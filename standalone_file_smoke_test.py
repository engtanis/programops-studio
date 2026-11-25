"""Verify the distributed single-file content renders with all scripts embedded."""
from pathlib import Path
from playwright.sync_api import sync_playwright
html=(Path(__file__).resolve().parent/'ProgramOps_Studio_Stage_3_Demo.html')
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1366,'height':768})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    # This environment blocks file:// navigation by administrator policy.
    # Render the exact bundled HTML, without injecting separate code files.
    page.set_content(html.read_text(),wait_until='load')
    assert page.locator('button.item').count()==5
    assert 'Executive stakeholder briefing' in page.locator('#detailTitle').inner_text()
    page.get_by_role('button',name='Move to Ready for review').click()
    assert 'Technology test' in page.locator('#feedback').inner_text()
    page.locator('[data-evidence="it"]').fill('Fictional technical verification')
    page.locator('[data-complete="it"]').click()
    assert 'Ready' in page.locator('#details').inner_text()
    assert not errors,errors
    print('PASS distributed single-file HTML content (file:// blocked in this environment): HTML render, seeded data, guarded transition, successful task completion, no console exceptions')
    browser.close()
