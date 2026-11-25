"""Stage 4 real Chromium interaction checks; independent jsdom suite remains separate."""
from pathlib import Path
import csv, io, json, re
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent
HTML=re.sub(r'<script src="[^"]+"></script>','',(R/'index.html').read_text())
KEY='programops-stage3-v2'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1400,'height':900},accept_downloads=True);page.set_default_timeout(6000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(HTML)
 page.add_script_tag(content="var cache={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return cache[k]??null},setItem(k,v){cache[k]=String(v)},removeItem(k){delete cache[k]}}});const RealDate=Date;window.Date=class extends RealDate{constructor(...a){if(a.length)super(...a);else super('2026-11-23T10:00:00')}static now(){return new RealDate('2026-11-23T10:00:00').getTime()}};")
 for f in ('core.js','fixtures.js'):page.add_script_tag(content=(R/f).read_text())
 page.evaluate("""()=>{const F=ProgramOpsFixtures,C=ProgramOpsCore,clock='2026-11-23',recs=F.starter(clock);const ready=recs[0];ready.title='Équipe readiness';ready.tasks[1].status='Complete';ready.tasks[1].evidence='IT checked';ready.tasks[1].completedAt=C.stamp(clock);ready.targetDate='2026-11-20';ready.tasks[0].status='Open';ready.tasks[0].evidence='';delete ready.tasks[3].required;const far=recs[1];far.targetDate='2026-12-20';far.tasks[1].dueDate='2026-12-18';const d=recs[3];d.targetDate=F.dateAdd(d.delivery.date,-2);d.approval.basis=C.approvalBasis(d);localStorage.setItem('programops-stage3-v2',JSON.stringify({version:2,clock,records:recs}));}""")
 page.add_script_tag(content=(R/'app.js').read_text())
 def row(title):return page.locator('.task').filter(has=page.locator('.task-title',has_text=title))
 def record(id):return page.evaluate("id=>JSON.parse(localStorage.getItem('programops-stage3-v2')).records.find(r=>r.id===id)",id)
 def select(id):page.locator(f'button.item[data-open="{id}"]').click()
 def metric(name):return page.locator('.metric').filter(has=page.locator('.label',has_text=name)).locator('.value').inner_text()
 assert row('Presenter readiness').locator('.tag').inner_text()=='Blocked';assert 'Required' in row('Presenter readiness').inner_text();assert 'Optional' not in row('Presenter readiness').inner_text();print('PASS UI-09: imported completed dependent is visibly blocked; absent required flag is Required')
 old=record('OPS-101');page.locator('#requestForm [name=targetDate]').fill('');page.locator('#requestForm button[type=submit]').click();assert 'Cannot clear' in page.locator('#feedback').inner_text();assert record('OPS-101')==old;assert page.locator('button.item[data-open="OPS-101"] .tag').inner_text()=='Critical';print('PASS F-14: blanking target date blocked without hiding overdue risk')
 page.locator('#requestForm [name=targetDate]').fill('2026-12-10');page.locator('#requestForm button[type=submit]').click();assert record('OPS-101')['targetDate']=='2026-12-10';page.locator('summary').filter(has_text='View simulated change history').click();ev=page.locator('.event').filter(has_text='request updated').first;assert '2026-11-20' in ev.inner_text() and '2026-12-10' in ev.inner_text();print('PASS F-14: prior target remains visible after legitimate revision')
 # First restore agenda; then reopen it using UI to prove presenter evidence is reset and retained.
 page.locator('[data-evidence="agenda"]').fill('Reverified agenda');page.locator('[data-complete="agenda"]').click();page.once('dialog',lambda d:d.accept('New agenda'));page.locator('[data-reopen="agenda"]').click();assert row('Presenter readiness').locator('.tag').inner_text()=='Blocked';r=record('OPS-101');t=next(t for t in r['tasks'] if t['id']=='presenter');assert t['status']=='Open' and t['evidence']=='';assert 'Presenter acknowledged briefing' in next(e['before'] for e in r['events'] if e['type']=='dependent verification invalidated');page.locator('[data-evidence="presenter"]').fill('Premature');page.locator('[data-complete="presenter"]').click();assert 'prerequisite' in page.locator('#feedback').inner_text().lower();page.locator('[data-evidence="agenda"]').fill('Fresh agenda');page.locator('[data-complete="agenda"]').click();page.locator('[data-evidence="presenter"]').fill('Fresh presenter proof');page.locator('[data-complete="presenter"]').click();assert row('Presenter readiness').locator('.tag').inner_text()=='Complete';print('PASS F-15: invalidation, preserved evidence, premature completion blocked, normal re-verification')
 assert metric('Active requests')=='4';assert metric('Readiness verified')=='1';select('OPS-102');assert row('Technology test').locator('.tag').inner_text()=='Action needed';
 def respond_cancel(d): d.accept('Withdrawn') if d.type=='prompt' else d.accept()
 page.on('dialog',respond_cancel);page.locator('[data-stage="Cancelled"]').click();page.remove_listener('dialog',respond_cancel);assert metric('Active requests')=='3';assert row('Technology test').locator('.tag').inner_text()=='Not applicable';print('PASS F-16/F-17: far-off unaccepted task not critical; delivered/cancelled excluded from active count')
 with page.expect_download() as download:page.locator('#export').click()
 data=Path(download.value.path()).read_bytes();assert data[:3]==b'\xef\xbb\xbf';parsed={r['id']:r for r in csv.DictReader(io.StringIO(data.decode('utf-8-sig')))};assert parsed['OPS-101']['title']=='Équipe readiness';c=parsed['OPS-102'];assert c['readiness']=='Not applicable' and c['pending_tasks']=='' and c['pending_task_phase']=='' and c['risk']=='Terminal';assert c['scenario_date']=='2026-11-23';print('PASS UI-11/UI-12: actual CSV bytes include BOM, Unicode preserved, cancelled fields N/A')
 d=parsed['OPS-104'];assert d['delivery_date']=='2026-11-22' and d['delivery_outcome']=='Delivered 2 day(s) late' and d['pending_task_phase']=='closeout' and d['pending_tasks']=='1';assert parsed['OPS-101']['pending_task_phase']=='readiness';print('PASS F-17: delivery date/outcome and scenario date export accurately; pending count uses correct work phase')
 assert not errors,errors;b.close()
print('7/7 Stage 4 targeted Chromium groups passed; no page errors')
