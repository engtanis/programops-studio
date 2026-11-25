# Technical notes

- `index.html`: HTML/CSS application shell and styles.
- `core.js`: pure JavaScript workflow functions and validation. Actions return an explicit success or error result; records and history are modeled as JSON.
- `fixtures.js`: fictional examples and date-relative sample data.
- `app.js`: browser rendering, form actions, local storage, draft/focus handling, exception views and CSV export.
- `ProgramOps_Studio_Stage_3_Demo.html`: self-contained version with the three scripts embedded. The historical filename is retained for compatibility with the standalone smoke test.

The simulated lifecycle is Submitted / Needs information → Planned → In progress → Ready for review → Approved → Delivered → Closed, with controlled rework and cancellation paths. Approval policies can be explicitly not required. An Approved stage represents clearance, not necessarily an affirmative reviewer decision when approval is not required.

Approval basis is a serialized business scope comparison, not a cryptographic signature. Simulated reviewer comparisons normalize case and whitespace. Event dates have calendar-day granularity. The browser uses localStorage for synthetic records; storage checks are best-effort, not atomic database transactions. No external services are called by the workflow. There is no authentication, real role enforcement, or secure audit storage.

The final minor corrections concern feedback after automatic rollback, accurate delivery error messages, accessible button names, the ordering of closure details, and normalized reviewer comparisons. A previously authorized setup-only change to `stage1_targeted_checks.js` adds renewed review, approval, delivery and completed follow-up before the existing closure assertions. A November 25 comparison with the earlier reviewed file confirmed the inserted calls and unchanged assertions; a local Node v22.16.0 run passed 5/5 (exit 0). The targeted independent reviewer did not check this correction. No code or tests were edited for this documentation update.

A future organizational implementation should choose the simplest platform that satisfies validated requirements. A spreadsheet or an existing low-code platform may be sufficient. No live platform comparison or measurable adoption benefit is claimed.

## Verification boundaries

The November 25 targeted independent run used Node v22.23.5 and jsdom 31.0.1, passing both specified suites without skips. It did not independently inspect this release candidate in full. Development-side real-browser testing is limited to modern Chromium; Safari, Firefox, physical devices and screen readers remain unverified on the current candidate. See [verification details](VERIFICATION.md). The application is not production-ready.
