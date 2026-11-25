from pathlib import Path
import json,re
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent
html=re.sub(r'<script src="[^"]+"></script>','',(R/'index.html').read_text())
KEY='programops-stage3-v2';checks=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1400,'height':900});page.set_default_timeout(5000);errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
 page.set_content(html)
 page.add_script_tag(content="var cache={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return cache[k]??null},setItem(k,v){cache[k]=String(v)},removeItem(k){delete cache[k]}}});const RealDate=Date;window.Date=class extends RealDate{constructor(...a){if(a.length)super(...a);else super('2026-11-23T10:00:00')}static now(){return new RealDate('2026-11-23T10:00:00').getTime()}};")
 for name in ('core.js','fixtures.js','app.js'):page.add_script_tag(content=(R/name).read_text())
 def check(x):checks.append(x);print('PASS '+x,flush=True)
 def record(id):return page.evaluate('id=>JSON.parse(localStorage.getItem("'+KEY+'")).records.find(r=>r.id===id)',id)
 def select(id):page.locator(f'button.item[data-open="{id}"]').click()
 def submit(id):page.locator(f'#{id} button[type=submit]').click()
 print(page.locator('#policyForm [name=approver]').inner_html(),flush=True);assert page.locator('#policyForm [name=approver] option[value="Morgan Reed"]').evaluate('(e)=>e.disabled');assert page.locator('#policyForm [name=approver] option[value="Taylor Brooks"]').evaluate('(e)=>e.disabled');assert not page.locator('#policyForm [name=approver] option[value="Avery Chen"]').evaluate('(e)=>e.disabled');assert page.locator('#closeForm').count()==0;check('Independent reviewer choice enforced visibly; premature closure form absent')
 select('OPS-103');page.locator('#requestForm [name=summary]').fill('Substantially changed scope');submit('requestForm');r=record('OPS-103');assert r['approval']['required'] is None and r['stage']=='In progress';page.locator('[data-stage="Ready for review"]').click();assert 'policy' in page.locator('#feedback').inner_text().lower();form=page.locator('#policyForm');form.locator('[name=required]').select_option('no');form.locator('[name=reason]').fill('New scope assessed, low risk');submit('policyForm');page.locator('[data-stage="Ready for review"]').click();page.locator('[data-stage="Approved"]').click();assert record('OPS-103')['stage']=='Approved';check('Material change invalidates exemption; explicit reassessment permits clearance')
 select('OPS-104');assert page.locator('#closeForm').count()==1;page.locator('[data-evidence=followup]').fill('Fictional follow-up proof');page.locator('[data-complete=followup]').click();form=page.locator('#closeForm');form.locator('[name=actor]').fill('Morgan Reed');form.locator('[name=reason]').fill('Verified all follow-up');submit('closeForm');page.locator('[data-stage=Closed]').click();r=record('OPS-104');assert r['stage']=='Closed' and r['events'][-1]['actor']=='Morgan Reed' and r['events'][-1]['reason']=='Verified all follow-up';check('Actual closure event reflects recorded actor/reason, not default simulated coordinator')
 select('OPS-101');page.locator('#requestForm [name=targetDate]').fill('2101-01-01');submit('requestForm');assert record('OPS-101')['targetDate']!='2101-01-01';page.locator('#requestForm [name=targetDate]').fill('2026-11-25');check('HTML date bounds reject out-of-range edit without mutating stored date')
 # Exercise extreme scenario date; prior records remain saved after fixture creation fails.
 page.locator('#clock').fill('2100-12-31');page.locator('#clock').dispatch_event('change');before=page.evaluate('()=>localStorage.getItem("'+KEY+'")');page.locator('[data-nav=method]').click();page.once('dialog',lambda d:d.accept());page.locator('[data-scenario=falsegreen]').click();assert 'Existing records retained' in page.locator('#feedback').inner_text();assert page.evaluate('()=>localStorage.getItem("'+KEY+'")')==before;check('Boundary scenario fails safely without clearing prior records')
 assert not errs,errs;b.close()
print(f'{len(checks)}/{len(checks)} final consolidation Chromium checks passed; no page errors')
