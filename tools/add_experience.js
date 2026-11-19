// Records a skill, tool, metric or piece of work you've done in your experience bank,
// so tailored resumes (and the truth check) can use it.
//
// Usage:
//   npm run add -- --skill="Kubernetes" --where="Example Payments Ltd" --detail="Deployed test environments per microservice"
//   npm run add -- --metric="35%" --where="Example Payments Ltd" --detail="Reduced flaky tests by 35% after the Playwright migration"
//   npm run add            (no flags: asks the questions one by one)
//
// Options:
//   --skill=NAME     a tool, technology, method or certification
//   --metric=VALUE   a number you want to use (35%, 400, 2 hours ...); put it in --detail too
//   --where=TEXT     employer name exactly as in your master resume, or "personal project", "course", ...
//   --detail=TEXT    one line on what you did; this is what makes it usable in a bullet
//   --jd=TEXT        the job description that prompted it (optional)
//   --bank=PATH      experience bank file (default: resumes/experience_bank.md)
//   --master=PATH    master resume, checked so Rejected items can't be added (default: resumes/master_resume.md)
//
// Only record what you actually did. The truth check trusts this file.
const { appendEntries } = require("./experience_bank");

const args = process.argv.slice(2);
const opt = (name) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : undefined;
};

async function askAll() {
  const rl = require("readline").createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((res) => rl.question(q, (a) => res(a.trim())));
  const kind = (await ask("Add a (s)kill/tool or a (m)etric? [s/m] ")).toLowerCase().startsWith("m") ? "metric" : "skill";
  const value = await ask(kind === "metric" ? "Metric (e.g. 35%): " : "Skill or tool (e.g. Kubernetes): ");
  const where = await ask("Where? (employer as in your master resume, or 'personal project'): ");
  const detail = await ask("What did you do? (one line): ");
  const jd = await ask("Which job description prompted this? (optional): ");
  rl.close();
  return { kind, value, where, detail, jd };
}

(async () => {
  const bank = opt("bank") || "resumes/experience_bank.md";
  let entry;
  if (opt("skill") || opt("metric")) {
    entry = { kind: opt("metric") ? "metric" : "skill", value: opt("metric") || opt("skill"), where: opt("where"), detail: opt("detail"), jd: opt("jd") };
  } else {
    entry = await askAll();
  }
  if (!entry.value) {
    console.error("Nothing to add: give --skill or --metric (or answer the questions).");
    process.exit(2);
  }
  const master = opt("master") || "resumes/master_resume.md";
  if (require("fs").existsSync(master)) {
    const text = require("fs").readFileSync(master, "utf8");
    const rejected = text.split(/\n(?=#{1,6}\s)/).filter((sec) => /^#{1,6}\s.*rejected/i.test(sec)).join("\n").toLowerCase();
    const esc = entry.value.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|[^a-z0-9])${esc}($|[^a-z0-9])`).test(rejected)) {
      console.error(`"${entry.value}" is on the Rejected list in ${master}. Remove it there first if it's actually true.`);
      process.exit(1);
    }
  }
  if (!entry.where) console.warn("Note: no employer given. Tailored resumes will keep this in skills or summary only, not under a job.");
  const label = entry.kind === "metric" ? `Metric "${entry.value}"` : entry.value;
  let detail = entry.detail || "";
  if (entry.kind === "metric" && !detail.includes(entry.value)) detail = `${detail} (${entry.value})`.trim();
  appendEntries(bank, [{ label, where: entry.where, detail }], entry.jd);
  console.log(`Added to ${bank}: ${label}${entry.where ? ` (${entry.where})` : ""}`);
})();
