# QuietMark

[English](README.md) | [简体中文](README.zh-CN.md)

QuietMark is a calm macOS Markdown editor built with Electron, React, Vite, and Vditor. It focuses on a quiet writing surface, live Markdown rendering, native file workflows, a folder-aware Markdown sidebar, document outline navigation, and a bilingual English/Chinese interface.

It is not affiliated with Typora and does not copy Typora branding or proprietary UI. QuietMark aims for the same class of distraction-light Markdown writing experience while remaining its own open-source project.

## Features

- English and Simplified Chinese UI switch, including the app menu
- Live Markdown editing with instant rendered feedback
- Rich, source, and read modes
- Native macOS file open, save, save as, recent documents, and represented file title
- Drag a Markdown file onto the app icon to open it
- Folder sidebar that lists Markdown files in the current file's folder
- Collapsible Files and Outline panels with independent scrolling
- Current document outline with heading filtering
- Focus mode and light/dark themes
- HTML export
- Local Vditor runtime assets for offline-friendly editor loading

## Requirements

- macOS 12 or later
- Node.js 22 or later
- npm

## Download

For normal use, download `QuietMark-mac-arm64.zip` from the [latest GitHub Release](https://github.com/986756091/quietmark/releases/latest), unzip it, and double-click `QuietMark.app`.

The packaged app is currently built for Apple Silicon Macs. Developers can still run from source with the commands below.

## Install

```sh
npm install
```

If Electron downloads slowly or fails on a restricted network, use a mirror:

```sh
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install --cache ./.npm-cache
```

## Development

```sh
npm run dev
```

This starts Vite and Electron together.

## Build And Run

```sh
npm run build
npm start
```

## Package For macOS

```sh
npm run package:mac
```

This creates `release/QuietMark.app` and `release/QuietMark-mac-arm64.zip`.

## Usage

Open a Markdown file with `File -> Open...`, drag a Markdown file onto the app icon, or use the toolbar open button.

When a file is open, the left sidebar automatically lists Markdown files from the same folder. Click a file to switch to it. The Outline panel below it shows headings from the current document. Both Files and Outline can be collapsed and each list scrolls independently for large projects.

Use the language button in the toolbar to switch between English and Simplified Chinese. The choice is saved locally and also updates the macOS menu labels.

More details: [Usage Guide](docs/USAGE.md) | [中文使用指南](docs/USAGE.zh-CN.md)

## Scripts

- `npm run dev`: run the development app
- `npm run build`: build the renderer and copy Electron main-process files into `dist/main`
- `npm run package:mac`: create a double-clickable macOS app and zip archive in `release/`
- `npm start`: run the production build with Electron
- `npm run preview`: preview the Vite build in a browser

## Project Structure

```text
main/       Electron main process and preload bridge
src/        React UI, Markdown rendering, localization, and styles
public/     Vendored Vditor runtime assets
scripts/    Build helper scripts
docs/       English and Chinese user documentation
```

## License

MIT
