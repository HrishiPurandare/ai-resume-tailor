# Resume Generation Report — Example Retail Group, Senior QA Engineer (fictional)

**Mode:** fast · **Verdict:** Strong match. Cypress and Kubernetes (nice to have) are gaps.

## Coverage
| Requirement | Match | Evidence used |
|---|---|---|
| 5+ years QA with automation | Direct | 6+ years; Playwright and PyTest frameworks |
| Playwright with TypeScript | Direct | 400 end-to-end tests at Example Payments Ltd |
| API testing (REST, Postman) | Direct | PyTest API tests for 12 microservices |
| CI/CD with GitHub Actions and Docker | Direct | Regression cut from 2 hours to 25 minutes |
| Risk-based strategy, defect triage | Direct | Triage with 3 squads |
| Jira, test management tool | Direct | Jira, TestRail |
| **Cypress** (nice to have) | **Gap** | On the "Rejected" list; not claimed |
| **Kubernetes** (nice to have) | **Gap** | Not in the library; not claimed |
| ISTQB (nice to have) | Direct | ISTQB Foundation Level |

**Overall coverage:** about 85%.

## Wording changes
- **Headline:** "Senior QA Engineer | Test Automation & CI/CD | Playwright, Python, TypeScript". Job titles stay exact.
- **Summary** leads with Playwright and CI/CD, the posting's first two requirements.

## Checks
- `npm run truth` passed: every number, employer, title and named tool traces to `master_resume.md`.
- `npm run ats` passed: 100% of content readable from both the DOCX and the PDF.

## Interview prep
- **Stories:** the 2-hours-to-25-minutes CI redesign; building the 400-test Playwright framework.
- **Likely questions:** how do you keep a large Playwright suite stable? How do you decide what to automate first?
