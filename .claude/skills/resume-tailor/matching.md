# Matching requirements to the library

Score every JD requirement before writing a single bullet. The scores decide what goes on the resume, what you ask about, and what the report calls a gap.

## Bands

| Band | Score | Meaning | Example (JD asks for Playwright with TypeScript) |
|---|---|---|---|
| **Direct** | 90–100% | Same skill, same context, ideally with a result | "Built a Playwright + TypeScript framework, 400 tests" |
| **Transferable** | 75–89% | Same capability, different tool or domain | Selenium framework design in Java |
| **Adjacent** | 60–74% | Related tool or problem space, real but thinner | Ran other people's Playwright tests |
| **Gap** | below 60% | Not supported by the library | Nothing |

Use **"Direct, thin"** in the report when the match is direct but the evidence is one line with no result. For example, a skill confirmed in discovery but with no metric yet.

## How to score

For each requirement, look for evidence in this order:
1. A bullet under a job: the strongest evidence.
2. An experience-bank entry **with** an employer.
3. A skills-list entry or an unattributed experience-bank entry. Cap these at "Direct, thin" or "Adjacent".
4. Nothing: Gap.

Adjust the score:
- **Up** for a quantified result, recency (last 3 years), or the same domain (payments JD, payments experience).
- **Down** for "learning" or "exposure only" in the library. Never present those as production use.

## Must-haves vs nice-to-haves

- A **must-have below 60%** triggers discovery questions (see `discovery.md`), at most 3, in one message.
- A **nice-to-have below 60%** is listed as a gap in the report. Don't ask about it unless the user is in deep mode.
- **Knockouts** (work rights, mandatory language, mandatory certification, clearance) aren't scored. They go in the "Check before applying" part of the report.

## Coverage percentage

Report a single **overall coverage** number, the weighted share of requirements the resume covers:
- must-haves count double;
- Direct = 1.0, Transferable = 0.8, Adjacent = 0.6, Gap = 0.

Round to the nearest 5% and prefix it with "about". Also run the ATS check with `--keywords <folder>/JD.md` and mention if many JD keywords are missing from the extracted text.

## Choosing bullets

For each job, from most to least recent:
1. Keep the bullets that cover the highest-scored **must-haves**, then nice-to-haves.
2. Prefer bullets with numbers.
3. Cover each requirement once, in the strongest place. Don't repeat the same claim under two jobs.
4. Give the most recent and most relevant job the most bullets (typically 4–8), and older jobs 1–3.
5. Remove whatever doesn't serve this JD, even good material (awards, unrelated tools), to keep to the planned length.

## Reframing (allowed) vs inventing (not allowed)

Allowed, and disclosed in the report:
- Use the JD's term for what the user did ("SIT" for "integration testing", "red teaming" for "prompt-injection testing").
- Change the emphasis: lead with the AI part of a bullet for an AI role.
- Merge or split bullets, and change the order.
- Mirror the target title in the **headline** when the work supports it.

Not allowed:
- Change a job title, employer name or date.
- Upgrade the scope ("led" for "contributed to", "architected" for "used").
- Add a number that isn't in the library, or make one bigger.
- Move a skill to a job the user didn't name for it.
