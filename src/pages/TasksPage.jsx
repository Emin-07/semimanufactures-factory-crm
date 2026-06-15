import { useState, useEffect, useCallback, useMemo, useContext, useRef } from "react";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area } from "recharts";
import { AppContext } from "../context/AppContext.js";
import { ROLES, JOB_TITLES, PAY_TYPES, STORE_STATUSES, STORE_STATUS_LABELS, ORDER_SOURCES, ATTENDANCE_TYPES, ATTENDANCE_TYPE_COLORS, BATCH_STATUSES, DEFECT_REASONS, PAYROLL_STATUSES, CATEGORIES, UNITS, STATUSES, TASK_STATUSES, RAW_CATEGORIES, RAW_UNITS, NOTIF_TYPES, MARK_TYPES, PLAN_STATUSES, ORDER_STATUSES, ORDER_PRIORITIES, BOARD_COLUMNS, MOVEMENT_TYPES, DEBT_STATUSES, CAMERA_SOURCE_TYPES, CAMERA_SOURCE_LABELS, CAMERA_ZONES } from "../constants/index.js";
import { fmtDate, fmtShort, fmtTime, daysBetween, relTime } from "../utils/dates.js";
import { C, CC } from "../theme/colors.js";
import { I } from "../icons/Icons.jsx";
import { EthnicBorder, EthnicCorner, Badge, Btn, Inp, Sel, Txa, Modal, Confirm, Stat, Toast, TH, TD, Card, Title, PageH, SearchBox, RecipeButton, RecipeModal, ProgressBar } from "../components/ui/index.jsx";
import { TechMapCard } from "../components/ui/TechMapCard.jsx";
import { listItem, spring } from "../motion/presets.js";
import { canSeeFinance } from "../utils/roles.js";

// TASKS
const TasksPage = ()=>{
  const {tasks,setTasks,taskEmployees,setTaskEmployees,products,setProducts,users,rawMaterials,recipes,addLog,currentUser,addNotification,productionOutputs,setProductionOutputs,setBatches,applyOutput,applyServerState}=useContext(AppContext);
  const [modal,setModal]=useState(false);
  const [completeModal,setCompleteModal]=useState(null);
  const [toast,setToast]=useState(null);
  const [errs,setErrs]=useState({});
  const role=ROLES.find(r=>r.id===currentUser.roleId);
  const isWorker=role?.name==="worker";
  const [filter,setFilter]=useState(isWorker?"активные":"all");
  const canCreate=role?.name==="admin"||role?.name==="manager";

  const ap=products.filter(p=>!p.deleted);
  const workers=users.filter(u=>u.roleId===3&&u.status==="active");
  const [form,setForm]=useState({productId:ap[0]?.id||"",userIds:[],quantity:"",deadline:"",note:""});
  const [rawCheck,setRawCheck]=useState(null);
  const [empQtys,setEmpQtys]=useState({});
  const [recipeProductId,setRecipeProductId]=useState(null);

  const filtered=useMemo(()=>{
    let l=isWorker?tasks.filter(t=>(t.userIds||[]).includes(currentUser.id)):[...tasks];
    if(filter==="активные") l=l.filter(t=>t.status==="назначено"||t.status==="в работе");
    else if(filter!=="all") l=l.filter(t=>t.status===filter);
    // Sort: overdue first, then by deadline
    return l.sort((a,b)=>{
      const ao=!a.completedAt&&new Date()>new Date(a.deadline);
      const bo=!b.completedAt&&new Date()>new Date(b.deadline);
      if(ao&&!bo) return -1; if(!ao&&bo) return 1;
      if(a.status==="в работе"&&b.status!=="в работе") return -1;
      if(a.status!=="в работе"&&b.status==="в работе") return 1;
      return new Date(a.deadline)-new Date(b.deadline);
    });
  },[tasks,filter,isWorker,currentUser]);

  const checkRaw=(productId,qty)=>{
    const recipe=recipes.find(r=>r.productId===+productId);
    if(!recipe) return {ok:true,items:[]};
    const items=recipe.items.map(it=>{
      const raw=rawMaterials.find(r=>r.id===it.rawId);
      const needed=it.qty*qty;
      return {rawId:it.rawId,name:raw?.name||"?",needed:+needed.toFixed(3),available:raw?.stock||0,unit:raw?.unit||"",enough:raw?raw.stock>=needed:false};
    });
    return {ok:items.every(i=>i.enough),items};
  };

  const toggleUser=(uid)=>{
    setForm(f=>({...f,userIds:f.userIds.includes(uid)?f.userIds.filter(x=>x!==uid):[...f.userIds,uid]}));
  };

  const openNew=()=>{
    setForm({productId:ap[0]?.id||"",userIds:[],quantity:"",deadline:new Date(Date.now()+86400000).toISOString().slice(0,16),note:""});
    setRawCheck(null);setErrs({});setModal(true);
  };

  useEffect(()=>{
    if(modal&&form.productId&&form.quantity&&+form.quantity>0){
      setRawCheck(checkRaw(form.productId,+form.quantity));
    }else{setRawCheck(null)}
  },[form.productId,form.quantity,modal]);

  const validate=()=>{const e={};if(!form.productId)e.productId="!";if(!form.userIds.length)e.userIds="!";if(!form.quantity||+form.quantity<=0)e.quantity="!";if(!form.deadline)e.deadline="!";setErrs(e);return!Object.keys(e).length};

  const save=()=>{
    if(!validate())return;
    const rc=checkRaw(form.productId,+form.quantity);
    if(!rc.ok){setToast({message:"Недостаточно сырья!",type:"error"});return}
    const now=new Date().toISOString();
    const taskId=Date.now();
    const task={id:taskId,productId:+form.productId,userIds:form.userIds,quantity:+form.quantity,status:"назначено",createdAt:now,deadline:form.deadline,completedAt:null,note:form.note};
    setTasks(p=>[...p,task]);
    // Create task_employees entries
    const newTEs=form.userIds.map((uid,i)=>({id:taskId+i+1,taskId,employeeId:uid,producedQty:0,status:"назначено",createdAt:now}));
    setTaskEmployees(p=>[...p,...newTEs]);
    const pName=products.find(p=>p.id===+form.productId)?.name;
    const names=form.userIds.map(uid=>users.find(u=>u.id===uid)?.name?.split(" ").slice(0,2).join(" ")).join(", ");
    addLog(`Задание: ${pName} x${form.quantity} \u2192 ${names}`);
    addNotification({title:`Новое задание: ${pName}`,type:"информация",content:`Назначено: ${pName} x${form.quantity} \u2192 ${names}. Срок: ${fmtDate(form.deadline)}`,targetUsers:form.userIds});
    setToast({message:"Задание создано",type:"success"});setModal(false);
  };

  const openComplete=(t)=>{
    const initial={};
    (t.userIds||[]).forEach(uid=>{
      const eq=Math.floor(t.quantity/(t.userIds||[]).length);
      initial[uid]=eq;
    });
    // Adjust remainder to first user
    const remainder=t.quantity-Object.values(initial).reduce((s,v)=>s+v,0);
    if(remainder>0&&(t.userIds||[]).length>0) initial[(t.userIds||[])[0]]+=remainder;
    setEmpQtys(initial);
    setCompleteModal(t);
  };

  const doComplete=async()=>{
    const t=completeModal;if(!t)return;
    // Guard: task already completed (double-click / race condition)
    if(t.status==="завершено"||t.status==="просрочено"){setCompleteModal(null);return;}
    // Guard: productionOutput already exists for this task
    if((productionOutputs||[]).some(o=>o.taskId===t.id)){
      setToast({message:"Выпуск для этого задания уже создан",type:"warn"});
      setCompleteModal(null);return;
    }
    const totalAssigned=Object.values(empQtys).reduce((s,v)=>s+(+v||0),0);
    if(totalAssigned!==t.quantity){setToast({message:`Сумма (${totalAssigned}) должна равняться ${t.quantity}`,type:"error"});return}

    // ── Worker path: server action endpoint ──
    // Workers cannot write manager-only keys (dk_batches, dk_products, dk_raw_mats, etc.)
    // so we delegate all derived state updates to the server atomically.
    const role=ROLES.find(r=>r.id===currentUser.roleId);
    if(role?.name==="worker"){
      try{
        const r=await fetch("/api/actions/task-complete",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({taskId:t.id,quantities:empQtys}),
        });
        const data=await r.json();
        if(!r.ok){setToast({message:data.error||"Ошибка сервера",type:"error"});return;}
        applyServerState(data.state);
        setToast({message:"Завершено!",type:"success"});
      }catch(e){
        setToast({message:"Нет соединения с сервером",type:"error"});
      }
      setCompleteModal(null);
      return;
    }

    // ── Manager / Admin path (unchanged) ──
    const now=new Date().toISOString();
    const isLate=new Date(now)>new Date(t.deadline);

    // 1. Update task and taskEmployee statuses
    setTasks(p=>p.map(x=>x.id===t.id?{...x,status:isLate?"просрочено":"завершено",completedAt:now}:x));
    Object.entries(empQtys).forEach(([uid,qty])=>{
      setTaskEmployees(p=>p.map(te=>te.taskId===t.id&&te.employeeId===+uid?{...te,producedQty:+qty,status:isLate?"просрочено":"завершено"}:te));
    });

    // 2. One batch for the entire task (all workers combined = t.quantity).
    //    batchId is shared across all per-worker outputs so revertOutput knows which batch to remove.
    const sharedBatchId=t.id+0.5;
    const expiresAt=new Date(new Date(now).getTime()+7*24*3600*1000).toISOString();
    setBatches(p=>[...(p||[]),{id:sharedBatchId,productId:t.productId,quantity:t.quantity,producedAt:now,expiresAt,createdBy:currentUser.id,status:"активна",note:t.note||"",taskId:t.id}]);

    // 3. One productionOutput per worker (with their individual qty share).
    //    applyOutput handles: stock, inventoryMovements, rawMaterials, rawMovements, employeeHistory, productionPlans.
    //    First worker's output carries batchId so revertOutput can remove the batch;
    //    subsequent workers carry batchId:null (batch already created above).
    let runningStock=products.find(p=>p.id===t.productId)?.stock||0;
    let firstWorker=true;
    Object.entries(empQtys).forEach(([uid,qty])=>{
      if(+qty<=0) return;
      const outId=Date.now()+Math.random();
      const newOut={id:outId,productId:t.productId,employeeId:+uid,quantity:+qty,date:now,taskId:t.id,source:"task",batchId:firstWorker?sharedBatchId:null,comment:t.note||"",createdAt:now,createdBy:currentUser.id};
      firstWorker=false;
      setProductionOutputs(p=>[...(p||[]),newOut]);
      applyOutput(newOut,runningStock);
      runningStock+=+qty;
    });

    // 4. Logging, notifications, low-stock alerts
    const pName=products.find(p=>p.id===t.productId)?.name;
    const names=(t.userIds||[]).map(uid=>users.find(u=>u.id===uid)?.name?.split(" ").slice(0,2).join(" ")).join(", ");
    addLog(`Завершено: ${pName} x${t.quantity}${isLate?" (просрочено)":""} \u2192 ${names}`);
    addNotification({title:`Задание ${isLate?"просрочено":"выполнено"}: ${pName}`,type:isLate?"ошибка":"информация",content:`${names} ${isLate?"просрочили":"завершили"}: ${pName} x${t.quantity}`,targetAll:true});
    const recipe=recipes.find(r=>r.productId===t.productId);
    rawMaterials.forEach(r=>{
      const est=r.stock-(recipe?.items.find(x=>x.rawId===r.id)?.qty||0)*t.quantity;
      if(est<=r.minStock){addNotification({title:`Низкий остаток: ${r.name}`,type:"предупреждение",content:`${r.name}: ~${est.toFixed(1)} ${r.unit} (мин. ${r.minStock} ${r.unit})`,targetAll:true});}
    });
    setToast({message:isLate?"Завершено с опозданием":"Завершено!",type:isLate?"warn":"success"});
    setCompleteModal(null);
  };

  const startTask=async(t)=>{
    try{
      const r=await fetch("/api/actions/task-start",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({taskId:t.id}),
      });
      if(!r.ok){
        const err=await r.json().catch(()=>({}));
        setToast({message:err.error||"Не удалось начать задание",type:"error"});
        return;
      }
      const data=await r.json();
      if(data.state)applyServerState(data.state);
      setToast({message:"Задание начато",type:"info"});
    }catch(e){
      setToast({message:"Нет связи с сервером",type:"error"});
    }
  };

  const tColor=s=>s==="завершено"?"success":s==="в работе"?"info":s==="просрочено"?"danger":"primary";

  return(
    <div>
      <PageH title="Производственные задания">
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {["all","активные",...TASK_STATUSES].map(s=>(
            <button key={s} onClick={()=>setFilter(s)} style={{padding:"6px 14px",borderRadius:7,border:`1px solid ${filter===s?C.primary:C.border}`,background:filter===s?C.primaryBg:C.surface,color:filter===s?C.primary:C.muted,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{s==="all"?"Все":s==="активные"?"Активные":s}</button>
          ))}
        </div>
        {canCreate&&<Btn onClick={openNew} icon={<I.plus size={15}/>}>Новое задание</Btn>}
      </PageH>

      <LayoutGroup>
      <AnimatePresence mode="popLayout">
      <div style={{display:"grid",gap:10}}>
        {filtered.map(t=>{
          const prod=products.find(p=>p.id===t.productId);
          const tWorkers=(t.userIds||[]).map(uid=>users.find(u=>u.id===uid));
          const tEmps=taskEmployees.filter(te=>te.taskId===t.id);
          const producedTotal=tEmps.reduce((s,te)=>s+(+te.producedQty||0),0);
          const progressPct=t.quantity>0?Math.min(100,Math.round((producedTotal/t.quantity)*100)):0;
          const visibleWorkers=tWorkers.filter(Boolean).slice(0,4);
          const hiddenWorkersCount=Math.max(0,tWorkers.filter(Boolean).length-visibleWorkers.length);
          const isOverdue=!t.completedAt&&new Date()>new Date(t.deadline)&&t.status!=="завершено"&&t.status!=="просрочено";
          const canAct=isWorker?(t.userIds||[]).includes(currentUser.id):true;
          const msLeft=new Date(t.deadline).getTime()-Date.now();
          const hoursLeft=Math.floor(Math.abs(msLeft)/3600000);
          const dlLabel=t.completedAt?`Завершено: ${fmtShort(t.completedAt)}`:isOverdue?`Просрочено на ${hoursLeft} ч`:msLeft<3600000?`Срок: < 1 ч`:msLeft<86400000?`Срок: ${hoursLeft} ч`:msLeft<172800000?`Срок: завтра`:fmtShort(t.deadline);
          const dlColor=t.completedAt?C.success:isOverdue?C.danger:msLeft<3600000?C.danger:msLeft<86400000?C.orange:C.dim;
          return(
            <motion.div key={t.id} layout variants={listItem} initial="hidden" animate="show" exit="exit">
            <Card className="task-card" s={{display:"flex",flexDirection:"column",gap:10,padding:"14px 18px",minWidth:0,borderLeft:`3px solid ${isOverdue?C.danger:t.status==="завершено"?C.success:C.primary}`,background:isOverdue?`${C.danger}05`:""}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:"wrap"}}>
                <div style={{minWidth:0,flex:"1 1 220px"}}>
                  <div style={{fontSize:14,fontWeight:700,color:C.text,overflowWrap:"anywhere"}}>{prod?.name||"\u2014"} <span style={{fontWeight:400,color:C.muted}}>x{t.quantity}</span></div>
                  {t.note&&<div style={{fontSize:11,color:C.dim,fontStyle:"italic",marginTop:2}}>{t.note}</div>}
                </div>
                <Badge color={isOverdue?"danger":tColor(t.status)}>{isOverdue?"просрочено":t.status}</Badge>
              </div>
              <div style={{fontSize:12,color:dlColor,display:"flex",alignItems:"center",gap:5}}>
                <I.clock size={11}/>
                <span>{dlLabel}</span>
                {t.startedAt&&t.status==="в работе"&&<span style={{color:C.info}}>· В работе: {Math.floor((Date.now()-new Date(t.startedAt).getTime())/60000)} мин</span>}
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                <RecipeButton productId={t.productId} products={products} recipes={recipes} quantity={t.quantity} onOpen={setRecipeProductId}/>
                <div style={{flex:"1 1 180px",minWidth:140}}>
                  <div style={{fontSize:11,color:C.dim,marginBottom:4}}>Прогресс: {producedTotal}/{t.quantity}</div>
                  <ProgressBar value={progressPct} color={progressPct>=100?C.success:C.primary}/>
                </div>
              </div>
              {/* Employees list */}
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                <span style={{fontSize:11,color:C.dim,lineHeight:"24px"}}>Исполнители:</span>
                {visibleWorkers.map((w,i)=>{
                  const te=tEmps.find(e=>e.employeeId===w?.id);
                  return w?<Badge key={i} color={te?.producedQty>0?"success":"info"} s={{fontSize:11}}>
                    {w.name.split(" ").slice(0,2).join(" ")}{te?.producedQty>0?` — ${te.producedQty}`:""}
                  </Badge>:null;
                })}
                {hiddenWorkersCount>0&&<Badge color="info" s={{fontSize:11}}>+ ещё {hiddenWorkersCount}</Badge>}
              </div>
              <div style={{display:"flex",gap:5,justifyContent:"flex-end",marginTop:2}}>
                {t.status==="назначено"&&canAct&&<Btn sz="sm" v="info" onClick={()=>startTask(t)} style={{background:C.infoBg,color:C.info,border:`1px solid ${C.info}30`}}>Начать</Btn>}
                {t.status==="в работе"&&canAct&&<Btn sz="sm" v="success" onClick={()=>openComplete(t)}>Завершить</Btn>}
              </div>
              {prod?.techCard&&prod.techCard.length>0&&(
                <div style={{marginTop:8}}>
                  <TechMapCard steps={prod.techCard} compact />
                </div>
              )}
            </Card>
            </motion.div>
          );
        })}
      </div>
      </AnimatePresence>
      </LayoutGroup>
      {filtered.length===0&&<div style={{textAlign:"center",padding:50,color:C.dim}}><I.tasks size={36}/><p style={{marginTop:10}}>Нет заданий</p></div>}

      <RecipeModal
        open={!!recipeProductId}
        onClose={()=>setRecipeProductId(null)}
        product={products.find(p=>p.id===recipeProductId)}
        recipe={recipes.find(r=>r.productId===recipeProductId)}
        rawMaterials={rawMaterials}
        quantity={tasks.find(t=>t.productId===recipeProductId)?.quantity}
        showPrices={canSeeFinance(currentUser)}
      />

      {/* Create task modal */}
      <Modal open={modal} onClose={()=>setModal(false)} title="Новое задание" width={540}>
        <Sel label="Товар" value={form.productId} onChange={e=>setForm({...form,productId:e.target.value})} error={errs.productId} options={[{value:"",label:"Выберите"},...ap.map(p=>({value:p.id,label:`${p.name} (${p.category})`}))]}/>
        <div style={{marginBottom:12}}>
          <label style={{display:"block",fontSize:12,fontWeight:500,color:C.muted,marginBottom:6}}>Исполнители {errs.userIds&&<span style={{color:C.danger}}>(выберите хотя бы одного)</span>}</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {workers.map(w=>{
              const sel=form.userIds.includes(w.id);
              return <button key={w.id} onClick={()=>toggleUser(w.id)} style={{padding:"6px 12px",borderRadius:7,border:`1px solid ${sel?C.primary:C.border}`,background:sel?C.primaryBg:C.surface2,color:sel?C.primary:C.muted,fontSize:12,fontWeight:sel?600:400,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5}}>
                <span style={{width:14,height:14,borderRadius:4,border:`2px solid ${sel?C.primary:C.border}`,background:sel?C.primary:"transparent",display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{sel&&<I.check size={10}/>}</span>
                {w.name.split(" ").slice(0,2).join(" ")}
              </button>;
            })}
          </div>
        </div>
        <Inp label="Количество" type="number" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} error={errs.quantity}/>
        <Inp label="Срок выполнения" type="datetime-local" value={form.deadline} onChange={e=>setForm({...form,deadline:e.target.value})} error={errs.deadline}/>
        <Txa label="Примечание" value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/>
        {rawCheck&&(
          <div style={{background:rawCheck.ok?C.successBg:C.dangerBg,border:`1px solid ${rawCheck.ok?"rgba(90,158,95,.2)":"rgba(196,78,61,.2)"}`,borderRadius:8,padding:12,marginTop:8}}>
            <div style={{fontSize:13,fontWeight:600,color:rawCheck.ok?C.success:C.danger,marginBottom:6,display:"flex",alignItems:"center",gap:6}}>
              {rawCheck.ok?<I.check size={13}/>:<I.x size={13}/>}
              <span>{rawCheck.ok?"Сырья достаточно":"Недостаточно сырья"}</span>
            </div>
            {rawCheck.items.map((it,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"2px 0",color:it.enough?C.text:C.danger}}>
                <span>{it.name}</span>
                <span style={{display:"inline-flex",alignItems:"center",gap:5}}>
                  {it.needed} / {it.available} {it.unit}
                  {it.enough?<I.check size={12}/>:<I.x size={12}/>}
                </span>
              </div>
            ))}
          </div>
        )}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10}}>
          <Btn v="secondary" onClick={()=>setModal(false)}>Отмена</Btn>
          <Btn onClick={save} disabled={rawCheck&&!rawCheck.ok}>Создать</Btn>
        </div>
      </Modal>

      {/* Complete task modal — distribute quantities */}
      <Modal open={!!completeModal} onClose={()=>setCompleteModal(null)} title="Завершение задания" width={480}>
        {completeModal&&(()=>{
          const t=completeModal;
          const prod=products.find(p=>p.id===t.productId);
          const total=Object.values(empQtys).reduce((s,v)=>s+(+v||0),0);
          const isValid=total===t.quantity;
          return(<div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:15,fontWeight:700,color:C.text}}>{prod?.name} — {t.quantity} {prod?.unit}</div>
              <div style={{fontSize:12,color:C.muted,marginTop:4}}>Распределите количество между исполнителями:</div>
            </div>
            {(t.userIds||[]).map(uid=>{
              const w=users.find(u=>u.id===uid);
              return(
                <div key={uid} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,padding:10,background:C.bg,borderRadius:8,border:`1px solid ${C.border}`}}>
                  <div style={{flex:1,fontSize:13,fontWeight:500,color:C.text}}>{w?.name?.split(" ").slice(0,2).join(" ")}</div>
                  <input type="number" min="0" value={empQtys[uid]||""} onChange={e=>setEmpQtys({...empQtys,[uid]:+e.target.value||0})} style={{width:80,padding:"6px 8px",background:C.surface2,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:13,fontFamily:"inherit",textAlign:"right"}}/>
                  <span style={{fontSize:12,color:C.dim,width:30}}>{prod?.unit}</span>
                </div>
              );
            })}
            <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderTop:`1px solid ${C.border}`,marginTop:6}}>
              <span style={{fontSize:13,fontWeight:600,color:C.text}}>Итого:</span>
              <span style={{fontSize:14,fontWeight:800,color:isValid?C.success:C.danger}}>{total} / {t.quantity} {prod?.unit}</span>
            </div>
            {!isValid&&<div style={{fontSize:12,color:C.danger,marginBottom:8}}>Сумма должна равняться {t.quantity}</div>}
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:6}}>
              <Btn v="secondary" onClick={()=>setCompleteModal(null)}>Отмена</Btn>
              <Btn v="success" onClick={doComplete} disabled={!isValid}>Завершить</Btn>
            </div>
          </div>);
        })()}
      </Modal>
      {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
    </div>
  );
};


export { TasksPage };
