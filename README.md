# ProgramOps Studio

**Operational readiness and exception management** — an independent, AI-assisted portfolio prototype using entirely fictional records and simulated actors.

A request can appear ready even though a handoff has not been accepted, a dependency is incomplete, or an approval is stale. ProgramOps Studio demonstrates how a small operations team could make those gaps visible and prevent premature delivery or closure. It is a workflow demonstration, not a replacement for an organization's existing systems or a production application.

## Try it

**[Launch the live demonstration](https://engtanis.github.io/programops-studio/)**

[Read the business case study on Notes Across Borders](https://notesacrossborders.wordpress.com/applied-projects/programops-studio/)

Open `index.html` with its three adjacent JavaScript files in a current desktop browser, or open the bundled `ProgramOps_Studio_Stage_3_Demo.html`. No account or server is required; a static HTTP host is another option. Use fictional information only. Changes are stored locally in the browser where storage is available. Resetting the example records requires confirmation.

Suggested walkthrough:
1. Open **Executive stakeholder briefing** and try moving to Ready for review while a readiness task is incomplete.
2. Record fictional evidence for the technology test, review the approval policy and progress through the documented decision.
3. Enter valid delivery evidence. Try closing while follow-up remains incomplete, then complete follow-up and record the closure details.
4. Explore exceptions, history and CSV reporting. Try changing an approved request before delivery to see how material changes trigger renewed review.

All names, records and evidence in the examples are synthetic. Actor labels are simulations, not authenticated identities.

## What the demo illustrates

- Request intake, accepted task ownership, prerequisites and verification evidence.
- Explicit approval policies, reviewer independence checks, rejection recovery and conservative approval invalidation.
- Date-aware delivery gates, post-delivery follow-up and documented closure.
- Actionable exception explanations, change history and CSV export.
- Local draft retention, conflict warnings and recovery from malformed saved data.

See [case study](docs/CASE_STUDY.md), [requirements](docs/REQUIREMENTS.md), and [technical notes](docs/TECHNICAL_NOTES.md) for scope, decisions and limitations.

## Where this workflow could apply

The same readiness problem occurs when several teams must complete interdependent work before a business event or handoff.

| Illustrative setting | Operational question |
|---|---|
| Telecommunications — enterprise customer briefing | Have the briefing materials, technical checks and responsible teams been confirmed before delivery? |
| Healthcare administration — nonclinical service rollout | Have the required administrative handoffs, approvals and verification tasks been completed? |
| Financial services or government — operational change | Does a change invalidate an earlier approval, and is follow-up complete before closure? |

These are potential applications of the fictional demonstration, not employer-specific implementations or validated industry deployments.

## Practical adoption questions

- **Would this replace existing tools?** Not necessarily. First assess whether existing task tracking, Microsoft Lists, SharePoint or workflow controls can handle the same requirements.
- **What does a manager see when work is incomplete?** The exception queue identifies blockers and the next required action; the readiness and closure rules distinguish incomplete work from an approved or delivered request.
- **What if approved work changes?** The demonstrated rules can invalidate approval and require renewed review after a material change.
- **Can analysts use the outputs elsewhere?** The request-summary CSV is available for downstream analysis. It is not a live integration or a complete historical data export.
- **What would real adoption require?** Confirm actual users, ownership, approval rules, security, shared storage, maintenance and reporting needs before adapting the approach. The demo uses simulated actors and fictional data only.

## Verification — November 25, 2026

**Earlier independent review:** On November 25, an independent AI reviewer examined the preceding candidate, `ProgramOps_Final_Claude_Review_Package.zip`, and re-verified its original 26 findings. That was not a full review of this later release candidate. Five additional low to low-medium findings were subsequently corrected.

**Current release candidate — local checks:** The development-side November 25 verification recorded 82/82 original engine checks, 24/24 original independent engine defect regressions, 9/9 original independent pins, 19/19 independent fix-verification groups, 3/3 new engine defect regressions, 4/4 new pins, 65/65 stage-specific and final minor supplemental engine checks, 17/17 final-policy checks, and 13/13 Chromium scripts in the private verification workspace. The two new UI findings were also checked in Chromium. These are overlapping suites, not unique requirements or a coverage percentage. Local jsdom installation was blocked by registry DNS access.

**Current release candidate — targeted independent execution:** Results reported on November 25 for `ProgramOps_Public_Release_Candidate.zip` using Node v22.23.5 and jsdom 31.0.1:

| Command | Result |
|---|---|
| `node independent_review_ui_regressions.js` | 14/14 DEFECT, 2/2 PIN; no skips; exit 0 |
| `node final_review_new_findings.js` | 5/5 DEFECT (N-01–N-05), 4/4 PIN; no skips; exit 0 |

The reviewer reported unchanged application and test file hashes before and after these runs and no reproduced publication-blocking defect within this limited scope. Only these two suites were independently executed on this release candidate; the reviewer did not independently review the later source changes, README or docs, `final_minor_checks.js`, Playwright scripts, employer references, or the closure-test setup correction. These documentation-only revisions follow that execution; the application and tests are unchanged. See [verification details](docs/VERIFICATION.md) for the methods, chronology and limits of the evidence.

**Hosted smoke test (November 25, 2026):** GitHub Pages deployed the verified application from commit `03e00ee`. The project owner manually completed six planned checks with ChatGPT guidance: blocked advancement, verification evidence, valid advancement, reload persistence, exception queue and CSV export. All six passed in the reported browser session. The exported CSV contained five fictional records, 15 fields per row and six exceptions. See [deployment and smoke-test evidence](docs/VERIFICATION.md#public-deployment-and-hosted-smoke-test--november-25-2026). This was not an independent or comprehensive hosted review.

## Limits

This is a fictional-data demonstration, not production-ready software. Actors, roles, approvals and evidence are simulated, not authenticated. There is no authentication, backend, shared database, server-enforced authorization, tamper-resistant audit trail, notification service or actual organizational integration. Records are stored only in browser local storage when available; they can be edited, cleared or lost. Cross-tab guards are best-effort, not transactional concurrency controls. Event chronology is day-level, and legacy records have not been comprehensively migrated. A request recorded using a future scenario date may require restoring that date before further actions are possible. No real-user validation, commercial demand, business savings, security certification or employer approval is claimed.

Use a modern browser with `Array.prototype.findLast` and `.at()` support. Modern Chromium is the only browser family tested on the current application; desktop and mobile-viewport checks do not establish physical-device compatibility. Safari, Firefox, screen readers and direct `file://` navigation were not verified on this final release candidate. jsdom is a simulated DOM environment, not a real-browser compatibility test.

## About the work

The project draws on more than 20 years of business operations experience, including staff and vendor coordination, process improvement, records management and operational reporting. The project owner defined business requirements and directed policy decisions, evaluated proposed solutions, approved corrections and manually verified key hosted workflows. ChatGPT assisted with code generation, documentation and test execution; Claude provided a separate review of an earlier candidate and targeted test execution on the revised candidate. The documented decisions, corrections and verification results show how operational requirements were translated into a working demonstration and tested against specific failure scenarios.
