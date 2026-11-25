"""Real Chromium verification of Stage 5 controls; no claim of equivalent jsdom or screen reader coverage."""
from pathlib import Path
import json,re
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent
HTML=re.sub(r'<script src="[^"]+"></script>','',(R/'index.html').read_text())
KEY='programops-stage3-v2'; URL='http://programops-stage5.test/'
checks=[]
def passed(msg): checks.append(msg); print('PASS '+msg,flush=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 ctx=b.new_context(viewport={'width':1400,'height':900},accept_downloads=True)
 errors=[]
 def boot(page,saved=None):
  page.goto('about:blank');page.set_content(HTML)
  page.add_script_tag(content="var cache={};Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem(k){return cache[k]??null},setItem(k,v){cache[k]=String(v)},removeItem(k){delete cache[k]}}});const RealDate=Date;window.Date=class extends RealDate{constructor(...a){if(a.length)super(...a);else super('2026-11-23T10:00:00')}static now(){return new RealDate('2026-11-23T10:00:00').getTime()}};")
  if saved is not None:page.evaluate('([k,v])=>localStorage.setItem(k,v)',[KEY,saved])
  for f in ['core.js','fixtures.js','app.js']:page.add_script_tag(content=(R/f).read_text())
 def tab(saved=None):
  page=ctx.new_page();page.set_default_timeout(5000);page.on('pageerror',lambda e:errors.append(str(e)));boot(page,saved);return page
 def transfer(source,dest,event=True):
  raw=store(source);dest.evaluate('([k,v,e])=>{localStorage.setItem(k,v);if(e)window.dispatchEvent(new StorageEvent("storage",{key:k,newValue:v}));}',[KEY,raw,event])
 def store(page):return page.evaluate('k=>localStorage.getItem(k)',KEY)
 def rec(page,id):return next(r for r in json.loads(store(page))['records'] if r['id']==id)
 def select(page,id):page.locator(f'button.item[data-open="{id}"]').click()
 def submit(page,form):page.locator(f'#{form} button[type=submit]').click()
 def accept(page,button):page.once('dialog',lambda d:d.accept());page.locator(button).click()
 def cancel(page,button):page.once('dialog',lambda d:d.dismiss());page.locator(button).click()
 a=tab();a.locator('#create').click();a.locator('#createForm [name=title]').fill('Retain this request');a.locator('#createForm [name=owner]').select_option('Morgan Reed');a.locator('#createForm [name=targetDate]').fill('2026-12-01');submit(a,'createForm');old=store(a)
 a.locator('[data-nav=method]').click();cancel(a,'[data-scenario=falsegreen]');assert store(a)==old and 'Retain this request' in a.locator('#requests').inner_text();passed('UI-02: declined scenario replacement preserves exact stored records')
 accept(a,'[data-scenario=falsegreen]');assert len(json.loads(store(a))['records'])==5 and 'Retain this request' not in a.locator('#requests').inner_text();passed('F-18: confirmed scenario replacement succeeds explicitly')
 select(a,'OPS-102');old=store(a);dialogs=[]
 def deny_cancel(d):
  dialogs.append(d.type);d.accept('Withdrawn') if d.type=='prompt' else d.dismiss()
 a.on('dialog',deny_cancel);a.locator('[data-stage=Cancelled]').click();a.remove_listener('dialog',deny_cancel);assert dialogs==['prompt','confirm'] and store(a)==old;passed('UI-03: cancellation requires confirmation and refusal preserves records')
 def allow_cancel(d):d.accept('Withdrawn') if d.type=='prompt' else d.accept()
 a.on('dialog',allow_cancel);a.locator('[data-stage=Cancelled]').click();a.remove_listener('dialog',allow_cancel);assert rec(a,'OPS-102')['stage']=='Cancelled';passed('F-18: confirmed cancellation with reason succeeds')
 select(a,'OPS-101');a.locator('[data-evidence=it]').fill('typed but not submitted');a.locator('[data-task-date=agenda]').fill('2026-11-24');a.locator('[data-date-save=agenda]').focus();a.keyboard.press('Enter');assert a.locator('[data-evidence=it]').input_value()=='typed but not submitted' and a.evaluate('document.activeElement.dataset.dateSave')=='agenda';assert rec(a,'OPS-101')['tasks'][0]['dueDate']=='2026-11-24';passed('UI-06: unrelated action preserves evidence draft and keyboard focus')
 a.locator('#requestForm [name=summary]').fill('Unsaved summary');a.locator('[data-complete=it]').click();assert a.locator('#requestForm [name=summary]').input_value()=='Unsaved summary';assert rec(a,'OPS-101')['tasks'][1]['evidence']=='typed but not submitted';assert a.evaluate('document.activeElement.tagName')!='BODY';passed('F-19: completed evidence saved, unrelated form draft retained, focus fallback')
 # Switching and returning must retain the correct request's unsaved draft.
 old=store(a);select(a,'OPS-103');assert a.locator('#requestForm [name=summary]').input_value()!='Unsaved summary';select(a,'OPS-101');assert a.locator('#requestForm [name=summary]').input_value()=='Unsaved summary' and store(a)==old;passed('F-19: switching requests and returning retains drafts without cross-record leakage')
 submit(a,'requestForm');assert rec(a,'OPS-101')['summary']=='Unsaved summary';assert a.locator('#requestForm [name=summary]').input_value()=='Unsaved summary';
 # Browser origin navigation is blocked here; emulate shared localStorage and dispatch the actual listener.
 other=tab(store(a));select(other,'OPS-101');a.locator('#requestForm [name=title]').fill('Changed in A');submit(a,'requestForm');transfer(a,other);other.wait_for_function("document.querySelector('#requestForm [name=title]').value==='Changed in A'");other.locator('#requestForm [name=summary]').fill('Changed in B');submit(other,'requestForm');assert rec(other,'OPS-101')['title']=='Changed in A' and rec(other,'OPS-101')['summary']=='Changed in B';passed('UI-07: two Chromium pages, simulated shared storage event refreshes clean page and retains first edit')
 transfer(other,a);a.wait_for_function("document.querySelector('#requestForm [name=summary]').value==='Changed in B'");a.locator('#requestForm [name=title]').fill('Unsaved competing draft');other.locator('#requestForm [name=summary]').fill('Second saved edit');submit(other,'requestForm');transfer(other,a);a.wait_for_function("document.getElementById('storageNotice').textContent.includes('Another tab')");saved=store(a);submit(a,'requestForm');assert store(a)==saved and a.locator('#requestForm [name=title]').input_value()=='Unsaved competing draft' and 'Second saved edit' in saved;passed('F-21: dirty tab conflict blocks overwrite and preserves local draft')
 boot(a,store(a));select(a,'OPS-101');assert a.locator('#requestForm [name=title]').input_value()=='Changed in A';assert a.locator('#requestForm [name=summary]').input_value()=='Second saved edit';passed('F-21: reload recovers latest saved record after conflict')
 # A storage write may happen without the listener firing. The pre-write guard must still stop stale edits.
 transfer(a,other);other.locator('#requestForm [name=summary]').fill('Saved without notification');submit(other,'requestForm');transfer(other,a,event=False);a.locator('#requestForm [name=title]').fill('Unnotified competing edit');raw=store(a);submit(a,'requestForm');assert store(a)==raw and a.locator('#requestForm [name=title]').input_value()=='Unnotified competing edit' and 'Another tab' in a.locator('#storageNotice').inner_text();passed('F-21: pre-write guard catches missed storage event, preserves competing draft')
 boot(a,store(a));select(a,'OPS-101');a.locator('#requestForm [name=summary]').fill('Draft parked on 101');select(a,'OPS-103');other.locator('#requestForm [name=title]').fill('Remote saved title');submit(other,'requestForm');transfer(other,a);assert 'Another tab' in a.locator('#storageNotice').inner_text();select(a,'OPS-101');assert a.locator('#requestForm [name=summary]').input_value()=='Draft parked on 101';passed('F-21: remote change protects parked unsaved draft across record switching')
 boot(a,store(a));select(a,'OPS-101');old=store(a);a.evaluate("()=>{localStorage.setItem=()=>{throw new DOMException('Storage quota exceeded','QuotaExceededError')}}");a.locator('#requestForm [name=summary]').fill('Temporary local change');submit(a,'requestForm');assert store(a)==old and a.locator('#requestForm [name=summary]').input_value()=='Temporary local change' and 'temporary' in a.locator('#storageNotice').inner_text().lower() and 'Applied temporarily' in a.locator('#feedback').inner_text();passed('F-25/F-21: storage write failure clearly marked temporary, original saved bytes unchanged')
 boot(a,store(a));select(a,'OPS-101');
 # test control names, navigation semantics, live status presence, six reported text contrasts
 select(a,'OPS-103');names=a.locator('.task button[data-complete],.task button[data-reassign],.task button[data-date-save]').evaluate_all('(els)=>els.map(e=>e.getAttribute("aria-label"))');assert names and all(names) and len(names)==len(set(names)),names
 a.locator('[data-nav=exceptions]').click();assert a.locator('[data-nav=exceptions]').get_attribute('aria-current')=='page' and a.locator('[data-nav=workspace]').get_attribute('aria-current') is None;a.locator('[data-nav=workspace]').click();assert a.locator('#announcement').get_attribute('aria-live')=='polite';passed('UI-14: task-specific accessible names, current navigation, persistent live region')
 # evaluate actual computed colors against the nearest opaque background
 select(a,'OPS-101');a.locator('summary').filter(has_text='View simulated change history').click();a.locator('#search').fill('No such record xyz');contrasts=a.evaluate('''()=>{const rgb=s=>s.match(/[\\d.]+/g).map(Number), lum=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);return ['.sub','.metric .desc','.overline','.foot','.event span','.empty'].map(sel=>{const el=document.querySelector(sel);if(!el)return [sel,null];let e=el,bg;while(e){bg=rgb(getComputedStyle(e).backgroundColor);if(bg.length===3||bg[3]!==0)break;e=e.parentElement;}const l1=lum(rgb(getComputedStyle(el).color)),l2=lum(bg);return [sel,(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05)]})}''');assert all(v is not None and v>=4.5 for _,v in contrasts),contrasts;print('contrast samples:',contrasts,flush=True);passed('F-20: computed contrast for all six reported selectors meets 4.5:1');a.locator('#search').fill('')
 # malformed nested record is read-only placeholder; no mutation, exact raw retained
 other.close();bad=json.loads(store(a));bad['records'][0]['events']=[{'id':'EV-1','type':'x'}];bad['records'][1]['tasks'][0]['dependsOn']='agenda';raw=json.dumps(bad);a.evaluate('([k,v])=>localStorage.setItem(k,v)',[KEY,raw]);boot(a,store(a));select(a,'OPS-101');assert 'malformed' in a.locator('#storageNotice').inner_text().lower();assert 'read-only placeholder' in a.locator('#details').inner_text();assert store(a)==raw;a.locator('#create').click();assert not a.locator('#createDialog').is_visible() and store(a)==raw;passed('UI-13: malformed event and dependency data do not crash; original raw data unchanged')
 a.locator('[data-nav=method]').click();cancel(a,'#reset');assert store(a)==raw;accept(a,'#reset');assert len(json.loads(store(a))['records'])==5 and a.locator('#storageNotice').is_hidden();passed('F-25: recovery reset requires explicit confirmation and restores valid fixtures')
 a.evaluate('k=>localStorage.setItem(k,"{not json")',KEY);boot(a,store(a));assert 'unreadable' in a.locator('#storageNotice').inner_text().lower() and store(a)=='{not json' and a.locator('button.item').count()==0;passed('F-25: malformed top-level JSON quarantined without silent overwrite')
 assert not errors,errors;b.close()
print(f'{len(checks)}/{len(checks)} Stage 5 targeted Chromium groups passed; no page errors')
