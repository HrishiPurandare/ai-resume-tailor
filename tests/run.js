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
test("skill files are real files (not symlinks) and match the vendor copy", () => {
  const dir = path.join(ROOT, ".claude", "skills", "resume-tailoring");
  for (const f of ["SKILL.md", "branching-questions.md", "matching-strategies.md", "multi-job-workflow.md", "research-prompts.md", "LICENSE"]) {
    const p = path.join(dir, f);
    assert(fs.existsSync(p) && !fs.lstatSync(p).isSymbolicLink(), `${f} must be a real file`);
    assert(fs.statSync(p).size > 100, `${f} looks empty (a symlink checked out as text?)`);
  }
  expectExit(run("node", ["tools/sync_skill.js", "--check"]), 0, "skill copies out of date: run npm run sync-skill");
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
