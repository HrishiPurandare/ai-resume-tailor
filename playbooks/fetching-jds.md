# Getting the job description

Always try `npm run fetch -- "<url>"` first. This guide covers what it does and what to do when it can't fetch the page.

## What `npm run fetch` handles

| Site | URL looks like | How |
|---|---|---|
| Greenhouse | `boards.greenhouse.io/<board>/jobs/<id>`, `job-boards.greenhouse.io/...`, `job-boards.eu.greenhouse.io/...` | Public job board API |
| Ashby | `jobs.ashbyhq.com/<org>/<id>` | Public posting API (includes salary when published) |
| Lever | `jobs.lever.co/<company>/<id>`, `jobs.eu.lever.co/...` | Public postings API |
| SmartRecruiters | `jobs.smartrecruiters.com/<Company>/<id>-<slug>` | Public postings API |
| Workable | `apply.workable.com/<account>/j/<code>` | Public jobs API |
| Most company career pages (Workday, Phenom, iCIMS, SuccessFactors, Teamtailor, custom sites) | anything else | The page's schema.org `JobPosting` data |
| Plain pages without structured data | anything else | MarkItDown converts the whole page (needs `npm run setup:py`) |

It writes `applications/<Company>_<Role>_<date>/JD.md` with a metadata header (source, location, type, salary, posted date, and whether visa or work rights are mentioned), followed by the full description. It also adds a tracker row.

## When it can't

| Situation | What to do |
|---|---|
| **LinkedIn, Indeed, Glassdoor** | They block automated access, and copying their pages breaks their terms. Ask the user to copy the text (or use your own browsing tool, if you have one, to read it), then `npm run new -- "<Company>" "<Role>"` and paste it into `JD.md` |
| **"Couldn't find the job text"** (the page loads with JavaScript) | Use a browser tool if you have one; otherwise ask the user to paste it |
| **A recruiter message or email** | `npm run new -- "<Client or Recruiter>" "<Role>"` and paste the message, including the sender |
| **A PDF, Word file or screenshot** | `npm run import -- <file> -o applications/<folder>` (`--ocr` for screenshots or scans), then save the result as `JD.md` |
| **The posting has closed** (API says "no live posting") | Ask the user for a copy, or search the company's career site for the same role |

## Rules for `JD.md`

- **Keep the job's wording.** Don't summarise or "clean up" requirements; matching depends on the exact terms.
- **If you can only paraphrase** (for example, a source you may not copy verbatim), write that at the top of `JD.md`, and offer to replace it with the user's copy.
- **Record who posted it.** "Posted by a recruiter for an unnamed client" changes what the report should ask about.
- **Note anything time-sensitive:** posted date, applicant count, closing date.
