# Agent instructions

This repository tailors a resume to a job description. It works with any coding agent that can read files and run terminal commands (Codex CLI, GitHub Copilot, Cursor, Cline, Continue, Gemini CLI, Aider and others).

**Before doing anything, read these files and follow them exactly:**

1. `CLAUDE.md`: the workflow, the folder layout and the non-negotiable rules. It was written for Claude Code, but every step applies to you.
2. `.claude/skills/resume-tailoring/SKILL.md`: the detailed tailoring method. Its supporting files are in the same folder (`research-prompts.md`, `matching-strategies.md`, `branching-questions.md`, `multi-job-workflow.md`).

Commands are the same on macOS, Linux and Windows: always use the `npm run ...` scripts (for example `npm run import`, `npm run ats`), never `.venv/bin/python` directly.

## The rules that matter most

- **Never fabricate.** Use only facts from `resumes/master_resume.md` and `resumes/experience_bank.md`, or what the user tells you in chat. Never use anything in the master resume's "Rejected" list.
- **Ask, don't guess.** If a must-have requirement isn't supported by the library, ask the user (up to 3 short questions in one message) before writing.
- **Run both checks before you finish**, and fix the resume until they pass:
  - `npm run truth -- <resume.json> resumes/master_resume.md resumes/experience_bank.md`
  - `npm run ats -- <resume.json> <output basename>`

If the truth check flags a skill or metric the user might genuinely have, ask them. Record it only after they confirm in chat, using `npm run add -- --skill="X" --where="<employer>" --detail="<what they did>"`, then re-run the check. Never answer `--interactive` prompts yourself, and never treat `--warn` as passing. The section "When the truth check fails" in `CLAUDE.md` has the full rules.

If you can't browse the web, ask the user to paste the job description.
