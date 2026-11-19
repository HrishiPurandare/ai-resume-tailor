// Runs a Python script with the project's virtualenv, on macOS, Linux and Windows.
// Usage: node tools/py.js <script.py> [args...]     (used by `npm run import` and `npm run ats`)
const { spawnSync } = require("child_process");
const { ROOT, requireVenvBin } = require("./venv");

const python = requireVenvBin("python");
const res = spawnSync(python, process.argv.slice(2), { cwd: ROOT, stdio: "inherit" });
if (res.error) {
  console.error(res.error.message);
  process.exit(1);
}
process.exit(res.status ?? 1);
