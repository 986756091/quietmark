export const LANGUAGE_STORAGE_KEY = "quietmark-language";

const englishSample = `# QuietMark

A focused Markdown desk for long notes, drafts, and technical writing.

## What is ready

- Live Markdown rendering with GitHub-style tables and task lists
- Source and reading modes
- File open, save, save as, and HTML export from the macOS menu
- Document outline, word count, focus mode, and paper/dark themes

## A small table

| Mode | Best for |
| --- | --- |
| Write | Drafting while seeing rendered Markdown nearby |
| Read | Reviewing the document without editing chrome |
| Source | Precise Markdown changes |

## Code

\`\`\`js
function settleIntoThePage(markdown) {
  return markdown.trim();
}
\`\`\`

> Quiet software should make room for the document, not fight it for attention.
`;

const chineseSample = `# QuietMark

一个安静的 Markdown 写作桌面，适合长笔记、草稿和技术文档。

## 已就绪

- 写作时即时渲染 Markdown，支持表格和任务列表
- 即时、富文本、源码和阅读模式
- 通过 macOS 菜单打开、保存、另存为并导出 HTML
- 文档大纲、字数统计、专注模式以及纸张/深色主题

## 一个小表格

| 模式 | 适合 |
| --- | --- |
| 写作 | 边写边查看渲染效果 |
| 阅读 | 隐去编辑界面，专心审阅文档 |
| 源码 | 精确调整 Markdown 原文 |

## 代码

\`\`\`js
function settleIntoThePage(markdown) {
  return markdown.trim();
}
\`\`\`

> 安静的软件应该把空间留给文档，而不是和文档争夺注意力。
`;

export const translations = {
  en: {
    code: "en",
    htmlLang: "en",
    vditorLang: "en_US",
    language: {
      name: "English",
      nextShort: "中文",
      switch: "Switch to Chinese"
    },
    file: {
      untitledName: "Untitled.md",
      localDraft: "Local draft",
      noFolder: "No folder",
      openMarkdown: "Open a Markdown file",
      newDocumentContent: "# Untitled\n\nStart writing.",
      sampleMarkdown: englishSample
    },
    actions: {
      new: "New",
      open: "Open",
      save: "Save",
      exportHtml: "Export HTML",
      closeSidebar: "Close sidebar",
      showSidebar: "Show sidebar",
      focusMode: "Focus mode",
      toggleTheme: "Toggle theme",
      clearFilter: "Clear filter",
      collapseFiles: "Collapse files",
      expandFiles: "Expand files",
      collapseOutline: "Collapse outline",
      expandOutline: "Expand outline"
    },
    sidebar: {
      files: "Files",
      outline: "Outline",
      markdownFiles: "Markdown files",
      filterHeadings: "Filter headings",
      noHeadings: "No headings"
    },
    editor: {
      mode: "Editor mode",
      placeholder: "Start writing...",
      sourceAria: "Markdown source editor"
    },
    modes: {
      instant: "Instant",
      rich: "Rich",
      source: "Source",
      read: "Read",
      wysiwyg: "WYSIWYG"
    },
    theme: {
      paper: "Paper",
      dark: "Dark"
    },
    status: {
      words: (count) => `${count} ${count === 1 ? "word" : "words"}`,
      characters: (count) => `${count} ${count === 1 ? "char" : "chars"}`,
      readingMinutes: (count) => `${count} min read`,
      saved: "Saved",
      unsaved: "Unsaved",
      unsavedChanges: "Unsaved changes"
    },
    toasts: {
      saved: "Saved",
      saveDraftBeforeSwitch: "Save the current draft before switching",
      opened: (name) => `Opened ${name}`,
      htmlExported: "HTML exported"
    }
  },
  zh: {
    code: "zh",
    htmlLang: "zh-CN",
    vditorLang: "zh_CN",
    language: {
      name: "简体中文",
      nextShort: "EN",
      switch: "切换到英文"
    },
    file: {
      untitledName: "未命名.md",
      localDraft: "本地草稿",
      noFolder: "无文件夹",
      openMarkdown: "打开 Markdown 文件",
      newDocumentContent: "# 未命名\n\n开始写作。",
      sampleMarkdown: chineseSample
    },
    actions: {
      new: "新建",
      open: "打开",
      save: "保存",
      exportHtml: "导出 HTML",
      closeSidebar: "关闭侧边栏",
      showSidebar: "显示侧边栏",
      focusMode: "专注模式",
      toggleTheme: "切换主题",
      clearFilter: "清除筛选",
      collapseFiles: "折叠文件",
      expandFiles: "展开文件",
      collapseOutline: "折叠大纲",
      expandOutline: "展开大纲"
    },
    sidebar: {
      files: "文件",
      outline: "大纲",
      markdownFiles: "Markdown 文件",
      filterHeadings: "筛选标题",
      noHeadings: "暂无标题"
    },
    editor: {
      mode: "编辑模式",
      placeholder: "开始写作...",
      sourceAria: "Markdown 源码编辑器"
    },
    modes: {
      instant: "即时",
      rich: "富文本",
      source: "源码",
      read: "阅读",
      wysiwyg: "所见即所得"
    },
    theme: {
      paper: "纸张",
      dark: "深色"
    },
    status: {
      words: (count) => `${count} 词`,
      characters: (count) => `${count} 字符`,
      readingMinutes: (count) => `${count} 分钟阅读`,
      saved: "已保存",
      unsaved: "未保存",
      unsavedChanges: "未保存的修改"
    },
    toasts: {
      saved: "已保存",
      saveDraftBeforeSwitch: "切换前请先保存当前草稿",
      opened: (name) => `已打开 ${name}`,
      htmlExported: "HTML 已导出"
    }
  }
};

export function normalizeLanguage(language) {
  return String(language || "").toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function detectLanguage() {
  if (typeof navigator === "undefined") {
    return "en";
  }
  return normalizeLanguage(navigator.language || navigator.userLanguage);
}

export function getStoredLanguage() {
  if (typeof localStorage === "undefined") {
    return detectLanguage();
  }

  return normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY) || detectLanguage());
}

export function getTranslation(language) {
  return translations[normalizeLanguage(language)] || translations.en;
}
