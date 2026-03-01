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

let instances;
let mainWindow;

function ensureDirs() {
  fs.ensureDirSync(downloadsDir);
  fs.ensureDirSync(versionsDir);
}

function createWindow(file = "renderer/index.html") {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });

  mainWindow.loadFile(file);
}

app.whenReady().then(() => {
  ensureDirs();
  instances = require("./instances.json");
  createWindow();
});

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
  const installerPath = path.join(__dirname, "installers", `${loader}_installer.jar`);
  if (!fs.existsSync(installerPath)) {
    throw new Error(`No se encontró el instalador del loader: ${installerPath}`);
  }

  closeLauncher();
  execSync(`java -jar "${installerPath}" --installClient`, { stdio: "ignore" });
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
  const data = instances[name];

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

  const zip = new AdmZip(zipPath);
  zip.extractAllTo(path.join(mcVersions, name), true);

  fs.removeSync(zipPath);

  // Guardar versión
  const versionText = (await axios.get(data.version)).data.trim();
  fs.writeFileSync(path.join(versionsDir, name + ".txt"), versionText);

  registerProfile(name, data.loader);

  // Quitar barra de progreso al finalizar
  if (mainWindow) mainWindow.setProgressBar(-1);

  return true;
});

ipcMain.handle("delete", async (e, name) => {
  fs.removeSync(path.join(mcVersions, name));
  fs.removeSync(path.join(versionsDir, name + ".txt"));
  return true;
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

// -----------------------------
// Actualizaciones con electron-updater
// -----------------------------
ipcMain.handle("check-updates", () => {
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
    readyMsg: "Eguneratzea deskargatu da. Aplikazioa berrabiaraziko da instalatzeko."
  },
  es: {
    availableTitle: "Actualización disponible",
    availableMsg: (v) => `Nueva versión disponible: ${v}. Descargando automáticamente...`,
    noUpdateTitle: "Sin actualizaciones",
    noUpdateMsg: "Tu programa ya está actualizado ✅",
    readyTitle: "Actualización lista",
    readyMsg: "Se ha descargado la actualización. La aplicación se reiniciará para instalarla."
  },
  en: {
    availableTitle: "Update available",
    availableMsg: (v) => `New version available: ${v}. Downloading automatically...`,
    noUpdateTitle: "No updates",
    noUpdateMsg: "Your program is up to date ✅",
    readyTitle: "Update ready",
    readyMsg: "Update downloaded. The application will restart to install it."
  }
};

function getMessages() {
  const locale = app.getLocale() || "en";
  if (locale.startsWith("eu")) return i18n.eu;
  if (locale.startsWith("es")) return i18n.es;
  return i18n.en;
}

autoUpdater.on("update-available", (info) => {
  const msgs = getMessages();
  dialog.showMessageBox({
    type: "info",
    title: msgs.availableTitle,
    message: msgs.availableMsg(info.version)
  });
});

autoUpdater.on("download-progress", (progressObj) => {
  if (mainWindow) {
    // mode: 'normal' usa el color estándar (Verde o el color de acento de Windows)
    mainWindow.setProgressBar(progressObj.percent / 100, { mode: "normal" });
  }
});

autoUpdater.on("update-not-available", () => {
  const msgs = getMessages();
  dialog.showMessageBoxSync({
    type: "info",
    title: msgs.noUpdateTitle,
    message: msgs.noUpdateMsg
  });
});

autoUpdater.on("update-downloaded", () => {
  if (mainWindow) {
    mainWindow.setProgressBar(-1);
  }
  const msgs = getMessages();
  dialog.showMessageBoxSync({
    type: "info",
    title: msgs.readyTitle,
    message: msgs.readyMsg
  });

  autoUpdater.quitAndInstall();
});