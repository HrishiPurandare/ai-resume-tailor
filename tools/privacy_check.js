// Privacy check: stops your personal data from being committed to this (public) repository.
//
// 1. Your private paths (resumes/, applications/, application-tracker.md, CLAUDE.local.md) must
//    never be tracked by git.
// 2. No tracked or staged file may contain your contact details. They're read from the "Contact"
//    section of resumes/master_resume.md (emails, phone numbers, LinkedIn handle), so nothing
//    personal is written into this script.
//
// Usage: node tools/privacy_check.js [--staged]      (--staged: check only files staged for commit)
// Installed as a git pre-commit hook by `npm run hooks`.
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PRIVATE = ["resumes/", "applications/", "application-tracker.md", "CLAUDE.local.md"];
const git = (...a) => spawnSync("git", a, { cwd: ROOT, encoding: "utf8" });

if (git("rev-parse", "--is-inside-work-tree").status !== 0) {
  console.log("privacy check: not a git repository, skipping");
  process.exit(0);
}

const problems = [];
const tracked = git("ls-files", "--cached", "--", ...PRIVATE).stdout.split("\n").filter(Boolean);
for (const f of tracked) problems.push(`private file is tracked by git: ${f}  (run: git rm --cached "${f}")`);

const secrets = new Set();
const master = path.join(ROOT, "resumes", "master_resume.md");
if (fs.existsSync(master)) {
  const text = fs.readFileSync(master, "utf8");
  for (const m of text.matchAll(/[\w.+-]+@[\w-]+\.[\w.-]+/g)) secrets.add(m[0].toLowerCase());
  for (const m of text.matchAll(/\+?\d[\d\s-]{7,}\d/g)) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length >= 9) secrets.add(digits);
  }
  for (const m of text.matchAll(/linkedin\.com\/in\/([\w-]+)/gi)) secrets.add(`linkedin.com/in/${m[1].toLowerCase()}`);
}

const files = process.argv.includes("--staged")
  ? git("diff", "--cached", "--name-only", "--diff-filter=ACMR").stdout.split("\n").filter(Boolean)
  : git("ls-files").stdout.split("\n").filter(Boolean);

if (secrets.size) {
  for (const f of files) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p) || fs.statSync(p).isDirectory() || fs.statSync(p).size > 5e6) continue;
    const raw = process.argv.includes("--staged") ? git("show", `:${f}`).stdout || "" : fs.readFileSync(p, "latin1");
    const lower = raw.toLowerCase();
    const digitsOnly = lower.replace(/\D/g, "");
    for (const s of secrets) {
      const hit = /^\d+$/.test(s) ? digitsOnly.includes(s) && lower.replace(/[\s-]/g, "").includes(s) : lower.includes(s);
      if (hit) problems.push(`${f} contains your contact detail "${s.replace(/(.{3}).+(.{2})/, "$1…$2")}"`);
    }
  }
}

if (problems.length) {
  console.error("PRIVACY CHECK FAIL");
  for (const p of problems) console.error(`  - ${p}`);
  console.error("Nothing was committed. Remove the personal data (or unstage the file) and try again.");
  process.exit(1);
}
console.log(`PRIVACY CHECK PASS: ${files.length} file(s) checked${secrets.size ? "" : " (no resumes/master_resume.md, so only private paths were checked)"}`);
