"""Targeted Chromium checks for the final five minor findings (synthetic data)."""
from pathlib import Path
import re
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent
HTML=re.sub(r'<script src="[^"]+"></script>','',(R/'index.html').read_text())
KEY='programops-stage3-v2'; checks=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);page=b.new_page(viewport={'width':1400,'height':900});page.set_default_timeout(5000);errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
 def boot(seed=False):
  page.goto('about:blank');page.set_content(HTML)
  page.add_script_tag(content="var cache={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return cache[k]??null},setItem(k,v){cache[k]=String(v)},removeItem(k){delete cache[k]}}});const RealDate=Date;window.Date=class extends RealDate{constructor(...a){if(a.length)super(...a);else super('2026-11-23T10:00:00')}static now(){return new RealDate('2026-11-23T10:00:00').getTime()}};")
  for f in ['core.js','fixtures.js']:page.add_script_tag(content=(R/f).read_text())
  if seed:page.evaluate('''()=>{const C=ProgramOpsCore,F=ProgramOpsFixtures,D='2026-11-23';let r=F.fixture('N1','Synthetic review',{clock:D,offset:3,stage:'In progress'});for(const t of r.tasks.filter(t=>t.kind==='readiness')){t.acceptedBy=t.assignedTo;t.acceptedAt=C.stamp(D);t.completedAt=C.stamp(D);t.status='Complete';t.evidence='Proof '+t.id}r=C.changeStage(r,'Ready for review',{clock:D}).record;r=C.decideApproval(r,{decision:'Approved',actor:r.approval.approver,clock:D}).record;r=C.changeStage(r,'Approved',{clock:D}).record;const f=r.tasks.find(t=>t.id==='followup');f.assignedTo='';f.acceptedBy='';f.acceptedAt='';r.approval.basis=C.approvalBasis(r);localStorage.setItem('programops-stage3-v2',JSON.stringify({version:2,records:[r]}));}''')
  if not seed:page.evaluate("()=>localStorage.setItem('programops-stage3-v2',JSON.stringify({version:2,records:ProgramOpsFixtures.starter('2026-11-23')}))")
  page.add_script_tag(content=(R/'app.js').read_text())
 def check(s): checks.append(s);print('PASS '+s,flush=True)
 def record(id): return page.evaluate('id=>JSON.parse(localStorage.getItem("'+KEY+'" )).records.find(r=>r.id===id)',id)
 def select(id): page.locator(f'button.item[data-open="{id}"]').click()
 boot(True);select('N1');page.locator('[data-task-owner=followup]').select_option('Casey Shah');page.locator('[data-reassign=followup]').click();r=record('N1');assert r['stage']=='In progress' and r['approval']['decision']=='Pending';text=page.locator('#feedback').inner_text();assert 'returned to In progress' in text and 'Approval reset to Pending' in text;assert 'returned to In progress' in page.locator('#announcement').inner_text();check('N-02 real reassignment feedback explains actual stage and approval reset')
 boot();bad=[];accept=0;reopen=0
 for id in ['OPS-101','OPS-102','OPS-103','OPS-104','OPS-105']:
  select(id);buttons=page.locator('button[aria-label]').evaluate_all('els=>els.map(e=>[e.textContent.trim().replace(/\\*/g,\'\'),e.getAttribute("aria-label")])')
  for vis,aria in buttons:
   if vis.lower() not in aria.lower(): bad.append((id,vis,aria))
   if vis=='Accept as owner':accept+=1
   if vis=='Reopen task (explain why)':reopen+=1
 assert not bad,bad;assert accept and reopen,(accept,reopen);check(f'N-04 all visible button labels contained in accessible names ({accept} Accept and {reopen} Reopen instances)')
 select('OPS-104');before=record('OPS-104');page.locator('#closeForm [name=actor]').fill('Morgan Reed');page.locator('#closeForm [name=reason]').fill('Premature claim');page.locator('#closeForm button').click();assert 'follow-up' in page.locator('#feedback').inner_text().lower();assert record('OPS-104')==before;page.locator('[data-evidence=followup]').fill('Verified follow-up');page.locator('[data-complete=followup]').click();page.locator('#closeForm [name=reason]').fill('Follow-up verified');page.locator('#closeForm button').click();page.locator('[data-stage=Closed]').click();assert record('OPS-104')['stage']=='Closed';check('N-01 blocked early closure, then valid verification and closure in actual UI')
 assert not errs,errs;b.close()
print(f'{len(checks)}/{len(checks)} final minor Chromium checks passed')
