// Fetches a job description from a URL and saves it as applications/<Company>_<Role>_<date>/JD.md,
// with a tracker row. Uses the job board's public posting API when it recognises the URL, and the
// page's structured JobPosting data (schema.org JSON-LD) otherwise.
//
// Supported directly: Greenhouse (incl. EU), Ashby, Lever (incl. EU), SmartRecruiters, Workable,
// and any career page that publishes JobPosting JSON-LD (Workday, Phenom, iCIMS, SuccessFactors and
// most company sites do). Falls back to MarkItDown (if installed) for plain pages.
// LinkedIn, Indeed and Glassdoor block automated access: paste those JDs instead (`npm run new`).
//
// Usage:
//   node tools/fetch_jd.js <url> [--stdout] [--force] [--date=YYYY-MM-DD] [--no-track]
//     --stdout    print the JD Markdown instead of creating a folder
//     --force     overwrite an existing JD.md
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { createApplication, today } = require("./applications");

const UA = "Mozilla/5.0 (compatible; ai-resume-tailor/1.0; +https://github.com/HrishiPurandare/ai-resume-tailor)";
const BLOCKED = /(^|\.)(linkedin\.com|indeed\.[a-z.]+|glassdoor\.[a-z.]+)$/i;

// ---------- HTML -> Markdown (small, dependency-free) ----------
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', hellip: "…", bull: "•", middot: "·", eacute: "é", uuml: "ü", ouml: "ö", auml: "ä", copy: "©", reg: "®", trade: "™" };
function decode(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}
function htmlToMarkdown(html) {
  let s = String(html || "");
  if (/&lt;\/?[a-z]/i.test(s) && !/<\/?[a-z]/i.test(s)) s = decode(s); // HTML delivered escaped (Greenhouse)
  s = s
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => `\n\n${"#".repeat(Math.min(6, Number(n) + 1))} ${t.replace(/<[^>]+>/g, "").trim()}\n\n`)
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(p|div|ul|ol|section|article|tr|table)>/gi, "\n\n")
    .replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, t) => (t.trim() ? `**${t.trim()}**` : ""))
    .replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, t) => (t.trim() ? `*${t.trim()}*` : ""))
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, t) => (t.trim() && !href.startsWith("mailto:") && href !== t.trim() ? `${t.trim()} (${href})` : t))
    .replace(/<[^>]+>/g, "");
  return decode(s)
    .replace(/ /g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+(?=\S)/g, (m) => (m.includes("- ") ? m : "\n"))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const titleCase = (slug) => String(slug || "").replace(/[-_]+/g, " ").replace(/\b[a-z]/g, (c) => c.toUpperCase());

// ---------- source detection ----------
function detect(url) {
  const u = new URL(url);
  const host = u.hostname.toLowerCase();
  const parts = u.pathname.split("/").filter(Boolean);
  if (BLOCKED.test(host)) return { kind: "blocked", host };
  if (/(^|\.)greenhouse\.io$/.test(host)) {
    const i = parts.indexOf("jobs");
    const id = (i > 0 && parts[i + 1]) || u.searchParams.get("gh_jid");
    if (i > 0 && id) {
      // EU boards (job-boards.eu.greenhouse.io) are served by the same global API
      return { kind: "greenhouse", board: parts[i - 1], id, api: `https://boards-api.greenhouse.io/v1/boards/${parts[i - 1]}/jobs/${id}` };
    }
  }
  if (host === "jobs.ashbyhq.com" && parts.length >= 2) {
    return { kind: "ashby", org: parts[0], id: parts[1], api: `https://api.ashbyhq.com/posting-api/job-board/${parts[0]}?includeCompensation=true` };
  }
  if (/^jobs\.(eu\.)?lever\.co$/.test(host) && parts.length >= 2) {
    const eu = host.includes(".eu.");
    return { kind: "lever", company: parts[0], id: parts[1], api: `https://api${eu ? ".eu" : ""}.lever.co/v0/postings/${parts[0]}/${parts[1]}` };
  }
  if (/^(jobs|careers)\.smartrecruiters\.com$/.test(host) && parts.length >= 2) {
    const id = parts[1].split("-")[0];
    return { kind: "smartrecruiters", company: parts[0], id, api: `https://api.smartrecruiters.com/v1/companies/${parts[0]}/postings/${id}` };
  }
  if (host === "apply.workable.com" && parts.length >= 3 && parts[1] === "j") {
    return { kind: "workable", account: parts[0], id: parts[2], api: `https://apply.workable.com/api/v2/accounts/${parts[0]}/jobs/${parts[2]}` };
  }
  return { kind: "page" };
}

// ---------- parsers (pure: payload -> job) ----------
// job = { title, company, location, type, salary, posted, url, description (markdown) }
function fromGreenhouse(d, src, url) {
  return {
    title: d.title,
    company: d.company_name || titleCase(src.board),
    location: d.location?.name,
    posted: (d.first_published || d.updated_at || "").slice(0, 10),
    salary: (d.pay_input_ranges || []).map((p) => `${p.min_cents / 100}–${p.max_cents / 100} ${p.currency_type}`).join("; "),
    url: d.absolute_url || url,
    description: htmlToMarkdown(d.content),
  };
}
function fromAshby(d, src, url) {
  const job = (d.jobs || []).find((j) => j.id === src.id || (j.jobUrl || "").includes(src.id));
  if (!job) throw new Error(`Ashby board "${src.org}" has no live posting ${src.id} (it may have closed)`);
  return {
    title: job.title,
    company: d.organizationName || titleCase(src.org),
    location: [job.location, job.workplaceType || (job.isRemote ? "Remote" : "")].filter(Boolean).join(", "),
    type: job.employmentType,
    salary: job.compensation?.compensationTierSummary || job.compensation?.scrapeableCompensationSalarySummary,
    posted: (job.publishedAt || "").slice(0, 10),
    url: job.jobUrl || url,
    description: job.descriptionHtml ? htmlToMarkdown(job.descriptionHtml) : job.descriptionPlain,
  };
}
function fromLever(d, src, url) {
  const lists = (d.lists || []).map((l) => `## ${decode(l.text)}\n\n${htmlToMarkdown(l.content)}`).join("\n\n");
  const sal = d.salaryRange ? `${d.salaryRange.min}–${d.salaryRange.max} ${d.salaryRange.currency} ${d.salaryRange.interval || ""}`.trim() : "";
  return {
    title: d.text,
    company: titleCase(src.company),
    location: [d.categories?.location, d.workplaceType].filter(Boolean).join(", "),
    type: d.categories?.commitment,
    salary: sal,
    posted: d.createdAt ? new Date(d.createdAt).toISOString().slice(0, 10) : "",
    url: d.hostedUrl || url,
    description: [htmlToMarkdown(d.description), lists, htmlToMarkdown(d.additional)].filter(Boolean).join("\n\n"),
  };
}
function fromSmartRecruiters(d, src, url) {
  const sec = d.jobAd?.sections || {};
  const body = ["companyDescription", "jobDescription", "qualifications", "additionalInformation"]
    .map((k) => sec[k])
    .filter((x) => x && x.text)
    .map((x) => `## ${x.title}\n\n${htmlToMarkdown(x.text)}`)
    .join("\n\n");
  const loc = d.location || {};
  return {
    title: d.name,
    company: d.company?.name || src.company,
    location: [loc.city, loc.region, loc.country?.toUpperCase?.(), loc.remote ? "remote" : ""].filter(Boolean).join(", "),
    type: d.typeOfEmployment?.label,
    posted: (d.releasedDate || "").slice(0, 10),
    url: d.postingUrl || url,
    description: body,
  };
}
function fromWorkable(d, src, url) {
  const loc = d.location || {};
  return {
    title: d.title,
    company: titleCase(src.account),
    location: [loc.city, loc.country, d.workplace || d.remote ? d.workplace || "remote" : ""].filter(Boolean).join(", "),
    type: d.type,
    posted: (d.published || "").slice(0, 10),
    url,
    description: [d.description, d.requirements && `## Requirements\n\n${d.requirements}`, d.benefits && `## Benefits\n\n${d.benefits}`]
      .filter(Boolean)
      .map(htmlToMarkdown)
      .join("\n\n"),
  };
}
/** Finds a schema.org JobPosting in a page's JSON-LD. */
function fromJsonLd(html, url) {
  const blocks = [...String(html).matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const flatten = (x) => (Array.isArray(x) ? x.flatMap(flatten) : x && x["@graph"] ? flatten(x["@graph"]) : [x]);
  for (const b of blocks) {
    let data;
    try {
      data = JSON.parse(b.trim());
    } catch {
      continue;
    }
    const jp = flatten(data).find((x) => x && [].concat(x["@type"]).includes("JobPosting"));
    if (!jp) continue;
    const addr = [].concat(jp.jobLocation || []).map((l) => l?.address || {})[0] || {};
    const base = jp.baseSalary?.value || {};
    const salary = jp.baseSalary
      ? `${base.minValue ?? base.value ?? ""}${base.maxValue ? `–${base.maxValue}` : ""} ${jp.baseSalary.currency || ""} ${base.unitText ? `per ${base.unitText.toLowerCase()}` : ""}`.trim()
      : "";
    return {
      title: decode(jp.title || ""),
      company: decode(jp.hiringOrganization?.name || ""),
      location: [addr.addressLocality, addr.addressRegion, addr.addressCountry?.name || addr.addressCountry, jp.jobLocationType === "TELECOMMUTE" ? "remote" : ""]
        .filter((x) => typeof x === "string" && x)
        .join(", "),
      type: [].concat(jp.employmentType || []).join(", "),
      salary,
      posted: String(jp.datePosted || "").slice(0, 10),
      url: jp.url || url,
      description: htmlToMarkdown(jp.description),
    };
  }
  return null;
}

// ---------- output ----------
function toMarkdown(job, fetchedFrom, via, date = today()) {
  const meta = [
    `- **Source:** ${job.url || fetchedFrom} (fetched ${date} via ${via})`,
    job.location && `- **Location:** ${job.location}`,
    job.type && `- **Type:** ${job.type}`,
    job.salary && `- **Salary:** ${job.salary}`,
    job.posted && `- **Posted:** ${job.posted}`,
    `- **Visa / work rights:** ${/sponsor|visa|work (permit|authori[sz]ation|rights)|right to work/i.test(job.description) ? "mentioned: see the description" : "not stated"}`,
  ].filter(Boolean);
  return `# ${job.title} — ${job.company}\n\n${meta.join("\n")}\n\n${job.description.trim()}\n`;
}

// ---------- network ----------
async function getJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} from ${new URL(url).host}`);
  return res.json();
}
async function getText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" }, redirect: "follow" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} from ${new URL(url).host}`);
  return res.text();
}

async function fetchJob(url) {
  const src = detect(url);
  if (src.kind === "blocked") {
    throw new Error(
      `${src.host} blocks automated access. Copy the job text from the page, then run:\n` +
        `  npm run new -- "<Company>" "<Role>"\nand paste it into the JD.md it creates.`
    );
  }
  const parsers = { greenhouse: fromGreenhouse, ashby: fromAshby, lever: fromLever, smartrecruiters: fromSmartRecruiters, workable: fromWorkable };
  if (parsers[src.kind]) {
    try {
      return { job: parsers[src.kind](await getJson(src.api), src, url), via: `${src.kind} API` };
    } catch (err) {
      console.error(`note: ${src.kind} API failed (${err.message}); trying the page itself`);
    }
  }
  const html = await getText(url);
  const job = fromJsonLd(html, url);
  if (job && job.description) return { job, via: "JobPosting data on the page" };

  const py = require("./venv").venvBin("python");
  if (fs.existsSync(py)) {
    const res = spawnSync(py, [path.join(__dirname, "to_markdown.py"), url, "--stdout"], { encoding: "utf8" });
    if (res.status === 0 && res.stdout.trim().length > 200) {
      const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "Job description";
      return { job: { title: decode(title).trim(), company: new URL(url).hostname.replace(/^www\./, ""), url, description: res.stdout }, via: "MarkItDown (whole page)" };
    }
  }
  throw new Error(
    "Couldn't find the job text on that page (it may load with JavaScript). Copy it from the browser, then run:\n" +
      '  npm run new -- "<Company>" "<Role>"\nand paste it into the JD.md it creates.'
  );
}

async function main() {
  const args = process.argv.slice(2);
  const url = args.find((a) => /^https?:\/\//i.test(a));
  if (!url) {
    console.error('Usage: npm run fetch -- "<job url>" [--stdout] [--force] [--date=YYYY-MM-DD] [--no-track]');
    process.exit(2);
  }
  const date = (args.find((a) => a.startsWith("--date=")) || "").slice(7) || today();
  try {
    const { job, via } = await fetchJob(url);
    if (!job.title || !job.company) throw new Error("The posting has no title or company; paste it instead (npm run new)");
    const md = toMarkdown(job, url, via, date);
    if (args.includes("--stdout")) return void process.stdout.write(md);
    const res = createApplication({ company: job.company, role: job.title, markdown: md, date, force: args.includes("--force"), track: !args.includes("--no-track") });
    console.log(`${res.wroteJd ? "wrote" : "kept existing"} ${res.folder}/JD.md  (${via})`);
    if (!res.wroteJd) console.log("  (JD.md already existed; use --force to overwrite)");
    if (res.tracked) console.log("  added a row to application-tracker.md");
    console.log(`  ${job.title} — ${job.company}${job.location ? ` — ${job.location}` : ""}`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

module.exports = { detect, htmlToMarkdown, fromGreenhouse, fromAshby, fromLever, fromSmartRecruiters, fromWorkable, fromJsonLd, toMarkdown };
if (require.main === module) main();
