// Prints <base>.html to <base>.pdf (A4) with Puppeteer, then deletes the .html.
// Usage: node tools/print_pdf.js <output basename without extension>
const fs = require("fs");
const path = require("path");
(async () => {
  const { default: puppeteer } = await import("puppeteer"); // puppeteer is ESM-only
  const base = process.argv[2];
  if (!base) throw new Error("Usage: node tools/print_pdf.js <basename>");
  const html = path.resolve(`${base}.html`);
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.goto(`file://${html}`, { waitUntil: "networkidle0" });
  await page.pdf({ path: `${base}.pdf`, format: "A4", printBackground: true, preferCSSPageSize: true });
  await browser.close();
  fs.unlinkSync(html);
  console.log(`Wrote ${base}.pdf`);
})();
