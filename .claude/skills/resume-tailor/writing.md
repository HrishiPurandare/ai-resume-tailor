# Writing the resume

## `resume.json` fields

| Field | What goes in it |
|---|---|
| `name` | As in the master resume (uppercase is fine) |
| `headline` | `Target title | 2–3 strengths | key tools`, under about 100 characters |
| `contact` | 1–2 lines, only from the master resume, joined with ` | ` |
| `summary` | 3–5 sentences (see below) |
| `skills` | 4–7 `[category, "comma, separated, items"]` pairs, most relevant category first |
| `experience` | Each job: `title`, `company`, `location`, `dates` **exactly as in the library**, plus `bullets` |
| `projects` | Optional `[name, description]` pairs, for public work only |
| `education`, `certifications` | As in the library; drop certifications irrelevant to the JD |

## Summary

1. **First sentence:** years of experience plus the identity the JD wants, with a certification if it's relevant: "ISTQB-certified SDET with 7+ years in test automation for banking and payments."
2. **One or two sentences** on the strongest evidence for the top must-haves, including a number.
3. **One sentence** on the second theme the JD cares about (AI testing, leadership, performance...).
4. **Optional:** availability or location if it helps: "Based in Dubai; available on 30 days' notice."

No first person, no "passionate", no "results-driven".

## Bullets

- **Pattern:** verb + what + how (tools) + result. "Cut full regression from 7 hours to 40 minutes by running each suite in isolated Docker containers in CI."
- **Under 30 words**, one sentence, ending with a full stop.
- **Start with a strong, accurate verb:** Built, Designed, Automated, Led, Cut, Migrated, Tested, Validated, Trained. "Led" only if they led it.
- **Numbers:** keep them exactly as in the library. Don't add precision or round up.
- **Present tense** for the current job, past tense for earlier ones.
- **Use the JD's own keywords** where they're truthful (exact tool names, "SIT", "shift-left"), once each, in the strongest bullet. No keyword stuffing.

## Skills lines

- **Group by what the JD cares about,** not alphabetically. Lead with the JD's first must-have.
- **Qualify honestly:** "Rust (personal projects)", "C++ (basics)", "Claude Code (personal projects)".
- **Never list a Rejected item,** not even as "similar to X".
- **Unattributed experience-bank items belong here,** not under a job.

## Layout (handled by the build, don't fight it)

- Single column, standard headings, no tables, icons or photos: ATS-safe.
- A4, Calibri 10.5pt. If it runs over the planned page count, remove the least relevant bullets or skills first.

## Before you build, re-read the JSON and check

- [ ] Every number appears in the library.
- [ ] Every employer, title and date matches the library exactly.
- [ ] No unattributed skill sits under a job.
- [ ] No Rejected item appears anywhere.
- [ ] Each must-have is covered in its strongest place, once.

The truth check verifies most of this automatically. This list catches what it can't, such as scope inflation.
