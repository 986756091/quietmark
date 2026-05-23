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
let currentLanguage = "en";

const i18n = {
  en: {
    error: {
      unableToOpenFile: "Unable to open file"
    },
    dialogs: {
      untitled: "Untitled.md",
      document: "Document",
      markdown: "Markdown",
      allFiles: "All Files",
      text: "Text",
      html: "HTML"
    },
    menu: {
      about: `About ${appName}`,
      services: "Services",
      hide: `Hide ${appName}`,
      hideOthers: "Hide Others",
      unhide: "Show All",
      quit: `Quit ${appName}`,
      file: "File",
      new: "New",
      open: "Open...",
      save: "Save",
      saveAs: "Save As...",
      exportHtml: "Export HTML...",
      close: "Close",
      edit: "Edit",
      undo: "Undo",
      redo: "Redo",
      cut: "Cut",
      copy: "Copy",
      paste: "Paste",
      selectAll: "Select All",
      find: "Find",
      view: "View",
      toggleOutline: "Toggle Sidebar",
      toggleSourceMode: "Toggle Source Mode",
      focusMode: "Focus Mode",
      reload: "Reload",
      toggleDevTools: "Toggle Developer Tools",
      toggleFullScreen: "Toggle Full Screen",
      window: "Window",
      minimize: "Minimize",
      zoom: "Zoom",
      front: "Bring All to Front"
    }
  },
  zh: {
    error: {
      unableToOpenFile: "无法打开文件"
    },
    dialogs: {
      untitled: "未命名.md",
      document: "文档",
      markdown: "Markdown",
      allFiles: "所有文件",
      text: "文本",
      html: "HTML"
    },
    menu: {
      about: `关于 ${appName}`,
      services: "服务",
      hide: `隐藏 ${appName}`,
      hideOthers: "隐藏其他",
      unhide: "全部显示",
      quit: `退出 ${appName}`,
      file: "文件",
      new: "新建",
      open: "打开...",
      save: "保存",
      saveAs: "另存为...",
      exportHtml: "导出 HTML...",
      close: "关闭",
      edit: "编辑",
      undo: "撤销",
      redo: "重做",
      cut: "剪切",
      copy: "复制",
      paste: "粘贴",
      selectAll: "全选",
      find: "查找",
      view: "视图",
      toggleOutline: "显示/隐藏侧边栏",
      toggleSourceMode: "切换源码模式",
      focusMode: "专注模式",
      reload: "重新载入",
      toggleDevTools: "切换开发者工具",
      toggleFullScreen: "切换全屏",
      window: "窗口",
      minimize: "最小化",
      zoom: "缩放",
      front: "全部置于顶层"
    }
  }
};

function normalizeLanguage(language) {
  return String(language || "").toLowerCase().startsWith("zh") ? "zh" : "en";
}

function t() {
  return i18n[currentLanguage] || i18n.en;
}

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
        dialog.showErrorBox(t().error.unableToOpenFile, `${filePath}\n\n${error.message}`);
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
  const labels = t().dialogs;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [
      { name: labels.markdown, extensions: ["md", "markdown", "mdown", "txt"] },
      { name: labels.allFiles, extensions: ["*"] }
    ]
  });

  if (!result.canceled && result.filePaths[0]) {
    queueFileOpen(result.filePaths[0]);
  }
}

async function saveFile({ filePath, content }) {
  let targetPath = filePath;

  if (!targetPath) {
    const labels = t().dialogs;
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: labels.untitled,
      filters: [
        { name: labels.markdown, extensions: ["md"] },
        { name: labels.text, extensions: ["txt"] }
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
  const labels = t().dialogs;
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `${title || labels.document}.html`,
    filters: [{ name: labels.html, extensions: ["html"] }]
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  await fs.writeFile(result.filePath, html, "utf8");
  return { canceled: false, path: result.filePath };
}

function buildMenu() {
  const labels = t().menu;
  const template = [
    {
      label: appName,
      submenu: [
        { label: labels.about, role: "about" },
        { type: "separator" },
        { label: labels.services, role: "services" },
        { type: "separator" },
        { label: labels.hide, role: "hide" },
        { label: labels.hideOthers, role: "hideOthers" },
        { label: labels.unhide, role: "unhide" },
        { type: "separator" },
        { label: labels.quit, role: "quit" }
      ]
    },
    {
      label: labels.file,
      submenu: [
        {
          label: labels.new,
          accelerator: "CmdOrCtrl+N",
          click: () => send("menu-command", "new")
        },
        {
          label: labels.open,
          accelerator: "CmdOrCtrl+O",
          click: openDialog
        },
        { type: "separator" },
        {
          label: labels.save,
          accelerator: "CmdOrCtrl+S",
          click: () => send("menu-command", "save")
        },
        {
          label: labels.saveAs,
          accelerator: "Shift+CmdOrCtrl+S",
          click: () => send("menu-command", "save-as")
        },
        { type: "separator" },
        {
          label: labels.exportHtml,
          accelerator: "Option+CmdOrCtrl+E",
          click: () => send("menu-command", "export-html")
        },
        { type: "separator" },
        { label: labels.close, role: "close" }
      ]
    },
    {
      label: labels.edit,
      submenu: [
        { label: labels.undo, role: "undo" },
        { label: labels.redo, role: "redo" },
        { type: "separator" },
        { label: labels.cut, role: "cut" },
        { label: labels.copy, role: "copy" },
        { label: labels.paste, role: "paste" },
        { label: labels.selectAll, role: "selectAll" },
        { type: "separator" },
        {
          label: labels.find,
          accelerator: "CmdOrCtrl+F",
          click: () => send("menu-command", "find")
        }
      ]
    },
    {
      label: labels.view,
      submenu: [
        {
          label: labels.toggleOutline,
          accelerator: "CmdOrCtrl+1",
          click: () => send("menu-command", "toggle-outline")
        },
        {
          label: labels.toggleSourceMode,
          accelerator: "CmdOrCtrl+/",
          click: () => send("menu-command", "toggle-source")
        },
        {
          label: labels.focusMode,
          accelerator: "CmdOrCtrl+.",
          click: () => send("menu-command", "toggle-focus")
        },
        { type: "separator" },
        { label: labels.reload, role: "reload" },
        { label: labels.toggleDevTools, role: "toggleDevTools" },
        { type: "separator" },
        { label: labels.toggleFullScreen, role: "togglefullscreen" }
      ]
    },
    {
      label: labels.window,
      submenu: [
        { label: labels.minimize, role: "minimize" },
        { label: labels.zoom, role: "zoom" },
        { type: "separator" },
        { label: labels.front, role: "front" }
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
ipcMain.handle("set-language", (_event, language) => {
  const nextLanguage = normalizeLanguage(language);
  if (nextLanguage !== currentLanguage) {
    currentLanguage = nextLanguage;
    buildMenu();
  }
  return currentLanguage;
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
