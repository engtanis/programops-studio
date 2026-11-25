# Requirements and acceptance criteria

## Problem hypothesis

When multiple teams coordinate a request, incomplete handoffs, stale approvals and missing evidence can create a misleading impression of readiness. The intended primary user is a coordinator responsible for resolving blockers. Contributing staff need actionable tasks; a manager needs accurate status; a process owner needs a reviewable record. These needs are hypotheses based on operational experience, not externally validated customer requirements.

| Requirement | Expected behavior |
|---|---|
| Intake | Active work retains required title, category, coordinator and valid target date. |
| Ownership | Required tasks have an assigned owner and accepted handoff; simulated completion checks the assigned actor. |
| Dependencies | Incomplete predecessors block dependent completion. Reopening a prerequisite invalidates affected verification and preserves superseded evidence. |
| Readiness | Required tasks, dependencies and applicable evidence must be complete before review; malformed task configurations are flagged. |
| Approval policy | An explicit documented determination is required; approval or scoped waiver must be recorded where applicable. A rejected request cannot evade review through reclassification or a waiver. |
| Reviewer independence | A simulated reviewer cannot also coordinate or contribute to required verification; name comparisons normalize case and whitespace, but do not verify identity. |
| Changes | Material pre-delivery changes conservatively restart review and invalidate affected approval or exemption. Historical decisions are retained. |
| Delivery | Require a valid date, evidence, and accepted mandatory follow-up ownership; delivery cannot predate required review/verification or occur in the future. Late entry of compliant earlier delivery is permitted. |
| Closure | Record delivery first, complete required follow-up, then save actor and reason; document why no follow-up is required if applicable. |
| Rework | Reopening delivered work requires a reason and preserves superseded records. Terminal records are locked; cancellation requires confirmation. |
| Reporting | Separate pending delivery, delivered and cancelled work; use actual delivery date for historical delivery performance. Explain blockers and feasible next actions. |
| Usability | Preserve applicable unsaved drafts and focus, provide task-specific accessible names, and require confirmation for destructive actions. |
| Local persistence | Warn about detected conflicting edits and failed writes; quarantine malformed data rather than silently overwrite. |

## Deliberate boundaries

Controls are conservative examples, not universal policies. The prototype does not implement emergency authorization exceptions, authenticated actors, integrations, multi-user databases or secure audit retention. It is not suitable for actual operational or sensitive records. An implementation in a real organization would start with process discovery, existing platform assessment, policy approval, user testing and appropriate security controls.

## Acceptance approach

For each control, test a valid flow, an invalid flow, specific refusal reason, preservation of the input record, and successful recovery where supported. Compare dashboard and export values to source records. Maintain regressions for reproduced defects and test the interface separately from the engine. A passing test is limited evidence for the tested scenario, not proof of correctness for all inputs.

These are intended controls, not certified production guarantees. See the [dated verification record](VERIFICATION.md) for tested scenarios and the limited scope of the November 25 targeted independent execution. Only simulated actors and browser-local records are supported; there is no authentication or backend.
