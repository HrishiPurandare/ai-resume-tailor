// Builds an ATS-friendly resume (.md + .docx) from a resume.json.
// Usage: node build_resume.js <resume.json> <output basename without extension>
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, AlignmentType, LevelFormat, BorderStyle, TabStopType,
} = require("docx");

const [, , jsonPath, outBase] = process.argv;
const r = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

// ---------- Markdown ----------
const md = [];
md.push(`# ${r.name}`, "", `**${r.headline}**`, "", ...r.contact.map((c) => `${c}  `), "");
md.push("## Professional Summary", "", r.summary, "");
md.push("## Technical Skills", "", ...r.skills.map(([k, v]) => `- **${k}:** ${v}`), "");
md.push("## Professional Experience", "");
for (const e of r.experience) {
  md.push(`### ${e.title}`, `**${e.company}** | ${e.location} | ${e.dates}`, "", ...e.bullets.map((b) => `- ${b}`), "");
}
const projects = r.projects || []; // optional: [[name, description], ...]
if (projects.length) md.push("## Projects", "", ...projects.map(([k, v]) => `- **${k}:** ${v}`), "");
md.push("## Education", "", ...r.education.map((x) => `- ${x}`), "");
md.push("## Certifications", "", ...r.certifications.map((x) => `- ${x}`), "");
fs.writeFileSync(`${outBase}.md`, md.join("\n"));

// ---------- HTML (printed to PDF with headless Chrome) ----------
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const ul = (items) => `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(r.name)}</title><style>
@page { size: A4; margin: 15mm 17.6mm; }
body { font-family: Calibri, Carlito, Arial, sans-serif; font-size: 10.5pt; line-height: 1.3; color: #000; margin: 0; }
h1 { text-align: center; color: #1F3864; font-size: 16pt; margin: 0; }
.c { text-align: center; margin: 0; }
h2 { color: #1F3864; font-size: 11.5pt; text-transform: uppercase; border-bottom: 1px solid #1F3864; margin: 10pt 0 4pt; }
.role { display: flex; justify-content: space-between; font-weight: bold; margin-top: 6pt; }
.co { font-style: italic; margin-bottom: 2pt; }
.keep { break-inside: avoid; } h2 { break-after: avoid; }
ul { margin: 0; padding-left: 16pt; } li { margin-bottom: 2pt; } p { margin: 0; text-align: justify; }
</style></head><body>
<h1>${esc(r.name)}</h1><p class="c"><b>${esc(r.headline)}</b></p>${r.contact.map((c) => `<p class="c">${esc(c)}</p>`).join("")}
<h2>Professional Summary</h2><p>${esc(r.summary)}</p>
<h2>Technical Skills</h2>${ul(r.skills.map(([k, v]) => `<b>${esc(k)}:</b> ${esc(v)}`))}
<h2>Professional Experience</h2>${r.experience.map((e) => `<div class="keep"><div class="role"><span>${esc(e.title)}</span><span>${esc(e.dates)}</span></div><div class="co">${esc(e.company)} | ${esc(e.location)}</div>${ul(e.bullets.slice(0, 1).map(esc))}</div>${ul(e.bullets.slice(1).map(esc))}`).join("")}
${projects.length ? `<h2>Projects</h2>${ul(projects.map(([k, v]) => `<b>${esc(k)}:</b> ${esc(v)}`))}` : ""}
<h2>Education</h2>${ul(r.education.map(esc))}
<h2>Certifications</h2>${ul(r.certifications.map(esc))}
</body></html>`;
fs.writeFileSync(`${outBase}.html`, html);

// ---------- DOCX ----------
const FONT = "Calibri";
const BODY = 21; // half-points (10.5pt)
const TEXT_WIDTH = 11906 - 2 * 1000; // A4 width minus margins

const heading = (text) =>
  new Paragraph({
    spacing: { before: 200, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "1F3864", space: 1 } },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 23, color: "1F3864", font: FONT })],
  });
const bullet = (children) =>
  new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 40 }, children });
const run = (text, opts = {}) => new TextRun({ text, size: BODY, font: FONT, ...opts });

const children = [
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: r.name, bold: true, size: 32, font: FONT, color: "1F3864" })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [run(r.headline, { bold: true })] }),
  ...r.contact.map((c) => new Paragraph({ alignment: AlignmentType.CENTER, children: [run(c)] })),
  heading("Professional Summary"),
  new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: [run(r.summary)] }),
  heading("Technical Skills"),
  ...r.skills.map(([k, v]) => bullet([run(`${k}: `, { bold: true }), run(v)])),
  heading("Professional Experience"),
];
for (const e of r.experience) {
  children.push(
    new Paragraph({
      spacing: { before: 120 },
      keepNext: true,
      tabStops: [{ type: TabStopType.RIGHT, position: TEXT_WIDTH }],
      children: [run(e.title, { bold: true }), run(`\t${e.dates}`, { bold: true })],
    }),
    new Paragraph({ keepNext: true, spacing: { after: 40 }, children: [run(`${e.company} | ${e.location}`, { italics: true })] }),
    ...e.bullets.map((b) => bullet([run(b)])),
  );
}
if (projects.length) children.push(heading("Projects"), ...projects.map(([k, v]) => bullet([run(`${k}: `, { bold: true }), run(v)])));
children.push(heading("Education"), ...r.education.map((x) => bullet([run(x)])));
children.push(heading("Certifications"), ...r.certifications.map((x) => bullet([run(x)])));

const doc = new Document({
  creator: r.name.replace(/\b\w+/g, (w) => w[0] + w.slice(1).toLowerCase()),
  styles: { default: { document: { run: { font: FONT, size: BODY } } } },
  numbering: {
    config: [{
      reference: "bullets",
      levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 360, hanging: 240 } } } }],
    }],
  },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 850, bottom: 850, left: 1000, right: 1000 } } },
    children,
  }],
});
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(`${outBase}.docx`, buf);
  console.log(`Wrote ${outBase}.md and ${outBase}.docx`);
});
