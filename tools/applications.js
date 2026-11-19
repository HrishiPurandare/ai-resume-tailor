// Creates application folders (applications/<Company>_<Role>_<YYYY-MM-DD>/JD.md) and their tracker rows.
const fs = require("fs");
const path = require("path");
const tracker = require("./tracker");

const today = () => new Date().toISOString().slice(0, 10);

const words = (s) =>
  String(s || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .split(/[^A-Za-z0-9+#]+/)
    .filter(Boolean);

/** "Example Retail Group" -> "ExampleRetailGroup"; "Senior QA Engineer (Remote)" -> "Senior-QA-Engineer-Remote" */
function companySlug(s) {
  return words(s).map((w) => w[0].toUpperCase() + w.slice(1)).join("").slice(0, 40) || "Company";
}
function roleSlug(s) {
  return words(s).join("-").slice(0, 60).replace(/-+$/, "") || "Role";
}
function folderName(company, role, date = today()) {
  return `${companySlug(company)}_${roleSlug(role)}_${date}`;
}

/**
 * @param {object} o
 * @param {string} o.company
 * @param {string} o.role
 * @param {string} [o.markdown]   full JD.md content; a fill-in stub is written when omitted
 * @param {string} [o.date]
 * @param {string} [o.root]       repo root (default: cwd)
 * @param {boolean} [o.force]     overwrite an existing JD.md
 * @param {boolean} [o.track]     add a tracker row (default true)
 */
function createApplication({ company, role, markdown, date = today(), root = process.cwd(), force = false, track = true }) {
  const rel = path.posix.join("applications", folderName(company, role, date));
  const dir = path.join(root, rel);
  const jd = path.join(dir, "JD.md");
  fs.mkdirSync(dir, { recursive: true });
  let wrote = false;
  if (!fs.existsSync(jd) || force) {
    fs.writeFileSync(jd, markdown || stub(company, role, date));
    wrote = true;
  }
  const tracked = track ? tracker.addRow(path.join(root, "application-tracker.md"), { date, company, role, folder: rel }) : false;
  return { folder: rel, dir, jdPath: jd, wroteJd: wrote, tracked };
}

function stub(company, role, date) {
  return `# ${role} — ${company}

- **Source:** pasted by user, ${date}
- **Location:**
- **Type:**
- **Salary:**
- **Visa / work rights:**

## Job description

<!-- Paste the full job description here, unchanged. -->
`;
}

module.exports = { today, companySlug, roleSlug, folderName, createApplication };
