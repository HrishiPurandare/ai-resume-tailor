# Gemini CLI instructions

Read `AGENTS.md` and follow it. It points you to `CLAUDE.md` (the workflow and rules) and to the resume-tailor skill in `.claude/skills/resume-tailor/`.

The short version: build the resume only from `resumes/master_resume.md` and `resumes/experience_bank.md`, never invent a fact, ask the user when a must-have is unsupported, and finish only when `npm run truth` and `npm run ats` both pass.
