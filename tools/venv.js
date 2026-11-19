// Locates files inside the project's Python virtualenv on any OS.
// macOS / Linux: .venv/bin/<name>    Windows: .venv\Scripts\<name>.exe
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const VENV = path.join(ROOT, ".venv");
const IS_WIN = process.platform === "win32";

function venvBin(name) {
  return IS_WIN ? path.join(VENV, "Scripts", `${name}.exe`) : path.join(VENV, "bin", name);
}

function requireVenvBin(name, hint = "npm run setup:py") {
  const bin = venvBin(name);
  if (!fs.existsSync(bin)) {
    console.error(`${path.relative(ROOT, bin)} not found. Run: ${hint}`);
    process.exit(1);
  }
  return bin;
}

module.exports = { ROOT, VENV, IS_WIN, venvBin, requireVenvBin };
