/* ProgramOps Studio Stage 3 - independent review regressions, UI level.
 *
 * Needs jsdom (dev-only):   npm install jsdom
 * Place in stage3/ and run: node independent_review_ui_regressions.js
 *
 * Loads the real index.html + core.js + fixtures.js + app.js in jsdom and drives the real click/submit handlers.
 * DEFECT tests assert correct behaviour and are expected to FAIL on the current build.
 * PIN tests assert currently-correct behaviour (negative security results) and are expected to PASS.
 * Limits: jsdom is not a real browser. Focus, layout, screen-reader and contrast behaviour still need a real browser/AT pass.
 */
'use strict';
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path'), assert = require('node:assert/strict');
const F = require('./fixtures.js'), C = require('./core.js');
const KEY = 'programops-stage3-v2', CLOCK = '2026-11-23';
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').replace(/<script src="[^"]+"><\/script>/g, '');

function boot({ records, clock = CLOCK, stored, today = CLOCK, prompts = [], confirmVal = true } = {}) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/', pretendToBeVisual: true });
  const w = dom.window;
  if (!w.HTMLDialogElement.prototype.showModal) { w.HTMLDialogElement.prototype.showModal = function () { this.open = true; }; w.HTMLDialogElement.prototype.close = function () { this.open = false; }; }
  if (stored) w.localStorage.setItem(KEY, stored);
  else if (records) w.localStorage.setItem(KEY, JSON.stringify({ version: 2, clock, records }));
  w.Element.prototype.scrollIntoView = () => {}; w.scrollTo = () => {};
  w.__confirms = 0; w.__prompts = 0;
  w.prompt = () => { w.__prompts++; return prompts.length ? prompts.shift() : ''; };
  w.confirm = () => { w.__confirms++; return confirmVal; };
  w.URL.createObjectURL = b => { w.__blob = b; return 'blob:x'; }; w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () { w.__download = this.download; };
  const R = w.Date; w.Date = class extends R { constructor(...a) { if (a.length) super(...a); else super(today + 'T10:00:00'); } static now() { return new R(today + 'T10:00:00').getTime(); } };
  for (const f of ['core.js', 'fixtures.js', 'app.js']) w.eval(fs.readFileSync(path.join(__dirname, f), 'utf8'));
  return w;
}
const click = (w, sel) => { const el = typeof sel === 'string' ? w.document.querySelector(sel) : sel; if (!el) throw new Error('control not found: ' + sel); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
const submit = (w, form) => form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
const store = w => JSON.parse(w.localStorage.getItem(KEY));
const readyRec = (id, stage) => { const r = F.fixture(id, 'Seeded request', { clock: CLOCK, offset: 2, stage }); for (const t of r.tasks.filter(t => t.kind === 'readiness')) { t.acceptedBy = t.assignedTo; t.status = 'Complete'; t.evidence = 'proof'; } return r; };
function createRequest(w, title) { click(w, '#create'); const f = w.document.querySelector('#createForm'); f.querySelector('[name=title]').value = title; f.querySelector('[name=owner]').value = 'Morgan Reed'; f.querySelector('[name=targetDate]').value = '2026-11-26'; submit(w, f); }

const results = [];
async function t(kind, id, sev, title, fn) {
  try { await fn(); results.push({ kind, id, sev, title, ok: true }); } catch (e) { results.push({ kind, id, sev, title, ok: false, why: String(e.message).split('\n')[0] }); }
}

(async () => {
  await t('DEFECT', 'UI-01', 'Medium', 'A later visit must not keep a stale frozen scenario date (F-12)', () => {
    const a = boot({ today: CLOCK }); createRequest(a, 'First visit');
    const w = boot({ stored: a.localStorage.getItem(KEY), today: '2026-12-04' });
    assert.ok(w.document.getElementById('footer').textContent.includes('2026-12-04'), 'footer still says: ' + w.document.getElementById('footer').textContent);
  });
  await t('DEFECT', 'UI-02', 'Medium', 'Scenario shortcut must not silently delete user-created requests (F-18)', () => {
    const w = boot({ confirmVal: false }); createRequest(w, 'My real work item');
    click(w, '[data-nav=method]'); click(w, '[data-scenario=falsegreen]');
    assert.ok(store(w).records.some(r => r.title === 'My real work item'), 'user request deleted without confirmation');
  });
  await t('DEFECT', 'UI-03', 'Medium', 'Cancelling a request must ask for confirmation (irreversible) (F-18)', () => {
    const w = boot({ records: [readyRec('R1', 'Approved')], prompts: ['.'], confirmVal: false }); click(w, '[data-open="R1"]');
    click(w, '[data-stage="Cancelled"]');
    assert.notEqual(store(w).records[0].stage, 'Cancelled', 'cancelled with a one-character reason and no confirmation');
  });
  await t('DEFECT', 'UI-04', 'Medium', 'Rejection note must not be pre-filled into the waiver reason (F-04)', () => {
    const w = boot({ records: [readyRec('R1', 'Ready for review')] }); click(w, '[data-open="R1"]');
    w.document.getElementById('approvalNote').value = 'Scope is unacceptable'; click(w, '[data-decision="Rejected"]');
    click(w, '[data-stage="Ready for review"]');
    assert.equal(w.document.getElementById('approvalNote').value, '', 'note field still contains the rejection text');
  });
  await t('DEFECT', 'UI-05', 'Medium', 'History must show the evidence the UI says was "retained" after Reopen task (F-08)', () => {
    const w = boot({ records: [readyRec('R2', 'In progress')], prompts: ['redo needed'] }); click(w, '[data-open="R2"]');
    click(w, '[data-reopen="vendor"]');
    const entry = [...w.document.querySelectorAll('#details .event')].find(e => e.querySelector('b')?.textContent === 'task reopened');
    assert.ok(entry && entry.textContent.includes('Before: proof'), 'old seeded evidence is stored but never displayed in the reopening event');
  });
  await t('DEFECT', 'UI-06', 'Medium', 'An action must not destroy keyboard focus or unsaved input in other controls (F-19)', () => {
    const w = boot({ records: [F.fixture('R3', 'Req', { clock: CLOCK, offset: 5 })] }); click(w, '[data-open="R3"]');
    w.document.querySelector('[data-evidence="it"]').value = 'typed but not submitted';
    const b = w.document.querySelector('[data-date-save="agenda"]'); b.focus();
    w.document.querySelector('[data-task-date="agenda"]').value = '2026-11-24'; click(w, b);
    assert.notEqual(w.document.activeElement.tagName, 'BODY', 'focus dropped to <body> after the action');
    assert.equal(w.document.querySelector('[data-evidence="it"]')?.value, 'typed but not submitted', 'unsaved input lost');
  });
  await t('DEFECT', 'UI-07', 'Low', 'A second tab must not overwrite the first tab\'s saved edit (F-21)', () => {
    const a = boot({ records: [F.fixture('R6', 'Tab test', { clock: CLOCK, offset: 5 })] });
    const b = boot({ stored: a.localStorage.getItem(KEY) });
    click(a, '[data-open="R6"]'); a.document.querySelector('#requestForm [name=title]').value = 'Edited in A'; submit(a, a.document.querySelector('#requestForm'));
    b.localStorage.setItem(KEY, a.localStorage.getItem(KEY)); b.dispatchEvent(new b.StorageEvent('storage', { key: KEY, newValue: a.localStorage.getItem(KEY) }));
    click(b, '[data-open="R6"]'); b.document.querySelector('#requestForm [name=summary]').value = 'Edited in B'; submit(b, b.document.querySelector('#requestForm'));
    assert.equal(store(b).records[0].title, 'Edited in A', 'tab A edit lost');
  });
  await t('DEFECT', 'UI-08', 'Medium', 'A rejected request must not show "No current exception" or count as readiness-verified (F-13)', () => {
    const w = boot({ records: [readyRec('R7', 'Ready for review')] }); click(w, '[data-open="R7"]');
    w.document.getElementById('approvalNote').value = 'No'; click(w, '[data-decision="Rejected"]');
    assert.notEqual(w.document.querySelector('[data-open="R7"] .tag').textContent, 'No current exception');
  });
  await t('DEFECT', 'UI-09', 'Low', 'A task blocked by an incomplete predecessor must not display a plain "Complete" badge (F-16)', () => {
    const r = readyRec('R5', 'In progress'); const a = r.tasks.find(x => x.id === 'agenda'); a.status = 'Open'; a.evidence = '';
    const w = boot({ records: [r] }); click(w, '[data-open="R5"]');
    const row = [...w.document.querySelectorAll('.task')].find(x => x.textContent.includes('Presenter readiness'));
    assert.notEqual(row.querySelector('.tag').textContent, 'Complete', 'dependant shown Complete while predecessor is open');
  });
  await t('DEFECT', 'UI-10', 'High', 'UI path: a request delivered with an unassigned closeout task must still be closable (F-01)', () => {
    const w = boot(); createRequest(w, 'UI path');
    const own = (id, who) => { w.document.querySelector(`[data-task-owner="${id}"]`).value = who; click(w, `[data-reassign="${id}"]`); };
    click(w, '[data-stage="Planned"]'); click(w, '[data-stage="In progress"]');
    const pf = w.document.querySelector('#policyForm'); pf.querySelector('[name=required]').value = 'no'; pf.querySelector('[name=reason]').value = 'low risk'; submit(w, pf);
    for (const [id, who] of [['agenda', 'Morgan Reed'], ['handoff', 'Taylor Brooks']]) { own(id, who); click(w, `[data-accept="${id}"]`); w.document.querySelector(`[data-evidence="${id}"]`).value = 'ok'; click(w, `[data-complete="${id}"]`); }
    click(w, '[data-stage="Ready for review"]'); click(w, '[data-stage="Approved"]');
    const df = w.document.querySelector('#deliveryForm'); df.querySelector('[name=date]').value = CLOCK; df.querySelector('[name=evidence]').value = 'receipt'; submit(w, df);
    click(w, '[data-stage="Delivered"]');
    if (store(w).records[0].stage !== 'Delivered') return;                    // fix A: delivery blocked until closeout owner accepted
    const row = [...w.document.querySelectorAll('.task')].find(x => x.textContent.includes('Post-delivery'));
    assert.ok(row.querySelector('[data-reassign]') || row.querySelector('[data-accept]'), 'Delivered with no way to assign or accept the closeout task');
  });
  await t('DEFECT', 'UI-11', 'Low', 'CSV: Cancelled rows must not report "Not ready" with pending tasks (F-17)', async () => {
    const recs = F.starter(CLOCK); recs[1] = C.changeStage(recs[1], 'Cancelled', { reason: 'Dropped', clock: CLOCK }).record;
    const w = boot({ records: recs }); click(w, '#export'); const csv = await w.__blob.text();
    const row = csv.split('\r\n').find(l => l.includes('OPS-102'));
    assert.ok(!row.includes('"Not ready"'), 'Cancelled request exported as Not ready: ' + row);
  });
  await t('DEFECT', 'UI-12', 'Low', 'CSV: starts with a UTF-8 BOM so non-ASCII names open correctly in Excel (F-17)', async () => {
    const w = boot({ records: F.starter(CLOCK) }); click(w, '#export'); const buf = Buffer.from(await w.__blob.arrayBuffer());
    assert.deepEqual([...buf.slice(0, 3)], [0xEF, 0xBB, 0xBF]);
  });
  await t('DEFECT', 'UI-13', 'Low', 'Malformed saved state must not throw during render (F-25)', () => {
    const a = F.fixture('M1', 'Malformed', { clock: CLOCK, offset: 5 }); a.events = [{ id: 'EV-1', type: 'x' }];
    const w = boot({ records: [a] }); click(w, '[data-open="M1"]');
  });
  await t('DEFECT', 'UI-14', 'Low', 'Repeated controls need task-specific accessible names (F-20)', () => {
    const w = boot({ records: [F.fixture('R8', 'Req', { clock: CLOCK, offset: 5 })] }); click(w, '[data-open="R8"]');
    const name = el => (el.getAttribute('aria-label') || el.textContent).trim();
    const completes = [...w.document.querySelectorAll('[data-complete]')].map(name);
    assert.equal(new Set(completes).size, completes.length, 'identical accessible names: ' + JSON.stringify(completes));
  });

  // negative security results worth keeping as regression guards
  await t('PIN', 'UI-S1', '', 'Script/markup in title, summary and evidence is not executed or injected', () => {
    const bad = F.fixture('R4', '<img src=x onerror="window.__xss=1">', { clock: CLOCK, offset: 5 }); bad.tasks[0].evidence = '<script>window.__xss=2</script>'; bad.summary = '"><svg onload=window.__xss=3>';
    const w = boot({ records: [bad] }); click(w, '[data-open="R4"]');
    assert.equal(w.__xss, undefined); assert.equal(w.document.querySelectorAll('#details img,#requests img,#details svg,#details script').length, 0);
  });
  await t('PIN', 'UI-S2', '', 'CSV neutralises leading = + - @ and whitespace-prefixed formulas', async () => {
    const recs = F.starter(CLOCK); recs[0].title = '=HYPERLINK("http://x","c")'; recs[2].title = '\u00A0=cmd'; recs[3].title = '@SUM(A1)'; recs[4].title = '-2+3';
    const w = boot({ records: recs }); click(w, '#export'); const csv = await w.__blob.text();
    for (const l of csv.split('\r\n').slice(1)) { const title = l.split('","')[1]; assert.ok(!/^[\s]*[=+\-@]/.test(title), 'unescaped: ' + title); }
  });

  const pad = (s, n) => String(s).padEnd(n);
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${pad(r.kind, 6)} ${pad(r.id, 6)} ${pad(r.sev, 6)} ${r.title}${r.ok ? '' : '\n        -> ' + r.why}`);
  const d = results.filter(r => r.kind === 'DEFECT'), p = results.filter(r => r.kind === 'PIN');
  console.log(`\nDEFECT tests failing (open defects): ${d.filter(r => !r.ok).length}/${d.length}`);
  console.log(`PIN tests passing: ${p.filter(r => r.ok).length}/${p.length}`);
  process.exitCode = results.some(r => !r.ok) ? 1 : 0;
})();
