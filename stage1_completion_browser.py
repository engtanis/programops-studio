"""Targeted real-browser checks, not a claim that the independent jsdom suite ran."""
from pathlib import Path
import re, json
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent
HTML=re.sub(r'<script src="[^"]+"></script>','',(R/'index.html').read_text())
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1400,'height':900}); errors=[]; page.set_default_timeout(8000);page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(HTML)
 page.add_script_tag(content="var cache={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return cache[k]??null},setItem(k,v){cache[k]=String(v)},removeItem(k){delete cache[k]}}});const RealDate=Date;window.Date=class extends RealDate{constructor(...a){if(a.length)super(...a);else super('2026-11-23T10:00:00')}static now(){return new RealDate('2026-11-23T10:00:00').getTime()}};")
 for f in ('core.js','fixtures.js'):page.add_script_tag(content=(R/f).read_text())
 page.evaluate("""()=>{let r=ProgramOpsFixtures.fixture('R2','Seeded request',{clock:'2026-11-23',offset:2,stage:'In progress'});for(const t of r.tasks.filter(t=>t.kind==='readiness')){t.acceptedBy=t.assignedTo;t.status='Complete';t.evidence='proof';}let d=ProgramOpsFixtures.starter('2026-11-23').find(x=>x.id==='OPS-104');localStorage.setItem('programops-stage3-v2',JSON.stringify({version:2,clock:'2026-11-23',records:[r,d]}));}""")
 page.add_script_tag(content=(R/'app.js').read_text())
 def record(id):return page.evaluate("id=>JSON.parse(localStorage.getItem('programops-stage3-v2')).records.find(r=>r.id===id)",id)
 page.once('dialog',lambda d:d.accept('redo needed'));page.locator('[data-reopen="vendor"]').click()
 page.locator('summary').filter(has_text='View simulated change history').click();ev=page.locator('.event').filter(has_text='task reopened').first
 assert 'Before: proof' in ev.inner_text() and 'redo needed' in ev.inner_text(),ev.inner_text()
 assert record('R2')['tasks'][2]['evidence']==''
 print('PASS UI-05 corrected seeded proof appears in the specific visible reopening event')
 page.locator('button.item[data-open="OPS-104"]').click();original=record('OPS-104')
 for value in [None,'','  ']:
  page.once('dialog',lambda d,v=value:d.dismiss() if v is None else d.accept(v));page.locator('[data-stage="In progress"]').click()
  assert 'requires a reason' in page.locator('#feedback').inner_text();assert record('OPS-104')==original
  print('PASS F-06 browser rejects '+repr(value)+' without modifying stored delivery or history')
 page.once('dialog',lambda d:d.accept('Incorrect delivery record'));page.locator('[data-stage="In progress"]').click();r=record('OPS-104')
 assert r['stage']=='In progress' and r['delivery']['evidence']==''
 history=[e for e in r['events'] if e['type']=='delivery reopened'][-1];assert json.loads(history['before'])['delivery']==original['delivery']
 page.locator('summary').filter(has_text='View simulated change history').click()
 assert 'Incorrect delivery record' in page.locator('details .event').filter(has_text='stage').first.inner_text()
 assert original['delivery']['evidence'] in page.locator('.event').filter(has_text='delivery reopened').first.inner_text()
 print('PASS F-06 browser records reason and displays superseded delivery evidence after reopening')
 assert not errors,errors;b.close()
print('5/5 Stage 1 completion Chromium checks passed; no page errors')
