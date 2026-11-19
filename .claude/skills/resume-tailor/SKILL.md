---
name: resume-tailor
description: Tailor a resume to a job description using only facts from the user's own resume library. Use when the user pastes a job description or a job URL, asks for a tailored resume or CV, asks to revise one, or asks for application material (recruiter reply, LinkedIn note, cover letter, screening answers) for a specific job.
---

# Resume Tailor

Turn a job description (JD) into a tailored, ATS-safe resume, a report and application material, using only what the user has really done.

**The one rule that overrides everything:** every fact in the output must trace to `resumes/master_resume.md`, `resumes/experience_bank.md`, or something the user said in this conversation. Reword and reorder freely; never invent. When in doubt, ask.

Supporting files in this folder:
- `matching.md`: how to score each requirement and choose bullets
- `discovery.md`: how to ask the user about gaps (and record the answers)
- `writing.md`: bullet, summary, headline and skills-line rules
- Playbooks in `playbooks/`: `fetching-jds.md`, `visa-and-work-rights.md`, `salary-research.md`
- Templates in `templates/`: `Report.md` and the outreach messages

## Modes

- **Fast (default):** one checkpoint at most, only when a must-have is unsupported. Everything else you decide and disclose in the report.
- **Deep (user says "deep mode"):** stop for approval after the requirement map (step 3), after the discovery answers (step 4) and before building (step 6).
- **Batch (several JDs at once):** do steps 1–3 for every JD first, ask one combined set of discovery questions covering all of them (step 4), then build each one.

## Workflow

### 1. Load the library
Read `resumes/master_resume.md` and `resumes/experience_bank.md` in full. Note three lists before you look at the JD:
- **Confirmed facts:** employers, exact titles, exact dates, metrics, tools.
- **Rejected:** anything in the master resume's "Rejected" section. It must never appear, not even as "similar to X".
- **Unattributed:** experience-bank items with no employer. They may appear in skills or summary lines only, never under a job.

If the library is missing, tell the user and offer `npm run import -- <old resumes folder> --recursive -o resumes/imported`. Then build `master_resume.md` *with* them, confirming each fact.

### 2. Get the JD
- **URL:** run `npm run fetch -- "<url>"`. It creates `applications/<Company>_<Role>_<date>/JD.md` and adds a tracker row. If it can't fetch the page (LinkedIn, login walls, JS-only pages), use your own browsing tool if you have one, otherwise ask the user to paste the text. See `playbooks/fetching-jds.md`.
- **Pasted text:** run `npm run new -- "<Company>" "<Role>"`, then write the text into the `JD.md` it created.
- **File** (PDF, DOCX, PPTX, image): `npm run import -- <file> -o <folder>`, then save it as `JD.md`.

Never edit the JD's wording. If you had to paraphrase (for example, a source you may not copy verbatim), say so at the top of `JD.md`.

### 3. Map the requirements
Split the JD into **must-haves** (required, "you have", years, certifications, work rights, language) and **nice-to-haves**. Then:
- Score each against the library using `matching.md` (Direct / Transferable / Adjacent / Gap).
- Do quick research: 2–3 searches about the company, what it builds, and whether it can hire you. Check visa sponsorship and work rights for the job's country (`playbooks/visa-and-work-rights.md`). Skip profile scraping.
- Note **knockouts**: work rights, mandatory language, mandatory domain, years far beyond the user's. Raise them in the reply instead of hiding them.

### 4. Ask about gaps (only when needed)
If any **must-have** scores below 60%, ask up to 3 questions in **one** message, following `discovery.md`. Every question must collect the employer and any number in the same answer, so there are no follow-ups.

Record every confirmed answer straight away with `npm run add` (see `discovery.md`), including answers that say "no": those go in the experience bank as "Confirmed NOT held" so you never ask again.

If no must-have is below 60%, don't ask. Go straight to building.

### 5. Plan the resume
Decide, then disclose in the report:
- **Headline:** can mirror the target title if the user's work supports it ("SDET Lead | ..."). **Job titles under each employer never change.**
- **Order and length:** most relevant role content first within each job. Default to the master resume's length (1 page up to about 5 years' experience, otherwise up to 2 pages). Drop the least relevant bullets rather than shrinking the font.
- **Contact line:** from the master resume only. Add "Open to relocating to <city> with visa sponsorship" when the job is abroad and the user needs sponsorship. Show only the local city for local roles.
- **Country norms:** use the master resume's country-specific details only when that country expects them (for example, date of birth on a German CV).

### 6. Write and build
1. Write `resume.json` in the job folder. `examples/jane-doe/resume.json` shows the exact format. Follow `writing.md`.
2. Build and check, fixing and rebuilding until both checks pass:
   ```bash
   npm run build -- <folder>/resume.json <folder>/<Name>_<Company>_<Role>_Resume
   npm run pdf -- <folder>/<Name>_<Company>_<Role>_Resume
   npm run truth -- <folder>/resume.json resumes/master_resume.md resumes/experience_bank.md
   npm run ats -- <folder>/resume.json <folder>/<Name>_<Company>_<Role>_Resume --keywords <folder>/JD.md
   ```
3. If the truth check flags something:
   - you invented it: remove it;
   - the user might have it: ask them (never answer `--interactive` yourself), record it with `npm run add`, then re-run.

   Never ship a resume that only passes with `--warn`.
4. Check the page count against the plan.

### 7. Report and reply
- Write `Report.md` from `templates/Report.md`: role snapshot, check-before-applying, coverage table, wording changes, open questions, interview prep and sources.
- Update the tracker: `npm run track -- update "<folder or company>" --coverage "~85%" --status "Resume ready, not applied"`.
- **Reply briefly:**
  - the folder path and the coverage %;
  - the top 5 matched keywords;
  - gaps and how you handled them;
  - every wording change or reframing;
  - knockouts to check before applying.

  The files hold the detail; don't repeat them.

## Revisions
When the user says "shorter", "emphasise X", "change the headline", "1 page", "remove Y" and so on:
- Edit that job's `resume.json` in place, rebuild, and re-run both checks.
- Update `Report.md` if coverage or wording changed.
- Never create a second folder for the same job.

## Application material
When the user asks for a recruiter reply, LinkedIn note, application email, cover letter or screening-form answer, use the matching file in `templates/`. The same truth rule applies: only library facts, the job's real details, and the user's real notice period, location and availability. Give it as ready-to-paste text. Respect length limits: LinkedIn connection notes are 300 characters.

## Status updates
When the user reports progress ("applied", "rejected", "interview on Monday", "not applying"), update the tracker with `npm run track -- update "<company>" --status "..."` and include the date.

## What you must never do
- Invent or round up a metric, tool, employer, title, date, certification or scope ("led" when they "helped").
- Put an unattributed skill under a job.
- Use a Rejected item, or name a tool as "similar to" a rejected one.
- Copy facts from old resumes or cover letters that aren't in the library.
- Put the user's personal data anywhere outside `resumes/`, `applications/` and `application-tracker.md`. Those paths are git-ignored.
- Send, submit or post anything for the user. Draft it; they send it.
