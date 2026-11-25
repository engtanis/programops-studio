/* ProgramOps Studio Stage 3 - independent review regressions (engine level, no dependencies).
 *
 * Place in stage3/ next to core.js and fixtures.js, then run:  node independent_review_regressions.js
 *
 * Two kinds of test:
 *   DEFECT  - asserts the CORRECT behaviour. Expected to FAIL on the current build and to PASS once fixed.
 *   PIN     - asserts behaviour that is currently correct but that no existing test (of the 82) pins.
 *             Expected to PASS today; added because a mutation experiment showed the 82 tests do not catch a regression.
 *
 * Fictional data only. Some DEFECT tests assume a specific fix shape (noted inline); adapt the call signature,
 * but keep the intent of the assertion.
 */
'use strict';
const assert = require('node:assert/strict');
const C = require('./core.js'), F = require('./fixtures.js');
const CLOCK = '2026-11-23';
const results = [];
function defect(id, sev, title, fn) { run('DEFECT', id, sev, title, fn); }
function pin(id, title, fn) { run('PIN', id, '', title, fn); }
function run(kind, id, sev, title, fn) {
  try { fn(); results.push({ kind, id, sev, title, ok: true }); }
  catch (e) { results.push({ kind, id, sev, title, ok: false, why: String(e.message).split('\n')[0] }); }
}

// ---------- helpers (use real engine transitions wherever possible) ----------
const mk = (stage = 'In progress', approval = true) => F.fixture('REV-1', 'Fictional request', { clock: CLOCK, offset: 2, stage, approvalRequired: approval });
function allDone(r) { for (const t of r.tasks.filter(t => t.kind === 'readiness')) { t.acceptedBy = t.assignedTo; t.status = 'Complete'; t.evidence = 'Fictional proof'; t.completedAt = C.stamp(CLOCK); } return r; }
const ok = (res, msg) => { assert.equal(res.ok, true, msg || res.message); return res.record; };
function approved(clock = CLOCK) {                       // required-approval request taken to Approved through real transitions
  let r = allDone(mk('Ready for review'));
  r = ok(C.decideApproval(r, { decision: 'Approved', actor: r.approval.approver, clock }));
  return ok(C.changeStage(r, 'Approved', { clock }));
}
function delivered(clock = CLOCK) {
  let r = approved(clock);
  r = ok(C.saveDelivery(r, { date: clock, evidence: 'Fictional receipt' }, { clock }));
  return ok(C.changeStage(r, 'Delivered', { clock }));
}

/* ================= DEFECTS ================= */

defect('F-01', 'High', 'Delivered must not be a dead end when a closeout task was never assigned/accepted', () => {
  // Shape of a request created through the UI: closeout task has no owner and is not accepted.
  let r = allDone(mk('Approved', false));
  r.approval = { required: false, approver: '', decision: 'Not applicable', policyReason: 'Low risk', policyDecidedBy: 'Demo process owner', policyDecidedAt: C.stamp(CLOCK), decisionAt: '', decisionBy: '', note: '', waiver: null, basis: '' };
  const f = r.tasks.find(t => t.kind === 'closeout'); f.assignedTo = ''; f.acceptedBy = '';
  r = ok(C.saveDelivery(r, { date: CLOCK, evidence: 'Fictional receipt' }, { clock: CLOCK }));
  const d = C.changeStage(r, 'Delivered', { clock: CLOCK });
  if (!d.ok) return;                                       // acceptable fix A: block Delivered until closeout task has an accepted owner
  let x = d.record;                                        // acceptable fix B: allow assign/accept/complete of closeout tasks after delivery
  x = ok(C.reassignTask(x, f.id, 'Morgan Reed', { clock: CLOCK }), 'cannot assign closeout owner after delivery');
  x = ok(C.acceptTask(x, f.id, { actor: 'Morgan Reed', clock: CLOCK }), 'cannot accept closeout task after delivery');
  x = ok(C.completeTask(x, f.id, { actor: 'Morgan Reed', evidence: 'Follow-up done', clock: CLOCK }));
  x = ok(C.saveCloseout(x, { actor: 'Morgan Reed', reason: 'Follow-up verified' }, { clock: CLOCK }));
  ok(C.changeStage(x, 'Closed', { clock: CLOCK }), 'request cannot be closed');
});

defect('F-01b', 'Low', 'Unassigned closeout task must not be reported as an ACTOR (identity) failure', () => {
  let r = delivered(); const f = r.tasks.find(t => t.kind === 'closeout'); f.assignedTo = ''; f.acceptedBy = '';
  const res = C.completeTask(r, f.id, { actor: 'Morgan Reed', evidence: 'x', clock: CLOCK });
  assert.equal(res.ok, false); assert.notEqual(res.code, 'ACTOR', 'message blames the actor; real cause is no assigned owner');
});

defect('F-02', 'High', 'Reopening a post-delivery (closeout) task must not void approval or block closure', () => {
  let r = delivered();
  r = ok(C.completeTask(r, 'followup', { actor: 'Morgan Reed', evidence: 'Done', clock: CLOCK }));
  r = ok(C.reopenTask(r, 'followup', { actor: 'Morgan Reed', reason: 'Follow-up incomplete', clock: CLOCK }));
  assert.equal(r.approval.decision, 'Approved', 'approval of already-delivered work was invalidated');
  assert.equal(r.consistencyWarning, '', 'false historical-status conflict raised');
  r = ok(C.completeTask(r, 'followup', { actor: 'Morgan Reed', evidence: 'Done properly', clock: CLOCK }));
  r = ok(C.saveCloseout(r, { actor: 'Morgan Reed', reason: 'Verified' }, { clock: CLOCK }));
  ok(C.changeStage(r, 'Closed', { clock: CLOCK }), 'cannot close after redoing the follow-up');
});

defect('F-03', 'High', 'Approval policy cannot be flipped to "not required" by an unauthorised actor to bypass a pending/rejected approval', () => {
  let r = allDone(mk('Ready for review'));
  r = ok(C.decideApproval(r, { decision: 'Rejected', actor: r.approval.approver, note: 'Scope unacceptable', clock: CLOCK }));
  r = ok(C.changeStage(r, 'Ready for review', { clock: CLOCK }));
  // Assumed fix shape: a role-gated policy change, mirroring waiveApproval. Adapt the argument name if you choose another design.
  const flip = C.setApprovalPolicy(r, { required: false, reason: 'Changed my mind', actor: 'Demo coordinator', actorRole: 'Coordinator', clock: CLOCK });
  if (flip.ok) {
    const again = ok(C.changeStage(flip.record, 'Ready for review', { clock: CLOCK }));
    assert.equal(C.changeStage(again, 'Approved', { clock: CLOCK }).ok, false, 'reached Approved after an explicit rejection without any approver decision or authorised waiver');
  }
});

defect('F-04', 'Medium', 'A waiver must not silently override an explicit rejection', () => {
  let r = allDone(mk('Ready for review'));
  r = ok(C.decideApproval(r, { decision: 'Rejected', actor: r.approval.approver, note: 'No', clock: CLOCK }));
  r = ok(C.changeStage(r, 'Ready for review', { clock: CLOCK }));
  const w = C.waiveApproval(r, { actor: 'Demo process owner', actorRole: 'Process owner (simulated)', reason: 'Override', clock: CLOCK });
  assert.equal(w.ok, false, 'waiver accepted over an explicit rejection');
});

defect('F-05', 'Medium', 'Approver must be independent of the coordinator (separation of duties)', () => {
  const r = mk('In progress');
  const res = C.setApprovalPolicy(r, { required: true, approver: r.owner, reason: 'Review required', clock: CLOCK });
  assert.equal(res.ok, false, 'coordinator who owns/verifies the work can be named as its approver');
});

defect('F-06', 'High', 'Reopening Delivered work must require a reason and retain the superseded delivery/closeout evidence', () => {
  let r = delivered();
  r = ok(C.completeTask(r, 'followup', { actor: 'Morgan Reed', evidence: 'Follow-up evidence #77', clock: CLOCK }));
  const noReason = C.changeStage(r, 'In progress', { actor: 'Demo coordinator', reason: '', clock: CLOCK });
  assert.equal(noReason.ok, false, 'delivered request reopened with no reason');
  const x = ok(C.changeStage(r, 'In progress', { actor: 'Demo coordinator', reason: 'Wrong item delivered', clock: CLOCK }));
  const log = JSON.stringify(x.events);
  assert.ok(log.includes('Fictional receipt'), 'prior delivery evidence not retained anywhere');
  assert.ok(log.includes(CLOCK), 'prior delivery date not retained');
  assert.ok(log.includes('Follow-up evidence #77'), 'prior closeout evidence not retained');
});

defect('F-07a', 'Medium', 'Reassigning a completed task must retain the discarded evidence in the history', () => {
  const r = allDone(mk('In progress'));
  const x = ok(C.reassignTask(r, 'vendor', 'Taylor Brooks', { clock: CLOCK }));
  assert.ok(JSON.stringify(x.events).includes('Fictional proof'), 'completed-task evidence silently destroyed');
});
defect('F-07b', 'Medium', 'Re-completing an already complete task must not silently overwrite its evidence', () => {
  const r = allDone(mk('In progress'));
  const res = C.completeTask(r, 'agenda', { actor: 'Morgan Reed', evidence: 'Different evidence', clock: CLOCK });
  if (res.ok) assert.ok(JSON.stringify(res.record.events).includes('Fictional proof'), 'old evidence overwritten without trace');
});
defect('F-07c', 'Medium', 'Delivery edits must log the values entered, not just "edited"', () => {
  const r = approved();
  const x = ok(C.saveDelivery(r, { date: '2026-11-20', evidence: 'first receipt' }, { clock: CLOCK }));
  const y = ok(C.saveDelivery(x, { date: '2026-11-22', evidence: 'second receipt' }, { clock: CLOCK }));
  const log = JSON.stringify(y.events);
  assert.ok(log.includes('first receipt') && log.includes('second receipt'), 'delivery history carries no values');
});

defect('F-09a', 'High', 'Delivery dated before the approval date is rejected with a chronology reason', () => {
  let r = approved();                                       // approved on CLOCK
  r = ok(C.saveDelivery(r, { date: '2026-11-21', evidence: 'Fictional retroactive delivery' }, { clock: CLOCK }));
  const d = C.changeStage(r, 'Delivered', { clock: CLOCK });
  assert.equal(d.ok, false, 'delivery two days before approval accepted');
  assert.match(d.message, /approv|before|chronolog/i, 'rejection reason is not about chronology: ' + d.message);
});
defect('F-09b', 'High', 'Delivery dated before required tasks were verified is rejected', () => {
  let r = allDone(mk('Approved', false));
  r.approval = { required: false, approver: '', decision: 'Not applicable', policyReason: 'Low risk', policyDecidedBy: 'Demo process owner', policyDecidedAt: C.stamp(CLOCK), decisionAt: '', decisionBy: '', note: '', waiver: null, basis: '' };
  r = ok(C.saveDelivery(r, { date: '2026-11-10', evidence: 'receipt' }, { clock: CLOCK }));
  assert.equal(C.changeStage(r, 'Delivered', { clock: CLOCK }).ok, false, 'delivered before verification and with no approval anchor');
});
defect('F-09c', 'High', 'Delivery dated before the request existed is rejected', () => {
  let r = approved();
  r = ok(C.saveDelivery(r, { date: '2020-01-01', evidence: 'receipt' }, { clock: CLOCK }));
  assert.equal(C.changeStage(r, 'Delivered', { clock: CLOCK }).ok, false);
});
defect('F-09d', 'High', 'Delivery dated before a documented waiver is rejected', () => {
  let r = allDone(mk('Ready for review'));
  r = ok(C.waiveApproval(r, { actor: 'Demo process owner', actorRole: 'Process owner (simulated)', reason: 'Policy exemption', clock: CLOCK }));
  r = ok(C.changeStage(r, 'Approved', { clock: CLOCK }));
  r = ok(C.saveDelivery(r, { date: '2026-11-21', evidence: 'receipt' }, { clock: CLOCK }));
  assert.equal(C.changeStage(r, 'Delivered', { clock: CLOCK }).ok, false);
});
defect('F-09e', 'High', 'The shipped starter fixture must not itself contain a delivery that precedes its approval', () => {
  const d = F.starter(CLOCK).find(x => x.id === 'OPS-104');
  assert.ok(d.delivery.date >= d.approval.decisionAt.slice(0, 10), `OPS-104 delivered ${d.delivery.date} but approved ${d.approval.decisionAt.slice(0, 10)}`);
});
defect('F-09f', 'Low', 'Fixture task timestamps follow the supplied clock', () => {
  const t = F.starter('2026-12-04')[0].tasks[0];
  assert.equal(t.completedAt.slice(0, 10), '2026-12-04', 'completedAt hard-coded to 2026-11-23');
});

defect('F-10', 'Medium', 'An action may not be recorded with a clock earlier than the latest recorded event', () => {
  let r = mk('In progress'); r = ok(C.acceptTask(r, 'it', { actor: 'Taylor Brooks', clock: '2026-11-25' }));
  const res = C.completeTask(r, 'it', { actor: 'Taylor Brooks', evidence: 'ok', clock: '2026-11-20' });
  assert.equal(res.ok, false, 'event dated 5 days before the previous event accepted');
});
defect('F-11', 'Low', 'An invalid clock must not disable the future-delivery check', () => {
  let r = approved(); r = ok(C.saveDelivery(r, { date: '2099-01-01', evidence: 'receipt' }, { clock: CLOCK }));
  for (const bad of ['', 'garbage', null]) assert.equal(C.changeStage(r, 'Delivered', { clock: bad }).ok, false, 'future delivery accepted with clock=' + JSON.stringify(bad));
});

defect('F-13', 'Medium', 'A rejected approval must be visible as an exception, not "No current exception"', () => {
  let r = allDone(mk('Ready for review'));
  r = ok(C.decideApproval(r, { decision: 'Rejected', actor: r.approval.approver, note: 'No', clock: CLOCK }));
  const a = C.assess(r, CLOCK);
  assert.notEqual(a.risk, 'No current exception', 'rejected request reports no exception');
  assert.ok(a.issues.some(i => /reject/i.test(i.message)), 'no issue mentions the rejection');
});

defect('F-14a', 'Medium', 'Active requests cannot have target date or coordinator blanked', () => {
  const r = allDone(mk('Ready for review'));
  assert.equal(C.updateRequest(r, { targetDate: '' }, { clock: CLOCK }).ok, false, 'target date cleared on an active request');
  assert.equal(C.updateRequest(r, { owner: '' }, { clock: CLOCK }).ok, false, 'coordinator cleared on an active request');
  assert.equal(C.updateRequest(r, { type: '' }, { clock: CLOCK }).ok, false, 'type cleared on an active request');
});
defect('F-14b', 'Medium', 'Clearing the target date must not downgrade an overdue Critical', () => {
  const r = allDone(mk('In progress')); r.targetDate = '2026-11-20';
  assert.equal(C.assess(r, CLOCK).risk, 'Critical');
  const x = C.updateRequest(r, { targetDate: '' }, { clock: CLOCK });
  if (x.ok) assert.equal(C.assess(x.record, CLOCK).risk, 'Critical', 'Critical overdue replaced by "Review needed"');
});
defect('F-14c', 'Medium', 'Changing the target date must retain the previous value (schedule-slip baseline)', () => {
  const r = allDone(mk('In progress'));
  const x = ok(C.updateRequest(r, { targetDate: '2026-12-31' }, { clock: CLOCK }));
  const last = x.events[x.events.length - 1];
  assert.ok(JSON.stringify(last).includes(r.targetDate), 'previous target date not recorded: ' + JSON.stringify(last));
});

defect('F-15', 'Medium', 'Reopening/reassigning a predecessor must invalidate completed dependants', () => {
  const r = allDone(mk('In progress'));                       // presenter depends on agenda
  const x = ok(C.reopenTask(r, 'agenda', { reason: 'Agenda changed', clock: CLOCK }));
  const pres = x.tasks.find(t => t.id === 'presenter');
  assert.notEqual(pres.status, 'Complete', 'dependant still Complete with evidence gathered against the old predecessor');
});

defect('F-22', 'Low', 'Implausible dates (year 0001) are rejected', () => {
  assert.equal(C.validDay('0001-01-01'), false);
});

/* ================= PINS (currently correct; not covered by the existing 82 tests) ================= */

pin('G-01', 'decideApproval refuses anyone but the configured approver (mutation m11 survived)', () => {
  const r = allDone(mk('Ready for review'));
  const res = C.decideApproval(r, { decision: 'Approved', actor: 'Somebody Else', clock: CLOCK });
  assert.equal(res.ok, false); assert.equal(res.code, 'ACTOR');
});
pin('G-02', 'Readiness is Not ready when a completed task has an incomplete predecessor (m13 survived)', () => {
  const r = allDone(mk('In progress')); r.tasks.find(t => t.id === 'agenda').status = 'Open';
  const g = C.getReadiness(r); assert.equal(g.state, 'Not ready');
  assert.ok(g.issues.some(i => i.rule === 'BR-05' && /predecessor/.test(i.message)), 'dependant is not blocked by its incomplete predecessor');
});
pin('G-03', 'Closing requires closure actor and reason (m17 survived)', () => {
  let r = delivered(); r = ok(C.completeTask(r, 'followup', { actor: 'Morgan Reed', evidence: 'Done', clock: CLOCK }));
  const res = C.changeStage(r, 'Closed', { clock: CLOCK }); assert.equal(res.ok, false); assert.match(res.message, /Closure actor and reason/);
});
pin('G-04', 'Cancelled requests refuse task acceptance and completion (m08/m09 survived)', () => {
  const r = ok(C.changeStage(mk('In progress'), 'Cancelled', { reason: 'Scope dropped', clock: CLOCK }));
  assert.equal(C.acceptTask(r, 'it', { actor: 'Taylor Brooks', clock: CLOCK }).ok, false);
  assert.equal(C.completeTask(r, 'it', { actor: 'Taylor Brooks', evidence: 'x', clock: CLOCK }).ok, false);
});
pin('G-05', 'Reopening Delivered work resets closeout tasks (m10 survived)', () => {
  let r = delivered(); r = ok(C.completeTask(r, 'followup', { actor: 'Morgan Reed', evidence: 'Done', clock: CLOCK }));
  const x = ok(C.changeStage(r, 'In progress', { clock: CLOCK, reason: 'Correct delivered work' }));
  assert.equal(x.tasks.find(t => t.id === 'followup').status, 'Open');
});
pin('G-06', 'Delivered re-checks approval validity - asserted by reason, not just ok:false (m22 survived; D10 passes for the wrong reason)', () => {
  let r = approved(); r.summary = 'Changed silently after approval';
  r.delivery = { date: CLOCK, evidence: 'Fictional receipt' };      // set directly: saveDelivery would auto-roll the stage back before the gate is reached
  const res = C.changeStage(r, 'Delivered', { clock: CLOCK });
  assert.equal(res.ok, false); assert.match(res.message, /Approval required/);
});
pin('G-07', 'addTask voids a prior approval decision, not just the stage (m02 survived)', () => {
  const r = approved();
  const x = ok(C.addTask(r, F.task('new', 'Emergency check', 'Morgan Reed', { dueDate: CLOCK }), { clock: CLOCK }));
  assert.equal(x.approval.decision, 'Pending');
});
pin('G-08', 'Severity bands: 3-7 days to target with an open blocker is Warning (m07 survived)', () => {
  const r = F.fixture('REV-W', 'Req', { clock: CLOCK, offset: 5 });
  const i = C.riskIssues(r, CLOCK).find(x => x.message.includes('Technology test') && x.rule === 'BR-04');
  assert.equal(i.severity, 'Warning');
});
pin('G-09', 'Event ids stay unique across a mixed sequence of actions', () => {
  let r = mk('In progress');
  r = ok(C.completeTask(r, 'it', { actor: 'Taylor Brooks', evidence: 'e', clock: CLOCK }));
  r = ok(C.reopenTask(r, 'it', { reason: 'redo', clock: CLOCK }));
  r = ok(C.updateRequest(r, { type: 'Internal project' }, { clock: CLOCK }));
  r = ok(C.updateTaskDueDate(r, 'it', '2026-11-25', { clock: CLOCK }));
  const ids = r.events.map(e => e.id); assert.equal(new Set(ids).size, ids.length);
});

/* ---------------- report ---------------- */
const pad = (s, n) => String(s).padEnd(n);
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${pad(r.kind, 6)} ${pad(r.id, 6)} ${pad(r.sev, 6)} ${r.title}${r.ok ? '' : '\n        -> ' + r.why}`);
const d = results.filter(r => r.kind === 'DEFECT'), p = results.filter(r => r.kind === 'PIN');
console.log(`\nDEFECT tests failing (open defects): ${d.filter(r => !r.ok).length}/${d.length}`);
console.log(`PIN tests passing (existing behaviour now pinned): ${p.filter(r => r.ok).length}/${p.length}`);
if (require.main === module) process.exitCode = results.some(r => !r.ok) ? 1 : 0;
module.exports = results;
