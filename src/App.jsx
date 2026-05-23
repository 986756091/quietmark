import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Vditor from "vditor";
import "vditor/dist/index.css";
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Download,
  FilePlus2,
  Files,
  FolderOpen,
  Focus,
  Languages,
  Moon,
  PanelLeft,
  PenLine,
  Save,
  Search,
  Sun,
  Type,
  Wand2,
  X
} from "lucide-react";
import "highlight.js/styles/github.css";
import "./styles.css";
import { buildExportHtml, documentTitle, extractOutline, renderMarkdown } from "./markdown.js";
import { getStoredLanguage, getTranslation, LANGUAGE_STORAGE_KEY } from "./i18n.js";

const api = window.quietMark;

function App() {
  const [language, setLanguage] = useState(getStoredLanguage);
  const t = useMemo(() => getTranslation(language), [language]);
  const [markdown, setMarkdown] = useState(() => t.file.sampleMarkdown);
  const [html, setHtml] = useState("");
  const [fileInfo, setFileInfo] = useState({
    path: null,
    name: t.file.untitledName,
    directory: ""
  });
  const [dirty, setDirty] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("quietmark-theme") || "paper");
  const [mode, setMode] = useState("instant");
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [folderFiles, setFolderFiles] = useState([]);
  const [filesPanelOpen, setFilesPanelOpen] = useState(true);
  const [outlinePanelOpen, setOutlinePanelOpen] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");

  const vditorHostRef = useRef(null);
  const vditorRef = useRef(null);
  const editorReadyRef = useRef(false);
  const sourceRef = useRef(null);
  const markdownRef = useRef(markdown);
  const editorBootingRef = useRef(false);

  const outline = useMemo(() => extractOutline(markdown), [markdown]);
  const stats = useMemo(() => getStats(markdown), [markdown]);
  const title = useMemo(
    () => documentTitle(markdown, fileInfo.name.replace(/\.[^.]+$/, "")),
    [markdown, fileInfo.name]
  );

  useEffect(() => {
    markdownRef.current = markdown;
  }, [markdown]);

  useEffect(() => {
    let live = true;
    renderMarkdown(markdown).then((nextHtml) => {
      if (live) {
        setHtml(nextHtml);
      }
    });
    return () => {
      live = false;
    };
  }, [markdown]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("quietmark-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = t.htmlLang;
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    api?.setLanguage(language);
  }, [language, t.htmlLang]);

  useEffect(() => {
    api?.setEdited(dirty);
  }, [dirty]);

  useEffect(() => {
    if (mode !== "instant" && mode !== "rich") {
      destroyEditor();
      return;
    }

    const host = vditorHostRef.current;
    if (!host) {
      return;
    }

    host.innerHTML = "";
    editorBootingRef.current = true;
    editorReadyRef.current = false;

    const editor = new Vditor(host, {
      value: markdownRef.current,
      mode: mode === "rich" ? "wysiwyg" : "ir",
      height: "100%",
      width: "100%",
      minHeight: 420,
      lang: t.vditorLang,
      cdn: "./vendor/vditor",
      theme: theme === "dark" ? "dark" : "classic",
      icon: "ant",
      typewriterMode: true,
      placeholder: t.editor.placeholder,
      cache: {
        enable: false
      },
      counter: {
        enable: false
      },
      toolbarConfig: {
        hide: true,
        pin: false
      },
      preview: {
        delay: 120,
        maxWidth: 860,
        mode: "editor",
        markdown: {
          codeBlockPreview: true,
          mathBlockPreview: true,
          sanitize: true,
          toc: true
        },
        hljs: {
          enable: true,
          style: theme === "dark" ? "github-dark" : "github"
        }
      },
      input(value) {
        markdownRef.current = value;
        setMarkdown(value);
        if (!editorBootingRef.current) {
          setDirty(true);
        }
      },
      after() {
        if (vditorRef.current !== editor) {
          return;
        }
        const currentValue = markdownRef.current;
        if (editor.getValue() !== currentValue) {
          editor.setValue(currentValue, true);
        }
        editorReadyRef.current = true;
        requestAnimationFrame(() => {
          editorBootingRef.current = false;
        });
        editor.focus();
      }
    });

    vditorRef.current = editor;

    return () => {
      editorBootingRef.current = false;
      editorReadyRef.current = false;
      if (vditorRef.current === editor) {
        vditorRef.current = null;
      }
      safeDestroy(editor);
    };
  }, [mode, theme, t.editor.placeholder, t.vditorLang]);

  useEffect(() => {
    if ((mode === "instant" || mode === "rich") && vditorRef.current && editorReadyRef.current) {
      const currentValue = vditorRef.current.getValue();
      if (currentValue !== markdown) {
        editorBootingRef.current = true;
        vditorRef.current.setValue(markdown, true);
        requestAnimationFrame(() => {
          editorBootingRef.current = false;
        });
      }
    }
  }, [markdown, mode]);

  const showToast = useCallback((message) => {
    setToast(message);
    window.clearTimeout(showToast.timeout);
    showToast.timeout = window.setTimeout(() => setToast(""), 2300);
  }, []);

  const readCurrentMarkdown = useCallback(() => {
    if ((mode === "instant" || mode === "rich") && vditorRef.current && editorReadyRef.current) {
      return vditorRef.current.getValue();
    }
    return markdownRef.current;
  }, [mode]);

  const destroyEditor = useCallback(() => {
    const editor = vditorRef.current;
    vditorRef.current = null;
    editorReadyRef.current = false;
    editorBootingRef.current = false;
    safeDestroy(editor);
  }, []);

  const replaceDocument = useCallback((nextMarkdown, nextInfo, markDirty = false) => {
    markdownRef.current = nextMarkdown;
    setMarkdown(nextMarkdown);
    if (nextInfo) {
      setFileInfo(nextInfo);
      setFolderFiles(nextInfo.folderFiles || []);
    }
    setDirty(markDirty);
  }, []);

  const newDocument = useCallback(() => {
    replaceDocument(t.file.newDocumentContent, {
      path: null,
      name: t.file.untitledName,
      directory: "",
      folderFiles: []
    });
    setMode("instant");
  }, [replaceDocument, t.file.newDocumentContent, t.file.untitledName]);

  const saveDocument = useCallback(
    async (forceSaveAs = false) => {
      const content = readCurrentMarkdown();
      const result = await api?.saveFile({
        filePath: forceSaveAs ? null : fileInfo.path,
        content
      });

      if (!result || result.canceled) {
        return;
      }

      replaceDocument(content, {
        path: result.path,
        name: result.name,
        directory: result.directory,
        folderFiles: result.folderFiles || []
      });
      showToast(t.toasts.saved);
      return result;
    },
    [fileInfo.path, readCurrentMarkdown, replaceDocument, showToast, t.toasts.saved]
  );

  const openDocument = useCallback(async () => {
    await api?.openFile();
  }, []);

  const openSidebarFile = useCallback(
    async (filePath) => {
      if (!filePath || filePath === fileInfo.path) {
        return;
      }

      if (dirty) {
        if (!fileInfo.path) {
          showToast(t.toasts.saveDraftBeforeSwitch);
          return;
        }
        const result = await saveDocument(false);
        if (!result || result.canceled) {
          return;
        }
      }

      const payload = await api?.openFilePath(filePath);
      if (!payload) {
        return;
      }

      replaceDocument(payload.content, {
        path: payload.path,
        name: payload.name,
        directory: payload.directory,
        folderFiles: payload.folderFiles || []
      });
      setQuery("");
      setMode("instant");
      showToast(t.toasts.opened(payload.name));
    },
    [dirty, fileInfo.path, replaceDocument, saveDocument, showToast, t.toasts]
  );

  const exportHtml = useCallback(async () => {
    const content = readCurrentMarkdown();
    const body = await renderMarkdown(content);
    const payload = buildExportHtml({ body, title, theme: theme === "dark" ? "dark" : "light" });
    const result = await api?.exportHtml({ html: payload, title });
    if (result && !result.canceled) {
      showToast(t.toasts.htmlExported);
    }
  }, [readCurrentMarkdown, showToast, theme, title, t.toasts.htmlExported]);

  useEffect(() => {
    const removeFile = api?.onFileOpened((payload) => {
      replaceDocument(payload.content, {
        path: payload.path,
        name: payload.name,
        directory: payload.directory,
        folderFiles: payload.folderFiles || []
      });
      setQuery("");
      setMode("instant");
      showToast(t.toasts.opened(payload.name));
    });

    const removeMenu = api?.onMenuCommand((command) => {
      if (command === "new") newDocument();
      if (command === "save") saveDocument(false);
      if (command === "save-as") saveDocument(true);
      if (command === "export-html") exportHtml();
      if (command === "toggle-outline") setOutlineOpen((value) => !value);
      if (command === "toggle-source") setMode((value) => (value === "source" ? "instant" : "source"));
      if (command === "toggle-focus") setFocusMode((value) => !value);
      if (command === "find") {
        setQuery("");
        requestAnimationFrame(() => document.querySelector(".search-input")?.focus());
      }
    });

    api?.rendererReady();

    return () => {
      removeFile?.();
      removeMenu?.();
    };
  }, [exportHtml, newDocument, replaceDocument, saveDocument, showToast, t.toasts]);

  const updateMarkdown = (value) => {
    markdownRef.current = value;
    setMarkdown(value);
    setDirty(true);
  };

  const selectHeadingInSource = useCallback(
    (item) => {
      const source = sourceRef.current;
      if (!source) {
        return;
      }
      const lines = markdownRef.current.split(/\r?\n/);
      const position = lines.slice(0, item.line).join("\n").length + (item.line > 0 ? 1 : 0);
      source.focus();
      source.setSelectionRange(position, position);
      source.scrollTop = Math.max(0, item.line * 28 - source.clientHeight * 0.25);
    },
    []
  );

  const goToHeading = (item) => {
    setMode("source");
    requestAnimationFrame(() => selectHeadingInSource(item));
  };

  const filteredOutline = outline.filter((item) =>
    item.title.toLowerCase().includes(query.trim().toLowerCase())
  );
  const sidebarVisible = outlineOpen && !focusMode;
  const activeFolderName = fileInfo.directory ? fileInfo.directory.split(/[\\/]/).filter(Boolean).pop() : "";
  const switchLanguage = useCallback(() => {
    setLanguage((value) => (value === "zh" ? "en" : "zh"));
  }, []);

  return (
    <div className={`app-shell ${sidebarVisible ? "has-sidebar" : ""} ${focusMode ? "is-focus" : ""}`}>
      <header className="topbar">
        <div className="window-drag" />
        <div className="document-meta">
          <div className="document-title">
            {dirty && <span className="dirty-dot" aria-label={t.status.unsavedChanges} />}
            <span>{fileInfo.name}</span>
          </div>
          <button
            className="path-button"
            type="button"
            onClick={() => api?.showItem(fileInfo.path)}
            disabled={!fileInfo.path}
          >
            {fileInfo.directory || t.file.localDraft}
          </button>
        </div>

        <div className="toolbar">
          <IconButton title={t.actions.new} onClick={newDocument}>
            <FilePlus2 />
          </IconButton>
          <IconButton title={t.actions.open} onClick={openDocument}>
            <FolderOpen />
          </IconButton>
          <IconButton title={t.actions.save} onClick={() => saveDocument(false)}>
            <Save />
          </IconButton>
          <IconButton title={t.actions.exportHtml} onClick={exportHtml}>
            <Download />
          </IconButton>
        </div>
      </header>

      <main className="workspace">
        {sidebarVisible && (
          <aside
            className={`side-pane ${filesPanelOpen ? "" : "files-collapsed"} ${
              outlinePanelOpen ? "" : "outline-collapsed"
            }`}
          >
            <div className={`side-section files-section ${filesPanelOpen ? "" : "is-collapsed"}`}>
              <div className="side-head">
                <button
                  type="button"
                  className="side-title-button"
                  title={filesPanelOpen ? t.actions.collapseFiles : t.actions.expandFiles}
                  aria-expanded={filesPanelOpen}
                  onClick={() => setFilesPanelOpen((value) => !value)}
                >
                  {filesPanelOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  <span>{t.sidebar.files}</span>
                  <span className="side-count">{folderFiles.length}</span>
                </button>
                <button type="button" title={t.actions.closeSidebar} onClick={() => setOutlineOpen(false)}>
                  <X size={16} />
                </button>
              </div>
              {filesPanelOpen && (
                <>
                  <div className="folder-label" title={fileInfo.directory || t.file.noFolder}>
                    {activeFolderName || t.file.noFolder}
                  </div>
                  <nav className="file-list scroll-list" aria-label={t.sidebar.markdownFiles}>
                    {folderFiles.length === 0 && <span className="empty-outline">{t.file.openMarkdown}</span>}
                    {folderFiles.map((file) => (
                      <button
                        type="button"
                        key={file.path}
                        className={`file-item ${file.path === fileInfo.path ? "is-active" : ""}`}
                        title={file.path}
                        onClick={() => openSidebarFile(file.path)}
                      >
                        <Files size={15} />
                        <span>{file.name}</span>
                      </button>
                    ))}
                  </nav>
                </>
              )}
            </div>

            <div className={`side-section outline-section ${outlinePanelOpen ? "" : "is-collapsed"}`}>
              <div className="side-head">
                <button
                  type="button"
                  className="side-title-button"
                  title={outlinePanelOpen ? t.actions.collapseOutline : t.actions.expandOutline}
                  aria-expanded={outlinePanelOpen}
                  onClick={() => setOutlinePanelOpen((value) => !value)}
                >
                  {outlinePanelOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  <span>{t.sidebar.outline}</span>
                  <span className="side-count">{outline.length}</span>
                </button>
                {outlinePanelOpen && (
                  <button type="button" title={t.actions.clearFilter} onClick={() => setQuery("")} disabled={!query}>
                    <X size={16} />
                  </button>
                )}
              </div>
              {outlinePanelOpen && (
                <>
                  <label className="search-box">
                    <Search size={15} />
                    <input
                      className="search-input"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder={t.sidebar.filterHeadings}
                    />
                  </label>
                  <nav className="outline-list scroll-list">
                    {filteredOutline.length === 0 && <span className="empty-outline">{t.sidebar.noHeadings}</span>}
                    {filteredOutline.map((item) => (
                      <button
                        type="button"
                        key={`${item.line}-${item.title}`}
                        className="outline-item"
                        style={{ paddingLeft: `${10 + (item.level - 1) * 14}px` }}
                        onClick={() => goToHeading(item)}
                      >
                        {item.title}
                      </button>
                    ))}
                  </nav>
                </>
              )}
            </div>
          </aside>
        )}

        <section className="editor-shell">
          <div className="control-strip">
            <div className="segmented" aria-label={t.editor.mode}>
              <Segment
                active={mode === "instant"}
                title={t.modes.instant}
                onClick={() => setMode("instant")}
                icon={<PenLine />}
              />
              <Segment
                active={mode === "rich"}
                title={t.modes.rich}
                onClick={() => setMode("rich")}
                icon={<Wand2 />}
              />
              <Segment
                active={mode === "source"}
                title={t.modes.source}
                onClick={() => setMode("source")}
                icon={<Code2 />}
              />
              <Segment
                active={mode === "read"}
                title={t.modes.read}
                onClick={() => setMode("read")}
                icon={<BookOpen />}
              />
            </div>

            <div className="strip-actions">
              {!outlineOpen && !focusMode && (
                <IconButton title={t.actions.showSidebar} onClick={() => setOutlineOpen(true)}>
                  <PanelLeft />
                </IconButton>
              )}
              <IconButton title={t.actions.focusMode} pressed={focusMode} onClick={() => setFocusMode((value) => !value)}>
                <Focus />
              </IconButton>
              <button type="button" className="language-toggle" onClick={switchLanguage} title={t.language.switch}>
                <Languages size={16} />
                <span>{t.language.nextShort}</span>
              </button>
              <button
                type="button"
                className="theme-toggle"
                onClick={() => setTheme((value) => (value === "dark" ? "paper" : "dark"))}
                title={t.actions.toggleTheme}
              >
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                <span>{theme === "dark" ? t.theme.paper : t.theme.dark}</span>
              </button>
            </div>
          </div>

          <div className={`writing-surface mode-${mode}`}>
            {(mode === "instant" || mode === "rich") && <div ref={vditorHostRef} className="vditor-host" />}
            {mode === "source" && (
              <textarea
                ref={sourceRef}
                className="markdown-editor"
                value={markdown}
                spellCheck="true"
                onChange={(event) => updateMarkdown(event.target.value)}
                aria-label={t.editor.sourceAria}
              />
            )}
            {mode === "read" && (
              <article
                className="markdown-preview"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            )}
          </div>
        </section>
      </main>

      <footer className="statusbar">
        <div className="status-group">
          <span>{t.status.words(stats.words)}</span>
          <span>{t.status.characters(stats.characters)}</span>
          <span>{t.status.readingMinutes(stats.readingMinutes)}</span>
        </div>
        <div className="status-group">
          <Type size={14} />
          <span>{modeLabel(mode, t)}</span>
          {dirty ? <span>{t.status.unsaved}</span> : <span><Check size={13} /> {t.status.saved}</span>}
        </div>
      </footer>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function safeDestroy(editor) {
  try {
    if (editor?.vditor?.element) {
      editor.destroy();
    }
  } catch {
    // Vditor may still be loading its async parser during hot reload or quick mode switches.
  }
}

function IconButton({ children, title, onClick, pressed = false }) {
  return (
    <button
      type="button"
      className={`icon-button ${pressed ? "is-pressed" : ""}`}
      title={title}
      aria-label={title}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {React.cloneElement(children, { size: 17, strokeWidth: 1.9 })}
    </button>
  );
}

function Segment({ active, title, onClick, icon }) {
  return (
    <button
      type="button"
      className={active ? "active" : ""}
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
    >
      {React.cloneElement(icon, { size: 16 })}
      <span>{title}</span>
    </button>
  );
}

function getStats(markdown) {
  const text = markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[[^\]]+]\([^)]*\)/g, "")
    .replace(/[#>*_\-[\]()|~]/g, " ")
    .trim();

  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const characters = text.replace(/\s/g, "").length;
  return {
    words,
    characters,
    readingMinutes: Math.max(1, Math.ceil(words / 220))
  };
}

function modeLabel(mode, t) {
  if (mode === "read") return t.modes.read;
  if (mode === "source") return t.modes.source;
  if (mode === "rich") return t.modes.wysiwyg;
  return t.modes.instant;
}

const rootElement = document.getElementById("root");

if (!window.__quietMarkRoot) {
  window.__quietMarkRoot = createRoot(rootElement);
}

window.__quietMarkRoot.render(<App />);
