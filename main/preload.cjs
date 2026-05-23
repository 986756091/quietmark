const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("quietMark", {
  openFile: () => ipcRenderer.invoke("open-file"),
  openFilePath: (filePath) => ipcRenderer.invoke("open-file-path", filePath),
  saveFile: (payload) => ipcRenderer.invoke("save-file", payload),
  exportHtml: (payload) => ipcRenderer.invoke("export-html", payload),
  setEdited: (edited) => ipcRenderer.invoke("set-edited", edited),
  rendererReady: () => ipcRenderer.invoke("renderer-ready"),
  showItem: (filePath) => ipcRenderer.invoke("show-item", filePath),
  onFileOpened: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("file-opened", listener);
    return () => ipcRenderer.removeListener("file-opened", listener);
  },
  onMenuCommand: (callback) => {
    const listener = (_event, command) => callback(command);
    ipcRenderer.on("menu-command", listener);
    return () => ipcRenderer.removeListener("menu-command", listener);
  }
});
