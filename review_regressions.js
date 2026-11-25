/* Independent blind-spots regression tests, 2026-11-23. These EXPECT the desired behavior.
 * Until repaired, they are expected to FAIL. Fictional data only.
 * Run: node review_regressions.js
 */
const assert=require('node:assert/strict');
const C=require('./core.js'),F=require('./fixtures.js');
const CLOCK='2026-11-23';
const results=[];
function report(id,label,fn){try{fn();results.push({id,label,status:'PASS'});}catch(e){results.push({id,label,status:'FAIL',detail:e.message});}}
function ready(stage='In progress'){
 const r=F.fixture('AUDIT-01','Cross-team service coordination',{clock:CLOCK,offset:2,stage});
 for(const t of r.tasks.filter(t=>t.kind==='readiness')){t.acceptedBy=t.assignedTo;t.status='Complete';t.evidence='Fictional verification';}
 return r;
}
report('A01','Material edits invalidate a prior approval',()=>{
 const r=ready('Approved');r.approval.decision='Approved';r.approval.decisionBy=r.approval.approver;r.approval.decisionAt=C.stamp(CLOCK);r.approval.basis=C.approvalBasis(r);
 const result=C.updateRequest(r,{targetDate:'2026-12-30',type:'Equipment installation',summary:'Changed deliverable and schedule'},{clock:CLOCK});
 assert.equal(result.ok,true);
 assert.notEqual(result.record.approval.decision,'Approved','Prior approval remains valid after material changes');
});
report('A02','Only assigned contributor can verify completion',()=>{
 const r=F.fixture('AUDIT-02','Request',{clock:CLOCK});
 const result=C.completeTask(r,'it',{actor:'Unrelated person',evidence:'Fictional verification',clock:CLOCK});
 assert.equal(result.ok,false,'Unassigned person was allowed to complete task');
});
report('A03','New requests require an explicit reviewable approval-policy decision',()=>{
 const r=C.newRequest({title:'Equipment installation',type:'Equipment installation',owner:'Morgan Reed',targetDate:'2026-11-26'},'AUDIT-03',CLOCK);
 assert.notEqual(r.approval.decision,'Not applicable','New request silently assumes no approval needed instead of requiring a documented approval-policy choice');
});
report('A04','Task deadline after target date triggers scheduling review',()=>{
 const r=ready();r.tasks.find(x=>x.id==='it').dueDate='2026-12-31';
 const issues=C.assess(r,CLOCK).issues;
 assert.ok(issues.some(x=>/due|schedule|date|dependency/i.test(x.message)),'No scheduling warning, even though a required task due date follows delivery date');
});
report('A05','Invalid task deadline cannot produce fully verified readiness',()=>{
 const r=ready();r.tasks.find(x=>x.id==='it').dueDate='not-a-date';
 assert.notEqual(C.getReadiness(r).state,'Ready','Malformed required-task date produced Ready');
});
report('A06','Closed record revisions require a controlled reopen or correction',()=>{
 const r=ready('Closed');r.approval.decision='Approved';r.delivery={date:CLOCK,evidence:'Fictional receipt'};r.closeout={actor:'Morgan Reed',reason:'Completed'};
 for(const t of r.tasks.filter(t=>t.kind==='closeout')){t.status='Complete';t.evidence='Follow-up done'}
 const result=C.updateRequest(r,{targetDate:'2027-01-01',title:'Materially different closed request'},{clock:CLOCK});
 assert.equal(result.ok,false,'Closed record accepted uncontrolled material edits');
});
report('A07','Delivery date, not current date, determines late/on-time display',()=>{
 // Execute the actual UI date-label function, not a source-text pattern assertion.
 const vm=require('node:vm');
 const code=require('node:fs').readFileSync(require('node:path').join(__dirname,'app.js'),'utf8');
 const start=code.indexOf('function days(r){'),end=code.indexOf('function stageLabel(r){',start);
 assert.ok(start>=0&&end>start,'UI date-label function not found');
 const state={clock:CLOCK};const days=vm.runInNewContext(code.slice(start,end)+'\ndays',{C,state});
 const r=F.starter(CLOCK).find(x=>x.id==='OPS-104');
 assert.equal(r.stage,'Delivered');assert.equal(r.delivery.date,r.targetDate);
 assert.ok(r.approval.decisionAt.slice(0,10)<=r.delivery.date,'Fixture delivery must not predate approval');
 assert.equal(days(r),'Delivered on time');
 state.clock='2026-12-04';assert.equal(days(r),'Delivered on time');
 state.clock='2026-11-20';assert.equal(days(r),'Delivered on time');
 const late=C.clone(r);late.delivery.date=F.dateAdd(r.targetDate,1);assert.equal(days(late),'Delivered 1 day(s) late');
 const early=C.clone(r);early.targetDate=F.dateAdd(r.delivery.date,2);assert.equal(days(early),'Delivered 2 day(s) early');
 const active=F.starter(CLOCK)[0];state.clock=CLOCK;assert.equal(days(active),'In 2 day(s)');
 state.clock='2026-12-04';assert.equal(days(active),'9 day(s) overdue');
});
for(const result of results)console.log(`${result.status} ${result.id} ${result.label}${result.detail?' — '+result.detail:''}`);
const failed=results.filter(r=>r.status==='FAIL').length;
console.log(`\n${results.length-failed}/${results.length} newly added audit expectations pass; ${failed} outstanding problems.`);
if(require.main===module)process.exitCode=failed?1:0;
