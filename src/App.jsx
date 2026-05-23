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
import { sampleMarkdown } from "./sample.js";

const api = window.quietMark;

function App() {
  const [markdown, setMarkdown] = useState(sampleMarkdown);
  const [html, setHtml] = useState("");
  const [fileInfo, setFileInfo] = useState({
    path: null,
    name: "Untitled.md",
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
      lang: "en_US",
      cdn: "./vendor/vditor",
      theme: theme === "dark" ? "dark" : "classic",
      icon: "ant",
      typewriterMode: true,
      placeholder: "Start writing...",
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
  }, [mode, theme]);

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
    replaceDocument("# Untitled\n\nStart writing.", {
      path: null,
      name: "Untitled.md",
      directory: "",
      folderFiles: []
    });
    setMode("instant");
  }, [replaceDocument]);

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
      showToast("Saved");
      return result;
    },
    [fileInfo.path, readCurrentMarkdown, replaceDocument, showToast]
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
          showToast("Save the current draft before switching");
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
      showToast(`Opened ${payload.name}`);
    },
    [dirty, fileInfo.path, replaceDocument, saveDocument, showToast]
  );

  const exportHtml = useCallback(async () => {
    const content = readCurrentMarkdown();
    const body = await renderMarkdown(content);
    const payload = buildExportHtml({ body, title, theme: theme === "dark" ? "dark" : "light" });
    const result = await api?.exportHtml({ html: payload, title });
    if (result && !result.canceled) {
      showToast("HTML exported");
    }
  }, [readCurrentMarkdown, showToast, theme, title]);

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
      showToast(`Opened ${payload.name}`);
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
  }, [exportHtml, newDocument, replaceDocument, saveDocument, showToast]);

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

  return (
    <div className={`app-shell ${sidebarVisible ? "has-sidebar" : ""} ${focusMode ? "is-focus" : ""}`}>
      <header className="topbar">
        <div className="window-drag" />
        <div className="document-meta">
          <div className="document-title">
            {dirty && <span className="dirty-dot" aria-label="Unsaved changes" />}
            <span>{fileInfo.name}</span>
          </div>
          <button
            className="path-button"
            type="button"
            onClick={() => api?.showItem(fileInfo.path)}
            disabled={!fileInfo.path}
          >
            {fileInfo.directory || "Local draft"}
          </button>
        </div>

        <div className="toolbar">
          <IconButton title="New" onClick={newDocument}>
            <FilePlus2 />
          </IconButton>
          <IconButton title="Open" onClick={openDocument}>
            <FolderOpen />
          </IconButton>
          <IconButton title="Save" onClick={() => saveDocument(false)}>
            <Save />
          </IconButton>
          <IconButton title="Export HTML" onClick={exportHtml}>
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
                  title={filesPanelOpen ? "Collapse files" : "Expand files"}
                  aria-expanded={filesPanelOpen}
                  onClick={() => setFilesPanelOpen((value) => !value)}
                >
                  {filesPanelOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  <span>Files</span>
                  <span className="side-count">{folderFiles.length}</span>
                </button>
                <button type="button" title="Close sidebar" onClick={() => setOutlineOpen(false)}>
                  <X size={16} />
                </button>
              </div>
              {filesPanelOpen && (
                <>
                  <div className="folder-label" title={fileInfo.directory || "No folder"}>
                    {activeFolderName || "No folder"}
                  </div>
                  <nav className="file-list scroll-list" aria-label="Markdown files">
                    {folderFiles.length === 0 && <span className="empty-outline">Open a Markdown file</span>}
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
                  title={outlinePanelOpen ? "Collapse outline" : "Expand outline"}
                  aria-expanded={outlinePanelOpen}
                  onClick={() => setOutlinePanelOpen((value) => !value)}
                >
                  {outlinePanelOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  <span>Outline</span>
                  <span className="side-count">{outline.length}</span>
                </button>
                {outlinePanelOpen && (
                  <button type="button" title="Clear filter" onClick={() => setQuery("")} disabled={!query}>
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
                      placeholder="Filter headings"
                    />
                  </label>
                  <nav className="outline-list scroll-list">
                    {filteredOutline.length === 0 && <span className="empty-outline">No headings</span>}
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
            <div className="segmented" aria-label="Editor mode">
              <Segment
                active={mode === "instant"}
                title="Instant"
                onClick={() => setMode("instant")}
                icon={<PenLine />}
              />
              <Segment
                active={mode === "rich"}
                title="Rich"
                onClick={() => setMode("rich")}
                icon={<Wand2 />}
              />
              <Segment
                active={mode === "source"}
                title="Source"
                onClick={() => setMode("source")}
                icon={<Code2 />}
              />
              <Segment
                active={mode === "read"}
                title="Read"
                onClick={() => setMode("read")}
                icon={<BookOpen />}
              />
            </div>

            <div className="strip-actions">
              {!outlineOpen && !focusMode && (
                <IconButton title="Show outline" onClick={() => setOutlineOpen(true)}>
                  <PanelLeft />
                </IconButton>
              )}
              <IconButton title="Focus mode" pressed={focusMode} onClick={() => setFocusMode((value) => !value)}>
                <Focus />
              </IconButton>
              <button
                type="button"
                className="theme-toggle"
                onClick={() => setTheme((value) => (value === "dark" ? "paper" : "dark"))}
                title="Toggle theme"
              >
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                <span>{theme === "dark" ? "Paper" : "Dark"}</span>
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
                aria-label="Markdown source editor"
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
          <span>{stats.words} words</span>
          <span>{stats.characters} chars</span>
          <span>{stats.readingMinutes} min read</span>
        </div>
        <div className="status-group">
          <Type size={14} />
          <span>{modeLabel(mode)}</span>
          {dirty ? <span>Unsaved</span> : <span><Check size={13} /> Saved</span>}
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

function modeLabel(mode) {
  if (mode === "read") return "Read";
  if (mode === "source") return "Source";
  if (mode === "rich") return "WYSIWYG";
  return "Instant";
}

const rootElement = document.getElementById("root");

if (!window.__quietMarkRoot) {
  window.__quietMarkRoot = createRoot(rootElement);
}

window.__quietMarkRoot.render(<App />);
