// Manages application-tracker.md from the command line.
//
// Usage:
//   npm run track                                   list every application, with a count per status
//   npm run track -- list [--status=applied]        list, filtered by status text
//   npm run track -- update "<company or folder>" --status="Applied (2026-11-20)" [--coverage="~85%"]
//   npm run track -- add --company="Acme" --role="QA Engineer" [--folder=...] [--coverage=...] [--status=...] [--date=...]
//   --file=path   use another tracker file (default: application-tracker.md)
const path = require("path");
const tracker = require("./tracker");
const { folderName, today } = require("./applications");

const args = process.argv.slice(2);
const opt = (n) => {
  const a = args.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : undefined;
};
const pos = args.filter((a) => !a.startsWith("--"));
const cmd = pos[0] || "list";
const file = opt("file") || "application-tracker.md";

function bucket(status) {
  const s = (status || "").toLowerCase();
  if (/offer/.test(s)) return "offer";
  if (/reject|declined|position closed|unsuccessful/.test(s)) return "rejected";
  if (/not applying|not suitable|skip|withdrew/.test(s)) return "not applying";
  if (/interview(ing)? (on|scheduled|booked|with|stage)|invited to interview|interview invite|\binterviewing\b/.test(s)) return "interview";
  if (/not applied|resume ready|ready/.test(s)) return "resume ready";
  if (/applied|sent|submitted|under review/.test(s)) return "applied";
  if (/jd saved/.test(s)) return "jd saved";
  return "other";
}

try {
  if (cmd === "list") {
    const want = (opt("status") || "").toLowerCase();
    const { rows } = tracker.load(file);
    const shown = rows.filter((r) => !want || (r[5] || "").toLowerCase().includes(want) || bucket(r[5]) === want);
    if (!shown.length) console.log(rows.length ? "No applications match." : `No applications yet in ${file}.`);
    for (const r of shown) console.log(`${r[0]}  ${r[1]} — ${r[2]}\n            ${r[5]}   [${r[3]}]   ${r[4]}`);
    const counts = {};
    for (const r of rows) counts[bucket(r[5])] = (counts[bucket(r[5])] || 0) + 1;
    if (rows.length) console.log(`\n${rows.length} total: ` + Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(", "));
  } else if (cmd === "update") {
    if (!pos[1] || (!opt("status") && !opt("coverage"))) throw new Error('Usage: npm run track -- update "<company or folder>" --status="..." [--coverage="..."]');
    const row = tracker.updateRow(file, pos[1], { status: opt("status"), coverage: opt("coverage") });
    console.log(`updated ${row[1]} — ${row[2]}: ${row[5]} [${row[3]}]`);
  } else if (cmd === "add") {
    const company = opt("company");
    const role = opt("role");
    if (!company || !role) throw new Error('Usage: npm run track -- add --company="..." --role="..."');
    const date = opt("date") || today();
    const folder = opt("folder") || path.posix.join("applications", folderName(company, role, date));
    const added = tracker.addRow(file, { date, company, role, folder, coverage: opt("coverage"), status: opt("status") });
    console.log(added ? `added ${company} — ${role}` : `already tracked: ${folder}`);
  } else {
    throw new Error(`Unknown command "${cmd}". Use list, update or add.`);
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
