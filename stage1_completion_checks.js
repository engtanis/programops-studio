/* Supplementary controls for F-06. No existing assertion is removed. */
const assert = require('node:assert/strict'), C = require('./core.js'), F = require('./fixtures.js');
const clock='2026-11-23';
const take=x=>{assert.equal(x.ok,true,x.message);return x.record;};
let r=F.fixture('REOPEN','Synthetic request',{clock,stage:'Ready for review'});
for(const t of r.tasks.filter(t=>t.kind==='readiness')){t.status='Complete';t.evidence='verified '+t.id;t.completedAt=C.stamp(clock);}
r=take(C.decideApproval(r,{decision:'Approved',actor:r.approval.approver,clock}));r=take(C.changeStage(r,'Approved',{clock}));
r=take(C.saveDelivery(r,{date:clock,evidence:'unique receipt 903'},{clock}));r=take(C.changeStage(r,'Delivered',{clock}));
r=take(C.completeTask(r,'followup',{actor:'Morgan Reed',evidence:'unique follow-up 904',clock}));
r=take(C.saveCloseout(r,{actor:'Morgan Reed',reason:'unique closeout 905'},{clock}));
const original=C.clone(r);let n=0;
for(const reason of [undefined,'',' \t\n ']){const x=C.changeStage(r,'In progress',{clock,reason});assert.equal(x.ok,false);assert.equal(x.code,'REASON');assert.deepEqual(r,original);n++;console.log('PASS F-06 rejects '+JSON.stringify(reason)+' without altering evidence or events');}
const x=C.changeStage(r,'In progress',{clock,actor:' ',reason:'Correct work'});assert.equal(x.code,'ACTOR');assert.deepEqual(r,original);n++;console.log('PASS F-06 rejects blank simulated actor without modifying record');
const reopened=take(C.changeStage(r,'In progress',{clock,actor:'Morgan Reed',reason:'Wrong item delivered'}));
const archive=JSON.parse(reopened.events.findLast(e=>e.type==='delivery reopened').before);
assert.deepEqual(archive,{delivery:original.delivery,closeout:original.closeout,tasks:original.tasks.filter(t=>t.kind==='closeout')});
const transition=reopened.events.findLast(e=>e.type==='stage');assert.equal(transition.actor,'Morgan Reed');assert.equal(transition.reason,'Wrong item delivered');assert.equal(reopened.delivery.evidence,'');assert.equal(reopened.closeout.reason,'');assert.equal(reopened.tasks.find(t=>t.id==='followup').status,'Open');assert.deepEqual(r,original);
n++;console.log('PASS F-06 valid correction retains exact original evidence and actor/reason, clears only active fields');
const earlier=F.fixture('EARLIER','Synthetic request',{clock,stage:'Ready for review'});assert.equal(C.changeStage(earlier,'In progress',{clock}).ok,true);n++;console.log('PASS non-delivered back-step remains unaffected');
console.log(`${n}/${n} Stage 1 completion engine checks passed`);
