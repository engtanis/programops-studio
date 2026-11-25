"""Supplementary real Chromium checks for Stage 1. Not a replacement for jsdom suite."""
from pathlib import Path
import re, json
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent
html=re.sub(r'<script src="[^"]+"></script>','',(R/'index.html').read_text())
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1400,'height':900}); errors=[]
 page.set_default_timeout(8000);page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('dialog',lambda d:d.accept('redo needed'))
 page.set_content(html)
 page.add_script_tag(content="var cache={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return cache[k]??null},setItem(k,v){cache[k]=String(v)},removeItem(k){delete cache[k]}}});const RealDate=Date;window.Date=class extends RealDate{constructor(...a){if(a.length)super(...a);else super('2026-11-23T10:00:00')}static now(){return new RealDate('2026-11-23T10:00:00').getTime()}};")
 for f in ('core.js','fixtures.js','app.js'):page.add_script_tag(content=(R/f).read_text())
 # Real fixture evidence; uniquely check the before field of a rendered history event.
 page.locator('[data-reopen="vendor"]').click()
 page.locator('summary').filter(has_text='View simulated change history').click()
 event=page.locator('.event').filter(has_text='task reopened').first
 assert 'Before: Fictional access confirmation' in event.inner_text(),event.inner_text()
 assert 'redo needed' in event.inner_text()
 print('PASS F-08 Chromium: original fixture evidence and correction reason visible in expanded history')
 # New request through UI, deliberately omit closeout owner. Use no-approval policy, then verify recovery.
 page.locator('#create').click(); f=page.locator('#createForm')
 f.locator('[name=title]').fill('Stage 1 closeout test');f.locator('[name=owner]').select_option('Morgan Reed');f.locator('[name=targetDate]').fill('2026-11-26');f.locator('button[type=submit]').click()
 page.locator('[data-stage="Planned"]').click();page.locator('[data-stage="In progress"]').click()
 f=page.locator('#policyForm');f.locator('[name=required]').select_option('no');f.locator('[name=reason]').fill('Synthetic low risk');f.locator('button[type=submit]').click()
 def assign(id,who):
  page.locator(f'[data-task-owner="{id}"]').select_option(who);page.locator(f'[data-reassign="{id}"]').click();page.locator(f'[data-accept="{id}"]').click()
 def complete(id,ev):
  page.locator(f'[data-evidence="{id}"]').fill(ev);page.locator(f'[data-complete="{id}"]').click()
 for id,who in [('agenda','Morgan Reed'),('handoff','Taylor Brooks')]:assign(id,who);complete(id,'synthetic proof')
 page.locator('[data-stage="Ready for review"]').click();page.locator('[data-stage="Approved"]').click()
 f=page.locator('#deliveryForm');f.locator('[name=date]').fill('2026-11-23');f.locator('[name=evidence]').fill('synthetic delivery');f.locator('button[type=submit]').click()
 page.locator('[data-stage="Delivered"]').click(); assert 'assign an owner and accept the closeout handoff' in page.locator('#feedback').inner_text(),page.locator('#feedback').inner_text()
 assert 'Cleared for delivery' in page.locator('#detailSubtitle').inner_text()
 assign('closeout','Morgan Reed');page.locator('[data-stage="Ready for review"]').click();page.locator('[data-stage="Approved"]').click();page.locator('[data-stage="Delivered"]').click()
 assert 'Delivered' in page.locator('#detailSubtitle').inner_text()
 complete('closeout','closeout proof');f=page.locator('#closeForm');f.locator('[name=actor]').fill('Morgan Reed');f.locator('[name=reason]').fill('verified');f.locator('button[type=submit]').click();page.locator('[data-stage="Closed"]').click();assert 'Closed' in page.locator('#detailSubtitle').inner_text()
 print('PASS F-01 Chromium: legitimate transition blocked specifically for missing closeout ownership, recovered without discarding delivery evidence, closed normally')
 assert not errors, errors
 b.close()
print('2/2 supplementary Chromium checks passed; no page errors')
