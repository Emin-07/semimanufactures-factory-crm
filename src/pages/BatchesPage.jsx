import { useState, useEffect, useCallback, useMemo, useContext, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area } from "recharts";
import { AppContext } from "../context/AppContext.js";
import { ROLES, JOB_TITLES, PAY_TYPES, STORE_STATUSES, STORE_STATUS_LABELS, ORDER_SOURCES, ATTENDANCE_TYPES, ATTENDANCE_TYPE_COLORS, BATCH_STATUSES, DEFECT_REASONS, PAYROLL_STATUSES, CATEGORIES, UNITS, STATUSES, TASK_STATUSES, RAW_CATEGORIES, RAW_UNITS, NOTIF_TYPES, MARK_TYPES, PLAN_STATUSES, ORDER_STATUSES, ORDER_PRIORITIES, BOARD_COLUMNS, MOVEMENT_TYPES, DEBT_STATUSES, CAMERA_SOURCE_TYPES, CAMERA_SOURCE_LABELS, CAMERA_ZONES } from "../constants/index.js";
import { fmtDate, fmtShort, fmtTime, daysBetween, relTime } from "../utils/dates.js";
import { C, CC } from "../theme/colors.js";
import { I } from "../icons/Icons.jsx";
import { EthnicBorder, EthnicCorner, Badge, Btn, Inp, Sel, Txa, Modal, Confirm, Stat, Toast, TH, TD, Card, Title, PageH, SearchBox } from "../components/ui/index.jsx";

// BATCHES PAGE — Партии продукции
const BatchesPage = ()=>{
  const {batches,setBatches,products,currentUser,addLog}=useContext(AppContext);
  const role=ROLES.find(r=>r.id===currentUser.roleId);
  const isAdmin=role?.name==="admin"||role?.name==="owner";
  const [fStatus,setFStatus]=useState("all");
  const [fProduct,setFProduct]=useState("all");
  const [confirm,setConfirm]=useState(null);
  const [toast,setToast]=useState(null);

  const now=new Date();
  const filtered=useMemo(()=>{
    let l=[...(batches||[])];
    if(fStatus!=="all") l=l.filter(b=>b.status===fStatus);
    if(fProduct!=="all") l=l.filter(b=>b.productId===+fProduct);
    return l.sort((a,b)=>new Date(b.producedAt)-new Date(a.producedAt));
  },[batches,fStatus,fProduct]);

  const daysLeft=(expiresAt)=>{
    if(!expiresAt) return null;
    return Math.ceil((new Date(expiresAt)-now)/(86400000));
  };
  const expiryColor=(days)=>{
    if(days===null) return "info";
    if(days<0) return "danger";
    if(days<=3) return "danger";
    if(days<=7) return "orange";
    return "success";
  };

  const writeOff=(b)=>{
    setBatches(p=>p.map(x=>x.id===b.id?{...x,status:"списана",updatedAt:new Date().toISOString()}:x));
    const p=products.find(x=>x.id===b.productId);
    addLog(`Списана партия: ${p?.name||"?"} ${b.quantity}ед.`);
    setToast({message:"Партия списана",type:"success"});
    setConfirm(null);
  };

  const active=(batches||[]).filter(b=>b.status==="активна");
  const expiringSoon=active.filter(b=>daysLeft(b.expiresAt)!==null&&daysLeft(b.expiresAt)<=3);
  const totalActive=active.reduce((s,b)=>s+b.quantity,0);

  return(
    <div>
      <PageH title="Партии продукции">
        <select value={fProduct} onChange={e=>setFProduct(e.target.value)} style={{padding:"7px 9px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,fontSize:12,fontFamily:"inherit"}}>
          <option value="all">Все товары</option>
          {(products||[]).filter(p=>!p.deleted).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={fStatus} onChange={e=>setFStatus(e.target.value)} style={{padding:"7px 9px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,fontSize:12,fontFamily:"inherit"}}>
          <option value="all">Все статусы</option>
          {BATCH_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
      </PageH>

      <div style={{display:"flex",flexWrap:"wrap",gap:12,marginBottom:16}}>
        <Stat icon={<I.box size={18}/>} label="Активных партий" value={active.length} color={C.info}/>
        <Stat icon={<I.chart size={18}/>} label="Ед. в обороте" value={totalActive} color={C.success}/>
        {expiringSoon.length>0&&<Stat icon={<I.alert size={18}/>} label="Истекает ≤ 3 дней" value={expiringSoon.length} color={C.danger}/>}
      </div>

      <div style={{display:"grid",gap:8}}>
        {filtered.map(b=>{
          const prod=products.find(p=>p.id===b.productId);
          const days=daysLeft(b.expiresAt);
          const clr=b.status==="активна"?expiryColor(days):(b.status==="списана"?"danger":"muted");
          return(
            <Card key={b.id} s={{borderLeft:`3px solid ${C[clr]||C.border}`,opacity:b.status!=="активна"?0.7:1}}>
              <div style={{display:"flex",flexWrap:"wrap",gap:12,alignItems:"center"}}>
                <div style={{flex:"1 1 180px"}}>
                  <div style={{fontSize:14,fontWeight:700,color:C.text}}>{prod?.name||"—"}</div>
                  <div style={{fontSize:11,color:C.dim}}>Произведено: {fmtShort(b.producedAt)}{b.expiresAt&&` · Годен до: ${fmtShort(b.expiresAt)}`}</div>
                  {b.note&&<div style={{fontSize:11,color:C.dim,fontStyle:"italic"}}>{b.note}</div>}
                </div>
                <div style={{textAlign:"center",minWidth:60}}>
                  <div style={{fontSize:20,fontWeight:800,color:C.text}}>{b.quantity}</div>
                  <div style={{fontSize:10,color:C.dim}}>ед.</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <Badge color={clr==="muted"?"info":clr} s={{fontSize:10}}>{b.status}</Badge>
                  {days!==null&&b.status==="активна"&&(
                    <Badge color={expiryColor(days)} s={{fontSize:10}}>
                      {days<0?`просрочено ${-days}д`:days===0?"истекает сегодня":`${days}д`}
                    </Badge>
                  )}
                  {isAdmin&&b.status==="активна"&&(
                    <Btn v="ghost" sz="sm" onClick={()=>setConfirm({title:"Списать партию?",message:`${prod?.name||"?"} — ${b.quantity} ед.`,onConfirm:()=>writeOff(b)})} icon={<I.trash size={13}/>}/>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
        {filtered.length===0&&<div style={{textAlign:"center",padding:50,color:C.dim}}>Нет партий по выбранным фильтрам</div>}
      </div>

      {confirm&&<Confirm open={!!confirm} onClose={()=>setConfirm(null)} title={confirm.title} message={confirm.message} onConfirm={confirm.onConfirm}/>}
      {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
    </div>
  );
};


export { BatchesPage };
