from pathlib import Path
import re
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent
HTML=re.sub(r'<script src="[^\"]+"></script>','',(R/'index.html').read_text())
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']); page=b.new_page(); page.set_default_timeout(6000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(HTML)
 page.add_script_tag(content="var cache={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return cache[k]??null},setItem(k,v){cache[k]=String(v)},removeItem(k){delete cache[k]}}});")
 for f in ('core.js','fixtures.js'):page.add_script_tag(content=(R/f).read_text())
 page.evaluate("""()=>{let r=ProgramOpsFixtures.fixture('R1','Review scenario',{clock:'2026-11-23',offset:9,stage:'Ready for review'});for(const t of r.tasks.filter(t=>t.kind==='readiness')){t.status='Complete';t.evidence='proof';}localStorage.setItem('programops-stage3-v2',JSON.stringify({version:2,clock:'2026-11-23',records:[r]}));}""")
 page.add_script_tag(content=(R/'app.js').read_text())
 def metric():return page.locator('.metric').filter(has_text='Readiness verified').locator('.value').inner_text()
 assert metric()=='1';page.locator('#approvalNote').fill('Scope is unacceptable');page.locator('[data-decision="Rejected"]').click();assert metric()=='0';assert page.locator('button.item[data-open="R1"] .tag').inner_text()!='No current exception';assert 'Scope is unacceptable' in page.locator('#details').inner_text();print('PASS UI-08 rejection shown and excluded from verified readiness metric')
 page.locator('[data-stage="Ready for review"]').click();assert page.locator('#approvalNote').input_value()=='';assert 'Scope is unacceptable' in page.locator('#details').inner_text();print('PASS UI-04 fresh decision input, original rejection visible')
 page.locator('#approvalNote').fill('Override');page.locator('[data-waiver="approval"]').click();assert 'cannot override' in page.locator('#feedback').inner_text();assert metric()=='0';print('PASS F-04 waiver rejected for the intended reason even with fresh text')
 page.locator('[data-stage="Approved"]').click();assert 'Approval rejected' in page.locator('#feedback').inner_text();page.locator('#approvalNote').fill('Concerns resolved');page.locator('[data-decision="Approved"]').click();page.locator('[data-stage="Approved"]').click();assert 'Stage: Approved' in page.locator('#details').inner_text();assert metric()=='1';print('PASS new reviewer decision restores normal clearance')
 assert not errors,errors;b.close()
print('4/4 Stage 2 partial Chromium checks passed; no page errors')
