(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./core.js'):root.ProgramOpsCore);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.ProgramOpsFixtures=api;})(typeof globalThis==='object'?globalThis:this,function(C){
'use strict';
const dateAdd=(day,n)=>new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
function task(id,title,assignedTo,{accepted=true,status='Open',kind='readiness',evidence='',dueDate='',dependsOn=[],required=true,applicable=true,evidenceRequired=true,clock='2026-11-23'}={}){
 return {id,title,assignedTo,acceptedBy:accepted?assignedTo:'',acceptedAt:accepted?C.stamp(clock):'',dueDate,status,kind,required,applicable,evidenceRequired,evidence,dependsOn,completedAt:status==='Complete'?C.stamp(clock):''};
}
function fixture(id,title,{clock='2026-11-23',offset=2,stage='In progress',type='Stakeholder meeting',owner='Morgan Reed',approvalRequired=true}={}){
 const r=C.newRequest({title,type,owner,targetDate:dateAdd(clock,offset),summary:'Illustrative multi-team coordination request. Every person and record is fictional.'},id,clock);
 r.stage=stage;
 r.tasks=[
  task('agenda','Agenda confirmed','Morgan Reed',{clock,status:'Complete',evidence:'Agenda reviewed and recorded',dueDate:dateAdd(clock,offset-2)}),
  task('it','Technology test','Taylor Brooks',{clock,status:'Open',dueDate:dateAdd(clock,offset-1)}),
  task('vendor','Vendor access confirmed','Casey Shah',{clock,status:'Complete',evidence:'Fictional access confirmation',dueDate:dateAdd(clock,offset-1)}),
  task('presenter','Presenter readiness','Jesse Park',{clock,status:'Complete',evidence:'Presenter acknowledged briefing',dueDate:dateAdd(clock,offset-1),dependsOn:['agenda']}),
  task('followup','Post-delivery follow-up','Morgan Reed',{clock,kind:'closeout',dueDate:dateAdd(clock,offset+1)})
 ];
 r.approval={required:approvalRequired,approver:approvalRequired?'Avery Chen':'',decision:approvalRequired?'Pending':'Not applicable',policyReason:approvalRequired?'Illustrative program requires review':'Illustrative low-risk request does not require approval',policyDecidedBy:'Demo process owner',policyDecidedAt:C.stamp(clock),decisionAt:'',decisionBy:'',note:'',waiver:null,basis:''};
 return r;
}
function starter(clock='2026-11-23'){
 const a=fixture('OPS-101','Executive stakeholder briefing',{clock,offset:2});
 const b=fixture('OPS-102','Facilities access coordination',{clock,offset:5,owner:'Jesse Park'});
 b.tasks[1].acceptedBy='';b.tasks[1].acceptedAt='';b.tasks[2].status='Open';b.tasks[2].evidence='';b.tasks[2].completedAt='';
 const c=fixture('OPS-103','Community program meeting',{clock,offset:9,owner:'Casey Shah',approvalRequired:false});
 c.tasks[1].status='Complete';c.tasks[1].completedAt=C.stamp(clock);c.tasks[1].evidence='Technology checklist verified';c.stage='Ready for review';
 const deliveredDay=dateAdd(clock,-1);
 const d=fixture('OPS-104','Equipment handoff',{clock:deliveredDay,offset:0,stage:'Delivered',owner:'Taylor Brooks'});
 d.tasks[1].status='Complete';d.tasks[1].completedAt=C.stamp(deliveredDay);d.tasks[1].evidence='Equipment tested';d.approval.decision='Approved';d.approval.decisionBy=d.approval.approver;d.approval.decisionAt=C.stamp(deliveredDay);d.approval.basis=C.approvalBasis(d);d.delivery={date:deliveredDay,evidence:'Handoff receipt recorded',recordedAt:C.stamp(deliveredDay)};
 const e=fixture('OPS-105','Training coordination',{clock,offset:15,stage:'Submitted'});
 e.owner='';e.targetDate='';
 return [a,b,c,d,e];
}
return {dateAdd,task,fixture,starter};
});
