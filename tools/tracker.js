// Reads and writes application-tracker.md, a Markdown table with one row per job description:
// | Date | Company | Role | JD coverage | Folder | Status |
const fs = require("fs");

const HEADER = ["Date", "Company", "Role", "JD coverage", "Folder", "Status"];
const TITLE = "# Application Tracker\n\n";

const cell = (s) => String(s ?? "").replace(/\|/g, "/").replace(/\s+/g, " ").trim();

function load(file) {
  if (!fs.existsSync(file)) return { before: TITLE, rows: [], after: "" };
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  const start = lines.findIndex((l) => /^\|\s*Date\s*\|/i.test(l));
  if (start === -1) return { before: lines.join("\n").trimEnd() + "\n\n", rows: [], after: "" };
  let end = start + 2;
  while (end < lines.length && lines[end].trim().startsWith("|")) end++;
  const rows = lines.slice(start + 2, end).map((l) =>
    l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim())
  );
  return {
    before: lines.slice(0, start).join("\n") + (start ? "\n" : ""),
    rows,
    after: lines.slice(end).join("\n"),
  };
}

function save(file, t) {
  const table = [
    `| ${HEADER.join(" | ")} |`,
    `|${HEADER.map((h) => "-".repeat(h.length + 2)).join("|")}|`,
    ...t.rows.map((r) => `| ${HEADER.map((_, i) => cell(r[i])).join(" | ")} |`),
  ].join("\n");
  const after = t.after.trim() ? `\n${t.after.replace(/^\n+/, "\n")}` : "\n";
  fs.writeFileSync(file, `${t.before}${table}${after}`);
}

/** Adds a row unless one with the same folder already exists. Returns true if added. */
function addRow(file, { date, company, role, coverage = "Not assessed yet", folder, status = "JD saved" }) {
  const t = load(file);
  if (folder && t.rows.some((r) => r[4] === folder)) return false;
  t.rows.push([date, company, role, coverage, folder, status]);
  save(file, t);
  return true;
}

/** Rows whose company, role or folder contains the query (case-insensitive). */
function find(file, query) {
  const q = String(query).toLowerCase();
  return load(file).rows.filter((r) => [r[1], r[2], r[4]].some((c) => (c || "").toLowerCase().includes(q)));
}

/** Updates status and/or coverage on the single matching row. Throws if 0 or several match. */
function updateRow(file, query, { status, coverage }) {
  const t = load(file);
  const q = String(query).toLowerCase();
  const hits = t.rows.filter((r) => [r[1], r[2], r[4]].some((c) => (c || "").toLowerCase().includes(q)));
  if (!hits.length) throw new Error(`No tracker row matches "${query}"`);
  if (hits.length > 1) {
    throw new Error(`"${query}" matches ${hits.length} rows; use the folder name instead:\n  ${hits.map((r) => r[4]).join("\n  ")}`);
  }
  if (status) hits[0][5] = status;
  if (coverage) hits[0][3] = coverage;
  save(file, t);
  return hits[0];
}

module.exports = { HEADER, load, save, addRow, find, updateRow };
