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
const { venvBin } = require("../tools/venv");
const PY = venvBin("python"); // .venv/bin/python, or .venv\\Scripts\\python.exe on Windows
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

console.log("Cross-platform setup");
test("the resume-tailor skill is present, original and self-contained", () => {
  const dir = path.join(ROOT, ".claude", "skills", "resume-tailor");
  const skill = fs.readFileSync(path.join(dir, "SKILL.md"), "utf8");
  assert(/^---\nname: resume-tailor\ndescription: .+\n---/m.test(skill), "SKILL.md needs name/description front matter");
  for (const f of ["matching.md", "discovery.md", "writing.md"]) {
    const p = path.join(dir, f);
    assert(fs.existsSync(p) && !fs.lstatSync(p).isSymbolicLink() && fs.statSync(p).size > 500, `${f} missing or empty`);
    assert(skill.includes(f), `SKILL.md should point to ${f}`);
  }
  for (const ref of [...skill.matchAll(/`((?:playbooks|templates)\/[\w.-]+)`/g)].map((m) => m[1])) {
    assert(fs.existsSync(path.join(ROOT, ref)), `SKILL.md points to missing ${ref}`);
  }
  for (const f of ["templates/Report.md", "templates/outreach.md", "templates/cover-letter.md", "templates/screening-answers.md"]) {
    assert(fs.existsSync(path.join(ROOT, f)), `missing ${f}`);
  }
});
test("no dependency on another resume-skill repository", () => {
  assert(!fs.existsSync(path.join(ROOT, ".gitmodules")) && !fs.existsSync(path.join(ROOT, "vendor")), "submodule should be gone");
  const files = ["README.md", "CLAUDE.md", "AGENTS.md", "GEMINI.md", "package.json", ".github/workflows/ci.yml"];
  for (const f of files) assert(!/resume-tailoring-skill|vendor\//.test(fs.readFileSync(path.join(ROOT, f), "utf8")), `${f} still references the old skill`);
});
test(".mcp.json launches the server with node (no bash needed)", () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, ".mcp.json"), "utf8")).mcpServers.markitdown;
  assert(cfg.command === "node" && fs.existsSync(path.join(ROOT, cfg.args[0])), JSON.stringify(cfg));
});
test("npm scripts call no OS-specific paths", () => {
  const scripts = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).scripts;
  for (const [name, cmd] of Object.entries(scripts)) {
    assert(!/\.venv\/bin|python3\.\d+|\bbash\b|\.sh\b/.test(cmd), `${name} is not cross-platform: ${cmd}`);
  }
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

console.log("Relaxed modes and adding experience");
const withKubernetes = () => tampered((r) => (r.skills[0][1] += ", Kubernetes"));
const freshLibrary = () => {
  const dir = fs.mkdtempSync(path.join(TMP, "lib-"));
  fs.copyFileSync(path.join(EX, "master_resume.md"), path.join(dir, "master_resume.md"));
  return { master: path.join(dir, "master_resume.md"), bank: path.join(dir, "experience_bank.md") };
};
test("--warn lists problems but exits 0", () => {
  const res = truth(withKubernetes(), "--warn");
  expectExit(res, 0, "warn");
  assert(/TRUTH CHECK WARN/.test(res.stdout) && /Kubernetes/.test(res.stdout), "should still list the problem");
});
test("strict failure suggests how to record a true item", () => {
  assert(/--interactive/.test(truth(withKubernetes()).stdout), "should point to --interactive / npm run add");
});
test("add_experience records a skill that then passes the check", () => {
  const lib = freshLibrary();
  const json = withKubernetes();
  const check = () => run("node", ["tools/truth_check.js", json, lib.master, lib.bank]);
  expectExit(check(), 1, "before adding");
  expectExit(
    run("node", ["tools/add_experience.js", "--skill=Kubernetes", "--where=Example Payments Ltd", "--detail=Deployed test environments", `--bank=${lib.bank}`]),
    0,
    "add"
  );
  expectExit(check(), 0, "after adding");
  assert(/Kubernetes \(Example Payments Ltd\)/.test(fs.readFileSync(lib.bank, "utf8")), "entry should name the employer");
});
test("--interactive saves only the items answered yes", () => {
  const lib = freshLibrary();
  const json = tampered((r) => {
    r.skills[0][1] += ", Kubernetes";
    r.experience[0].bullets[1] = "Cut CI regression time by 95% across pipelines.";
  });
  const res = spawnSync("node", ["tools/truth_check.js", json, lib.master, `--bank=${lib.bank}`, "--interactive"], {
    cwd: ROOT,
    encoding: "utf8",
    input: "n\ny\nExample Payments Ltd\nDeployed test environments\n", // no to 95, yes to Kubernetes
  });
  expectExit(res, 1, "still fails on the declined number");
  const bank = fs.readFileSync(lib.bank, "utf8");
  assert(/Kubernetes \(Example Payments Ltd\)/.test(bank), "confirmed skill should be saved");
  assert(!/95/.test(bank), "declined number must not be saved");
});
test("--interactive can't whitelist a Rejected item or a changed employer", () => {
  const lib = freshLibrary();
  const json = tampered((r) => {
    r.skills[0][1] += ", Cypress";
    r.experience[0].company = "Example Payments Group";
  });
  const res = spawnSync("node", ["tools/truth_check.js", json, lib.master, `--bank=${lib.bank}`, "--interactive"], {
    cwd: ROOT,
    encoding: "utf8",
    input: "y\ny\n",
  });
  expectExit(res, 1, "interactive");
  assert(/REJECTED item: Cypress/.test(res.stdout) && /company not in library/.test(res.stdout), "both must still fail");
  assert(!fs.existsSync(lib.bank), "nothing should be written");
});

test("add_experience refuses an item from the Rejected list", () => {
  const lib = freshLibrary();
  const res = run("node", ["tools/add_experience.js", "--skill=Cypress", "--where=Example Payments Ltd", `--bank=${lib.bank}`, `--master=${lib.master}`]);
  expectExit(res, 1, "add rejected");
  assert(!fs.existsSync(lib.bank), "nothing should be written");
});
test("a bank entry can't un-reject a Rejected item", () => {
  const lib = freshLibrary();
  fs.writeFileSync(lib.bank, "# Experience Bank\n\n- **Cypress (Example Payments Ltd):** written by hand\n");
  const res = truth(tampered((r) => (r.skills[0][1] += ", Cypress")), lib.bank);
  expectExit(res, 1, "truth");
  assert(/REJECTED item: Cypress/.test(res.stdout), "rejected item must still fail");
});

test("a confirmed NOT held item can't support a claim", () => {
  const lib = freshLibrary();
  expectExit(run("node", ["tools/add_experience.js", "--not-held=Webhook testing", `--bank=${lib.bank}`, `--master=${lib.master}`]), 0, "add not-held");
  const res = run("node", ["tools/truth_check.js", tampered((r) => (r.skills[0][1] += ", Webhook testing")), lib.master, lib.bank]);
  expectExit(res, 1, "truth");
  assert(/Webhook/.test(res.stdout), "Webhook must still be unsupported");
});

console.log("Job descriptions: fetch, new, track");
const fetchJd = require("../tools/fetch_jd");
const FX = path.join(ROOT, "tests", "fixtures", "jd");
const fx = (f) => JSON.parse(fs.readFileSync(path.join(FX, f), "utf8"));
test("recognises job-board URLs and refuses LinkedIn", () => {
  const cases = {
    "https://job-boards.eu.greenhouse.io/exampleco/jobs/123": ["greenhouse", "https://boards-api.greenhouse.io/v1/boards/exampleco/jobs/123"],
    "https://boards.greenhouse.io/exampleco/jobs/123?gh_src=x": ["greenhouse", "https://boards-api.greenhouse.io/v1/boards/exampleco/jobs/123"],
    "https://jobs.ashbyhq.com/exampleco/0d1e2f3a-aaaa-bbbb-cccc-1234567890ab": ["ashby", "https://api.ashbyhq.com/posting-api/job-board/exampleco?includeCompensation=true"],
    "https://jobs.lever.co/exampleco/9f8e7d6c": ["lever", "https://api.lever.co/v0/postings/exampleco/9f8e7d6c"],
    "https://jobs.eu.lever.co/exampleco/9f8e7d6c": ["lever", "https://api.eu.lever.co/v0/postings/exampleco/9f8e7d6c"],
    "https://jobs.smartrecruiters.com/ExampleCo/744000111222333-senior-qa-engineer": ["smartrecruiters", "https://api.smartrecruiters.com/v1/companies/ExampleCo/postings/744000111222333"],
    "https://apply.workable.com/exampleco/j/ABC123DEF/": ["workable", "https://apply.workable.com/api/v2/accounts/exampleco/jobs/ABC123DEF"],
    "https://careers.example.com/jobs/senior-qa": ["page", undefined],
  };
  for (const [url, [kind, api]] of Object.entries(cases)) {
    const d = fetchJd.detect(url);
    assert(d.kind === kind && d.api === api, `${url} -> ${JSON.stringify(d)}`);
  }
  assert(fetchJd.detect("https://www.linkedin.com/jobs/view/123/").kind === "blocked", "LinkedIn should be blocked");
  assert(fetchJd.detect("https://ae.linkedin.com/jobs/view/123/").kind === "blocked", "regional LinkedIn should be blocked");
});
test("parses each job-board API format into the same fields", () => {
  const parsed = [
    fetchJd.fromGreenhouse(fx("greenhouse.json"), { board: "exampleco" }, "u"),
    fetchJd.fromAshby(fx("ashby.json"), { org: "exampleco", id: "job-1" }, "u"),
    fetchJd.fromLever(fx("lever.json"), { company: "exampleco" }, "u"),
    fetchJd.fromSmartRecruiters(fx("smartrecruiters.json"), { company: "ExampleCo" }, "u"),
    fetchJd.fromWorkable(fx("workable.json"), { account: "exampleco" }, "u"),
    fetchJd.fromJsonLd(fs.readFileSync(path.join(FX, "jsonld.html"), "utf8"), "u"),
  ];
  for (const job of parsed) {
    assert(job.title === "Senior QA Engineer", `title: ${job.title}`);
    assert(/Example/i.test(job.company), `company: ${job.company}`);
    assert(/Playwright/.test(job.description) && !/<\/?[a-z]+>/i.test(job.description), `description must be clean Markdown: ${job.description.slice(0, 120)}`);
    assert(job.location, "location missing");
  }
  assert(/90000/.test(parsed[5].salary), "JSON-LD salary should be read");
  assert(/^- /m.test(parsed[0].description), "HTML lists should become Markdown lists");
});
test("toMarkdown writes the metadata header and flags visa wording", () => {
  const md = fetchJd.toMarkdown({ title: "QA", company: "Example", location: "Springfield", description: "Visa sponsorship available." }, "https://x", "test", "2026-01-02");
  assert(md.startsWith("# QA — Example") && /fetched 2026-01-02 via test/.test(md) && /mentioned: see the description/.test(md), md);
});
const work = fs.mkdtempSync(path.join(TMP, "work-"));
const inWork = (script, args) => spawnSync("node", [path.join(ROOT, "tools", script), ...args], { cwd: work, encoding: "utf8" });
test("npm run new creates the folder, JD stub and a tracker row", () => {
  const res = inWork("new_application.js", ["Example Retail Group", "Senior QA Engineer (Hybrid)", "--date=2026-11-20"]);
  expectExit(res, 0, "new");
  const folder = path.join(work, "applications", "ExampleRetailGroup_Senior-QA-Engineer-Hybrid_2026-11-20");
  assert(fs.existsSync(path.join(folder, "JD.md")), "JD.md missing");
  const t = fs.readFileSync(path.join(work, "application-tracker.md"), "utf8");
  assert(/\| 2026-11-20 \| Example Retail Group \| Senior QA Engineer \(Hybrid\) \|/.test(t), t);
  expectExit(inWork("new_application.js", ["Example Retail Group", "Senior QA Engineer (Hybrid)", "--date=2026-11-20"]), 0, "again");
  assert(fs.readFileSync(path.join(work, "application-tracker.md"), "utf8").split("Example Retail Group").length === 2, "must not add a duplicate row");
});
test("npm run track updates, lists and refuses ambiguous matches", () => {
  inWork("track.js", ["add", "--company=Sample Software Co", "--role=QA Engineer", "--date=2026-11-21"]);
  expectExit(inWork("track.js", ["update", "Example Retail", "--status=Applied (2026-11-22)", "--coverage=~85%"]), 0, "update");
  const t = fs.readFileSync(path.join(work, "application-tracker.md"), "utf8");
  assert(/~85% \| applications\/ExampleRetailGroup_[^|]+\| Applied \(2026-11-22\) \|/.test(t), t);
  const list = inWork("track.js", ["list"]);
  assert(/2 total: .*1 applied/.test(list.stdout), list.stdout);
  inWork("track.js", ["add", "--company=Third Example", "--role=SDET", "--status=Resume ready, not applied"]);
  inWork("track.js", ["add", "--company=Fourth Example", "--role=SDET Lead", "--status=CV sent to recruiter; 3 interview rounds"]);
  inWork("track.js", ["add", "--company=Fifth Example", "--role=QA Lead", "--status=Interview scheduled (2026-11-25)"]);
  const summary = inWork("track.js", ["list"]).stdout;
  assert(/5 total: .*2 applied/.test(summary) && /1 resume ready/.test(summary) && /1 interview/.test(summary), summary);
  const amb = inWork("track.js", ["update", "QA Engineer", "--status=x"]);
  expectExit(amb, 1, "ambiguous");
  assert(/matches 2 rows/.test(amb.stderr), amb.stderr);
});
test("privacy check blocks committing personal data", () => {
  const repo = fs.mkdtempSync(path.join(TMP, "repo-"));
  const g = (...a) => spawnSync("git", a, { cwd: repo, encoding: "utf8" });
  g("init", "-q");
  fs.mkdirSync(path.join(repo, "tools"));
  fs.copyFileSync(path.join(ROOT, "tools", "privacy_check.js"), path.join(repo, "tools", "privacy_check.js"));
  fs.mkdirSync(path.join(repo, "resumes"));
  fs.writeFileSync(path.join(repo, "resumes", "master_resume.md"), "## 1. Contact\n- Email: jane.private@example.org\n- Phone: +00-111-2223333\n");
  fs.writeFileSync(path.join(repo, "README.md"), "Contact me at jane.private@example.org");
  g("add", "README.md");
  const check = () => spawnSync("node", ["tools/privacy_check.js", "--staged"], { cwd: repo, encoding: "utf8" });
  const bad = check();
  expectExit(bad, 1, "email in README");
  assert(/README\.md contains your contact detail/.test(bad.stderr), bad.stderr);
  fs.writeFileSync(path.join(repo, "README.md"), "Call 00111 222 3333");
  g("add", "README.md");
  expectExit(check(), 1, "phone in README");
  fs.writeFileSync(path.join(repo, "README.md"), "Nothing personal here.");
  g("add", "README.md");
  g("add", "-f", "resumes/master_resume.md");
  const tracked = check();
  expectExit(tracked, 1, "tracked master resume");
  assert(/private file is tracked/.test(tracked.stderr), tracked.stderr);
  g("rm", "-q", "--cached", "resumes/master_resume.md");
  expectExit(check(), 0, "clean");
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

  console.log("Importing every format (MarkItDown)");
  const FIX = path.join(TMP, "fixtures");
  const fixturesOk = run(PY, ["tests/make_fixtures.py", FIX]).status === 0;
  const imp = (...a) => run(PY, ["tools/to_markdown.py", ...a]);
  const readMd = (dir, name) => fs.readFileSync(path.join(dir, name), "utf8");
  test("fixtures can be generated (python-pptx, openpyxl installed)", () => assert(fixturesOk, "make_fixtures.py failed"));
  if (fixturesOk) {
    test("a folder converts HTML, TXT, JSON, CSV, ZIP, PPTX and XLSX", () => {
      const out = path.join(TMP, "all");
      const res = imp(FIX, "-o", out);
      expectExit(res, 0, `import folder\n${res.stderr}`);
      const expect = {
        "job.md": "FIXTURE HTML", "notes.md": "FIXTURE TXT", "data.md": "FIXTURE JSON", "skills.md": "FIXTURE CSV",
        "bundle.md": "FIXTURE ZIP", "deck.md": "FIXTURE PPTX", "matrix.md": "FIXTURE XLSX",
      };
      for (const [file, phrase] of Object.entries(expect)) assert(readMd(out, file).includes(phrase), `${file} should contain ${phrase}`);
      assert(!fs.existsSync(path.join(out, "nested")), "subfolders need --recursive");
    });
    test("--recursive keeps the folder structure", () => {
      const out = path.join(TMP, "rec");
      expectExit(imp(FIX, "--recursive", "-o", out), 0, "recursive");
      assert(readMd(path.join(out, "nested"), "deep.md").includes("FIXTURE NESTED"), "nested/deep.md missing");
    });
    test("--stdout and stdin (-) work", () => {
      const res = imp(path.join(FIX, "deck.pptx"), "--stdout");
      expectExit(res, 0, "stdout");
      assert(res.stdout.includes("FIXTURE PPTX"), "stdout should carry the markdown");
      const piped = spawnSync(PY, ["tools/to_markdown.py", "-", "--stdin-ext", ".html", "--stdout"], {
        cwd: ROOT, encoding: "utf8", input: fs.readFileSync(path.join(FIX, "job.html"), "utf8"),
      });
      expectExit(piped, 0, "stdin");
      assert(piped.stdout.includes("FIXTURE HTML"), "stdin conversion failed");
    });
    test("audio is skipped unless --allow-cloud", () => {
      const res = imp(path.join(FIX, "talk.mp3"), "-o", path.join(TMP, "audio"));
      assert(/online speech service/.test(res.stderr), "should explain why audio was skipped");
      assert(!fs.existsSync(path.join(TMP, "audio", "talk.md")), "audio must not be converted");
    });
    test("cloud OCR and Azure are refused without --allow-cloud", () => {
      const env = { ...process.env, OPENAI_API_KEY: "sk-test-not-used", OPENAI_BASE_URL: "" };
      for (const flags of [["--ocr"], ["--describe-images"], ["--docintel-endpoint", "https://example.cognitiveservices.azure.com/"]]) {
        const res = spawnSync(PY, ["tools/to_markdown.py", path.join(FIX, "job.html"), "--stdout", ...flags], { cwd: ROOT, encoding: "utf8", env });
        expectExit(res, 2, flags[0]);
        assert(/refused/.test(res.stderr), `${flags[0]} should be refused`);
      }
    });
    test("existing files are not overwritten without --force", () => {
      const out = path.join(TMP, "force");
      imp(path.join(FIX, "notes.txt"), "-o", out);
      fs.writeFileSync(path.join(out, "notes.md"), "KEEP ME");
      imp(path.join(FIX, "notes.txt"), "-o", out);
      assert(readMd(out, "notes.md") === "KEEP ME", "file was overwritten without --force");
      imp(path.join(FIX, "notes.txt"), "-o", out, "--force");
      assert(readMd(out, "notes.md").includes("FIXTURE TXT"), "--force should overwrite");
    });
  }
  test("--list-formats reports installed features", () => {
    const res = imp("--list-formats");
    expectExit(res, 0, "list");
    assert(/yes\s+PDF/.test(res.stdout) && /PowerPoint/.test(res.stdout), res.stdout);
  });

  console.log("MCP server (markitdown-mcp)");
  if (!fs.existsSync(venvBin("markitdown-mcp"))) {
    console.log("  skip  not installed; run `npm run setup:py:extras` to enable");
  } else {
    test("starts from .mcp.json, offers convert_to_markdown, converts a file", () => {
      const res = spawnSync(PY, ["tests/mcp_smoke.py", path.join(EX, "Jane_Doe_Resume.docx"), "Example Payments Ltd"], {
        cwd: ROOT, encoding: "utf8", timeout: 120000,
      });
      expectExit(res, 0, `mcp\n${res.stderr.slice(-500)}`);
      assert(/MCP PASS/.test(res.stdout), res.stdout);
    });
  }
}

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
