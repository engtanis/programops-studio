/* ProgramOps Studio final candidate - tests for issues found in the FINAL independent review (N-01 .. N-05) plus coverage pins.
 *
 *   node final_review_new_findings.js          (engine part always runs; UI part needs:  npm install jsdom)
 *
 * DEFECT tests assert the CORRECT behaviour and are expected to FAIL on the reviewed candidate (until the finding is addressed).
 * PIN tests assert behaviour that is correct today but that no earlier test pinned (mutation survivors); expected to PASS.
 * Every refusal assertion checks the code/message and a valid recovery path, so a blanket refusal cannot satisfy it.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const C = require('./core.js'), F = require('./fixtures.js');
const D = '2026-11-23', O = { clock: D };
const PO = { actor: 'Demo process owner', actorRole: 'Process owner (simulated)' };
const results = [];
async function t(kind, id, sev, title, fn) { try { await fn(); results.push({ kind, id, sev, title, ok: true }); } catch (e) { results.push({ kind, id, sev, title, ok: false, why: String(e.message).split('\n')[0] }); } }
const take = (res, l) => { assert.equal(res.ok, true, (l || '') + ' refused: ' + res.code + ' ' + res.message); return res.record; };
function ready() { let r = F.fixture('N1', 'Req', { clock: D, offset: 3, stage: 'In progress' }); for (const x of r.tasks.filter(x => x.kind === 'readiness')) { x.acceptedBy = x.assignedTo; x.acceptedAt = C.stamp(D); x.status = 'Complete'; x.evidence = 'Proof ' + x.id; x.completedAt = C.stamp(D); } return take(C.changeStage(r, 'Ready for review', O)); }
const approved = () => { let r = ready(); r = take(C.decideApproval(r, { decision: 'Approved', actor: r.approval.approver, clock: D })); return take(C.changeStage(r, 'Approved', O)); };
const delivered = () => { let r = approved(); r = take(C.saveDelivery(r, { date: D, evidence: 'receipt' }, O)); return take(C.changeStage(r, 'Delivered', O)); };

(async () => {
  /* ---------------- engine DEFECT tests ---------------- */
  await t('DEFECT', 'N-01', 'Low-Med', 'Closure details must not attest resolution before the follow-up task is complete', () => {
    const r = delivered(); const saved = C.saveCloseout(r, { actor: 'Morgan Reed', reason: 'All follow-up resolved' }, O);
    if (!saved.ok) {                                       // acceptable fix A: refuse while required follow-up is open, with a follow-up-specific reason
      assert.match(saved.message, /follow-up|closeout/i, 'refused for an unrelated reason: ' + saved.message);
      let x = take(C.completeTask(r, 'followup', { actor: 'Morgan Reed', evidence: 'Done', clock: D }));
      x = take(C.saveCloseout(x, { actor: 'Morgan Reed', reason: 'All follow-up resolved' }, O));       // recovery path must work
      assert.equal(take(C.changeStage(x, 'Closed', O)).stage, 'Closed'); return;
    }
    // acceptable fix B: accepted, but completing the follow-up afterwards invalidates the earlier text
    const x = take(C.completeTask(saved.record, 'followup', { actor: 'Morgan Reed', evidence: 'Done', clock: '2026-11-24' }));
    assert.deepEqual([x.closeout.actor, x.closeout.reason], ['', ''], 'closure text written while follow-up was open survived its completion and would be recorded at close');
  });
  await t('DEFECT', 'N-03', 'Low', 'Missing delivery evidence must not be reported as "recorded in the future"', () => {
    let a = approved(); a = take(C.saveDelivery(a, { date: D, evidence: '' }, O));
    const res = C.changeStage(a, 'Delivered', O); assert.equal(res.ok, false); assert.match(res.message, /evidence/i);
    assert.doesNotMatch(res.message, /future/i, 'wrong-reason text: ' + res.message);
  });
  await t('DEFECT', 'N-05', 'Low', 'Reviewer identity comparison must also normalise internal whitespace / non-breaking spaces', () => {
    const base = F.fixture('N5', 'Req', { clock: D, offset: 3, stage: 'In progress' });
    for (const variant of ['Avery\u00A0Chen', 'Avery  Chen', 'Avery\tChen']) {
      const q = C.clone(base); q.tasks.find(x => x.id === 'it').assignedTo = variant;
      const res = C.setApprovalPolicy(q, { required: true, approver: 'Avery Chen', reason: 'review', ...PO, clock: D });
      assert.equal(res.ok, false, 'approver accepted although the same person is assigned as ' + JSON.stringify(variant)); assert.equal(res.code, 'INDEPENDENCE');
    }
  });

  /* ---------------- engine PIN tests (mutation survivors) ---------------- */
  await t('PIN', 'G-31', '', 'A rejection requires a reason (mutation M31 survived all earlier suites)', () => {
    const r = ready(); const res = C.decideApproval(r, { decision: 'Rejected', actor: 'Avery Chen', note: '  ', clock: D });
    assert.equal(res.ok, false); assert.equal(res.code, 'REASON'); assert.match(res.message, /Rejection reason is required/);
    assert.equal(C.decideApproval(r, { decision: 'Rejected', actor: 'Avery Chen', note: 'Scope wrong', clock: D }).ok, true);
  });
  await t('PIN', 'G-32', '', 'A reviewer who becomes a contributor raises a visible exception and blocks Ready for review (M49)', () => {
    let r = F.fixture('N6', 'Req', { clock: D, offset: 3, stage: 'In progress' }); r = take(C.setApprovalPolicy(r, { required: true, approver: 'Avery Chen', reason: 'review', ...PO, clock: D })); r = take(C.reassignTask(r, 'it', 'Avery Chen', O));
    const issue = C.assess(r, D).issues.find(i => /independent/i.test(i.message)); assert.ok(issue, 'no independence exception raised'); assert.match(issue.severity, /Review needed|Critical|Warning/);
    const go = C.changeStage(r, 'Ready for review', O); assert.equal(go.ok, false); assert.match(go.message, /independent/i);
  });
  await t('PIN', 'G-33', '', 'reconcile() rolls a stale Approved record back and voids the decision (M51)', () => {
    const a = approved(); a.summary = 'Edited behind the engine'; const res = C.saveDelivery(a, { date: D, evidence: 'r' }, O);
    const x = take(res); assert.equal(x.stage, 'In progress'); assert.equal(x.approval.decision, 'Pending'); assert.ok(x.events.some(e => /rollback|invalidated/i.test(e.type + e.reason)), 'rollback not recorded in history');
  });
  await t('PIN', 'G-34', '', 'Stale approval basis: acceptance timestamp later than the decision invalidates approval (M46/M22/M23 are individually redundant)', () => {
    const a = approved(); const q = C.clone(a); q.tasks.find(x => x.id === 'it').acceptedAt = '2026-12-05T12:00:00Z';
    assert.ok(C.stageIssues(q, 'Approved', D).some(m => /Approval required/.test(m)));
  });

  /* ---------------- UI tests (jsdom) ---------------- */
  let JSDOM = null; try { ({ JSDOM } = require('jsdom')); } catch (e) { results.push({ kind: 'SKIP', id: 'UI', sev: '', title: 'UI tests skipped: jsdom not installed (npm install jsdom)', ok: true }); }
  if (JSDOM) {
    const KEY = 'programops-stage3-v2';
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').replace(/<script src="[^"]+"><\/script>/g, '');
    const boot = (records, today = D) => { const w = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true }).window;
      if (!w.HTMLDialogElement.prototype.showModal) { w.HTMLDialogElement.prototype.showModal = function () { this.open = true; }; w.HTMLDialogElement.prototype.close = function () { this.open = false; }; }
      w.localStorage.setItem(KEY, JSON.stringify({ version: 2, clock: today, records })); w.Element.prototype.scrollIntoView = () => {}; w.scrollTo = () => {}; w.confirm = () => true; w.prompt = () => 'reason';
      const R = w.Date; w.Date = class extends R { constructor(...a) { if (a.length) super(...a); else super(today + 'T10:00:00'); } static now() { return new R(today + 'T10:00:00').getTime(); } };
      for (const f of ['core.js', 'fixtures.js', 'app.js']) w.eval(fs.readFileSync(path.join(__dirname, f), 'utf8')); return w; };
    const click = (w, s) => { const el = typeof s === 'string' ? w.document.querySelector(s) : s; if (!el) throw new Error('control not found: ' + s); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
    await t('DEFECT', 'N-02', 'Low-Med', 'Assigning the follow-up owner after clearance silently returns the request to In progress: the feedback must say so', () => {
      const a = approved(); const f = a.tasks.find(x => x.id === 'followup'); f.assignedTo = ''; f.acceptedBy = ''; f.acceptedAt = ''; a.approval.basis = C.approvalBasis(a);
      const w = boot([a]); click(w, '[data-open="N1"]'); w.document.querySelector('[data-task-owner="followup"]').value = 'Casey Shah'; click(w, '[data-reassign="followup"]');
      const stage = JSON.parse(w.localStorage.getItem(KEY)).records[0].stage; assert.equal(stage, 'In progress', 'precondition: the request was rolled back');
      const text = w.document.getElementById('feedback').textContent + ' ' + w.document.getElementById('announcement').textContent;
      assert.match(text, /In progress|returned|rolled back|renewed review|approval/i, 'feedback does not mention the rollback/approval reset: ' + text.trim().slice(0, 120));
    });
    await t('DEFECT', 'N-04', 'Low', 'Visible button labels must be contained in their accessible names (WCAG 2.5.3)', () => {
      const w = boot(F.starter(D)); const bad = new Set();
      for (const id of ['OPS-101', 'OPS-102', 'OPS-103', 'OPS-104', 'OPS-105']) { click(w, `[data-open="${id}"]`); for (const b of w.document.querySelectorAll('button[aria-label]')) { const vis = b.textContent.trim().replace(/\*/g, '').toLowerCase(); if (!b.getAttribute('aria-label').toLowerCase().includes(vis)) bad.add(b.textContent.trim() + ' => ' + b.getAttribute('aria-label').split(' (')[0]); } }
      assert.equal(bad.size, 0, 'mismatches: ' + [...bad].join(' | '));
    });
  }

  const pad = (s, n) => String(s).padEnd(n);
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${pad(r.kind, 6)} ${pad(r.id, 5)} ${pad(r.sev, 8)} ${r.title}${r.ok ? '' : '\n        -> ' + r.why}`);
  const d = results.filter(r => r.kind === 'DEFECT'), p = results.filter(r => r.kind === 'PIN');
  console.log(`\nDEFECT tests failing (open new findings): ${d.filter(r => !r.ok).length}/${d.length}`); console.log(`PIN tests passing: ${p.filter(r => r.ok).length}/${p.length}`);
  if (require.main === module) process.exitCode = results.some(r => !r.ok) ? 1 : 0;
})();
