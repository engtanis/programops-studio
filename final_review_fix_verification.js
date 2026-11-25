/* ProgramOps Studio final candidate - independent, reason-specific verification of the original review findings.
 * Engine level, no dependencies:  node final_review_fix_verification.js   (place next to core.js and fixtures.js)
 *
 * Why this file exists: several earlier DEFECT tests accept ANY refusal (ok === false) or return early when a call is refused,
 * so they can pass when an operation is simply broken (mutation W5 "every action refused" left 16 of 38 earlier tests passing).
 * Every test here asserts the refusal CODE and message, AND demonstrates a valid recovery path so a blanket refusal cannot pass.
 * All tests are expected to PASS on the reviewed candidate.
 */
'use strict';
const assert = require('node:assert/strict');
const C = require('./core.js'), F = require('./fixtures.js');
const D = '2026-11-23', D2 = '2026-11-24';
const PO = { actor: 'Demo process owner', actorRole: 'Process owner (simulated)' };
const O = { clock: D };
const results = [];
function t(id, title, fn) { try { fn(); results.push({ id, title, ok: true }); } catch (e) { results.push({ id, title, ok: false, why: String(e.message).split('\n')[0] }); } }
const take = (res, label) => { assert.equal(res.ok, true, (label || '') + ' unexpectedly refused: ' + res.code + ' ' + res.message); return res.record; };
const refused = (res, code, re, label) => { assert.equal(res.ok, false, (label || '') + ' was accepted'); assert.equal(res.code, code, (label || '') + ' wrong code: ' + res.code + ' / ' + res.message); if (re) assert.match(res.message, re, (label || '') + ' wrong message: ' + res.message); };
const same = (a, b, label) => assert.equal(JSON.stringify(a), JSON.stringify(b), (label || 'record') + ' changed by a refused action');
function readyRec(opts = {}) {
  let r = F.fixture('V1', 'Verification request', { clock: D, offset: 3, stage: 'In progress', ...opts });
  for (const x of r.tasks.filter(x => x.kind === 'readiness')) { x.acceptedBy = x.assignedTo; x.acceptedAt = C.stamp(D); x.status = 'Complete'; x.evidence = 'Proof ' + x.id; x.completedAt = C.stamp(D); }
  return take(C.changeStage(r, 'Ready for review', O), 'ready');
}
const approvedRec = () => { let r = readyRec(); r = take(C.decideApproval(r, { decision: 'Approved', actor: r.approval.approver, clock: D })); return take(C.changeStage(r, 'Approved', O)); };
const deliveredRec = () => { let r = approvedRec(); r = take(C.saveDelivery(r, { date: D, evidence: 'Fictional receipt' }, O)); return take(C.changeStage(r, 'Delivered', O)); };
function uiRequest(clock = D, target = '2026-11-27') { // same shape app.js creates
  const r = C.newRequest({ title: 'UI request', type: 'Service request', owner: 'Morgan Reed', targetDate: target }, 'OPS-200', clock);
  r.tasks = [F.task('agenda', 'Requirements confirmed', '', { accepted: false, dueDate: target }), F.task('handoff', 'Technical / vendor handoff', '', { accepted: false, dueDate: target }), F.task('closeout', 'Post-delivery follow-up', '', { kind: 'closeout', accepted: false })];
  return r;
}

t('F-01', 'Delivered is gated on an owned+accepted closeout task, with a working recovery to Closed', () => {
  let r = uiRequest(); r = take(C.changeStage(r, 'Planned', O)); r = take(C.changeStage(r, 'In progress', O));
  r = take(C.setApprovalPolicy(r, { required: false, reason: 'Low risk', ...PO, clock: D }));
  for (const [id, who] of [['agenda', 'Morgan Reed'], ['handoff', 'Taylor Brooks']]) { r = take(C.reassignTask(r, id, who, O)); r = take(C.acceptTask(r, id, { actor: who, clock: D })); r = take(C.completeTask(r, id, { actor: who, evidence: 'ok ' + id, clock: D })); }
  r = take(C.changeStage(r, 'Ready for review', O)); r = take(C.changeStage(r, 'Approved', O));
  r = take(C.saveDelivery(r, { date: D, evidence: 'Fictional receipt' }, O));
  const blocked = C.changeStage(r, 'Delivered', O); refused(blocked, 'GATE', /Post-delivery follow-up: assign an owner and accept the closeout handoff before delivery/, 'delivery with unowned follow-up'); same(r, r);
  assert.equal(r.delivery.evidence, 'Fictional receipt', 'draft delivery evidence must survive the blocked attempt');
  r = take(C.reassignTask(r, 'closeout', 'Casey Shah', O)); r = take(C.acceptTask(r, 'closeout', { actor: 'Casey Shah', clock: D }));
  assert.equal(r.stage, 'In progress', 'documented behaviour: assigning the follow-up owner after clearance returns the request to In progress (see finding N-02)');
  r = take(C.changeStage(r, 'Ready for review', O)); r = take(C.changeStage(r, 'Approved', O));
  r = take(C.changeStage(r, 'Delivered', O), 'delivery after recovery');
  r = take(C.completeTask(r, 'closeout', { actor: 'Casey Shah', evidence: 'Follow-up done', clock: D }));
  r = take(C.saveCloseout(r, { actor: 'Casey Shah', reason: 'Follow-up verified' }, O));
  assert.equal(take(C.changeStage(r, 'Closed', O)).stage, 'Closed');
});
t('F-01b', 'Unassigned task reports HANDOFF, wrong actor reports ACTOR', () => {
  const r = deliveredRec(); const f = C.clone(r); f.tasks.find(x => x.id === 'followup').assignedTo = ''; f.tasks.find(x => x.id === 'followup').acceptedBy = '';
  refused(C.completeTask(f, 'followup', { actor: 'Morgan Reed', evidence: 'x', clock: D }), 'HANDOFF', /assigned|accept/i, 'unassigned');
  refused(C.completeTask(r, 'followup', { actor: 'Casey Shah', evidence: 'x', clock: D }), 'ACTOR', /assigned person/i, 'wrong actor');
});
t('F-02', 'Closeout rework after delivery keeps approval; closure details are invalidated and must be re-entered', () => {
  let r = deliveredRec(); r = take(C.completeTask(r, 'followup', { actor: 'Morgan Reed', evidence: 'Done', clock: D })); r = take(C.saveCloseout(r, { actor: 'Morgan Reed', reason: 'Resolved' }, O));
  const before = JSON.stringify(r.approval);
  r = take(C.reopenTask(r, 'followup', { actor: 'Morgan Reed', reason: 'Follow-up incomplete', clock: D }));
  assert.equal(JSON.stringify(r.approval), before, 'approval changed by closeout rework'); assert.equal(r.stage, 'Delivered'); assert.equal(r.consistencyWarning, '');
  assert.deepEqual([r.closeout.actor, r.closeout.reason], ['', ''], 'stale closure details survived');
  assert.ok(JSON.stringify(r.events).includes('Resolved'), 'invalidated closure reason must stay in history');
  refused(C.changeStage(r, 'Closed', O), 'GATE', /Post-delivery follow-up|Closure actor and reason/, 'close before redo');
  r = take(C.completeTask(r, 'followup', { actor: 'Morgan Reed', evidence: 'Done properly', clock: D })); r = take(C.saveCloseout(r, { actor: 'Morgan Reed', reason: 'Verified' }, O));
  assert.equal(take(C.changeStage(r, 'Closed', O)).stage, 'Closed');
});
t('F-03', 'Policy cannot be changed after rejection or by a non-process-owner; permitted pending change still works', () => {
  let r = readyRec(); const pending = r;
  refused(C.setApprovalPolicy(pending, { required: false, reason: 'x', actor: 'Demo coordinator', actorRole: 'Coordinator', clock: D }), 'AUTH', /process owner/i, 'coordinator policy change');
  const exempt = take(C.setApprovalPolicy(pending, { required: false, reason: 'Documented exemption', ...PO, clock: D }), 'process-owner change while pending');
  assert.equal(exempt.stage, 'In progress', 'review must restart after a policy change');
  r = take(C.decideApproval(r, { decision: 'Rejected', actor: 'Avery Chen', note: 'Scope wrong', clock: D }));
  refused(C.setApprovalPolicy(r, { required: false, reason: 'bypass', ...PO, clock: D }), 'REJECTED', /explicit rejection cannot be cleared/, 'policy bypass after rejection');
  refused(C.setApprovalPolicy(r, { required: true, approver: 'Jesse Park', reason: 'swap', ...PO, clock: D }), 'REJECTED', /explicit rejection/, 'reviewer swap after rejection');
  refused(C.updateRequest(r, { owner: 'Avery Chen' }, O), 'INDEPENDENCE', /independent/i, 'making the rejecting reviewer the coordinator');
  assert.equal(take(C.updateRequest(r, { type: 'Internal project' }, O)).approval.decision, 'Rejected', 'reclassification must not erase a rejection');
});
t('F-04', 'Waiver cannot override a rejection; a legitimate waiver still works', () => {
  let r = readyRec(); const waived = take(C.waiveApproval(r, { ...PO, reason: 'Documented waiver', clock: D }), 'waiver on pending approval'); assert.equal(waived.approval.decision, 'Waived');
  r = take(C.decideApproval(r, { decision: 'Rejected', actor: 'Avery Chen', note: 'No', clock: D })); r = take(C.changeStage(r, 'Ready for review', O));
  refused(C.waiveApproval(r, { ...PO, reason: 'Override', clock: D }), 'REJECTED', /cannot override this rejection/, 'waiver over rejection');
  refused(C.decideApproval(r, { decision: 'Approved', actor: 'Avery Chen', note: '', clock: D }), 'REASON', /previous rejection/i, 're-approval without explanation');
  assert.equal(take(C.decideApproval(r, { decision: 'Approved', actor: 'Avery Chen', note: 'Concerns addressed', clock: D })).approval.decision, 'Approved');
});
t('F-05', 'Reviewer independence: coordinator, assignee, case/outer-space variants, transitive dependency; independent reviewer allowed', () => {
  const base = F.fixture('V2', 'Req', { clock: D, offset: 3, stage: 'In progress' });
  const pol = r => C.setApprovalPolicy(r, { required: true, approver: 'Avery Chen', reason: 'review', ...PO, clock: D });
  const own = C.clone(base); own.owner = '  AVERY chen '; refused(pol(own), 'INDEPENDENCE', /independent/i, 'coordinator (case/space)');
  const asg = C.clone(base); asg.tasks.find(x => x.id === 'it').assignedTo = 'avery CHEN'; refused(pol(asg), 'INDEPENDENCE', /independent/i, 'task assignee (case)');
  const dep = C.clone(base); dep.tasks.push(F.task('prep', 'Optional prep', 'Avery Chen', { required: false, dueDate: D })); dep.tasks.find(x => x.id === 'it').dependsOn = ['prep']; refused(pol(dep), 'INDEPENDENCE', /independent/i, 'optional prerequisite');
  assert.equal(pol(base).ok, true, 'a genuinely independent reviewer must be accepted');
});
t('F-06', 'Reopening Delivered needs a reason, retains superseded delivery AND closeout values, and re-delivery works', () => {
  let r = deliveredRec(); r = take(C.completeTask(r, 'followup', { actor: 'Morgan Reed', evidence: 'Closeout evidence #77', clock: D }));
  for (const bad of ['', '   ', null, undefined]) { const x = C.changeStage(r, 'In progress', { clock: D, reason: bad }); refused(x, 'REASON', /requires a reason/, 'reopen with ' + JSON.stringify(bad)); }
  const x = take(C.changeStage(r, 'In progress', { clock: D, reason: 'Wrong item delivered', actor: 'Demo coordinator' })); const log = JSON.stringify(x.events);
  for (const needle of ['Fictional receipt', 'Closeout evidence #77', 'Wrong item delivered']) assert.ok(log.includes(needle), 'not retained: ' + needle);
  assert.equal(x.delivery.date, ''); assert.equal(x.approval.decision, 'Pending');
  let y = take(C.changeStage(x, 'Ready for review', O)); y = take(C.decideApproval(y, { decision: 'Approved', actor: y.approval.approver, note: 'Re-reviewed', clock: D })); y = take(C.changeStage(y, 'Approved', O)); y = take(C.saveDelivery(y, { date: D, evidence: 'Second receipt' }, O));
  assert.equal(take(C.changeStage(y, 'Delivered', O)).stage, 'Delivered');
});
t('F-07', 'Reassign, re-complete and delivery edits retain discarded values', () => {
  const r = readyRec({}); let x = take(C.reassignTask(r, 'vendor', 'Taylor Brooks', O)); assert.ok(JSON.stringify(x.events).includes('Proof vendor'), 'reassign lost evidence');
  const rc = take(C.completeTask(approvedRec(), 'agenda', { actor: 'Morgan Reed', evidence: 'Replacement', clock: D })); assert.ok(JSON.stringify(rc.events).includes('Proof agenda'), 're-complete lost evidence');
  let a = approvedRec(); a = take(C.saveDelivery(a, { date: D, evidence: 'first receipt' }, O)); a = take(C.saveDelivery(a, { date: D, evidence: 'second receipt' }, O));
  const log = JSON.stringify(a.events); assert.ok(log.includes('first receipt') && log.includes('second receipt'));
});
t('F-09', 'Delivery chronology: each anchor refused with its own reason; same-day and late-entry delivery accepted', () => {
  const asDelivery = (r, date) => { const x = take(C.saveDelivery(r, { date, evidence: 'receipt' }, O)); return C.changeStage(x, 'Delivered', O); };
  const a = approvedRec();
  refused(asDelivery(a, '2026-11-21'), 'GATE', /cannot be before request creation/, 'before creation');
  const late = C.clone(a); late.createdAt = '2026-11-10T12:00:00Z'; late.approval.policyDecidedAt = '2026-11-10T12:00:00Z'; late.tasks.forEach(x => { if (x.acceptedAt) x.acceptedAt = '2026-11-12T12:00:00Z'; if (x.completedAt) x.completedAt = '2026-11-15T12:00:00Z'; }); late.approval.decisionAt = '2026-11-23T12:00:00Z'; late.approval.basis = C.approvalBasis(late);
  refused(asDelivery(late, '2026-11-20'), 'GATE', /cannot be before approval/, 'before approval date');
  assert.equal(asDelivery(late, '2026-11-23').ok, true, 'same-day delivery (equal dates) must be accepted');
  const wv = take(C.waiveApproval(readyRec(), { ...PO, reason: 'Documented waiver', clock: D2 })); const w2 = take(C.changeStage(wv, 'Approved', { clock: D2 })); wv.tasks.forEach(x => { if (x.acceptedAt) x.acceptedAt = '2026-11-12T12:00:00Z'; });
  const wd = take(C.saveDelivery(w2, { date: '2026-11-23', evidence: 'receipt' }, { clock: D2 })); const wr = C.changeStage(wd, 'Delivered', { clock: D2 }); refused(wr, 'GATE', /cannot be before (documented waiver|waiver)/, 'before waiver');
  const fut = take(C.saveDelivery(a, { date: '2026-11-30', evidence: 'receipt' }, O)); refused(C.changeStage(fut, 'Delivered', O), 'GATE', /future/, 'future delivery');
  assert.equal(C.validDay('0001-01-01'), false);
});
t('F-10', 'Every record-changing entry point refuses a clock earlier than the latest recorded event, leaving the record unchanged', () => {
  let r = F.fixture('V3', 'Req', { clock: '2026-11-25', offset: 5, stage: 'In progress' }); const back = { clock: '2026-11-20' };
  const calls = { accept: () => C.acceptTask(r, 'it', { actor: 'Taylor Brooks', ...back }), complete: () => C.completeTask(r, 'it', { actor: 'Taylor Brooks', evidence: 'x', ...back }), reopen: () => C.reopenTask(r, 'agenda', { reason: 'x', ...back }), reassign: () => C.reassignTask(r, 'it', 'Jesse Park', back), update: () => C.updateRequest(r, { summary: 'x' }, back), due: () => C.updateTaskDueDate(r, 'it', '2026-11-30', back), policy: () => C.setApprovalPolicy(r, { required: false, reason: 'x', ...PO, ...back }), delivery: () => C.saveDelivery(r, { date: '2026-11-20', evidence: 'x' }, back), stage: () => C.changeStage(r, 'Ready for review', back), add: () => C.addTask(r, F.task('n', 'N', 'Casey Shah', { dueDate: '2026-11-30' }), back), waive: () => C.waiveApproval(r, { ...PO, reason: 'x', ...back }), decide: () => C.decideApproval(r, { decision: 'Approved', actor: 'Avery Chen', ...back }) };
  const snap = JSON.stringify(r);
  for (const [name, fn] of Object.entries(calls)) { const res = fn(); assert.equal(res.ok, false, name + ' accepted a backward clock'); assert.equal(res.code, 'CHRONOLOGY', name + ' wrong code ' + res.code); }
  assert.equal(JSON.stringify(r), snap);
  assert.equal(C.acceptTask(r, 'it', { actor: 'Taylor Brooks', clock: '2026-11-25' }).ok, true, 'same-day action must still work');
});
t('F-11', 'Invalid clocks are refused with CLOCK and cannot make a future delivery pass', () => {
  let a = approvedRec(); a = take(C.saveDelivery(a, { date: '2099-01-01', evidence: 'r' }, O));
  for (const bad of ['', 'garbage', null, '2026-02-30']) { const res = C.changeStage(a, 'Delivered', { clock: bad }); assert.equal(res.ok, false, 'clock ' + JSON.stringify(bad) + ' accepted'); assert.match(res.code, /CLOCK|DATE/, 'wrong code ' + res.code); }
});
t('F-13', 'A rejected approval is a visible exception with reason and a feasible next action', () => {
  let r = readyRec(); r = take(C.decideApproval(r, { decision: 'Rejected', actor: 'Avery Chen', note: 'Scope wrong', clock: D }));
  const a = C.assess(r, D); assert.notEqual(a.risk, 'No current exception'); const i = a.issues.find(x => /reject/i.test(x.message)); assert.ok(i, 'no rejection issue'); assert.match(i.message + ' ' + (i.next || i.action || ''), /Scope wrong|reviewer|new approval|rework|decision/i);
});
t('F-14', 'Established intake fields cannot be blanked; previous target date retained', () => {
  const r = readyRec();
  for (const [k, re] of [['owner', /coordinator/], ['targetDate', /target date/], ['type', /request type/]]) refused(C.updateRequest(r, { [k]: '' }, O), 'INTAKE', re, 'blank ' + k);
  const x = take(C.updateRequest(r, { targetDate: '2026-12-31' }, O)); assert.ok(JSON.stringify(x.events.at(-1)).includes(r.targetDate) || JSON.stringify(x.events).includes(r.targetDate), 'previous target date not retained');
});
t('F-15', 'Reopening/reassigning a predecessor invalidates dependants transitively, retaining their evidence', () => {
  const r = readyRec(); r.tasks.push(F.task('late', 'Late check', 'Casey Shah', { dueDate: '2026-11-26', dependsOn: ['presenter'] })); const lt = r.tasks.find(x => x.id === 'late'); lt.status = 'Complete'; lt.evidence = 'Late proof'; lt.acceptedBy = 'Casey Shah'; lt.acceptedAt = C.stamp(D); lt.completedAt = C.stamp(D);
  const x = take(C.reopenTask(r, 'agenda', { reason: 'Agenda changed', clock: D }));
  for (const id of ['presenter', 'late']) assert.equal(x.tasks.find(t => t.id === id).status, 'Open', id + ' kept stale Complete');
  assert.ok(JSON.stringify(x.events).includes('Late proof'), 'dependant evidence not retained');
  const y = take(C.reassignTask(readyRec(), 'agenda', 'Jesse Park', O)); assert.equal(y.tasks.find(t => t.id === 'presenter').status, 'Open');
});
t('F-22', 'Date range 2000-2100 and engine length limits', () => {
  assert.deepEqual(['1999-12-31', '2000-01-01', '2100-12-31', '2101-01-01', '2026-02-30'].map(C.validDay), [false, true, true, false, false]);
  const r = readyRec(); refused(C.updateRequest(r, { title: 'x'.repeat(101) }, O), 'LENGTH', /Title|title/, 'long title');
  assert.equal(C.updateRequest(r, { title: 'x'.repeat(100) }, O).ok, true);
});
t('F-23', 'Closure details only after delivery; closure needs actor+reason; closure event uses them; zero-follow-up needs an explanation', () => {
  refused(C.saveCloseout(approvedRec(), { actor: 'Morgan Reed', reason: 'early' }, O), 'SEQUENCE', /Record delivery before/, 'pre-delivery closure');
  let r = deliveredRec(); r = take(C.completeTask(r, 'followup', { actor: 'Morgan Reed', evidence: 'Done', clock: D }));
  refused(C.changeStage(r, 'Closed', O), 'GATE', /Closure actor and reason are required/, 'close without details');
  r = take(C.saveCloseout(r, { actor: 'Casey Shah', reason: 'Everything resolved' }, O)); const c = take(C.changeStage(r, 'Closed', O)); const e = c.events.at(-1); assert.deepEqual([e.actor, e.reason], ['Casey Shah', 'Everything resolved']);
  const z = deliveredRec(); z.tasks = z.tasks.filter(x => x.kind !== 'closeout'); z.approval.basis = C.approvalBasis(z); refused(C.changeStage(z, 'Closed', O), 'GATE', /explain why no follow-up is required/, 'no follow-up, no explanation');
});
t('F-24', 'Approval is invalidated by later identical verification/acceptance and by material edits; same-day identical re-verification is not', () => {
  const a = approvedRec(); const ev = a.tasks.find(x => x.id === 'it').evidence;
  assert.equal(take(C.completeTask(a, 'it', { actor: 'Taylor Brooks', evidence: ev, clock: D })).approval.decision, 'Approved', 'same-day identical re-verification must not void approval');
  const later = take(C.completeTask(a, 'it', { actor: 'Taylor Brooks', evidence: ev, clock: D2 })); assert.equal(later.approval.decision, 'Pending'); assert.equal(later.stage, 'In progress');
  const acc = take(C.acceptTask(a, 'it', { actor: 'Taylor Brooks', clock: D2 })); assert.equal(acc.approval.decision, 'Pending');
  const ed = take(C.updateRequest(a, { summary: 'Materially changed' }, O)); assert.equal(ed.approval.decision, 'Pending');
  refused(C.decideApproval(a, { decision: 'Rejected', actor: 'Avery Chen', note: 'late', clock: D }), 'STAGE', /Ready for review|stage/i, 'decision on non-review stage');
});
t('F-26', 'Recommendation copy does not promise unsupported operations', () => {
  const r = readyRec(); r.tasks.find(x => x.id === 'it').dueDate = '2026-12-30'; const msgs = C.assess(r, D).issues.map(i => i.message + ' ' + (i.next || i.action || '')).join(' | ');
  assert.doesNotMatch(msgs, /record an exception if intentional/i); assert.doesNotMatch(msgs, /record corrective action/i);
});
t('F-STALE', 'Stale approval basis detected for every approval-relevant field edited behind the engine\'s back', () => {
  const a = approvedRec(); const bad = [['title', q => q.title = 'X'], ['summary', q => q.summary = 'X'], ['targetDate', q => q.targetDate = '2026-11-30'], ['task evidence', q => q.tasks.find(x => x.id === 'it').evidence = 'x'], ['task assignee', q => q.tasks.find(x => x.id === 'it').assignedTo = 'Jesse Park'], ['approver', q => q.approval.approver = 'Jesse Park'], ['closeout task title', q => q.tasks.find(x => x.id === 'followup').title = 'Other']];
  for (const [label, mut] of bad) { const q = C.clone(a); mut(q); assert.ok(C.stageIssues(q, 'Approved', D).length > 0, label + ' edit not detected'); assert.notEqual(C.assess(q, D).risk, 'No current exception', label); }
});

const pad = (s, n) => String(s).padEnd(n);
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${pad(r.id, 8)} ${r.title}${r.ok ? '' : '\n        -> ' + r.why}`);
console.log(`\n${results.filter(r => r.ok).length}/${results.length} verification groups passed`);
if (require.main === module) process.exitCode = results.every(r => r.ok) ? 0 : 1;
