// Creates an application folder for a pasted job description:
// applications/<Company>_<Role>_<YYYY-MM-DD>/JD.md (a stub to paste into) plus a tracker row.
// Usage: node tools/new_application.js "<Company>" "<Role>" [--date=YYYY-MM-DD] [--from=jd.txt] [--no-track]
//   --from   read the JD text from a file instead of writing a stub
const fs = require("fs");
const { createApplication, today } = require("./applications");

const args = process.argv.slice(2);
const opt = (n) => (args.find((a) => a.startsWith(`--${n}=`)) || "").slice(n.length + 3);
const [company, role] = args.filter((a) => !a.startsWith("--"));
if (!company || !role) {
  console.error('Usage: npm run new -- "<Company>" "<Role>" [--date=YYYY-MM-DD] [--from=jd.txt]');
  process.exit(2);
}
const date = opt("date") || today();
let markdown;
if (opt("from")) {
  const text = fs.readFileSync(opt("from"), "utf8").trim();
  markdown = `# ${role} — ${company}\n\n- **Source:** pasted by user, ${date}\n\n${text}\n`;
}
const res = createApplication({ company, role, date, markdown, track: !args.includes("--no-track") });
console.log(`${res.wroteJd ? "created" : "kept existing"} ${res.folder}/JD.md`);
if (res.tracked) console.log("  added a row to application-tracker.md");
if (!markdown && res.wroteJd) console.log("  paste the job description into it");
