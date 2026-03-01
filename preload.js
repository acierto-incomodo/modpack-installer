const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  getInstances: () => ipcRenderer.invoke("getInstances"),
  install: (name) => ipcRenderer.invoke("install", name),
  delete: (name) => ipcRenderer.invoke("delete", name),
  openFolder: (name) => ipcRenderer.invoke("openFolder", name),
  launch: () => ipcRenderer.invoke("launch")
});