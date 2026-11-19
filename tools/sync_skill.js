// Copies the resume-tailoring skill from the vendor/ submodule into .claude/skills/ as real files.
// Real copies (not symlinks) so the skill works on Windows, where git often checks symlinks out
// as plain text files. Run after updating the submodule:
//   git submodule update --remote vendor/resume-tailoring-skill && npm run sync-skill
// Usage: node tools/sync_skill.js [--check]   (--check: exit 1 if the copies are out of date)
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "vendor", "resume-tailoring-skill");
const DEST = path.join(ROOT, ".claude", "skills", "resume-tailoring");
const FILES = {
  "SKILL.md": "skills/resume-tailoring/SKILL.md",
  "branching-questions.md": "branching-questions.md",
  "matching-strategies.md": "matching-strategies.md",
  "multi-job-workflow.md": "multi-job-workflow.md",
  "research-prompts.md": "research-prompts.md",
  "LICENSE": "LICENSE",
};
const NOTICE =
  "Copied from https://github.com/varunr89/resume-tailoring-skill (MIT, see LICENSE in this folder).\n" +
  "Do not edit here: update the vendor/ submodule and run `npm run sync-skill`.\n";

const check = process.argv.includes("--check");
if (!fs.existsSync(path.join(SRC, FILES["SKILL.md"]))) {
  console.error("vendor/resume-tailoring-skill is empty. Run: git submodule update --init");
  process.exit(check ? 0 : 1); // a clone without submodules can still use the committed copies
}

let stale = 0;
fs.mkdirSync(DEST, { recursive: true });
for (const [name, rel] of Object.entries(FILES)) {
  const want = fs.readFileSync(path.join(SRC, rel));
  const dest = path.join(DEST, name);
  const stat = fs.existsSync(dest) ? fs.lstatSync(dest) : null;
  const same = stat && !stat.isSymbolicLink() && Buffer.compare(fs.readFileSync(dest), want) === 0;
  if (same) continue;
  stale++;
  if (check) {
    console.log(`out of date: .claude/skills/resume-tailoring/${name}`);
    continue;
  }
  if (stat) fs.rmSync(dest);
  fs.writeFileSync(dest, want);
  console.log(`copied ${rel} -> .claude/skills/resume-tailoring/${name}`);
}
if (!check) fs.writeFileSync(path.join(DEST, "SOURCE.md"), NOTICE);
if (check && stale) process.exit(1);
console.log(stale ? `${stale} file(s) updated` : "skill copies are up to date");
