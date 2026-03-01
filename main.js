const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs-extra");
const axios = require("axios");
const AdmZip = require("adm-zip");
const { autoUpdater } = require("electron-updater");

const baseDir = path.join(app.getPath("appData"), "StormGamesStudios/Programs/Modpack Installer");
const downloadsDir = path.join(baseDir, "downloads");
const versionsDir = path.join(baseDir, "instance-versions");
const mcDir = path.join(app.getPath("appData"), ".minecraft");
const mcVersions = path.join(mcDir, "versions");
const profilesPath = path.join(mcDir, "launcher_profiles.json");

let instances;

function ensureDirs() {
  fs.ensureDirSync(downloadsDir);
  fs.ensureDirSync(versionsDir);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });

  win.loadFile("renderer/index.html");
}

app.whenReady().then(() => {
  ensureDirs();
  instances = require("./instances.json");
  createWindow();
  autoUpdater.checkForUpdatesAndNotify();
});

async function downloadFile(url, dest) {
  const res = await axios({ url, method: "GET", responseType: "arraybuffer" });
  fs.writeFileSync(dest, res.data);
}

async function checkVersion(name, data) {
  const localFile = path.join(versionsDir, name + ".txt");
  const remote = (await axios.get(data.version)).data.trim();

  if (!fs.existsSync(localFile)) return "not-installed";

  const local = fs.readFileSync(localFile, "utf8").trim();
  return local === remote ? "latest" : "update";
}

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
  const zipPath = path.join(downloadsDir, name + ".zip");

  await downloadFile(data.download, zipPath);

  const zip = new AdmZip(zipPath);
  zip.extractAllTo(path.join(mcVersions, name), true);

  fs.removeSync(zipPath);

  const versionText = (await axios.get(data.version)).data.trim();
  fs.writeFileSync(path.join(versionsDir, name + ".txt"), versionText);

  registerProfile(name, data.loader);

  return true;
});

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