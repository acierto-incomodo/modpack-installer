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

async function downloadFile(url, dest) {
  const res = await axios({ url, method: "GET", responseType: "arraybuffer" });
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
  await downloadFile(data.download, zipPath);

  const zip = new AdmZip(zipPath);
  zip.extractAllTo(path.join(mcVersions, name), true);

  fs.removeSync(zipPath);

  // Guardar versión
  const versionText = (await axios.get(data.version)).data.trim();
  fs.writeFileSync(path.join(versionsDir, name + ".txt"), versionText);

  registerProfile(name, data.loader);

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
  shell.openPath("C:\\Program Files (x86)\\Minecraft Launcher\\MinecraftLauncher.exe");
});

// -----------------------------
// Actualizaciones con electron-updater
// -----------------------------
ipcMain.handle("check-updates", () => {
  autoUpdater.checkForUpdates();
});

autoUpdater.autoDownload = true;

autoUpdater.on("update-available", (info) => {
  dialog.showMessageBoxSync({
    type: "info",
    title: "Actualización disponible",
    message: `Nueva versión disponible: ${info.version}. Descargando automáticamente...`
  });
});

autoUpdater.on("download-progress", (progressObj) => {
  if (mainWindow) {
    mainWindow.setProgressBar(progressObj.percent / 100);
  }
});

autoUpdater.on("update-not-available", () => {
  dialog.showMessageBoxSync({
    type: "info",
    title: "Sin actualizaciones",
    message: "Tu programa ya está actualizado ✅"
  });
});

autoUpdater.on("update-downloaded", () => {
  if (mainWindow) {
    mainWindow.setProgressBar(-1);
  }
  dialog.showMessageBoxSync({
    type: "info",
    title: "Actualización lista",
    message: "Se ha descargado la actualización. La aplicación se reiniciará para instalarla."
  });

  autoUpdater.quitAndInstall();
});