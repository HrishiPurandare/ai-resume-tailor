// Creates .venv with a suitable Python (3.10–3.14) and installs a requirements file.
// Works on macOS, Linux and Windows: tries the Windows `py` launcher, python3.x, python3 and python.
// Usage: node tools/setup_py.js [requirements.txt | requirements-extras.txt]
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { ROOT, VENV, IS_WIN, venvBin } = require("./venv");

const reqFile = process.argv[2] || "requirements.txt";
const MIN = [3, 10];
const MAX = [3, 14];

const candidates = IS_WIN
  ? [["py", "-3.13"], ["py", "-3.12"], ["py", "-3.14"], ["py", "-3.11"], ["py", "-3.10"], ["py", "-3"], ["python"], ["python3"]]
  : [["python3.13"], ["python3.12"], ["python3.14"], ["python3.11"], ["python3.10"], ["python3"], ["python"]];

function versionOf([cmd, ...pre]) {
  const res = spawnSync(cmd, [...pre, "-c", "import sys; print('%d.%d' % sys.version_info[:2])"], { encoding: "utf8" });
  if (res.status !== 0 || !res.stdout) return null;
  const [maj, min] = res.stdout.trim().split(".").map(Number);
  return [maj, min];
}
const inRange = ([maj, min]) =>
  (maj > MIN[0] || (maj === MIN[0] && min >= MIN[1])) && (maj < MAX[0] || (maj === MAX[0] && min <= MAX[1]));

function run(cmd, args) {
  console.log(`> ${[cmd, ...args].join(" ")}`);
  const res = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit" });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

if (!fs.existsSync(path.join(ROOT, reqFile))) {
  console.error(`${reqFile} not found`);
  process.exit(2);
}

if (!fs.existsSync(venvBin("python"))) {
  const found = candidates.map((c) => [c, versionOf(c)]).find(([, v]) => v && inRange(v));
  if (!found) {
    console.error(
      "No Python 3.10–3.14 found.\n" +
        (IS_WIN
          ? "  Windows: winget install Python.Python.3.12   (or download from python.org and tick 'Add python.exe to PATH')"
          : "  macOS:   brew install python@3.12   (or download from python.org)")
    );
    process.exit(1);
  }
  const [[cmd, ...pre], v] = found;
  console.log(`Using Python ${v.join(".")} (${[cmd, ...pre].join(" ")})`);
  run(cmd, [...pre, "-m", "venv", VENV]);
} else {
  console.log(".venv already exists; installing into it");
}

const py = venvBin("python");
run(py, ["-m", "pip", "install", "--upgrade", "pip"]);
run(py, ["-m", "pip", "install", "-r", reqFile]);
console.log(`\nDone. Python tools are ready (${reqFile}).`);
