/* ProgramOps Studio Stage 3 — deterministic demo workflow engine.
 * Synthetic data only. No authenticated actors, backend, or enforceable security boundary.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ProgramOpsCore = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const STAGES = ['Submitted','Needs information','Planned','In progress','Ready for review','Approved','Delivered','Closed','Cancelled'];
  const ACTIVE = new Set(STAGES.slice(0,7));
  const clean = value => String(value == null ? '' : value).trim();
  const validDay = date => typeof date==='string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && date.slice(0,4)>='2000' && date.slice(0,4)<='2100' && !Number.isNaN(Date.parse(date+'T00:00:00Z')) && new Date(date+'T00:00:00Z').toISOString().slice(0,10) === date;
  const dayDiff = (target, today) => validDay(target) && validDay(today) ? Math.round((Date.parse(target+'T00:00:00Z') - Date.parse(today+'T00:00:00Z'))/86400000) : null;
  const stamp = (clock='2026-11-23') => clock+'T12:00:00Z';
  const clone = x => JSON.parse(JSON.stringify(x));
  const fail = (code, message) => ({ ok:false, code, message });
  const ok = value => ({ok:true, ...(value||{})});
  // Bounds apply to user-entered text, not serialized audit snapshots. Never silently truncate evidence.
  const textError = (fields) => {for(const [name,value,max] of fields)if(clean(value).length>max)return fail('LENGTH',name+' exceeds '+max+' characters');return null;};
  const requestTextError = r => textError([['Request title',r.title,100],['Request type',r.type,100],['Coordinator',r.owner,100],['Summary',r.summary,180]]);
  const identity = v=>clean(v).replace(/\s+/g,' ').toLowerCase();
  const requiredVerificationIds = r => {const tasks=r.tasks||[], map=new Map(tasks.map(t=>[t.id,t])), ids=new Set(), visit=id=>{if(ids.has(id))return;ids.add(id);for(const dep of map.get(id)?.dependsOn||[])visit(dep);};for(const t of tasks)if(t.kind==='readiness'&&activeTask(t))visit(t.id);return ids;};
  const independentReviewer = (r,actor) => {const ids=requiredVerificationIds(r);return !!identity(actor) && identity(actor)!==identity(r.owner) && !(r.tasks||[]).some(t=>ids.has(t.id) && [t.assignedTo,t.acceptedBy].some(v=>identity(v)===identity(actor)));};
  const independenceError = () => fail('INDEPENDENCE','Select an independent reviewer who is neither the coordinator nor a required readiness contributor');
  const activeTask = t => t.required !== false && t.applicable !== false;
  const terminal = r => ['Closed','Cancelled'].includes(r.stage);
  const delivered = r => ['Delivered','Closed'].includes(r.stage);
  const policyOK = r => (r.approval?.required===true && !!clean(r.approval.approver) && !!clean(r.approval.policyReason) && !!clean(r.approval.policyDecidedBy) && !!clean(r.approval.policyDecidedAt)) || (r.approval?.required===false && r.approval.decision==='Not applicable' && !!clean(r.approval.policyReason) && !!clean(r.approval.policyDecidedBy) && !!clean(r.approval.policyDecidedAt));
  // Canonical business approval scope. This is a demo consistency check, NOT a cryptographic signature.
  const approvalBasis = r => JSON.stringify({title:clean(r.title),type:clean(r.type),summary:clean(r.summary),owner:clean(r.owner),targetDate:clean(r.targetDate),policy:{required:r.approval?.required,approver:clean(r.approval?.approver),reason:clean(r.approval?.policyReason)},tasks:(r.tasks||[]).filter(t=>activeTask(t)).map(t=>({id:t.id,kind:t.kind,title:clean(t.title),assignedTo:clean(t.assignedTo),acceptedBy:t.kind==='readiness'?clean(t.acceptedBy):'',status:t.kind==='readiness'?t.status:'Postdelivery',evidence:t.kind==='readiness'?clean(t.evidence):'',dueDate:clean(t.dueDate),dependsOn:t.dependsOn||[],evidenceRequired:t.evidenceRequired!==false})).sort((a,b)=>String(a.id).localeCompare(String(b.id)))});
  const approvalReset = (r,reason,actor,clock) => {
    if(r.approval?.required===true && ['Approved','Waived'].includes(r.approval.decision)){
      const before=JSON.stringify(r.approval);
      r.approval={...r.approval,decision:'Pending',decisionAt:'',decisionBy:'',note:'',waiver:null,basis:''};
      r.events=[...(r.events||[]),event(r,'approval invalidated',before,JSON.stringify(r.approval),reason,actor,clock)];
    }
  };
  const resetExemption = (r,reason,actor,clock) => {
    if(r.approval?.required!==false)return;const before=JSON.stringify(r.approval);
    r.approval={required:null,approver:'',decision:'Undetermined',note:'',policyReason:'',policyDecidedBy:'',policyDecidedAt:'',basis:'',decisionAt:'',decisionBy:'',waiver:null};
    r.events=[...(r.events||[]),event(r,'approval policy reset',before,JSON.stringify(r.approval),reason,actor,clock)];
  };
  const restartReview = (r,reason,actor,clock) => {
    if(['Ready for review','Approved'].includes(r.stage)){
      const old=r.stage;r.stage='In progress';
      r.events=[...(r.events||[]),event(r,'automatic rollback',old,'In progress',reason,actor,clock)];
    }
  };
  const relevant = (r, kind='readiness') => (r.tasks||[]).filter(t => t.kind===kind && activeTask(t));
  const checkIntake = r => {
    const missing=[];
    if(!clean(r.title)) missing.push('title');
    if(requestTextError(r))missing.push('request text within length limits');
    if(!clean(r.type)) missing.push('request type');
    if(!clean(r.owner)) missing.push('coordinator');
    if(!validDay(r.targetDate)) missing.push('valid target date');
    return missing;
  };
  const dependencyCycle = (tasks) => {
    const map=new Map(tasks.map(t=>[t.id,t]));
    const seen=new Set(), path=new Set();
    function visit(id){if(path.has(id))return true;if(seen.has(id))return false;seen.add(id);path.add(id);const t=map.get(id);for(const dep of (t?.dependsOn||[])){if(dep===id||!map.has(dep)||visit(dep)) return true;}path.delete(id);return false;}
    return tasks.some(t=>visit(t.id));
  };
  // Explicit dependencies require verified evidence, even for a task not otherwise mandatory.
  const taskVerified = (t,map,path=new Set()) => {
    if(!t||path.has(t.id)||t.status!=='Complete'||!clean(t.assignedTo)||clean(t.acceptedBy)!==clean(t.assignedTo)||(t.evidenceRequired!==false&&!clean(t.evidence)))return false;
    const next=new Set(path);next.add(t.id);
    return (t.dependsOn||[]).every(id=>taskVerified(map.get(id),map,next));
  };
  const dependencyBlockers=(r,t)=>{const map=new Map((r.tasks||[]).map(x=>[x.id,x]));return (t.dependsOn||[]).filter(id=>!taskVerified(map.get(id),map,new Set([t.id])));};
  const taskIssues = (r, kind='readiness') => {
    const issues=[];const map=new Map((r.tasks||[]).map(t=>[t.id,t]));
    for(const t of relevant(r,kind)){
      const prefix=clean(t.title)||t.id;
      if(!clean(t.assignedTo)){issues.push({rule:'BR-02',taskId:t.id,owner:r.owner||'Coordinator',message:prefix+': no assigned owner',next:'Assign a responsible person'});continue;}
      if(clean(t.acceptedBy)!==clean(t.assignedTo)){issues.push({rule:'BR-03',taskId:t.id,owner:t.assignedTo,message:prefix+': assignment not accepted',next:'Ask '+t.assignedTo+' to accept the handoff'});continue;}
      const blocking=dependencyBlockers(r,t);
      if(blocking.length){issues.push({rule:'BR-05',taskId:t.id,owner:t.assignedTo,message:prefix+': predecessor incomplete ('+blocking.map(id=>map.get(id)?.title||id).join(', ')+')',next:'Complete predecessor requirements first'});continue;}
      if(t.status!=='Complete'){issues.push({rule:'BR-04',taskId:t.id,owner:t.assignedTo,message:prefix+': task not complete',next:'Complete and verify task'});continue;}
      if(t.evidenceRequired!==false&&!clean(t.evidence)){issues.push({rule:'BR-04',taskId:t.id,owner:t.assignedTo,message:prefix+': verification evidence missing',next:'Record verification evidence'});continue;}
    }
    return issues;
  };
  const getReadiness = r => {
    const count=relevant(r).length;
    if(!validDay(r.targetDate)||!clean(r.owner)||!clean(r.title)||!clean(r.type)||requestTextError(r)||!Array.isArray(r.tasks)||!count){return {state:'Review needed',reason:'Missing or inconsistent intake, date, or readiness requirements',issues:[{rule:'BR-15',taskId:null,owner:r.owner||'Coordinator',message:'Missing or inconsistent request information',next:'Review the request details and readiness requirements'}]};}
    if((r.tasks||[]).some(t=>!clean(t.id)||!clean(t.title))||new Set((r.tasks||[]).map(t=>t.id)).size!==(r.tasks||[]).length)return {state:'Review needed',reason:'Task configuration contains blank or duplicate identifiers',issues:[{rule:'BR-15',taskId:null,owner:r.owner||'Coordinator',message:'Task identifiers or titles are blank or duplicated',next:'Review the task configuration outside this demo before relying on readiness'}]};
    if(dependencyCycle(r.tasks)){return {state:'Review needed',reason:'Invalid task dependency configuration',issues:[{rule:'BR-15',taskId:null,owner:r.owner||'Coordinator',message:'Task dependencies have a cycle or missing reference',next:'Review the task dependencies outside this demo; editing dependency links is not supported here'}]};}
    const badDates=relevant(r).filter(t=>!validDay(t.dueDate));
    if(badDates.length)return {state:'Review needed',reason:'Required task deadline missing or invalid',issues:badDates.map(t=>({rule:'BR-15',taskId:t.id,owner:t.assignedTo||r.owner||'Coordinator',message:(t.title||t.id)+': missing or invalid task due date',next:'Review and correct required task due date'}))};
    const issues=taskIssues(r);return {state:issues.length?'Not ready':'Ready',issues,reason:issues.length?issues[0].message:'All required readiness tasks have accepted owners, completed dependencies and evidence'};
  };
  const approvalOK = r => policyOK(r) && (r.approval.required===false || ((r.approval.decision==='Approved' && independentReviewer(r,r.approval.approver) && identity(r.approval.decisionBy)===identity(r.approval.approver) && validDay((r.approval.decisionAt||'').slice(0,10))) || (r.approval.decision==='Waived' && r.approval.waiver?.authorized===true && independentReviewer(r,r.approval.waiver.actor) && !!clean(r.approval.waiver.reason) && clean(r.approval.waiver.scope)==='approval')) && !!clean(r.approval.basis) && r.approval.basis===approvalBasis(r) && (r.tasks||[]).filter(t=>requiredVerificationIds(r).has(t.id)).every(t=>[t.completedAt,t.acceptedAt].every(at=>!at || (recordedDay(at) && recordedDay(r.approval.decisionAt) && recordedDay(at)<=recordedDay(r.approval.decisionAt)))));
  // The simulated clock is day-level. Never use scheduled dates or draft delivery dates
  // as the latest recorded event: they may intentionally refer to the past or future.
  const recordedDay = value => typeof value==='string' && validDay(value.slice(0,10)) && Number.isFinite(Date.parse(value)) ? value.slice(0,10) : null;
  const recordedValues = r => [r.createdAt,r.updatedAt,r.approval?.policyDecidedAt,r.approval?.decisionAt,r.approval?.waiver?.at,
    r.delivery?.recordedAt,...(r.tasks||[]).flatMap(t=>[t.acceptedAt,t.completedAt]),...(r.events||[]).map(e=>e.at)].filter(v=>v!==undefined&&v!==null&&v!=='');
  const clockCheck = (r,clock) => {
    if(!validDay(clock))return fail('CLOCK','Choose a valid scenario date before recording an action');
    const days=recordedValues(r).map(recordedDay);
    if(days.some(d=>!d))return fail('CLOCK','Recorded event timestamp is invalid; review the record before recording another action');
    const latest=days.sort().at(-1);
    if(latest && clock<latest)return fail('CHRONOLOGY','Scenario date is before the latest recorded event ('+latest+'). Choose that date or later to record an action.');
    return null;
  };
  // Historical delivery is evaluated against its recorded transition, not a movable
  // evaluation date. For older synthetic fixtures without a transition, use updatedAt.
  const historicalDeliveryDay = r => recordedDay(r.delivery?.recordedAt || (r.events||[]).findLast(e=>e.type==='stage'&&e.after==='Delivered')?.at || r.updatedAt);
  const deliveryIssues = (r,clock,{historical=false}={}) => {
    const errs=[],date=r.delivery?.date;
    if(!clean(date)&&!clean(r.delivery?.evidence))return ['Delivery date and evidence are required'];
    if(!validDay(date))return ['A valid delivery date is required (2000–2100)'];
    if(!clean(r.delivery?.evidence))return ['Delivery evidence is required'];
    const limit=historical?historicalDeliveryDay(r):clock;
    if(!validDay(limit))errs.push('Delivery chronology cannot be verified: recording date is missing or invalid');
    else if(date>limit)errs.push('Delivery cannot be recorded in the future relative to its recording date');
    const anchor=(value,label)=>{const day=recordedDay(value);if(!day)errs.push('Delivery chronology cannot be verified: '+label+' date is missing or invalid');else if(date<day)errs.push('Delivery date cannot be before '+label+' ('+day+')');};
    anchor(r.createdAt,'request creation');
    anchor(r.approval?.policyDecidedAt,'approval policy determination');
    if(r.approval?.required===true){
      if(r.approval.decision==='Approved')anchor(r.approval.decisionAt,'approval');
      if(r.approval.decision==='Waived'){anchor(r.approval.waiver?.at,'documented waiver');anchor(r.approval.decisionAt,'waiver decision');}
    }
    for(const t of relevant(r)){
      if(t.status!=='Complete')continue;
      if(t.acceptedAt)anchor(t.acceptedAt,t.title+' handoff acceptance');
      // Old hand-built approval fixtures lack some verification timestamps. A valid
      // required approval/waiver attests readiness as of its decision day, but is
      // not a substitute for a timestamp where no approval was required.
      if(t.completedAt||r.approval?.required!==true||!approvalOK(r))anchor(t.completedAt,t.title+' verification');
    }
    return errs;
  };
  const closeOK = r => !taskIssues(r,'closeout').length && !!clean(r.closeout?.actor) && !!clean(r.closeout?.reason);
  const stageIssues = (r,target,clock='2026-11-23') => {
    const errs=[];const missing=checkIntake(r);
    const rank=STAGES.indexOf(target);
    if(rank>=STAGES.indexOf('Planned') && target!=='Cancelled' && missing.length) errs.push('Missing required intake: '+missing.join(', '));
    if(rank>=STAGES.indexOf('Planned') && target!=='Cancelled' && (!Array.isArray(r.tasks)||!r.tasks.some(t=>t.kind==='readiness'&&activeTask(t)))) errs.push('Define at least one required readiness task before planning');
    if(rank>=STAGES.indexOf('Ready for review') && target!=='Cancelled' && !policyOK(r)) errs.push('Approval policy has not been explicitly determined and documented');
    if(rank>=STAGES.indexOf('Ready for review') && target!=='Cancelled' && r.approval?.required===true && !independentReviewer(r,r.approval.approver))errs.push('Approval reviewer must be independent of the coordinator and required readiness contributors');
    if(rank>=STAGES.indexOf('Ready for review') && target!=='Cancelled') {
      const readiness=getReadiness(r);
      if(readiness.state!=='Ready') errs.push(...readiness.issues.map(x=>x.message));
    }
    if(rank>=STAGES.indexOf('Approved') && target!=='Cancelled' && !approvalOK(r)) errs.push(r.approval?.decision==='Rejected'?'Approval rejected: address the reviewer’s concerns and obtain a new approval':'Approval required: authorized approval or a scoped, documented waiver is missing');
    if(rank>=STAGES.indexOf('Delivered') && target!=='Cancelled') errs.push(...deliveryIssues(r,clock,{historical:delivered(r)}));
    if(target==='Delivered'){
      for(const t of relevant(r,'closeout')){
        if(!clean(t.assignedTo)||clean(t.acceptedBy)!==clean(t.assignedTo)) errs.push((clean(t.title)||t.id)+': assign an owner and accept the closeout handoff before delivery');
      }
    }
    if(target==='Closed'){
      errs.push(...taskIssues(r,'closeout').map(x=>x.message));
      if(!clean(r.closeout?.actor)||!clean(r.closeout?.reason))errs.push('Closure actor and reason are required'+(!relevant(r,'closeout').length?'; explain why no follow-up is required':''));
    }
    return errs;
  };
  const nextStages={
    'Submitted':['Needs information','Planned','Cancelled'], 'Needs information':['Planned','Cancelled'],
    'Planned':['In progress','Cancelled'], 'In progress':['Ready for review','Cancelled'],
    'Ready for review':['Approved','In progress','Cancelled'], 'Approved':['Delivered','In progress','Cancelled'],
    'Delivered':['Closed','In progress'], 'Closed':[], 'Cancelled':[]
  };
  const event=(r, type, before, after, reason, actor, clock) => ({id:'EV-'+String((r.events||[]).length+1).padStart(3,'0'),at:stamp(clock),actor:clean(actor)||'Demo coordinator (unverified)',type,before,after,reason:clean(reason)});
  // Follow all downstream dependencies (including across open intermediates), preserve the
  // previous verification in history, and invalidate only completed dependent work.
  const invalidateDependants=(r,id,actor,clock)=>{
    const visited=new Set([id]),queue=[id];
    while(queue.length){const predecessor=queue.shift();for(const t of r.tasks||[]){
      if(visited.has(t.id)||!(t.dependsOn||[]).includes(predecessor))continue;
      visited.add(t.id);queue.push(t.id);
      if(t.status!=='Complete')continue;
      const before=JSON.stringify(t);t.status='Open';t.evidence='';t.completedAt='';
      r.events=[...(r.events||[]),event(r,'dependent verification invalidated',before,JSON.stringify(t),t.title+': prerequisite '+id+' changed; verify again',actor,clock)];
    }}
  };
  const changeStage = (r,target,{actor='Demo coordinator',reason='',clock='2026-11-23'}={}) => {
    const timeError=clockCheck(r,clock);if(timeError)return timeError;
    if(!nextStages[r.stage]?.includes(target))return fail('TRANSITION','Not permitted: '+r.stage+' → '+target+'. Use the next valid workflow step.');
    const limitError=textError([['Action reason',reason,1000],['Actor',actor,100]]);if(limitError)return limitError;
    if(target==='Cancelled'&&!clean(reason))return fail('REASON','Cancellation requires a reason');
    if(r.stage==='Delivered' && target==='In progress'){
      if(!clean(reason))return fail('REASON','Reopening delivered work requires a reason');
      if(!clean(actor))return fail('ACTOR','Reopening delivered work requires a simulated actor');
    }
    const errs=stageIssues(r,target,clock);
    if(errs.length)return fail('GATE',errs.join(' • '));
    const updated=clone(r);updated.stage=target;if(target==='Delivered'){updated.delivery.recordedAt=stamp(clock);if(clean(r.closeout?.actor)||clean(r.closeout?.reason)){updated.closeout={actor:'',reason:''};updated.events=[...(updated.events||[]),event(updated,'premature closeout cleared',JSON.stringify(r.closeout),JSON.stringify(updated.closeout),'Closure information must be recorded after delivery; old values retained',actor,clock)];}}
    updated.events=[...(updated.events||[]),event(updated,'stage',r.stage,target,target==='Closed'?r.closeout.reason:reason,target==='Closed'?r.closeout.actor:actor,clock)];
    if(target==='In progress' && ['Approved','Ready for review'].includes(r.stage))approvalReset(updated,'Returned for further work; prior decision requires renewed review',actor,clock);
    if(r.stage==='Delivered' && target==='In progress'){
      const previous={delivery:clone(r.delivery||{}),closeout:clone(r.closeout||{}),tasks:clone((r.tasks||[]).filter(t=>t.kind==='closeout'))};
      updated.delivery={date:'',evidence:''};updated.closeout={actor:'',reason:''};
      for(const t of (updated.tasks||[]).filter(x=>x.kind==='closeout')){t.status='Open';t.evidence='';t.completedAt='';}
      approvalReset(updated,'Delivered request reopened for corrective work',actor,clock);
      resetExemption(updated,'Delivered request reopened; reassess exemption before redelivery',actor,clock);
      updated.events.push(event(updated,'delivery reopened',JSON.stringify(previous),'In progress','Previous delivery and closeout reset; prior values retained in simulated history',actor,clock));
    }
    updated.updatedAt=stamp(clock);return ok({record:updated});
  };
  const reconcile = (r,{clock='2026-11-23',actor='Demo coordinator'}={}) => {
    const timeError=clockCheck(r,clock);if(timeError)return clone(r); // Do not write an event using an invalid or earlier clock.
    const updated=clone(r);const errs=stageIssues(updated,updated.stage,clock);
    if(errs.length && ['Ready for review','Approved'].includes(updated.stage)){
      const was=updated.stage;updated.stage='In progress';
      if(updated.approval?.required===true)approvalReset(updated,'Readiness or approval became inconsistent',actor,clock);
      updated.events=[...(updated.events||[]),event(updated,'automatic rollback',was,'In progress','Readiness or approval changed: '+errs.join(' | '),actor,clock)];
    }
    if(errs.length && ['Delivered','Closed'].includes(updated.stage)){
      // Historical delivery is not silently rewritten. Contradictions remain prominent.
      updated.consistencyWarning=errs.join(' • ');
    }else updated.consistencyWarning='';
    return updated;
  };
  const completeTask=(r,id,{actor='Demo contributor',evidence='',clock='2026-11-23'}={})=>{
    const timeError=clockCheck(r,clock);if(timeError)return timeError;
    if(terminal(r))return fail('TERMINAL','Completed or cancelled requests are locked');
    const updated=clone(r),t=updated.tasks?.find(t=>t.id===id);if(!t)return fail('NOT_FOUND','Task not found');
    if(r.stage==='Delivered' && t.kind==='readiness')return fail('DELIVERED','Reopen delivered work before changing readiness evidence');
    if(!clean(t.assignedTo))return fail('HANDOFF','Task needs an assigned owner before completion');
    if(clean(actor)!==clean(t.assignedTo)||!clean(actor))return fail('ACTOR','Only the assigned person (simulated) may verify this task');
    if(!clean(t.assignedTo)||clean(t.acceptedBy)!==clean(t.assignedTo))return fail('HANDOFF','Task needs an assigned, accepted owner before completion');
    if(t.kind==='closeout'&&!['Delivered','Closed'].includes(updated.stage))return fail('SEQUENCE','Closeout task cannot be completed until delivery is recorded');
    const limitError=textError([['Verification evidence',evidence,1000],['Actor',actor,100]]);if(limitError)return limitError;
    if(t.evidenceRequired!==false&&!clean(evidence))return fail('EVIDENCE','Verification evidence is required for '+t.title);
    const map=new Map(updated.tasks.map(t=>[t.id,t]));const deps=dependencyBlockers(updated,t);
    if(deps.length)return fail('DEPENDENCY','Complete prerequisite task(s): '+deps.map(id=>map.get(id)?.title||id).join(', '));
    const prior=t.status==='Complete'?JSON.stringify({id:t.id,title:t.title,evidence:t.evidence,completedAt:t.completedAt,assignedTo:t.assignedTo}):id;
    const repeated=t.status==='Complete' && t.kind==='readiness' && (clean(t.evidence)!==clean(evidence)||t.completedAt!==stamp(clock));
    t.status='Complete';t.evidence=clean(evidence);t.completedAt=stamp(clock);
    updated.events=[...(updated.events||[]),event(updated,'task completed',prior,t.title,t.evidence,actor,clock)];
    if(repeated){approvalReset(updated,'Readiness was reverified after a prior decision',actor,clock);restartReview(updated,'Readiness reverified; repeat review',actor,clock);}
    return ok({record:reconcile(updated,{clock,actor})});
  };
  const reopenTask=(r,id,{actor='Demo coordinator',reason='',clock='2026-11-23'}={})=>{
    const timeError=clockCheck(r,clock);if(timeError)return timeError;
    if(terminal(r))return fail('LOCKED','Completed or cancelled requests are locked');
    const limitError=textError([['Correction reason',reason,1000],['Actor',actor,100]]);if(limitError)return limitError;
    if(!clean(reason))return fail('REASON','Correcting a completed task requires a documented reason');
    const updated=clone(r),t=updated.tasks?.find(t=>t.id===id);if(!t)return fail('NOT_FOUND','Task not found');
    if(updated.stage==='Delivered'&&t.kind==='readiness')return fail('DELIVERED','Reopen delivery before changing previously verified readiness');
    if(t.status!=='Complete')return fail('STATUS','Only completed tasks can be reopened');
    const oldEvidence=t.evidence;t.status='Open';t.evidence='';t.completedAt='';
    updated.events=[...(updated.events||[]),event(updated,'task reopened',oldEvidence,'Open',t.title+': '+reason,actor,clock)];
    invalidateDependants(updated,id,actor,clock);
    if(r.stage==='Delivered'&&t.kind==='closeout'&&(clean(updated.closeout?.actor)||clean(updated.closeout?.reason))){const before=JSON.stringify(updated.closeout);updated.closeout={actor:'',reason:''};updated.events.push(event(updated,'closeout invalidated',before,JSON.stringify(updated.closeout),'Closeout task reopened; record fresh closure details after verification',actor,clock));}
    if(!(r.stage==='Delivered'&&t.kind==='closeout')){
      approvalReset(updated,'Verified task reopened: '+t.title,actor,clock);
      restartReview(updated,'Verified task reopened: '+t.title,actor,clock);
    }
    return ok({record:reconcile(updated,{clock,actor})});
  };
  const acceptTask=(r,id,{actor,clock='2026-11-23'}={})=>{
    const timeError=clockCheck(r,clock);if(timeError)return timeError;
    if(delivered(r)||r.stage==='Cancelled')return fail('LOCKED','Reopen delivered work before changing task acceptance');
    const updated=clone(r),t=updated.tasks?.find(t=>t.id===id);if(!t)return fail('NOT_FOUND','Task not found');
    if(!clean(t.assignedTo))return fail('OWNER','Task needs an assigned owner');
    if(clean(actor)!==clean(t.assignedTo))return fail('ACTOR','Only the assigned person (simulated) can accept this handoff');
    const repeated=requiredVerificationIds(r).has(t.id)&&t.acceptedBy===t.assignedTo&&t.acceptedAt!==stamp(clock);
    t.acceptedBy=t.assignedTo;t.acceptedAt=stamp(clock);
    updated.events=[...(updated.events||[]),event(updated,'handoff accepted',id,t.assignedTo,'Simulated owner acceptance',actor,clock)];if(repeated&&['Approved','Waived'].includes(updated.approval?.decision)){approvalReset(updated,'Readiness handoff accepted again after decision',actor,clock);restartReview(updated,'Handoff rechecked; repeat review',actor,clock);}return ok({record:reconcile(updated,{clock,actor})});
  };
  const reassignTask=(r,id,owner,{actor='Demo coordinator',clock='2026-11-23'}={})=>{
    const timeError=clockCheck(r,clock);if(timeError)return timeError;
    if(terminal(r)||r.stage==='Delivered')return fail('LOCKED','Reopen delivered work before reassigning tasks');
    const updated=clone(r),t=updated.tasks?.find(t=>t.id===id);if(!t)return fail('NOT_FOUND','Task not found');
    if(clean(t.assignedTo)===clean(owner))return ok({record:r});
    const limitError=textError([['Task owner',owner,100],['Actor',actor,100]]);if(limitError)return limitError;
    if(requiredVerificationIds(r).has(t.id) && r.approval?.decision==='Rejected' && identity(owner)===identity(r.approval.approver))return independenceError();
    const was=JSON.stringify({id:t.id,title:t.title,assignedTo:t.assignedTo,acceptedBy:t.acceptedBy,acceptedAt:t.acceptedAt,status:t.status,evidence:t.evidence,completedAt:t.completedAt});t.assignedTo=clean(owner);t.acceptedBy='';t.acceptedAt='';t.status='Open';t.evidence='';t.completedAt='';
    updated.events=[...(updated.events||[]),event(updated,'task reassigned',was,t.assignedTo,'Handoff acceptance and evidence reset',actor,clock)];
    invalidateDependants(updated,id,actor,clock);
    approvalReset(updated,'Task responsibility changed',actor,clock);restartReview(updated,'Task reassigned',actor,clock);return ok({record:reconcile(updated,{clock,actor})});
  };
  const updateRequest=(r,patch,{actor='Demo coordinator',clock='2026-11-23'}={})=>{
    const timeError=clockCheck(r,clock);if(timeError)return timeError;
    if(delivered(r)||r.stage==='Cancelled')return fail('LOCKED','Delivered, closed or cancelled details cannot be edited without controlled reopening');
    const updated=clone(r);
    for(const key of ['title','type','owner','targetDate','summary'])if(Object.prototype.hasOwnProperty.call(patch,key))updated[key]=clean(patch[key]);
    const limitError=requestTextError(updated)||textError([['Actor',actor,100]]);if(limitError)return limitError;
    if(!clean(updated.title))return fail('TITLE','Request title is required');
    if(clean(updated.targetDate)&&!validDay(updated.targetDate))return fail('DATE','Target date must be a valid calendar date');
    const material=['title','type','owner','targetDate','summary'].filter(k=>clean(r[k])!==clean(updated[k]));
    // Intake may be incomplete in Submitted/Needs information, but cannot be erased
    // once work has reached planning. Retain both values of every changed field.
    for(const key of ['type','owner','targetDate'])if(clean(r[key])&&!clean(updated[key]))return fail('INTAKE','Cannot clear an established '+({type:'request type',owner:'coordinator',targetDate:'target date'})[key]);
    if(['Planned','In progress','Ready for review','Approved'].includes(r.stage)){
      const missing=checkIntake(updated);if(missing.length)return fail('INTAKE','Missing required intake: '+missing.join(', '));
    }
    if(!material.length)return ok({record:r});
    if(r.approval?.decision==='Rejected' && identity(updated.owner)===identity(r.approval.approver))return independenceError();
    updated.events=[...(updated.events||[]),event(updated,'request updated',JSON.stringify(Object.fromEntries(material.map(k=>[k,r[k]??'']))),JSON.stringify(Object.fromEntries(material.map(k=>[k,updated[k]]))),'Request details edited: '+material.join(', '),actor,clock)];
    if(material.includes('type') && updated.approval?.decision==='Rejected'){
      // Reclassification may be a corrective action, but it cannot erase a rejection.
      updated.events.push(event(updated,'rejected approval retained',r.type,updated.type,'Request type changed; prior rejection and reviewer remain until a new approval decision',actor,clock));
    }else if(material.includes('type')){
      const priorPolicy=JSON.stringify(updated.approval||{});
      updated.approval={required:null,approver:'',decision:'Undetermined',note:'',policyReason:'',policyDecidedBy:'',policyDecidedAt:'',basis:'',decisionAt:'',decisionBy:'',waiver:null};
      updated.events.push(event(updated,'approval policy reset',priorPolicy,JSON.stringify(updated.approval),'Request type changed; simulated process owner must reassess policy',actor,clock));
    }else if(updated.approval?.required===false)resetExemption(updated,'Material request change: '+material.join(', '),actor,clock);
    else approvalReset(updated,'Material request change: '+material.join(', '),actor,clock);
    restartReview(updated,'Material request fields changed: '+material.join(', '),actor,clock);
    updated.updatedAt=stamp(clock);
    return ok({record:reconcile(updated,{clock,actor})});
  };
  const decideApproval=(r,{decision,actor='Demo reviewer',note='',clock='2026-11-23'}={})=>{
    const timeError=clockCheck(r,clock);if(timeError)return timeError;
    if(!policyOK(r)||!r.approval.required)return fail('POLICY','An explicit required-approval policy must be recorded first');
    if(r.stage!=='Ready for review')return fail('STAGE','Approval decisions require Ready for review stage');
    if(getReadiness(r).state!=='Ready')return fail('READINESS','Complete all readiness checks before an approval decision');
    if(identity(actor)!==identity(r.approval.approver))return fail('ACTOR','Only the configured simulated approver may decide');
    if(!independentReviewer(r,actor))return independenceError();
    const limitError=textError([['Approval note',note,1000],['Actor',actor,100]]);if(limitError)return limitError;
    if(['Approved','Waived'].includes(r.approval.decision))return fail('DECISION','Return to In progress for renewed review before replacing a recorded decision');
    if(!['Approved','Rejected'].includes(decision))return fail('DECISION','Expected Approved or Rejected');
    if(decision==='Rejected'&&!clean(note))return fail('REASON','Rejection reason is required');
    if(r.approval.decision==='Rejected'&&decision==='Approved'&&!clean(note))return fail('REASON','Explain how the previous rejection was addressed before recording a new approval');
    const updated=clone(r);
    updated.approval={...updated.approval,decision,decisionAt:stamp(clock),decisionBy:actor,note:clean(note),waiver:null,basis:decision==='Approved'?approvalBasis(updated):''};
    updated.events=[...(updated.events||[]),event(updated,'approval decision',r.approval.decision,decision,note,actor,clock)];
    if(['Approved','Rejected','Waived'].includes(r.approval.decision))updated.events.push(event(updated,'prior approval retained',JSON.stringify(r.approval),JSON.stringify(updated.approval),'Superseded decision preserved',actor,clock));
    if(decision==='Rejected'){updated.stage='In progress';updated.events.push(event(updated,'stage','Ready for review','In progress','Approval rejected',actor,clock));}
    return ok({record:updated});
  };
  const waiveApproval=(r,{actor='Demo coordinator',actorRole='Coordinator',reason='',scope='approval',clock='2026-11-23'}={})=>{
    const timeError=clockCheck(r,clock);if(timeError)return timeError;
    if(!r.approval?.required)return fail('POLICY','No approval is required');
    if(actorRole!=='Process owner (simulated)'||!['Demo process owner','Process owner'].includes(clean(actor)))return fail('AUTH','Only the simulated process-owner role can create a waiver');
    if(!independentReviewer(r,actor))return independenceError();
    const limitError=textError([['Waiver reason',reason,1000],['Actor',actor,100]]);if(limitError)return limitError;
    if(['Approved','Waived'].includes(r.approval.decision))return fail('DECISION','Return to In progress for renewed review before replacing a recorded decision');
    if(r.approval.decision==='Rejected')return fail('REJECTED','Approval was rejected. Address the reviewer’s concerns and obtain a new approval; a waiver cannot override this rejection.');
    if(!clean(actor)||!clean(reason)||scope!=='approval')return fail('WAIVER','Waiver requires actor, reason and exact scope: approval');
    if(r.stage!=='Ready for review')return fail('STAGE','Waiver can only be recorded while Ready for review');
    if(getReadiness(r).state!=='Ready')return fail('READINESS','Do not issue a waiver while required readiness checks remain open');
    const updated=clone(r);
    updated.approval={...updated.approval,decision:'Waived',waiver:{authorized:true,actor,role:actorRole,reason:clean(reason),scope,at:stamp(clock)},decisionAt:stamp(clock),decisionBy:actor,note:clean(reason),basis:approvalBasis(updated)};
    updated.events=[...(updated.events||[]),event(updated,'approval waiver',JSON.stringify(r.approval),JSON.stringify(updated.approval),reason+' (scope: approval)',actor,clock)];
    return ok({record:updated});
  };
  const riskIssues=(r,clock='2026-11-23')=>{
    const readiness=getReadiness(r),remaining=dayDiff(r.targetDate,clock);
    const issues=[];
    if(!validDay(clock))issues.push({id:r.id+':BR-15:clock',rule:'BR-15',severity:'Review needed',owner:r.owner||'Coordinator',message:'Scenario date is invalid',next:'Choose a valid scenario date before evaluating time-sensitive risks',due:''});
    const historical=(['Delivered','Closed'].includes(r.stage)?stageIssues(r,r.stage,clock):[]).join(' • ');
    if(!delivered(r)&&r.stage!=='Cancelled'&&!policyOK(r))issues.push({id:r.id+':BR-07:policy',rule:'BR-07',severity:r.stage==='Ready for review'?'Critical':'Review needed',owner:r.owner||'Coordinator',message:'Approval policy is not determined',next:'Record whether approval is required and justify the decision',due:r.targetDate});
    if(!delivered(r)&&r.stage!=='Cancelled'&&r.approval?.required===true&&!independentReviewer(r,r.approval.approver))issues.push({id:r.id+':BR-07:independence',rule:'BR-07',severity:'Review needed',owner:r.owner||'Coordinator',message:'Configured reviewer is not independent',next:r.approval.decision==='Rejected'?'Resolve role conflict without removing rejection; reassign the conflicting work or cancel the request if no independent review is possible':'Select an independent reviewer in Approval policy or reassign the conflicting work',due:r.targetDate});
    if(r.stage==='Approved' && stageIssues(r,'Approved',clock).length)issues.push({id:r.id+':BR-15:approved-conflict',rule:'BR-15',severity:'Critical',owner:r.owner||'Coordinator',message:'Approved state contains a stale or missing requirement',next:'Move to In progress; correct the listed requirements and repeat review before delivery',due:r.targetDate});
    if(r.consistencyWarning||historical) issues.push({id:r.id+':BR-15:consistency',rule:'BR-15',severity:'Critical',owner:r.owner||'Coordinator',message:'Historical status conflict: '+(historical||r.consistencyWarning),next:r.stage==='Delivered'?'Review the conflict; move to In progress with a documented reopening reason if correction is needed':'Review the conflict outside this demo; closed records cannot be corrected here',due:r.targetDate});
    if(remaining===null && ACTIVE.has(r.stage)) issues.push({id:r.id+':BR-15:date',rule:'BR-15',severity:'Review needed',owner:r.owner||'Coordinator',message:'Target date is missing or invalid',next:'Confirm and correct request date',due:''});
    if(['Cancelled','Closed'].includes(r.stage))return issues;
    // Scheduling anomaly is an advisory: a completed task can still have a policy-approved late due date.
    if(!delivered(r))for(const t of relevant(r))if(validDay(t.dueDate)&&validDay(r.targetDate)&&dayDiff(t.dueDate,r.targetDate)>0){
      issues.push({id:r.id+':BR-15:schedule:'+t.id,rule:'BR-15',severity:'Warning',owner:t.assignedTo||r.owner||'Coordinator',message:t.title+': required task due date is after request target date',next:'Review the task schedule and revise its due date if incorrect; intentional exceptions are not recordable in this demo',due:t.dueDate});
    }
    if(r.stage==='Delivered'){
      for(const issue of taskIssues(r,'closeout')) issues.push({id:r.id+':'+issue.rule+':'+issue.taskId,rule:issue.rule,severity:'Warning',owner:issue.owner,message:'Closeout: '+issue.message,next:issue.next,due:r.targetDate});
      return issues;
    }
    if(remaining!==null&&remaining<0){issues.push({id:r.id+':BR-10:overdue',rule:'BR-10',severity:'Critical',owner:r.owner||'Coordinator',message:'Target date has passed without recorded delivery',next:'Confirm schedule and delivery; revise the target in Request details or escalate outside this demo',due:r.targetDate});}
    for(const t of relevant(r)){
      const due=dayDiff(t.dueDate,clock);
      if(due!==null&&due<0&&t.status!=='Complete')issues.push({id:r.id+':BR-10:task:'+t.id,rule:'BR-10',severity:'Warning',owner:t.assignedTo||r.owner||'Coordinator',message:t.title+': task due date has passed',next:'Contact task owner; verify completion or revise due date',due:t.dueDate});
    }
    for(const issue of readiness.issues){
      issues.push({id:r.id+':'+issue.rule+':'+(issue.taskId||'request'),rule:issue.rule,severity:remaining!==null&&remaining<=2?'Critical':remaining!==null&&remaining<=7?'Warning':'Action needed',owner:issue.owner,message:issue.message,next:issue.next,due:r.targetDate});
    }
    if(r.approval?.required && r.approval.decision==='Rejected')issues.push({id:r.id+':BR-07:rejected',rule:'BR-07',severity:remaining!==null&&remaining<=2?'Critical':'Warning',owner:r.owner||'Coordinator',message:'Approval rejected: '+(clean(r.approval.note)||'No rejection reason recorded'),next:'Address the reviewer’s concerns, then request a new decision from '+(r.approval.approver||'authorized reviewer'),due:r.targetDate});
    else if(r.stage==='Ready for review' && r.approval?.required && !approvalOK(r))issues.push({id:r.id+':BR-07:approval',rule:'BR-07',severity:remaining!==null&&remaining<=2?'Critical':'Warning',owner:r.approval.approver||'Process owner',message:'Approval is still pending',next:'Request approval from '+(r.approval.approver||'authorized reviewer'),due:r.targetDate});
    return issues;
  };
  const assess=(r,clock)=>{
    const readiness=r.stage==='Cancelled'?{state:'Not applicable',reason:'Request cancelled; no further readiness work is required',issues:[]}:getReadiness(r),issues=riskIssues(r,clock);
    const rank={'Critical':0,'Review needed':1,'Warning':2,'Action needed':3};issues.sort((a,b)=>(rank[a.severity]??9)-(rank[b.severity]??9)||a.id.localeCompare(b.id));
    return {readiness,issues,risk:issues.length?issues[0].severity:(r.stage==='Closed'||r.stage==='Cancelled'?'Terminal':r.stage==='Delivered'?'Delivered':'No current exception')};
  };
  const newRequest=(values,id,clock='2026-11-23')=>{if(!validDay(clock))throw new RangeError('Choose a valid scenario date before creating a request');const limitError=requestTextError(values);if(limitError)throw new RangeError(limitError.message);if(clean(values.targetDate)&&!validDay(values.targetDate))throw new RangeError('Target date must be a valid date between 2000 and 2100');return ({id,title:clean(values.title),type:clean(values.type)||'Service request',summary:clean(values.summary),owner:clean(values.owner),targetDate:values.targetDate||'',stage:'Submitted',createdAt:stamp(clock),updatedAt:stamp(clock),tasks:[],approval:{required:null,approver:'',decision:'Undetermined',note:'',policyReason:'',policyDecidedBy:'',policyDecidedAt:'',basis:'',decisionAt:'',decisionBy:'',waiver:null},delivery:{date:'',evidence:''},closeout:{actor:'',reason:''},events:[],consistencyWarning:''});};
  const setApprovalPolicy=(r,{required,reason='',approver='',actor='Demo process owner',actorRole,clock='2026-11-23'}={})=>{
    const timeError=clockCheck(r,clock);if(timeError)return timeError;
    if(delivered(r)||r.stage==='Cancelled')return fail('LOCKED','Delivered or terminal records cannot change approval policy');
    if(typeof required!=='boolean'||!clean(reason)||!clean(actor))return fail('POLICY','Make an explicit yes/no approval determination and record the reason and actor');
    if(required&&!clean(approver))return fail('APPROVER','Select a reviewer when approval is required');
    const limitError=textError([['Policy rationale',reason,180],['Reviewer',approver,100],['Actor',actor,100]]);if(limitError)return limitError;
    // Both labels denote the same fictional process-owner role (legacy engine calls omit actorRole).
    // This is a demo action boundary only, not authenticated access control.
    if(!['Demo process owner','Process owner'].includes(clean(actor))||(actorRole!==undefined&&actorRole!=='Process owner (simulated)'))return fail('AUTH','Only the designated simulated process owner may determine or change approval policy');
    if(policyOK(r) && r.approval.required===required && clean(r.approval.approver)===(required?clean(approver):'') && clean(r.approval.policyReason)===clean(reason))return required&&!independentReviewer(r,approver)?independenceError():ok({record:r});
    if(r.approval?.decision==='Rejected')return fail('REJECTED','An explicit rejection cannot be cleared or reassigned through approval policy changes. Address the concerns and obtain a new decision from the configured reviewer.');
    if(required&&!independentReviewer(r,approver))return independenceError();
    const updated=clone(r);const prior=updated.approval||{};
    updated.approval={required,approver:required?clean(approver):'',decision:required?'Pending':'Not applicable',policyReason:clean(reason),policyDecidedBy:clean(actor),policyDecidedAt:stamp(clock),decisionAt:'',decisionBy:'',note:'',waiver:null,basis:''};
    updated.events=[...(updated.events||[]),event(updated,'approval policy determined',JSON.stringify(prior),JSON.stringify(updated.approval),reason,actor,clock)];
    if(['Ready for review','Approved'].includes(updated.stage)){const priorStage=updated.stage;updated.stage='In progress';updated.events.push(event(updated,'stage',priorStage,'In progress','Approval policy changed: readiness review must be repeated',actor,clock));}
    updated.updatedAt=stamp(clock);return ok({record:reconcile(updated,{clock,actor})});
  };
  const addTask=(r,task,{actor='Demo coordinator',clock='2026-11-23'}={})=>{
    const timeError=clockCheck(r,clock);if(timeError)return timeError;
    if(delivered(r)||r.stage==='Cancelled')return fail('LOCKED','Cannot add tasks after delivery or terminal status');
    const t=clone(task);
    const taskTimeError=clockCheck({tasks:[t]},clock);if(taskTimeError)return taskTimeError;
    const limitError=textError([['Task ID',t.id,100],['Task title',t.title,90],['Task owner',t.assignedTo,100],['Verification evidence',t.evidence,1000],['Actor',actor,100]]);if(limitError)return limitError;
    if(t.kind==='readiness'&&activeTask(t)&&r.approval?.decision==='Rejected' && [t.assignedTo,t.acceptedBy].some(v=>identity(v)===identity(r.approval.approver)))return independenceError();
    if(!clean(t.id)||!clean(t.title)||!['readiness','closeout'].includes(t.kind))return fail('TASK','A unique task ID, title and valid category are required');
    if((r.tasks||[]).some(x=>x.id===t.id))return fail('DUPLICATE','Task identifier already exists');
    if(t.kind==='readiness'&&!validDay(t.dueDate))return fail('DATE','Required readiness task must have a valid due date');
    if(t.dueDate&&!validDay(t.dueDate))return fail('DATE','Task due date is invalid');
    const updated=clone(r);updated.tasks=[...(r.tasks||[]),t];
    updated.events=[...(updated.events||[]),event(updated,'task added','',t.id,t.title,actor,clock)];
    approvalReset(updated,'Readiness requirements changed',actor,clock);
    if(t.kind==='readiness'&&activeTask(t))resetExemption(updated,'Required readiness scope changed; reassess exemption',actor,clock);
    restartReview(updated,'New mandatory task added',actor,clock);
    return ok({record:reconcile(updated,{clock,actor})});
  };
  const updateTaskDueDate=(r,id,dueDate,{actor='Demo coordinator',clock='2026-11-23'}={})=>{
    const timeError=clockCheck(r,clock);if(timeError)return timeError;
    if(delivered(r)||r.stage==='Cancelled')return fail('LOCKED','Task deadlines cannot be changed after delivery or terminal status');
    const updated=clone(r),t=updated.tasks?.find(t=>t.id===id);if(!t)return fail('NOT_FOUND','Task not found');
    if(!validDay(dueDate))return fail('DATE','Task deadline must be a valid date');
    if(t.dueDate===dueDate)return ok({record:r});
    const old=t.dueDate;t.dueDate=dueDate;
    updated.events=[...(updated.events||[]),event(updated,'task deadline updated',old,dueDate,t.title,actor,clock)];
    approvalReset(updated,'Required task scheduling changed',actor,clock);
    if(requiredVerificationIds(r).has(t.id))resetExemption(updated,'Required readiness deadline changed; reassess exemption',actor,clock);
    restartReview(updated,'Task deadline changed',actor,clock);
    return ok({record:reconcile(updated,{actor,clock})});
  };
  const saveDelivery=(r,delivery,{actor='Demo coordinator',clock='2026-11-23'}={})=>{
    const timeError=clockCheck(r,clock);if(timeError)return timeError;
    if(delivered(r)||r.stage==='Cancelled')return fail('LOCKED','Delivery record is locked after delivery; reopen to correct');
    const limitError=textError([['Delivery evidence',delivery.evidence,1000],['Actor',actor,100]]);if(limitError)return limitError;
    const date=clean(delivery.date),evidence=clean(delivery.evidence);
    if(date&&!validDay(date))return fail('DATE','Delivery date must be valid');
    const updated=clone(r);updated.delivery={date,evidence};
    updated.events=[...(updated.events||[]),event(updated,'delivery updated',JSON.stringify(r.delivery||{}),JSON.stringify(updated.delivery), 'Delivery data edited (simulated)',actor,clock)];return ok({record:reconcile(updated,{clock,actor})});
  };
  const saveCloseout=(r,closeout,{actor='Demo coordinator',clock='2026-11-23'}={})=>{
    const timeError=clockCheck(r,clock);if(timeError)return timeError;
    if(terminal(r))return fail('LOCKED','Closure record cannot be edited after terminal status');
    if(r.stage!=='Delivered')return fail('SEQUENCE','Record delivery before entering closure information');
    const openFollowup=taskIssues(r,'closeout');if(openFollowup.length)return fail('GATE','Complete required follow-up before entering closure information: '+openFollowup.map(issue=>issue.message).join('; '));
    const limitError=textError([['Closure actor',closeout.actor,100],['Closure reason',closeout.reason,1000],['Actor',actor,100]]);if(limitError)return limitError;
    if(!clean(closeout.actor)||!clean(closeout.reason))return fail('CLOSURE','Closure actor and reason are required; explain why no follow-up is needed if none is required');
    const updated=clone(r);updated.closeout={actor:clean(closeout.actor),reason:clean(closeout.reason)};
    updated.events=[...(updated.events||[]),event(updated,'closeout updated',JSON.stringify(r.closeout||{}),JSON.stringify(updated.closeout),'Closeout information updated',actor,clock)];return ok({record:reconcile(updated,{clock,actor})});
  };
  return {STAGES,ACTIVE,clone,validDay,dayDiff,stamp,checkIntake,dependencyCycle,dependencyBlockers,taskIssues,getReadiness,stageIssues,nextStages,changeStage,reconcile,completeTask,reopenTask,acceptTask,reassignTask,updateRequest,decideApproval,waiveApproval,riskIssues,assess,newRequest,setApprovalPolicy,policyOK,approvalBasis,addTask,updateTaskDueDate,saveDelivery,saveCloseout,independentReviewer};
});
