// Truth check: every fact in a tailored resume.json must trace to the resume library.
//
// Fails (exit 1) when the resume contains:
//   - a number (metric, count, year) that never appears in the library,
//   - an employer, job title or date range that isn't in the library exactly,
//   - a named tool or skill (anything capitalised in the skills lines) the library doesn't mention,
//   - anything listed in the library's "Rejected" section.
//
// Usage: node tools/truth_check.js <resume.json> <library.md> [<more library files>...] [--allow=Word1,Word2]
//   --allow  capitalised words that are plain wording, not tool claims (e.g. --allow=Deterministic)
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
  for (const line of lines) {
    if (/^#{1,6}\s/.test(line)) inRejected = /rejected/i.test(line);
    if (!inRejected) keep.push(line);
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

function main() {
  const args = process.argv.slice(2);
  const allowArg = args.find((a) => a.startsWith("--allow="));
  for (const w of allowArg ? allowArg.slice(8).split(",") : []) GENERIC.add(w.trim().toLowerCase());
  const [jsonPath, ...libs] = args.filter((a) => !a.startsWith("--"));
  if (!jsonPath || !libs.length) {
    console.error("Usage: node tools/truth_check.js <resume.json> <library.md> [...] [--allow=Word1,Word2]");
    process.exit(2);
  }
  const r = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const { supported, rejected } = splitLibrary(libs.map((f) => fs.readFileSync(f, "utf8")).join("\n"));
  const has = (s) => supported.includes(norm(s));
  const hasNumber = (n) => new RegExp(`(^|[^\\d.,])${n.replace(/[.,]/g, "[.,]")}($|[^\\d])`).test(supported);
  const problems = [];

  const prose = [r.headline, r.summary, ...r.skills.map(([, v]) => v), ...r.experience.flatMap((e) => e.bullets),
    ...(r.projects || []).flat(), ...r.education, ...r.certifications];
  for (const text of prose) {
    for (const n of numbersIn(text)) if (!hasNumber(n)) problems.push(`number "${n}" not in library: ${text.slice(0, 80)}`);
  }
  for (const e of r.experience) {
    const employer = e.company.split(/ — | \(/)[0]; // client notes after " — " are wording
    for (const [kind, val] of [["company", employer], ["title", e.title], ["dates", e.dates]]) {
      if (!has(val)) problems.push(`${kind} not in library exactly: ${val}`);
    }
  }
  for (const [, v] of r.skills) {
    for (const term of skillTerms(v)) if (!has(term)) problems.push(`skill/tool not in library: ${term}`);
  }
  for (const c of r.certifications) if (!has(c.split(" — ")[0])) problems.push(`certification not in library: ${c}`);

  const resumeText = norm(JSON.stringify(r));
  // A rejected phrase that the library also confirms elsewhere (e.g. a title rejected for one job
  // but real for another) can't be judged by text alone, so only flag phrases with no support at all.
  for (const item of rejected) {
    if (resumeText.includes(norm(item)) && !has(item)) problems.push(`uses a REJECTED item: ${item}`);
  }

  if (problems.length) {
    console.log(`TRUTH CHECK FAIL: ${problems.length} unsupported claim(s)`);
    for (const p of problems) console.log(`  - ${p}`);
    process.exit(1);
  }
  console.log("TRUTH CHECK PASS: every number, employer, title, date and named skill traces to the library");
}

main();
