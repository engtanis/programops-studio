from pathlib import Path
import re, json
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent
HTML=re.sub(r'<script src="[^"]+"></script>','',(R/'index.html').read_text())
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']); page=b.new_page();page.set_default_timeout(6000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(HTML)
 page.add_script_tag(content="var cache={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return cache[k]??null},setItem(k,v){cache[k]=String(v)},removeItem(k){delete cache[k]}}});")
 for f in ('core.js','fixtures.js'):page.add_script_tag(content=(R/f).read_text())
 page.evaluate("""()=>{let r=ProgramOpsFixtures.fixture('R1','Review scenario',{clock:'2026-11-23',offset:9,stage:'Ready for review'});for(const t of r.tasks.filter(t=>t.kind==='readiness')){t.status='Complete';t.evidence='proof';}let pending=ProgramOpsCore.clone(r);pending.id='R2';pending.title='Pending request';localStorage.setItem('programops-stage3-v2',JSON.stringify({version:2,clock:'2026-11-23',records:[r,pending]}));}""")
 page.add_script_tag(content=(R/'app.js').read_text())
 def record(id='R1'):return page.evaluate("id=>JSON.parse(localStorage.getItem('programops-stage3-v2')).records.find(r=>r.id===id)",id)
 def policy(choice,reason):
  f=page.locator('#policyForm');f.locator('[name=required]').select_option(choice);f.locator('[name=reason]').fill(reason);f.locator('button[type=submit]').click()
 def feedback():return page.locator('#feedback').inner_text()
 page.locator('#approvalNote').fill('Scope unacceptable');page.locator('[data-decision="Rejected"]').click();old=record();policy('no','Skip review');assert 'explicit rejection' in feedback() and record()==old;print('PASS process-owner action cannot remove rejected policy; saved record unchanged')
 f=page.locator('#requestForm');f.locator('[name=type]').select_option('Equipment installation');f.locator('[name=summary]').fill('Corrected scope');f.locator('button[type=submit]').click();r=record();assert r['type']=='Equipment installation' and r['approval']==old['approval'];assert 'Scope unacceptable' in page.locator('#details').inner_text();policy('no','Try after changing type');assert 'explicit rejection' in feedback() and record()==r;print('PASS type edit retains rejection, reviewer and evidence; indirect bypass blocked')
 page.locator('[data-stage="Ready for review"]').click();page.locator('[data-stage="Approved"]').click();assert 'Approval rejected' in feedback();page.locator('#approvalNote').fill('');page.locator('[data-decision="Approved"]').click();assert 'previous rejection was addressed' in feedback();page.locator('#approvalNote').fill('Reviewer verified corrected scope');page.locator('[data-decision="Approved"]').click();page.locator('[data-stage="Approved"]').click();assert record()['stage']=='Approved';page.locator('summary').filter(has_text='View simulated change history').click();assert 'Scope unacceptable' in page.locator('.event').filter(has_text='prior approval retained').first.inner_text();print('PASS legitimate reviewer recovery works and previous rejection visible in history')
 page.locator('button.item[data-open="R2"]').click();previous=record('R2')['approval'];policy('no','Process owner assessed low risk');r=record('R2');assert r['stage']=='In progress' and r['approval']['required'] is False;history=[e for e in r['events'] if e['type']=='approval policy determined'][-1];assert json.loads(history['before'])==previous and history['actor']=='Demo process owner';page.locator('[data-stage="Ready for review"]').click();page.locator('[data-stage="Approved"]').click();assert record('R2')['stage']=='Approved';assert 'approval not required' in page.locator('#detailSubtitle').inner_text();print('PASS authorized pending policy change requires rationale, logs previous policy and repeats readiness')
 assert not errors,errors;b.close()
print('4/4 Stage 2 completion Chromium checks passed; no page errors')
