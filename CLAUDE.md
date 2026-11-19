# JD → Tailored Resume (Claude Code workspace)

Paste a job description (text or URL) and Claude returns a tailored, ATS-friendly resume built only from your own resume library.

Powered by the `resume-tailoring` skill (`.claude/skills/resume-tailoring/`, from the MIT-licensed [varunr89/resume-tailoring-skill](https://github.com/varunr89/resume-tailoring-skill) in `vendor/`). Always invoke it when a JD arrives, and follow the house rules below where they differ.

## Folder layout

```
resumes/                   ← your private library (git-ignored)
│   ├── master_resume.md   ← source of truth
│   └── experience_bank.md ← experiences surfaced in past sessions
applications/              ← one folder per JD (git-ignored)
│   └── <Company>_<Role>_<YYYY-MM-DD>/  JD.md, resume.json, .md/.docx/.pdf, Report.md
application-tracker.md     ← one row per JD (git-ignored)
examples/                  ← fictional sample person, safe to publish
tools/build_resume.js      ← resume.json → .md + .docx + .html
tools/print_pdf.js         ← .html → .pdf (Puppeteer)
tools/to_markdown.py       ← PDF/DOCX/HTML/URL → .md (MarkItDown)
tools/ats_check.py         ← reads the DOCX/PDF back like an ATS and checks nothing was lost
```

Python tools need a one-time `npm run setup:py` (Python 3.10–3.14; creates `.venv/` with MarkItDown and all local formats). `npm run setup:py:extras` adds OCR, the MCP server, YouTube, audio and Azure.

## Importing an existing library or a JD file

- **Resumes:** if `resumes/` holds PDFs, Word, PowerPoint or other files, convert them first with `npm run import -- resumes --recursive -o resumes/imported`, then build `master_resume.md` from the converted text. Converted files are reference only: confirm facts with the user before they enter the master resume.
- **JD as a file, deck, spreadsheet or URL:** `npm run import -- <file-or-url> -o applications/<folder>`, then save the result as `JD.md`. If the `markitdown` MCP tool (`convert_to_markdown`) is available, you can use it instead.
- **Scanned PDFs or images:** use `--ocr`. Prefer a local model (`--llm-base-url http://localhost:11434/v1 --llm-model llava`). Only add `--allow-cloud` (sends the file to the LLM provider, Azure or a speech service) when the user has agreed to it in chat.
- Run `npm run import -- --list-formats` to see what's installed.

## When a JD arrives

1. **Check the library.** `resumes/master_resume.md` and `resumes/experience_bank.md` are the only source of truth. Never use anything in the master resume's "Rejected" list.
2. **Save the JD** to `applications/<Company>_<Role>_<YYYY-MM-DD>/JD.md`.
3. **Fast mode (default):** parse the JD, run 2–3 quick company searches, and score each requirement against the library. Ask up to 3 discovery questions in one message only if a must-have scores below 60%.
4. **Generate:** write `resume.json`, then run `npm run build -- <path>/resume.json <path>/<Name>_<Company>_<Role>_Resume` and `npm run pdf -- <path>/<base>`. Then run both guards and fix the resume until they pass:
   - `npm run truth -- <path>/resume.json resumes/master_resume.md resumes/experience_bank.md`: every number, employer, title, date and named tool must trace to the library. Use `--allow=Word` only for plain wording, never for a real tool.
   - `npm run ats -- <path>/resume.json <path>/<base>`: 100% readable from both DOCX and PDF. Write `Report.md` covering coverage, gaps, wording changes and interview prep.
5. **Reply briefly:** folder path, coverage %, top 5 keywords, gaps and how they were handled, and the reframings applied.
6. **Update** `application-tracker.md`, and add newly surfaced experiences to `experience_bank.md`, dated and tagged with the JD.

### When the truth check fails

- **Something you wrote that the user never said:** remove it from the resume. Don't ask the user to approve it after the fact.
- **A skill or metric the JD needs and the user might have:** ask the user, naming the item. If they confirm, record it with `npm run add -- --skill="X" --where="<employer>" --detail="<what they did>" --jd="<Company Role>"` (`--metric="35%"` for numbers), or ask them to run the truth check with `--interactive`. Then re-run the check.
- **Never** answer `--interactive` prompts yourself, never write to `experience_bank.md` without the user's confirmation in chat, and never ship a resume that only passes with `--warn`.
- **No employer given** ("personal project" or blank): the claim may go in skills or summary only, not under a job.

Say **"deep mode"** for the full skill workflow with all checkpoints.

## Non-negotiable rules

- **Never fabricate.** Every claim must trace to the library or to something the user said in chat.
- **A new claim goes under a job only when the user names the employer;** otherwise it goes in skills or summary only.
- **Company names, dates and job titles stay exact.** Any headline reframing must be defensible and disclosed.
- **Mirror JD keywords where truthful;** no keyword stuffing.
- **ATS format:** single column, no tables or graphics, standard headings, A4, at most 2 pages.
