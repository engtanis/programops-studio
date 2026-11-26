# Case study: preventing false readiness

## The problem

A coordinator sees an upcoming request marked on track. However, one required team has not completed verification, another handoff is unaccepted, and a previous approval may no longer apply after a scope change. A status label alone does not explain what needs to happen next.

## Approach

This independent, AI-assisted portfolio project explores a small, fictional workflow in which readiness is derived from required work and evidence instead of relying solely on manual status. The design makes incomplete requirements visible, explains refused transitions and preserves superseded evidence in a simulated history. It considers operational controls, reporting definitions and recovery paths alongside the user interface.

## Professional background and development approach

The project draws on business operations experience, an MBA and PMP certification, and practical work with Excel, Power BI, SharePoint and Microsoft Lists. Translating operational requirements into software required decisions about accepted handoffs, approval validity, evidence retention and the distinction between delivery and closure. For example, material changes to a request must invalidate affected approvals without discarding the previous decision record. The owner directed requirements and business-policy decisions, evaluated proposed corrections, approved changes, reviewed test results and manually exercised key workflows on the hosted site. ChatGPT assisted with generating code, documentation and test execution; Claude reviewed an earlier candidate and later executed two targeted regression suites on the revised candidate.

## Demonstration

Open the sample stakeholder briefing. Attempt to advance before the technology verification is complete; the application identifies the blocker. Complete the task with synthetic evidence, record review, and progress to delivery. The application also guards against premature closure while required follow-up remains open. After verification, the request can close with a documented reason.

## What changed during review

Early versions allowed misleading readiness or completion states. Subsequent adversarial review identified stale approvals, chronology issues, evidence loss, inaccurate status messages and saved-data risks. Corrections were tested with cumulative engine regressions and Chromium interactions. Independent AI reviewers also challenged the test suite itself, including tests that could pass for the wrong reason.

On November 25, 2026, an independent AI review of an earlier candidate verified 19 groups of earlier fixes and identified five minor findings. After corrections, development-side engine and Chromium checks passed. In a separate targeted execution on the release candidate, the independent reviewer reported 14/14 original UI defect tests and 2/2 pins, plus 5/5 new defect tests and 4/4 pins, passing in jsdom 31.0.1 on Node v22.23.5 with no skips or code/test changes. That execution covered only those two suites; it was not a full review of the revised project or documentation. Local jsdom installation remained blocked. The [verification summary](VERIFICATION.md) distinguishes these results and the outstanding limits.

## Relevance and next steps

The work illustrates requirements definition, process analysis, operational exception handling, evidence retention and practical testing. It is not a claim of customer adoption, quantified efficiency, production deployment, or independent software engineering authorship. Before recommending it to an organization, establish the actual workflow and constraints, compare the existing tools, test with users, and obtain required permissions. The project uses fictional data, simulated actors and browser local storage only; it has no authentication or backend. Only modern Chromium has been tested as a real browser on the current release candidate. It is not production-ready.
