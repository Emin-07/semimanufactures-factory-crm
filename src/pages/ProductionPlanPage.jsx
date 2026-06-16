import { useState, useEffect, useCallback, useMemo, useContext, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area } from "recharts";
import { AppContext } from "../context/AppContext.js";
import { ROLES, JOB_TITLES, PAY_TYPES, STORE_STATUSES, STORE_STATUS_LABELS, ORDER_SOURCES, ATTENDANCE_TYPES, ATTENDANCE_TYPE_COLORS, BATCH_STATUSES, DEFECT_REASONS, PAYROLL_STATUSES, CATEGORIES, UNITS, STATUSES, TASK_STATUSES, RAW_CATEGORIES, RAW_UNITS, NOTIF_TYPES, MARK_TYPES, PLAN_STATUSES, ORDER_STATUSES, ORDER_PRIORITIES, BOARD_COLUMNS, MOVEMENT_TYPES, DEBT_STATUSES, CAMERA_SOURCE_TYPES, CAMERA_SOURCE_LABELS, CAMERA_ZONES } from "../constants/index.js";
import { fmtDate, fmtShort, fmtTime, daysBetween, relTime } from "../utils/dates.js";
import { C, CC } from "../theme/colors.js";
import { I } from "../icons/Icons.jsx";
import { EthnicBorder, EthnicCorner, Badge, Btn, Inp, Sel, Txa, Modal, Confirm, Stat, Toast, TH, TD, Card, Title, PageH, SearchBox } from "../components/ui/index.jsx";

// PRODUCTION PLANNING
const ProductionPlanPage = ()=>{
  const {productionPlans,setProductionPlans,products,users,rawMaterials,recipes,addLog,currentUser,addNotification}=useContext(AppContext);
  const [modal,setModal]=useState(false);
  const [toast,setToast]=useState(null);
  const [errs,setErrs]=useState({});
  const [viewMode,setViewMode]=useState("week"); // day, week, month
  const [dateOffset,setDateOffset]=useState(0);
  const ap=products.filter(p=>!p.deleted);
  const workers=users.filter(u=>u.roleId===3&&u.status==="active"&&!u.deleted);
  const [form,setForm]=useState({productId:ap[0]?.id||"",plannedQty:"",productionDate:"",employeeIds:[]});

  const today=new Date();
  const baseDate=new Date(today);baseDate.setDate(baseDate.getDate()+dateOffset*7);

  // Get date range for current view
  const dateRange=useMemo(()=>{
    const d=new Date(baseDate);
    if(viewMode==="day") return [d.toISOString().slice(0,10)];
    if(viewMode==="week"){
      const mon=new Date(d);mon.setDate(mon.getDate()-mon.getDay()+1);
      return Array.from({length:7},(_,i)=>{const x=new Date(mon);x.setDate(x.getDate()+i);return x.toISOString().slice(0,10)});
    }
    // month
    const first=new Date(d.getFullYear(),d.getMonth(),1);
    const last=new Date(d.getFullYear(),d.getMonth()+1,0);
    const days=[];for(let x=new Date(first);x<=last;x.setDate(x.getDate()+1)) days.push(new Date(x).toISOString().slice(0,10));
    return days;
  },[baseDate,viewMode]);

  const plansInRange=productionPlans.filter(p=>dateRange.includes(p.productionDate)).sort((a,b)=>a.productionDate.localeCompare(b.productionDate));

  // Daily summary
  const dailySummary=useMemo(()=>{
    const m={};plansInRange.forEach(p=>{
      if(!m[p.productionDate]) m[p.productionDate]={planned:0,completed:0,plans:0};
      m[p.productionDate].planned+=p.plannedQty;
      m[p.productionDate].completed+=p.completedQty;
      m[p.productionDate].plans++;
    });
    return m;
  },[plansInRange]);

  // Worker load
  const workerLoad=useMemo(()=>{
    const m={};plansInRange.forEach(p=>{
      (p.employeeIds||[]).forEach(uid=>{
        if(!m[uid]) m[uid]={plans:0,totalQty:0};
        m[uid].plans++;m[uid].totalQty+=p.plannedQty;
      });
    });
    return m;
  },[plansInRange]);

  const toggleEmp=(uid)=>setForm(f=>({...f,employeeIds:f.employeeIds.includes(uid)?f.employeeIds.filter(x=>x!==uid):[...f.employeeIds,uid]}));

  const openNew=()=>{setForm({productId:ap[0]?.id||"",plannedQty:"",productionDate:new Date().toISOString().slice(0,10),employeeIds:[]});setErrs({});setModal(true)};

  const validate=()=>{const e={};if(!form.productId)e.productId="!";if(!form.plannedQty||+form.plannedQty<=0)e.plannedQty="!";if(!form.productionDate)e.productionDate="!";if(!form.employeeIds.length)e.employeeIds="!";setErrs(e);return !Object.keys(e).length};

  const save=()=>{
    if(!validate())return;
    const plan={id:Date.now(),productId:+form.productId,plannedQty:+form.plannedQty,completedQty:0,productionDate:form.productionDate,employeeIds:form.employeeIds,createdBy:currentUser.id,createdAt:new Date().toISOString(),status:"запланирован"};
    setProductionPlans(p=>[...p,plan]);
    const pName=products.find(p=>p.id===+form.productId)?.name;
    addLog(`План: ${pName} x${form.plannedQty} на ${form.productionDate}`);
    addNotification({title:`Новый план: ${pName}`,type:"информация",content:`План на ${form.productionDate}: ${pName} x${form.plannedQty}`,targetUsers:form.employeeIds});
    setToast({message:"План создан",type:"success"});setModal(false);
  };

  const updateStatus=(plan,newStatus)=>{
    setProductionPlans(p=>p.map(x=>x.id===plan.id?{...x,status:newStatus}:x));
    addLog(`План #${plan.id}: статус → ${newStatus}`);
    setToast({message:"Статус обновлён",type:"success"});
  };

  const updateCompleted=(plan,qty)=>{
    setProductionPlans(p=>p.map(x=>x.id===plan.id?{...x,completedQty:Math.min(+qty,x.plannedQty)}:x));
  };

  const pctColor=(pct)=>pct>=100?C.success:pct>=50?C.primary:C.danger;
  const navLabel=viewMode==="day"?baseDate.toLocaleDateString("ru-RU"):viewMode==="week"?`Неделя ${dateRange[0]?.slice(5)} — ${dateRange[6]?.slice(5)}`:`${baseDate.toLocaleDateString("ru-RU",{month:"long",year:"numeric"})}`;

  return(
    <div>
      <PageH title="Планирование производства">
        <div style={{display:"flex",gap:5}}>
          {[["day","День"],["week","Неделя"],["month","Месяц"]].map(([id,lb])=>(
            <button key={id} onClick={()=>{setViewMode(id);setDateOffset(0)}} style={{padding:"6px 14px",borderRadius:7,border:`1px solid ${viewMode===id?C.primary:C.border}`,background:viewMode===id?C.primaryBg:C.surface,color:viewMode===id?C.primary:C.muted,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{lb}</button>
          ))}
        </div>
        <Btn onClick={openNew} icon={<I.plus size={15}/>}>Новый план</Btn>
      </PageH>

      {/* Date navigation */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <Btn v="ghost" sz="sm" onClick={()=>setDateOffset(d=>d-1)}>{"\u25c0"}</Btn>
        <span style={{fontSize:14,fontWeight:600,color:C.text,minWidth:180,textAlign:"center"}}>{navLabel}</span>
        <Btn v="ghost" sz="sm" onClick={()=>setDateOffset(d=>d+1)}>{"\u25b6"}</Btn>
        <Btn v="ghost" sz="sm" onClick={()=>setDateOffset(0)}>Сегодня</Btn>
      </div>

      {/* Worker load summary */}
      {Object.keys(workerLoad).length>0&&<Card s={{marginBottom:14,padding:"12px 16px"}}>
        <div style={{fontSize:12,fontWeight:600,color:C.muted,marginBottom:8}}>Загрузка сотрудников:</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {Object.entries(workerLoad).map(([uid,data])=>{
            const w=users.find(u=>u.id===+uid);
            return <Badge key={uid} color="info" s={{fontSize:11}}>{w?.name?.split(" ").slice(0,2).join(" ")} — {data.plans} пл. / {data.totalQty}</Badge>;
          })}
        </div>
      </Card>}

      {/* Plans table */}
      <Card s={{padding:0,overflow:"hidden"}}><div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr><TH>Дата</TH><TH>Товар</TH><TH>План</TH><TH>Выполнено</TH><TH>Прогресс</TH><TH>Сотрудники</TH><TH>Статус</TH><TH></TH></tr></thead>
          <tbody>{plansInRange.map(plan=>{
            const prod=products.find(p=>p.id===plan.productId);
            const pct=plan.plannedQty>0?Math.round(plan.completedQty/plan.plannedQty*100):0;
            return(
              <tr key={plan.id} style={{borderBottom:`1px solid ${C.border}`}}>
                <TD s={{fontWeight:500,whiteSpace:"nowrap"}}>{plan.productionDate}</TD>
                <TD s={{fontWeight:500}}>{prod?.name||"\u2014"}</TD>
                <TD>{plan.plannedQty} {prod?.unit}</TD>
                <TD>
                  {plan.status!=="выполнен"&&plan.status!=="отменён"?
                    <input type="number" value={plan.completedQty} onChange={e=>updateCompleted(plan,e.target.value)} style={{width:60,padding:"4px 6px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:5,color:C.text,fontSize:12,fontFamily:"inherit"}}/>
                    :<span style={{fontWeight:600}}>{plan.completedQty}</span>
                  } {prod?.unit}
                </TD>
                <TD>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <div style={{flex:1,height:5,background:C.bg,borderRadius:3,overflow:"hidden",minWidth:50}}>
                      <div style={{height:"100%",width:`${pct}%`,background:pctColor(pct),borderRadius:3,transition:"width .3s"}}/>
                    </div>
                    <span style={{fontSize:11,fontWeight:600,color:pctColor(pct)}}>{pct}%</span>
                  </div>
                </TD>
                <TD>
                  <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                    {(plan.employeeIds||[]).map(uid=>{const w=users.find(u=>u.id===uid);return w?<span key={uid} style={{fontSize:10,color:C.muted,background:C.bg,padding:"2px 6px",borderRadius:4}}>{w.name.split(" ")[0]}</span>:null})}
                  </div>
                </TD>
                <TD>
                  <select value={plan.status} onChange={e=>updateStatus(plan,e.target.value)} style={{padding:"4px 6px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:5,color:C.text,fontSize:11,fontFamily:"inherit"}}>
                    {PLAN_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </TD>
                <TD s={{color:C.dim,fontSize:11}}>{dailySummary[plan.productionDate]?`${dailySummary[plan.productionDate].plans} пл.`:""}</TD>
              </tr>
            );
          })}</tbody>
        </table>
      </div></Card>
      {plansInRange.length===0&&<div style={{textAlign:"center",padding:50,color:C.dim}}><I.tasks size={36}/><p style={{marginTop:10}}>Нет планов на этот период</p></div>}

      <Modal open={modal} onClose={()=>setModal(false)} title="Новый план производства" width={520}>
        <Sel label="Товар" value={form.productId} onChange={e=>setForm({...form,productId:e.target.value})} error={errs.productId} options={[{value:"",label:"Выберите"},...ap.map(p=>({value:p.id,label:`${p.name} (${p.category})`}))]}/>
        <Inp label="Количество" type="number" value={form.plannedQty} onChange={e=>setForm({...form,plannedQty:e.target.value})} error={errs.plannedQty}/>
        <Inp label="Дата производства" type="date" value={form.productionDate} onChange={e=>setForm({...form,productionDate:e.target.value})} error={errs.productionDate}/>
        <div style={{marginBottom:12}}>
          <label style={{display:"block",fontSize:12,fontWeight:500,color:C.muted,marginBottom:6}}>Сотрудники {errs.employeeIds&&<span style={{color:C.danger}}>(выберите)</span>}</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {workers.map(w=>{const sel=form.employeeIds.includes(w.id);return(
              <button key={w.id} onClick={()=>toggleEmp(w.id)} style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${sel?C.primary:C.border}`,background:sel?C.primaryBg:C.surface2,color:sel?C.primary:C.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:sel?600:400,display:"flex",alignItems:"center",gap:4}}>
                <span style={{width:12,height:12,borderRadius:3,border:`2px solid ${sel?C.primary:C.border}`,background:sel?C.primary:"transparent",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>{sel&&<I.check size={8}/>}</span>
                {w.name.split(" ").slice(0,2).join(" ")}
              </button>
            )})}
          </div>
        </div>
        {/* Raw material check */}
        {form.productId&&form.plannedQty&&+form.plannedQty>0&&(()=>{
          const recipe=recipes.find(r=>r.productId===+form.productId);
          if(!recipe) return null;
          const items=recipe.items.map(it=>{const raw=rawMaterials.find(r=>r.id===it.rawId);const needed=it.qty*(+form.plannedQty);return{name:raw?.name||"?",needed:+needed.toFixed(2),available:raw?.stock||0,unit:raw?.unit||"",ok:(raw?.stock||0)>=needed}});
          const allOk=items.every(i=>i.ok);
          return(
            <div style={{background:allOk?C.successBg:C.dangerBg,border:`1px solid ${allOk?"rgba(90,158,95,.2)":"rgba(196,78,61,.2)"}`,borderRadius:8,padding:10,marginBottom:10}}>
              <div style={{fontSize:12,fontWeight:600,color:allOk?C.success:C.danger,marginBottom:4}}>{allOk?"\u2705 Сырья достаточно":"\u26a0 Недостаточно сырья"}</div>
              {items.map((it,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:11,color:it.ok?C.text:C.danger,padding:"1px 0"}}><span>{it.name}</span><span>{it.needed}/{it.available} {it.unit}</span></div>)}
            </div>
          );
        })()}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}>
          <Btn v="secondary" onClick={()=>setModal(false)}>Отмена</Btn>
          <Btn onClick={save}>Создать</Btn>
        </div>
      </Modal>
      {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
    </div>
  );
};


export { ProductionPlanPage };
