// Appends user-confirmed facts to the experience bank, in a format the truth check can read.
// Shared by tools/add_experience.js and the --interactive mode of tools/truth_check.js.
const fs = require("fs");
const path = require("path");

const today = () => new Date().toISOString().slice(0, 10);

/**
 * @param {string} bankPath  path to experience_bank.md (created if missing)
 * @param {{label: string, where: string, detail?: string}[]} entries
 * @param {string} [jd]      which job description surfaced these facts
 */
function appendEntries(bankPath, entries, jd) {
  if (!entries.length) return;
  fs.mkdirSync(path.dirname(path.resolve(bankPath)), { recursive: true });
  const exists = fs.existsSync(bankPath);
  const header = exists ? "" : "# Experience Bank\n\nFacts confirmed by the user that aren't in the master resume yet.\n";
  const lines = entries.map((e) => {
    const where = e.where && e.where.trim() ? e.where.trim() : "employer not given";
    const detail = e.detail && e.detail.trim() ? ` ${e.detail.trim().replace(/\s+/g, " ")}` : "";
    return `- **${e.label.trim()} (${where}):**${detail || " confirmed by user."}`;
  });
  const title = `## ${today()} — added by user${jd ? ` (JD: ${jd})` : ""}`;
  const sep = exists && !fs.readFileSync(bankPath, "utf8").endsWith("\n") ? "\n" : "";
  fs.appendFileSync(bankPath, `${header}${sep}\n${title}\n${lines.join("\n")}\n`);
}

module.exports = { appendEntries };
