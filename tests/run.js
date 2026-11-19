// Test suite: builds the fictional example from scratch and checks the whole pipeline,
// including negative tests that prove the guards actually fail on bad input.
// Usage: npm test   (Python checks run only when .venv exists; CI always creates it)
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const EX = path.join(ROOT, "examples", "jane-doe");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "resume-tailor-"));
const BASE = path.join(TMP, "Jane_Doe_Resume");
const PY = path.join(ROOT, ".venv", "bin", "python");
const HAS_PY = fs.existsSync(PY);

let passed = 0;
let failed = 0;
const run = (cmd, args) => spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8" });

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok    ${name}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL  ${name}\n        ${err.message.split("\n").join("\n        ")}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function expectExit(res, code, label) {
  assert(res.status === code, `${label}: expected exit ${code}, got ${res.status}\n${res.stdout}${res.stderr}`);
}
function tampered(change) {
  const r = JSON.parse(fs.readFileSync(path.join(EX, "resume.json"), "utf8"));
  change(r);
  const file = path.join(TMP, `tampered-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(file, JSON.stringify(r));
  return file;
}
const pdfPages = (file) => {
  const counts = [...fs.readFileSync(file, "latin1").matchAll(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)/g)].map((m) => +m[1]);
  return counts.length ? Math.max(...counts) : NaN;
};

console.log("Build");
test("resume.json has the required shape", () => {
  const r = JSON.parse(fs.readFileSync(path.join(EX, "resume.json"), "utf8"));
  for (const k of ["name", "headline", "summary"]) assert(typeof r[k] === "string" && r[k], `missing ${k}`);
  for (const k of ["contact", "skills", "experience", "education", "certifications"]) assert(Array.isArray(r[k]), `${k} must be an array`);
  for (const s of r.skills) assert(Array.isArray(s) && s.length === 2, "each skill must be [category, text]");
  for (const e of r.experience) {
    for (const k of ["title", "company", "location", "dates"]) assert(e[k], `experience entry missing ${k}`);
    assert(Array.isArray(e.bullets) && e.bullets.length, `${e.company}: needs bullets`);
  }
});
test("build writes .md, .docx and .html", () => {
  expectExit(run("node", ["tools/build_resume.js", path.join(EX, "resume.json"), BASE]), 0, "build");
  for (const ext of ["md", "docx", "html"]) assert(fs.existsSync(`${BASE}.${ext}`), `missing .${ext}`);
});
test("markdown contains every experience bullet", () => {
  const md = fs.readFileSync(`${BASE}.md`, "utf8");
  const r = JSON.parse(fs.readFileSync(path.join(EX, "resume.json"), "utf8"));
  for (const b of r.experience.flatMap((e) => e.bullets)) assert(md.includes(b), `missing bullet: ${b}`);
});
test("pdf prints, html is cleaned up, and it fits on 2 pages", () => {
  expectExit(run("node", ["tools/print_pdf.js", BASE]), 0, "pdf");
  assert(fs.existsSync(`${BASE}.pdf`), "missing .pdf");
  assert(!fs.existsSync(`${BASE}.html`), "temporary .html was not deleted");
  const pages = pdfPages(`${BASE}.pdf`);
  assert(pages >= 1 && pages <= 2, `expected 1-2 pages, got ${pages}`);
});

console.log("Truth check");
const truth = (json, ...extra) => run("node", ["tools/truth_check.js", json, path.join(EX, "master_resume.md"), ...extra]);
test("passes for the example", () => expectExit(truth(path.join(EX, "resume.json")), 0, "truth"));
test("fails on an invented metric", () => {
  const res = truth(tampered((r) => (r.experience[0].bullets[1] = "Cut CI regression time by 95% across 40 pipelines.")));
  expectExit(res, 1, "truth");
  assert(/number "95"/.test(res.stdout), "should name the invented number");
});
test("fails on a tool that isn't in the library", () => {
  const res = truth(tampered((r) => (r.skills[0][1] += ", Kubernetes")));
  expectExit(res, 1, "truth");
  assert(/Kubernetes/.test(res.stdout), "should name the unsupported tool");
});
test("fails on an item from the Rejected list", () => {
  const res = truth(tampered((r) => (r.skills[0][1] += ", Cypress")));
  expectExit(res, 1, "truth");
  assert(/REJECTED item: Cypress/.test(res.stdout), "should flag the rejected item");
});
test("fails on a changed employer name or dates", () => {
  expectExit(truth(tampered((r) => (r.experience[0].company = "Example Payments Group"))), 1, "employer");
  expectExit(truth(tampered((r) => (r.experience[1].dates = "Jan 2018 – Dec 2022"))), 1, "dates");
});
test("--allow whitelists plain wording", () => {
  const json = tampered((r) => (r.skills[3][1] += ", Deterministic assertions"));
  expectExit(truth(json), 1, "without --allow");
  expectExit(truth(json, "--allow=Deterministic"), 0, "with --allow");
});

console.log("ATS parse check (MarkItDown)");
if (!HAS_PY) {
  console.log("  skip  .venv not found; run `npm run setup:py` to enable");
} else {
  test("every item is readable from the DOCX and the PDF", () => {
    const res = run(PY, ["tools/ats_check.py", path.join(EX, "resume.json"), BASE]);
    expectExit(res, 0, "ats");
    assert((res.stdout.match(/PASS/g) || []).length === 2, `expected 2 PASS lines\n${res.stdout}`);
  });
  test("fails when content is missing from the files", () => {
    const json = tampered((r) => r.experience[0].bullets.push("A bullet that was never built into the files."));
    const res = run(PY, ["tools/ats_check.py", json, BASE]);
    expectExit(res, 1, "ats");
    assert(/not found \(bullet\)/.test(res.stdout), "should name the missing bullet");
  });
  test("to_markdown converts the PDF and DOCX without clobbering", () => {
    const out = path.join(TMP, "md");
    expectExit(run(PY, ["tools/to_markdown.py", `${BASE}.pdf`, `${BASE}.docx`, "-o", out]), 0, "import");
    for (const f of ["Jane_Doe_Resume.pdf.md", "Jane_Doe_Resume.docx.md"]) {
      const text = fs.readFileSync(path.join(out, f), "utf8");
      assert(text.includes("JANE DOE") && text.includes("Example Payments Ltd"), `${f} is missing content`);
    }
  });
}

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
