"""Chromium checks for the actual clock/reopen/late-entry UI. Not jsdom or production validation."""
from pathlib import Path
import json, re
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent
HTML=re.sub(r'<script src="[^"]+"></script>','',(R/'index.html').read_text())
KEY='programops-stage3-v2'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1400,'height':900});page.set_default_timeout(8000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def boot(today,saved=None):
  page.goto('about:blank');page.set_content(HTML)
  page.add_script_tag(content="var cache={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return cache[k]??null},setItem(k,v){cache[k]=String(v)},removeItem(k){delete cache[k]}}});const RealDate=Date;window.Date=class extends RealDate{constructor(...a){if(a.length)super(...a);else super('"+today+"T10:00:00')}static now(){return new RealDate('"+today+"T10:00:00').getTime()}};")
  if saved is not None:page.evaluate("([key,s])=>localStorage.setItem(key,s)",[KEY,saved])
  for f in ['core.js','fixtures.js','app.js']:page.add_script_tag(content=(R/f).read_text())
 def store():return page.evaluate('key=>localStorage.getItem(key)',KEY)
 def record(id):return next(r for r in json.loads(store())['records'] if r['id']==id)
 def clock(day):page.locator('#clock').fill(day);page.locator('#clock').dispatch_event('change')
 def pick(id):page.locator(f'button.item[data-open="{id}"]').click()
 def stage(name):page.locator(f'[data-stage="{name}"]').click()
 def feedback():return page.locator('#feedback').inner_text()
 boot('2026-11-23')
 page.locator('#create').click();page.locator('#createForm input[name="title"]').fill('First visit preserved');page.locator('#createForm select[name="owner"]').select_option('Morgan Reed');page.locator('#createForm input[name="targetDate"]').fill('2026-11-26');page.locator('#createForm button[type="submit"]').click()
 saved=store();assert saved and 'First visit preserved' in saved
 boot('2026-12-04',saved)
 assert page.locator('#clock').input_value()=='2026-12-04';assert '2026-12-04' in page.locator('#footer').inner_text();assert 'First visit preserved' in page.locator('#requests').inner_text();assert '9 day(s) overdue' in page.locator('button.item[data-open="OPS-101"]').inner_text()
 print('PASS UI-01 equivalent: reopen on later date updates clock and overdue label, preserves user record')
 malformed=json.loads(saved);malformed['clock']='bad';boot('2026-12-04',json.dumps(malformed));assert page.locator('#clock').input_value()=='2026-12-04';assert 'First visit preserved' in page.locator('#requests').inner_text()
 print('PASS corrupted saved clock ignored on load without deleting records')
 pick('OPS-104');assert 'Delivered on time' in page.locator('#detailSubtitle').inner_text()
 clock('2026-11-20');assert 'manual override' in page.locator('#footer').inner_text();assert 'Delivered on time' in page.locator('#detailSubtitle').inner_text();assert 'Historical status conflict' not in page.locator('#exceptionContent').inner_text();saved2=store()
 page.once('dialog',lambda d:d.accept('correct prior delivery'));stage('In progress');assert 'before the latest recorded event' in feedback();assert store()==saved2
 print('PASS earlier evaluation date leaves historical report valid; backward reopening blocked without state changes')
 boot('2026-12-04',saved2);assert page.locator('#clock').input_value()=='2026-12-04';assert 'manual override' not in page.locator('#footer').inner_text()
 print('PASS manual override is visit-only; saved records remain on reload')
 boot('2026-11-23');pick('OPS-101');page.locator('[data-evidence="it"]').fill('Verified equipment');page.locator('[data-complete="it"]').click();stage('Ready for review');page.locator('[data-decision="Approved"]').click();stage('Approved')
 assert record('OPS-101')['stage']=='Approved'
 page.locator('#deliveryForm input[name="date"]').fill('2026-11-22');page.locator('#deliveryForm input[name="evidence"]').fill('Fictional delivery note');page.locator('#deliveryForm button[type="submit"]').click();assert 'draft' in feedback();stage('Delivered');assert 'before approval' in feedback();assert record('OPS-101')['stage']=='Approved'
 print('PASS preapproval delivery remains draft with correct chronology explanation')
 clock('2026-11-27');page.locator('#deliveryForm input[name="date"]').fill('2026-11-23');page.locator('#deliveryForm input[name="evidence"]').fill('Fictional delivery note');page.locator('#deliveryForm button[type="submit"]').click();stage('Delivered');r=record('OPS-101');assert r['stage']=='Delivered' and r['delivery']['date']=='2026-11-23' and r['delivery']['recordedAt']=='2026-11-27T12:00:00Z'
 print('PASS valid late entry delivers on original date, with separate recording date')
 assert not errors,errors
 b.close()
print('6/6 Stage 3 targeted Chromium checks passed; no page errors')
