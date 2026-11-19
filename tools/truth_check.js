// Truth check: every fact in a tailored resume.json must trace to the resume library.
//
// Fails (exit 1) when the resume contains:
//   - a number (metric, count, year) that never appears in the library,
//   - an employer, job title or date range that isn't in the library exactly,
//   - a named tool or skill (anything capitalised in the skills lines) the library doesn't mention,
//   - anything listed in the library's "Rejected" section.
//
// Usage: node tools/truth_check.js <resume.json> <library.md> [<more library files>...] [options]
//
// Modes:
//   (default)      strict: exit 1 on any unsupported claim
//   --warn         draft mode: list the problems but exit 0
//   --interactive  ask, for each addable problem, whether it's true; if yes, record where and what
//                  in the experience bank, then re-check. Employers, titles, dates and Rejected items
//                  can't be added this way: they must match the library exactly.
// Options:
//   --allow=W1,W2  capitalised words that are plain wording, not tool claims (e.g. --allow=Deterministic)
//   --bank=path    experience bank to write to (default: the library file named *experience_bank*)
//   --jd=name      job description to tag new entries with
const fs = require("fs");

const norm = (s) =>
  s
    .normalize("NFKC")
    .replace(/[‐-―]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[*_`#>]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();

function splitLibrary(text) {
  // The "Rejected" section is evidence of what NOT to claim, so it doesn't count as support.
  const lines = text.split("\n");
  const keep = [];
  const rejected = [];
  let inRejected = false;
  // Lines that record a confirmed "no" ("Confirmed NOT held: webhook testing ... never claim") name
  // the skill only to rule it out, so they don't count as support either.
  const deniesSkill = (l) => /\b(not held|never claim|not confirmed|not established)\b/i.test(l);
  for (const line of lines) {
    if (/^#{1,6}\s/.test(line)) inRejected = /rejected/i.test(line);
    if (!inRejected && !deniesSkill(line)) keep.push(line);
    else if (/^\s*[-*]\s+/.test(line)) {
      const body = line.replace(/^\s*[-*]\s+/, "");
      const quoted = [...body.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
      rejected.push(...(quoted.length ? quoted : [body.split(" (")[0]]));
    }
  }
  return { supported: norm(keep.join("\n")), rejected: rejected.map((r) => r.trim()).filter(Boolean) };
}

const numbersIn = (s) => [...new Set(s.match(/\d+(?:[.,]\d+)?/g) || [])];

// Named tools and technologies: any token with a capital letter ("JMeter", "GitLab", "iOS").
// Descriptive words around them ("load test design") are wording, not claims, so they're skipped.
// Generic QA vocabulary: describes a practice, not a tool someone could falsely claim.
const GENERIC = new Set(
  (
    "QA QC SDLC STLC KPI KPIs UAT SIT API APIs REST UI UX E2E BDD TDD CI CD AI ML LLM SQL JSON XML HTML " +
    "Agile Scrum Kanban DevOps SDET"
  )
    .split(" ")
    .map((t) => t.toLowerCase())
);

function skillTerms(value) {
  const tokens = value.match(/[A-Za-z0-9.+#/-]*[A-Z][A-Za-z0-9.+#/-]*/g) || [];
  return [...new Set(tokens.flatMap((t) => t.split("/")).map((t) => t.replace(/^[-.]+|[-.]+$/g, "")))]
    .filter((t) => t.length > 1 && /[A-Z]/.test(t))
    .filter((t) => !GENERIC.has(t.toLowerCase()))
    .filter((t) => !/^[A-Z][a-z]+-[a-z-]+$/.test(t)); // "Product-wide", "Cross-functional": wording
}

// ---------- checks ----------
// coreText: library without the experience bank. Rejected items are judged against it only, so a
// user-added bank entry can never "un-reject" something.
function findProblems(r, libText, coreText = libText) {
  const { supported, rejected } = splitLibrary(libText);
  const core = splitLibrary(coreText).supported;
  const word = (v) => new RegExp(`(^|[^a-z0-9])${norm(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`);
  const isRejected = (v) => rejected.some((x) => word(v).test(norm(x)));
  const has = (s) => supported.includes(norm(s));
  const hasNumber = (n) => new RegExp(`(^|[^\\d.,])${n.replace(/[.,]/g, "[.,]")}($|[^\\d])`).test(supported);
  const problems = []; // { kind, value, msg, addable }
  const seen = new Set();
  const add = (p) => {
    const key = `${p.kind}:${p.value}`;
    if (!seen.has(key)) seen.add(key), problems.push(p);
  };

  const prose = [r.headline, r.summary, ...r.skills.map(([, v]) => v), ...r.experience.flatMap((e) => e.bullets),
    ...(r.projects || []).flat(), ...r.education, ...r.certifications];
  for (const text of prose) {
    for (const n of numbersIn(text)) {
      if (!hasNumber(n)) add({ kind: "number", value: n, context: text, addable: true, msg: `number "${n}" not in library: ${text.slice(0, 80)}` });
    }
  }
  for (const e of r.experience) {
    const employer = e.company.split(/ — | \(/)[0]; // client notes after " — " are wording
    for (const [kind, val] of [["company", employer], ["title", e.title], ["dates", e.dates]]) {
      if (!has(val)) add({ kind, value: val, addable: false, msg: `${kind} not in library exactly: ${val}` });
    }
  }
  for (const [, v] of r.skills) {
    for (const term of skillTerms(v)) {
      if (!has(term)) add({ kind: "skill", value: term, addable: !isRejected(term), msg: `skill/tool not in library: ${term}` });
    }
  }
  for (const c of r.certifications) {
    const name = c.split(" — ")[0];
    if (!has(name)) add({ kind: "certification", value: name, addable: true, msg: `certification not in library: ${c}` });
  }
  const resumeText = norm(JSON.stringify(r));
  // A rejected phrase that the library also confirms elsewhere (e.g. a title rejected for one job
  // but real for another) can't be judged by text alone, so only flag phrases with no support at all.
  for (const item of rejected) {
    if (resumeText.includes(norm(item)) && !core.includes(norm(item))) add({ kind: "rejected", value: item, addable: false, msg: `uses a REJECTED item: ${item}` });
  }
  return problems;
}

// ---------- interactive confirmation ----------
// Reads answers line by line from stdin, so it also works when answers are piped in (tests, scripts).
function lineReader() {
  const rl = require("readline").createInterface({ input: process.stdin, terminal: false });
  const queue = [];
  const waiting = [];
  let closed = false;
  rl.on("line", (l) => (waiting.length ? waiting.shift()(l) : queue.push(l)));
  rl.on("close", () => {
    closed = true;
    while (waiting.length) waiting.shift()("");
  });
  const ask = (q) => {
    process.stdout.write(q);
    if (queue.length) return Promise.resolve(queue.shift());
    if (closed) return Promise.resolve("");
    return new Promise((res) => waiting.push(res));
  };
  return { ask, close: () => rl.close() };
}

async function confirmInteractively(problems, bankPath, jd) {
  const { appendEntries } = require("./experience_bank");
  const { ask, close } = lineReader();
  const entries = [];
  console.log("\nFor each item, answer y only if it's TRUE for you. Anything you confirm is saved to the experience bank.\n");
  for (const p of problems) {
    if (!p.addable) {
      const why = p.kind === "rejected" || p.kind === "skill" ? "it's on your Rejected list" : `a ${p.kind} must match the library exactly`;
      console.log(`  can't add: ${p.value} (${why}; edit the resume or the master resume instead)`);
      continue;
    }
    const label = p.kind === "number" ? `Metric "${p.value}"` : p.value;
    const ctx = p.context ? `\n      in: "${p.context.slice(0, 100)}"` : "";
    const shown = p.kind === "number" ? `the number ${p.value}` : `"${p.value}"`;
    const yes = /^y(es)?$/i.test((await ask(`  Is ${shown} true for you?${ctx}\n    [y/N] `)).trim());
    if (!yes) continue;
    const where = await ask("    Where? (employer name, or 'personal project'): ");
    const detail = await ask("    What did you do? (one line, optional): ");
    entries.push({ label, where, detail: p.kind === "number" && !detail.includes(p.value) ? `${detail} (${p.value})` : detail });
  }
  close();
  appendEntries(bankPath, entries, jd);
  if (entries.length) console.log(`\nSaved ${entries.length} confirmed item(s) to ${bankPath}`);
  return entries.length;
}

// ---------- CLI ----------
async function main() {
  const args = process.argv.slice(2);
  const opt = (name) => {
    const a = args.find((x) => x.startsWith(`--${name}=`));
    return a ? a.slice(name.length + 3) : undefined;
  };
  for (const w of (opt("allow") || "").split(",").filter(Boolean)) GENERIC.add(w.trim().toLowerCase());
  const warnOnly = args.includes("--warn");
  const interactive = args.includes("--interactive");
  const [jsonPath, ...libs] = args.filter((a) => !a.startsWith("--"));
  if (!jsonPath || !libs.length) {
    console.error(
      "Usage: node tools/truth_check.js <resume.json> <library.md> [...] [--allow=W1,W2] [--warn] [--interactive [--bank=path] [--jd=name]]"
    );
    process.exit(2);
  }
  const r = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const bankPath = opt("bank") || libs.find((f) => /experience_bank/i.test(f));
  const read = (files) => files.filter((f) => fs.existsSync(f)).map((f) => fs.readFileSync(f, "utf8")).join("\n");
  const allFiles = [...new Set([...libs, ...(bankPath ? [bankPath] : [])])];
  const coreFiles = allFiles.filter((f) => f !== bankPath);
  const check = () => findProblems(r, read(allFiles), read(coreFiles));

  let problems = check();
  if (problems.length && interactive) {
    if (!bankPath) {
      console.error("--interactive needs an experience bank: pass it as a library file or with --bank=path");
      process.exit(2);
    }
    console.log(`TRUTH CHECK: ${problems.length} unsupported claim(s)`);
    for (const p of problems) console.log(`  - ${p.msg}`);
    await confirmInteractively(problems, bankPath, opt("jd"));
    problems = check();
  }

  if (problems.length) {
    console.log(`TRUTH CHECK ${warnOnly ? "WARN" : "FAIL"}: ${problems.length} unsupported claim(s)`);
    for (const p of problems) console.log(`  - ${p.msg}`);
    if (!warnOnly) {
      if (!interactive && problems.some((p) => p.addable)) {
        console.log("\n  If any of these are true, record them (then re-run):");
        console.log("    npm run truth -- <same arguments> --interactive");
        console.log('    or: npm run add -- --skill="<tool>" --where="<employer>" --detail="<what you did>"');
      }
      process.exit(1);
    }
    console.log("  (--warn: draft mode, not failing. Fix these before you send the resume.)");
    return;
  }
  console.log("TRUTH CHECK PASS: every number, employer, title, date and named skill traces to the library");
}

main();
