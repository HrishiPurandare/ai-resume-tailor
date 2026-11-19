# AI Resume Tailor (Claude Code workspace)

Paste a job description (text or URL) and get a tailored, ATS-safe resume built only from your own resume library, plus a report and application material.

**When a job description, job URL or resume request arrives, use the `resume-tailor` skill** (`.claude/skills/resume-tailor/SKILL.md`) and follow it exactly. It covers the workflow, matching, discovery questions, writing rules, revisions, outreach messages and tracker updates.

Personal instructions (your career goals, extra rules, paths to your own projects) go in `CLAUDE.local.md`, which is git-ignored and loaded automatically.

## Folder layout

```
resumes/                    your private library (git-ignored)
├── master_resume.md        source of truth, including a "Rejected" list
└── experience_bank.md      facts confirmed in past sessions (npm run add)
applications/               one folder per job (git-ignored)
└── <Company>_<Role>_<YYYY-MM-DD>/   JD.md, resume.json, .md/.docx/.pdf, Report.md
application-tracker.md      one row per job (git-ignored; npm run track)
.claude/skills/resume-tailor/   the skill: SKILL.md, matching.md, discovery.md, writing.md
playbooks/                  fetching JDs, visa and work rights, salary research
templates/                  Report.md, outreach messages, cover letter, screening answers
examples/jane-doe/          fictional person: library, JD, resume, report
tools/                      the commands below
```

## Commands (the same on macOS, Linux and Windows)

| Step | Command |
|---|---|
| Fetch a job from a URL | `npm run fetch -- "<url>"` |
| Start from pasted text | `npm run new -- "<Company>" "<Role>"` |
| Import a file (PDF, DOCX, PPTX...) | `npm run import -- <file> -o <folder>` |
| Build | `npm run build -- <folder>/resume.json <folder>/<base>` then `npm run pdf -- <folder>/<base>` |
| Truth check | `npm run truth -- <folder>/resume.json resumes/master_resume.md resumes/experience_bank.md` |
| ATS check | `npm run ats -- <folder>/resume.json <folder>/<base> --keywords <folder>/JD.md` |
| Record a confirmed fact | `npm run add -- --skill="X" --where="<Employer>" --detail="..."` (or `--metric=`, or `--not-held=`) |
| Tracker | `npm run track` / `npm run track -- update "<company>" --status="Applied (YYYY-MM-DD)"` |

Python tools need a one-time `npm run setup:py`; `npm run setup:py:extras` adds OCR, the MarkItDown MCP server, YouTube, audio and Azure. Cloud features need `--allow-cloud`. Only add it when the user has agreed to it in chat.

## Non-negotiable rules

- **Never fabricate.** Every claim traces to the library or to something the user said in chat. Never use a Rejected item.
- **A claim goes under a job only when the user named that employer;** otherwise it goes in skills or summary only.
- **Company names, dates and job titles stay exact.** Headline reframing must be defensible and disclosed.
- **Both checks must pass before a resume is finished.** Never treat `--warn` as passing, and never answer `--interactive` prompts for the user.
- **Personal data stays in the git-ignored paths.** Don't put it in tracked files. `npm run privacy` and the pre-commit hook (`npm run hooks`) check this.
- **Draft, don't send.** Never send, submit or post anything on the user's behalf.
