const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

const isDev = process.env.QUIETMARK_DEV === "1";
const appName = "QuietMark";
const markdownExtensions = new Set([".md", ".markdown", ".mdown"]);

let mainWindow;
let rendererReady = false;
let pendingFilePaths = [];
let flushingFileOpens = false;

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
}

app.on("second-instance", (_event, argv) => {
  if (!mainWindow) {
    return;
  }

  const filePath = argv.find((arg) => /\.(md|markdown|mdown|txt)$/i.test(arg));
  if (filePath) {
    queueFileOpen(filePath);
  } else {
    focusMainWindow();
  }
});

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

function queueFileOpen(filePath) {
  if (!filePath) {
    return;
  }

  pendingFilePaths.push(filePath);
  focusMainWindow();
  flushPendingFileOpens();
}

async function flushPendingFileOpens() {
  if (flushingFileOpens || !rendererReady || !mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  flushingFileOpens = true;
  try {
    while (pendingFilePaths.length > 0 && rendererReady && mainWindow && !mainWindow.isDestroyed()) {
      const filePath = pendingFilePaths.shift();
      try {
        await openFile(filePath);
      } catch (error) {
        dialog.showErrorBox("Unable to open file", `${filePath}\n\n${error.message}`);
      }
    }
  } finally {
    flushingFileOpens = false;
  }
}

async function createWindow() {
  rendererReady = false;
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 820,
    minHeight: 580,
    title: appName,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 18 },
    backgroundColor: "#f7f3eb",
    vibrancy: "sidebar",
    visualEffectState: "active",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    rendererReady = false;
  });

  if (isDev) {
    await mainWindow.loadURL("http://127.0.0.1:5173");
  } else {
    await mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

async function listMarkdownFiles(directory) {
  if (!directory) {
    return [];
  }

  let entries = [];
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = (
    await Promise.all(
      entries
        .filter((entry) => entry.isFile() && markdownExtensions.has(path.extname(entry.name).toLowerCase()))
        .map(async (entry) => {
          const filePath = path.join(directory, entry.name);
          try {
            const stats = await fs.stat(filePath);
            return {
              path: filePath,
              name: entry.name,
              directory,
              modifiedAt: stats.mtimeMs
            };
          } catch {
            return null;
          }
        })
    )
  ).filter(Boolean);

  return files.sort((left, right) =>
    left.name.localeCompare(right.name, undefined, {
      numeric: true,
      sensitivity: "base"
    })
  );
}

async function createFilePayload(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  const { base, dir } = path.parse(filePath);
  return {
    path: filePath,
    name: base,
    directory: dir,
    content,
    folderFiles: await listMarkdownFiles(dir)
  };
}

function applyOpenedFileState(payload) {
  app.addRecentDocument(payload.path);
  if (mainWindow) {
    mainWindow.setRepresentedFilename(payload.path);
    mainWindow.setTitle(`${payload.name} - ${appName}`);
  }
}

async function openFile(filePath, { notify = true } = {}) {
  const payload = await createFilePayload(filePath);
  if (notify) {
    send("file-opened", payload);
  }
  applyOpenedFileState(payload);
  return payload;
}

async function openDialog() {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [
      { name: "Markdown", extensions: ["md", "markdown", "mdown", "txt"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });

  if (!result.canceled && result.filePaths[0]) {
    queueFileOpen(result.filePaths[0]);
  }
}

async function saveFile({ filePath, content }) {
  let targetPath = filePath;

  if (!targetPath) {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: "Untitled.md",
      filters: [
        { name: "Markdown", extensions: ["md"] },
        { name: "Text", extensions: ["txt"] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    targetPath = result.filePath;
  }

  await fs.writeFile(targetPath, content, "utf8");
  const { base, dir } = path.parse(targetPath);
  app.addRecentDocument(targetPath);
  if (mainWindow) {
    mainWindow.setDocumentEdited(false);
    mainWindow.setRepresentedFilename(targetPath);
    mainWindow.setTitle(`${base} - ${appName}`);
  }

  return {
    canceled: false,
    path: targetPath,
    name: base,
    directory: dir,
    folderFiles: await listMarkdownFiles(dir)
  };
}

async function exportHtml({ html, title }) {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `${title || "Document"}.html`,
    filters: [{ name: "HTML", extensions: ["html"] }]
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  await fs.writeFile(result.filePath, html, "utf8");
  return { canceled: false, path: result.filePath };
}

function buildMenu() {
  const template = [
    {
      label: appName,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" }
      ]
    },
    {
      label: "File",
      submenu: [
        {
          label: "New",
          accelerator: "CmdOrCtrl+N",
          click: () => send("menu-command", "new")
        },
        {
          label: "Open...",
          accelerator: "CmdOrCtrl+O",
          click: openDialog
        },
        { type: "separator" },
        {
          label: "Save",
          accelerator: "CmdOrCtrl+S",
          click: () => send("menu-command", "save")
        },
        {
          label: "Save As...",
          accelerator: "Shift+CmdOrCtrl+S",
          click: () => send("menu-command", "save-as")
        },
        { type: "separator" },
        {
          label: "Export HTML...",
          accelerator: "Option+CmdOrCtrl+E",
          click: () => send("menu-command", "export-html")
        },
        { type: "separator" },
        { role: "close" }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
        { type: "separator" },
        {
          label: "Find",
          accelerator: "CmdOrCtrl+F",
          click: () => send("menu-command", "find")
        }
      ]
    },
    {
      label: "View",
      submenu: [
        {
          label: "Toggle Outline",
          accelerator: "CmdOrCtrl+1",
          click: () => send("menu-command", "toggle-outline")
        },
        {
          label: "Toggle Source Mode",
          accelerator: "CmdOrCtrl+/",
          click: () => send("menu-command", "toggle-source")
        },
        {
          label: "Focus Mode",
          accelerator: "CmdOrCtrl+.",
          click: () => send("menu-command", "toggle-focus")
        },
        { type: "separator" },
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { type: "separator" },
        { role: "front" }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.handle("open-file", openDialog);
ipcMain.handle("open-file-path", (_event, filePath) => {
  if (!filePath) {
    return null;
  }
  return openFile(filePath, { notify: false });
});
ipcMain.handle("save-file", (_event, payload) => saveFile(payload));
ipcMain.handle("export-html", (_event, payload) => exportHtml(payload));
ipcMain.handle("set-edited", (_event, edited) => {
  if (mainWindow) {
    mainWindow.setDocumentEdited(Boolean(edited));
  }
});
ipcMain.handle("renderer-ready", () => {
  rendererReady = true;
  flushPendingFileOpens();
});
ipcMain.handle("show-item", (_event, filePath) => {
  if (filePath) {
    shell.showItemInFolder(filePath);
  }
});

app.whenReady().then(async () => {
  app.setName(appName);
  buildMenu();
  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("open-file", (event, filePath) => {
  event.preventDefault();
  queueFileOpen(filePath);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
