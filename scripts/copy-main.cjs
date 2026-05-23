const fs = require("node:fs");
const path = require("node:path");

const source = path.join(__dirname, "..", "main");
const target = path.join(__dirname, "..", "dist", "main");

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });

for (const file of fs.readdirSync(source)) {
  fs.copyFileSync(path.join(source, file), path.join(target, file));
}
