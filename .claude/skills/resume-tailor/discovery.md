# Asking about gaps

Ask only when a **must-have** scores below 60% (see `matching.md`), or in deep mode. At most **3 questions, in one message**. People often have the experience and simply never wrote it down; good questions find it in one round.

## Every question collects three things at once

1. **Did you do it?** (yes, partly, learning only, no)
2. **Where?** Which employer, named exactly as in the master resume, or "personal project" or "course"
3. **How much?** Any number: scale, count, before and after, duration

If a question tool offers multiple choice, make the options carry the employer, so one click answers both "did you" and "where":

```
JD needs: contract testing (Pact or similar). Your library has no contract testing.
Have you done it, and where?
  ( ) Yes, at <most recent employer>
  ( ) Yes, at <earlier employer>
  ( ) Yes, but only in a personal project or course
  ( ) No
  ( ) Other: tell me the tool and any numbers
```

Then ask for the number in the same message if it matters for the JD: "If yes, roughly how many services or tests?"

## Writing good questions

- **Name the gap and why it matters:** "The JD requires 2+ years of hands-on performance testing; your library only says you ran JMeter tests."
- **Offer the likely adjacent experience as options**, so the user recognises it: "Designed the test scripts yourself", "Found and traced a bottleneck", "Stress, soak or spike tests too".
- **Group related gaps** into one question with multiple selection (for example observability: Grafana, Datadog, OpenTelemetry, None).
- **Always include a "None / no" option.** A clear "no" is valuable.
- **Don't ask** about things already in the library, or already confirmed as "NOT held".

## Recording the answers

Record immediately, whether the answer is yes or no.

**Yes, with an employer:**
```bash
npm run add -- --skill="Contract testing" --where="<Employer>" --detail="Consumer contract tests between payment services" --jd="<Company Role>"
```

**Yes, with a number:**
```bash
npm run add -- --metric="35%" --where="<Employer>" --detail="Cut flaky tests by 35% after the migration" --jd="<Company Role>"
```

**Yes, but no employer given:** record it with `--where="employer not given"`. It can go in skills or summary lines only until the user names one.

**No:** record it, so you never ask again and the truth check treats it as a gap:
```bash
npm run add -- --not-held="Webhook testing" --jd="<Company Role>"
```

**"Don't name the tool":** sometimes the user confirms the work but not the tool, or asks you to keep it generic. Record exactly that:
```markdown
- **Contract testing (<Employer>):** real project use. Tool not given; keep it generic, don't name Pact.
```

## After the answers

- Re-score the affected requirements.
- If something is still below 60%, keep it as a gap. Don't ask a second round in fast mode.
- Put the newly confirmed items in the report's "Wording changes", so the user sees where each one was used.
- Note anything still unresolved (an employer not given, a missing number) in the report's "Please confirm" list for next time.
