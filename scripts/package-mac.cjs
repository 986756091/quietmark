const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const electronApp = path.join(root, "node_modules", "electron", "dist", "Electron.app");
const releaseDir = path.join(root, "release");
const appName = "QuietMark";
const appPath = path.join(releaseDir, `${appName}.app`);
const resourcesDir = path.join(appPath, "Contents", "Resources");
const packagedAppDir = path.join(resourcesDir, "app");
const infoPlist = path.join(appPath, "Contents", "Info.plist");
const zipPath = path.join(releaseDir, `${appName}-mac-arm64.zip`);

const appFiles = [
  "dist",
  "main",
  "public",
  "package.json",
  "README.md",
  "README.zh-CN.md",
  "LICENSE"
];

function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: root,
    stdio: "inherit",
    ...options
  });
}

function copy(source, target) {
  fs.cpSync(source, target, {
    recursive: true,
    verbatimSymlinks: true,
    filter: (entry) => !entry.includes(`${path.sep}.DS_Store`)
  });
}

function ensureExists(filePath, message) {
  if (!fs.existsSync(filePath)) {
    throw new Error(message);
  }
}

ensureExists(electronApp, "Electron runtime is missing. Run npm install first.");

console.log("Building renderer...");
run("npm", ["run", "build"]);

fs.rmSync(releaseDir, { recursive: true, force: true });
fs.mkdirSync(releaseDir, { recursive: true });

console.log("Copying Electron runtime...");
run("ditto", [electronApp, appPath]);
fs.rmSync(path.join(resourcesDir, "default_app.asar"), { force: true });
fs.rmSync(packagedAppDir, { recursive: true, force: true });
fs.mkdirSync(packagedAppDir, { recursive: true });

console.log("Copying app files...");
for (const file of appFiles) {
  copy(path.join(root, file), path.join(packagedAppDir, file));
}

console.log("Updating app metadata...");
run("/usr/libexec/PlistBuddy", ["-c", `Set :CFBundleName ${appName}`, infoPlist]);
run("/usr/libexec/PlistBuddy", ["-c", `Set :CFBundleDisplayName ${appName}`, infoPlist]);
run("/usr/libexec/PlistBuddy", ["-c", "Set :CFBundleIdentifier local.quietmark.app", infoPlist]);
run("/usr/libexec/PlistBuddy", ["-c", "Set :LSMinimumSystemVersion 12.0", infoPlist]);

try {
  run("/usr/libexec/PlistBuddy", ["-c", "Delete :CFBundleDocumentTypes", infoPlist]);
} catch {
  // The base Electron plist may not have document type declarations yet.
}

run("/usr/libexec/PlistBuddy", ["-c", "Add :CFBundleDocumentTypes array", infoPlist]);
run("/usr/libexec/PlistBuddy", ["-c", "Add :CFBundleDocumentTypes:0 dict", infoPlist]);
run("/usr/libexec/PlistBuddy", ["-c", "Add :CFBundleDocumentTypes:0:CFBundleTypeName string 'Markdown Document'", infoPlist]);
run("/usr/libexec/PlistBuddy", ["-c", "Add :CFBundleDocumentTypes:0:CFBundleTypeRole string Editor", infoPlist]);
run("/usr/libexec/PlistBuddy", ["-c", "Add :CFBundleDocumentTypes:0:LSHandlerRank string Owner", infoPlist]);
run("/usr/libexec/PlistBuddy", ["-c", "Add :CFBundleDocumentTypes:0:CFBundleTypeExtensions array", infoPlist]);
for (const [index, extension] of ["md", "markdown", "mdown", "txt"].entries()) {
  run("/usr/libexec/PlistBuddy", [
    "-c",
    `Add :CFBundleDocumentTypes:0:CFBundleTypeExtensions:${index} string ${extension}`,
    infoPlist
  ]);
}
run("/usr/libexec/PlistBuddy", ["-c", "Add :CFBundleDocumentTypes:0:LSItemContentTypes array", infoPlist]);
for (const [index, contentType] of [
  "net.daringfireball.markdown",
  "public.markdown",
  "public.plain-text",
  "public.text"
].entries()) {
  run("/usr/libexec/PlistBuddy", [
    "-c",
    `Add :CFBundleDocumentTypes:0:LSItemContentTypes:${index} string ${contentType}`,
    infoPlist
  ]);
}

console.log("Removing extended attributes...");
run("xattr", ["-cr", appPath]);

console.log("Signing app...");
run("codesign", ["--force", "--deep", "--sign", "-", appPath]);

console.log("Creating zip archive...");
fs.rmSync(zipPath, { force: true });
run("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", `${appName}.app`, zipPath], {
  cwd: releaseDir
});

console.log(`Packaged ${appPath}`);
console.log(`Created ${zipPath}`);
