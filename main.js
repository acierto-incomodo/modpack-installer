const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs-extra");
const axios = require("axios");
const AdmZip = require("adm-zip");
const { autoUpdater } = require("electron-updater");
const { execSync } = require("child_process");

const baseDir = path.join(app.getPath("appData"), "StormGamesStudios/Programs/Modpack Installer");
const downloadsDir = path.join(baseDir, "downloads");
const versionsDir = path.join(baseDir, "instance-versions");
const mcDir = path.join(app.getPath("appData"), ".minecraft");
const mcVersions = path.join(mcDir, "versions");
const profilesPath = path.join(mcDir, "launcher_profiles.json");
const configPath = path.join(__dirname, "config.json");

let instances;
let mainWindow;
let isBusy = false;

function setBusy(busy) {
  isBusy = busy;
  if (mainWindow) {
    mainWindow.webContents.send(busy ? "lock-ui" : "unlock-ui");
  }
  // Evitar que autoUpdater inicie descargas si estamos ocupados
  autoUpdater.autoDownload = !busy;
}

// Configuración por defecto
let currentConfig = { language: "auto", theme: "auto" };

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      currentConfig = fs.readJsonSync(configPath);
    } else {
      fs.writeJsonSync(configPath, currentConfig);
    }
  } catch (e) {
    console.error("Error loading config:", e);
  }
}

function ensureDirs() {
  fs.ensureDirSync(downloadsDir);
  fs.ensureDirSync(versionsDir);
}

function createWindow(file = "renderer/index.html") {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 770,
    minWidth: 500,
    minHeight: 770,
    icon: path.join(__dirname, "assets/icons/logo.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });

  mainWindow.removeMenu();

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.control && input.shift && input.key.toLowerCase() === "i") {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.loadFile(file);
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    ensureDirs();
    loadConfig();
    instances = require("./instances.json");
    createWindow();
    autoUpdater.checkForUpdates().catch(() => {});
  });
}

// -----------------------------
// Funciones utilitarias
// -----------------------------

async function downloadFile(url, dest, onProgress) {
  const res = await axios({
    url,
    method: "GET",
    responseType: "arraybuffer",
    onDownloadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percent = progressEvent.loaded / progressEvent.total;
        onProgress(percent);
      }
    }
  });
  fs.writeFileSync(dest, res.data);
}

function loaderExists(loader) {
  const loaderPath = path.join(mcVersions, loader);
  return fs.existsSync(loaderPath);
}

function closeLauncher() {
  try {
    execSync('taskkill /IM MinecraftLauncher.exe /F');
  } catch {}
}

async function installLoader(loader) {
  let installerPath = path.join(__dirname, "installers", `${loader}_installer.jar`);
  let javaPath = path.join(__dirname, "installers", "jdk-25.0.2", "bin", "javaw.exe");

  if (app.isPackaged) {
    installerPath = installerPath.replace("app.asar", "app.asar.unpacked");
    javaPath = javaPath.replace("app.asar", "app.asar.unpacked");
  }

  if (!fs.existsSync(installerPath)) {
    throw new Error(`No se encontró el instalador del loader: ${installerPath}`);
  }

  closeLauncher();
  execSync(`"${javaPath}" -jar "${installerPath}" --installClient`, { stdio: "ignore" });
}

async function checkVersion(name, data) {
  const localFile = path.join(versionsDir, name + ".txt");
  const remote = (await axios.get(data.version)).data.trim();

  if (!fs.existsSync(localFile)) return "not-installed";

  const local = fs.readFileSync(localFile, "utf8").trim();
  return local === remote ? "latest" : "update";
}

function registerProfile(name, loader) {
  const profiles = fs.existsSync(profilesPath)
    ? fs.readJsonSync(profilesPath)
    : { profiles: {} };

  profiles.profiles[name] = {
    name,
    type: "custom",
    lastVersionId: loader,
    gameDir: path.join(mcVersions, name),
    icon: "Grass"
  };

  fs.writeJsonSync(profilesPath, profiles, { spaces: 2 });
}

// -----------------------------
// IPC Main handlers
// -----------------------------

ipcMain.handle("getInstances", async () => {
  const results = [];
  for (const [name, data] of Object.entries(instances)) {
    const status = await checkVersion(name, data);
    results.push({ name, ...data, status });
  }
  return results;
});

ipcMain.handle("install", async (e, name) => {
  if (isBusy) return false;
  setBusy(true);

  try {
  const data = instances[name];
  const installPath = path.join(mcVersions, name);

  // Comprobar loader
  if (!loaderExists(data.loader)) {
    await installLoader(data.loader);
  }

  // Descargar ZIP del modpack
  const zipPath = path.join(downloadsDir, name + ".zip");
  
  // Descargar con barra de progreso (Modo Normal/Verde)
  await downloadFile(data.download, zipPath, (percent) => {
    if (mainWindow) mainWindow.setProgressBar(percent, { mode: "normal" });
  });

  // Limpiar carpeta preservando archivos específicos (Actualización/Reinstalación limpia)
  if (fs.existsSync(installPath)) {
    const files = fs.readdirSync(installPath);
    for (const file of files) {
      const isPreserved = 
        file === "options.txt" ||
        file === "server.dat" || 
        file === "servers.dat" || // Añadido por compatibilidad estándar
        file === "server.dat_old" ||
        file === "servers.dat_old" ||
        file === "servers.essential.dat" ||
        file === "patchouli_data.json" ||
        file === "emi.json" ||
        file === "saves" ||
        file === ".bobby" ||
        file === "xaero" ||
        file.startsWith("XaeroWaypoints_BACKUP");

      if (!isPreserved) {
        fs.removeSync(path.join(installPath, file));
      }
    }
  }

  const zip = new AdmZip(zipPath);
  const zipEntries = zip.getEntries();
  const totalEntries = zipEntries.length;

  // Descomprimir archivo por archivo para mostrar progreso
  for (let i = 0; i < totalEntries; i++) {
    const entry = zipEntries[i];
    zip.extractEntryTo(entry, installPath, true, true);

    // Actualizar barra de progreso
    if (mainWindow) {
      mainWindow.setProgressBar((i + 1) / totalEntries, { mode: "normal" });
    }

    // Ceder control al event loop cada 50 archivos para evitar congelamiento de la UI
    if (i % 50 === 0) await new Promise(resolve => setTimeout(resolve, 1));
  }

  fs.removeSync(zipPath);

  // Guardar versión
  const versionText = (await axios.get(data.version)).data.trim();
  fs.writeFileSync(path.join(versionsDir, name + ".txt"), versionText);

  registerProfile(name, data.loader);

  // Quitar barra de progreso al finalizar
  if (mainWindow) mainWindow.setProgressBar(-1);

  return true;
  } finally {
    setBusy(false);
  }
});

ipcMain.handle("delete", async (e, name) => {
  if (isBusy) return false;
  setBusy(true);
  try {
  fs.removeSync(path.join(mcVersions, name));
  fs.removeSync(path.join(versionsDir, name + ".txt"));
  return true;
  } finally {
    setBusy(false);
  }
});

ipcMain.handle("openFolder", async (e, name) => {
  shell.openPath(path.join(mcVersions, name));
});

ipcMain.handle("launch", async () => {
  let launcherPath = path.join(__dirname, "minecraftlauncher", "MinecraftInstaller.exe");

  if (app.isPackaged) {
    launcherPath = launcherPath.replace("app.asar", "app.asar.unpacked");
  }

  shell.openPath(launcherPath);
});

ipcMain.handle("launchStorm", async () => {
  shell.openExternal("https://stormstore.vercel.app/app/stormlauncher/run");
});

ipcMain.handle("launchCompatibility", async () => {
  let compatPath = path.join(__dirname, "compatibility", "compatibility.exe");

  if (app.isPackaged) {
    compatPath = compatPath.replace("app.asar", "app.asar.unpacked");
  }

  shell.openPath(compatPath);
});

// -----------------------------
// Actualizaciones con electron-updater
// -----------------------------
let isManualCheck = false;

ipcMain.handle("check-updates", () => {
  if (isBusy) return;
  isManualCheck = true;
  autoUpdater.checkForUpdates();
});

autoUpdater.autoDownload = true;

const i18n = {
  eu: {
    availableTitle: "Eguneratzea eskuragarri",
    availableMsg: (v) => `Bertsio berria eskuragarri: ${v}. Automatikoki deskargatzen...`,
    noUpdateTitle: "Eguneratzerik ez",
    noUpdateMsg: "Zure programa eguneratuta dago ✅",
    readyTitle: "Eguneratzea prest",
    readyMsg: "Eguneratzea deskargatu da. Aplikazioa berrabiaraziko da instalatzeko.",
    ui: {
      compatibilityExtras: "Bateragarritasun Gehigarriak",
      settings: "Ezarpenak",
      checkForUpdates: "Eguneratzeak Bilatu",
      install: "Instalatu",
      update: "Eguneratu",
      reinstall: "Berrinstalatu",
      delete: "Ezabatu",
      location: "Kokalekua",
      launchMinecraft: "Minecraft Abiarazi",
      launchStormLauncher: "StormLauncher Abiarazi",
      status: "Egoera: ",
      updateCenter: "Eguneratze Zentroa",
      settingsCenter: "Ezarpen Zentroa",
      checkUpdateText: "Sakatu botoia instalatzailearen bertsio berriak bilatzeko.",
      checkNow: "Egiaztatu orain",
      back: "Itzuli",
      checkingUpdates: "Eguneratzeak bilatzen...",
      language: "Hizkuntza",
      theme: "Gaia",
      auto: "Automatikoa",
      dark: "Iluna",
      light: "Argia",
      save: "Gorde",
      unsavedTitle: "Gorde gabeko aldaketak",
      unsavedMsg: "Aldaketak egin dituzu. Gorde nahi dituzu?",
      saveChanges: "Gorde",
      discardChanges: "Baztertu",
      cancel: "Utzi",
      madeBy: "StormGamesStudios-ek egindakoa"
    }
  },
  es: {
    availableTitle: "Actualización disponible",
    availableMsg: (v) => `Nueva versión disponible: ${v}. Descargando automáticamente...`,
    noUpdateTitle: "Sin actualizaciones",
    noUpdateMsg: "Tu programa ya está actualizado ✅",
    readyTitle: "Actualización lista",
    readyMsg: "Se ha descargado la actualización. La aplicación se reiniciará para instalarla.",
    ui: {
      compatibilityExtras: "Extras de Compatibilidad",
      settings: "Ajustes",
      checkForUpdates: "Buscar Actualizaciones",
      install: "Instalar",
      update: "Actualizar",
      reinstall: "Reinstalar",
      delete: "Eliminar",
      location: "Ubicación",
      launchMinecraft: "Iniciar Minecraft",
      launchStormLauncher: "Iniciar StormLauncher",
      status: "Estado: ",
      updateCenter: "Centro de Actualizaciones",
      settingsCenter: "Centro de Ajustes",
      checkUpdateText: "Pulsa el botón para buscar nuevas versiones del instalador.",
      checkNow: "Comprobar ahora",
      back: "Volver",
      checkingUpdates: "Buscando actualizaciones...",
      language: "Idioma",
      theme: "Tema",
      auto: "Automático",
      dark: "Oscuro",
      light: "Claro",
      save: "Guardar",
      unsavedTitle: "Cambios sin guardar",
      unsavedMsg: "Has realizado cambios. ¿Quieres guardarlos?",
      saveChanges: "Guardar",
      discardChanges: "Descartar",
      cancel: "Cancelar",
      madeBy: "Hecho por StormGamesStudios"
    }
  },
  en: {
    availableTitle: "Update available",
    availableMsg: (v) => `New version available: ${v}. Downloading automatically...`,
    noUpdateTitle: "No updates",
    noUpdateMsg: "Your program is up to date ✅",
    readyTitle: "Update ready",
    readyMsg: "Update downloaded. The application will restart to install it.",
    ui: {
      compatibilityExtras: "Compatibility Extras",
      settings: "Settings",
      checkForUpdates: "Check for Updates",
      install: "Install",
      update: "Update",
      reinstall: "Reinstall",
      delete: "Delete",
      location: "Location",
      launchMinecraft: "Launch Minecraft",
      launchStormLauncher: "Launch StormLauncher",
      status: "Status: ",
      updateCenter: "Update Center",
      settingsCenter: "Settings Center",
      checkUpdateText: "Press the button to check for new installer versions.",
      checkNow: "Check now",
      back: "Back",
      checkingUpdates: "Checking for updates...",
      language: "Language",
      theme: "Theme",
      auto: "Auto",
      dark: "Dark",
      light: "Light",
      save: "Save",
      unsavedTitle: "Unsaved changes",
      unsavedMsg: "You have made changes. Do you want to save them?",
      saveChanges: "Save",
      discardChanges: "Discard",
      cancel: "Cancel",
      madeBy: "Made by StormGamesStudios"
    }
  }
};

function getMessages() {
  let lang = currentConfig.language;
  
  if (lang === "auto") {
    const locale = app.getLocale() || "en";
    if (locale.startsWith("eu")) lang = "eu";
    else if (locale.startsWith("es")) lang = "es";
    else lang = "en";
  }

  if (lang === "eu") return i18n.eu;
  if (lang === "es") return i18n.es;
  return i18n.en;
}

ipcMain.handle("get-settings", () => currentConfig);
ipcMain.handle("set-settings", (e, newSettings) => {
  try {
    currentConfig = { ...currentConfig, ...newSettings };
    fs.writeJsonSync(configPath, currentConfig);
    return true;
  } catch (error) {
    console.error("Error saving settings:", error);
    throw error;
  }
});

ipcMain.handle("get-strings", () => {
  const msgs = getMessages();
  return msgs.ui;
});

ipcMain.handle("show-save-dialog", async () => {
  const msgs = getMessages().ui;
  const result = await dialog.showMessageBox(mainWindow, {
    type: "question",
    buttons: [msgs.saveChanges, msgs.discardChanges, msgs.cancel],
    defaultId: 0,
    cancelId: 2,
    title: msgs.unsavedTitle,
    message: msgs.unsavedMsg
  });
  return result.response; // 0: Save, 1: Discard, 2: Cancel
});

autoUpdater.on("update-available", (info) => {
  // Si no estamos ocupados, bloqueamos la UI para la descarga de la actualización
  if (!isBusy) {
    setBusy(true);
  }
});

autoUpdater.on("download-progress", (progressObj) => {
  if (mainWindow) {
    // mode: 'normal' usa el color estándar (Verde o el color de acento de Windows)
    mainWindow.setProgressBar(progressObj.percent / 100, { mode: "normal" });
  }
});

autoUpdater.on("update-not-available", () => {
  // Si falló o no hay, liberamos (si fue check manual o auto)
  if (isBusy && isManualCheck) setBusy(false);
  if (isManualCheck) {
    const msgs = getMessages();
    dialog.showMessageBoxSync({
      type: "info",
      title: msgs.noUpdateTitle,
      message: msgs.noUpdateMsg
    });
    isManualCheck = false;
  }
});

autoUpdater.on("error", () => {
  // En caso de error, liberar bloqueo
  if (isBusy) setBusy(false);
});

autoUpdater.on("update-downloaded", () => {
  if (mainWindow) {
    mainWindow.setProgressBar(-1);
  }
  // Instalar y reiniciar sin preguntar
  autoUpdater.quitAndInstall();
});