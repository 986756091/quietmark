# QuietMark

[English](README.md) | [简体中文](README.zh-CN.md)

QuietMark 是一个安静的 macOS Markdown 桌面编辑器，基于 Electron、React、Vite 和 Vditor 构建。它关注沉浸写作、实时 Markdown 渲染、原生文件流程、按文件夹展示的 Markdown 侧边栏、当前文档大纲导航，以及中英文双语界面。

QuietMark 与 Typora 没有关联，也不复制 Typora 的品牌或专有界面。它希望提供同类的轻干扰 Markdown 写作体验，同时保持为独立的开源项目。

## 功能

- 支持英文和简体中文界面切换，包括 macOS 应用菜单
- Markdown 实时编辑与即时渲染反馈
- 即时、富文本、源码、阅读模式
- 原生 macOS 打开、保存、另存为、最近文档和标题文件路径展示
- 将 Markdown 文件拖到 App 图标上即可打开
- 左侧文件夹侧边栏自动展示当前文件夹下的 Markdown 文件
- 文件列表和大纲面板可折叠，并拥有独立滚动条
- 当前文档大纲与标题筛选
- 专注模式和浅色/深色主题
- HTML 导出
- 内置本地 Vditor 运行资源，离线加载更友好

## 环境要求

- macOS 12 或更高版本
- Node.js 22 或更高版本
- npm

## 安装

```sh
npm install
```

如果 Electron 下载较慢或网络受限，可以使用镜像：

```sh
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install --cache ./.npm-cache
```

## 开发

```sh
npm run dev
```

该命令会同时启动 Vite 和 Electron。

## 构建和运行

```sh
npm run build
npm start
```

## 使用

可以通过 `文件 -> 打开...`、工具栏打开按钮，或将 `.md` / `.markdown` / `.mdown` / `.txt` 文件拖到 macOS App 图标上打开文档。

打开文件后，左侧侧边栏会自动列出同一文件夹中的 Markdown 文件。点击文件名即可切换文档。下方的大纲面板展示当前文档标题，文件列表和大纲都可以折叠，也会在内容很长时独立滚动。

工具栏的语言按钮可以在英文和简体中文之间切换。语言选择会保存在本地，并同步更新 macOS 菜单文字。

更多说明：[English Usage Guide](docs/USAGE.md) | [中文使用指南](docs/USAGE.zh-CN.md)

## 脚本

- `npm run dev`：运行开发版应用
- `npm run build`：构建渲染进程，并复制 Electron 主进程文件到 `dist/main`
- `npm start`：用 Electron 运行生产构建
- `npm run preview`：在浏览器中预览 Vite 构建结果

## 项目结构

```text
main/       Electron 主进程和 preload 桥接
src/        React 界面、Markdown 渲染、国际化和样式
public/     内置的 Vditor 运行资源
scripts/    构建辅助脚本
docs/       英文和中文使用文档
```

## 许可证

MIT
