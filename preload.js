const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getInstances: () => ipcRenderer.invoke("getInstances"),
  install: (name) => ipcRenderer.invoke("install", name),
  delete: (name) => ipcRenderer.invoke("delete", name),
  openFolder: (name) => ipcRenderer.invoke("openFolder", name),
  launch: () => ipcRenderer.invoke("launch"),
  launchStorm: () => ipcRenderer.invoke("launchStorm"),
  launchCompatibility: () => ipcRenderer.invoke("launchCompatibility"),
  checkUpdates: () => ipcRenderer.invoke("check-updates"),
  getStrings: () => ipcRenderer.invoke("get-strings"),
  getSettings: () => ipcRenderer.invoke("get-settings"),
  setSettings: (settings) => ipcRenderer.invoke("set-settings", settings),
  showSaveDialog: () => ipcRenderer.invoke("show-save-dialog"),
  onLockUi: (callback) => ipcRenderer.on("lock-ui", callback),
  onUnlockUi: (callback) => ipcRenderer.on("unlock-ui", callback)
});