import { useState, useEffect, useCallback, useMemo, useContext, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area } from "recharts";
import { AppContext } from "../context/AppContext.js";
import { ROLES, JOB_TITLES, PAY_TYPES, STORE_STATUSES, STORE_STATUS_LABELS, ORDER_SOURCES, ATTENDANCE_TYPES, ATTENDANCE_TYPE_COLORS, BATCH_STATUSES, DEFECT_REASONS, PAYROLL_STATUSES, CATEGORIES, UNITS, STATUSES, TASK_STATUSES, RAW_CATEGORIES, RAW_UNITS, NOTIF_TYPES, MARK_TYPES, PLAN_STATUSES, ORDER_STATUSES, ORDER_PRIORITIES, BOARD_COLUMNS, MOVEMENT_TYPES, DEBT_STATUSES, CAMERA_SOURCE_TYPES, CAMERA_SOURCE_LABELS, CAMERA_ZONES } from "../constants/index.js";
import { fmtDate, fmtShort, fmtTime, daysBetween, relTime } from "../utils/dates.js";
import { GlassChartTooltip } from "../components/charts/GlassChartTooltip.jsx";
import { C, CC } from "../theme/colors.js";
import { I } from "../icons/Icons.jsx";
import { EthnicBorder, EthnicCorner, Badge, Btn, Inp, Sel, Txa, Modal, Confirm, Stat, Toast, TH, TD, Card, Title, PageH, SearchBox } from "../components/ui/index.jsx";

// DELIVERIES
const DeliveriesPage = ()=>{
  const {deliveries,setDeliveries,suppliers,setSuppliers,rawMaterials,setRawMaterials,setRawMovements,addLog,currentUser,addNotification}=useContext(AppContext);
  const [modal,setModal]=useState(false);
  const [supModal,setSupModal]=useState(false);
  const [toast,setToast]=useState(null);
  const [errs,setErrs]=useState({});
  const [tab,setTab]=useState("deliveries");
  const [form,setForm]=useState({supplierId:"",rawId:"",quantity:"",pricePerUnit:""});
  const [supForm,setSupForm]=useState({name:"",contact:"",email:""});

  const openNew=()=>{setForm({supplierId:suppliers[0]?.id||"",rawId:rawMaterials[0]?.id||"",quantity:"",pricePerUnit:""});setErrs({});setModal(true)};
  const validate=()=>{const e={};if(!form.supplierId)e.supplierId="!";if(!form.rawId)e.rawId="!";if(!form.quantity||+form.quantity<=0)e.quantity="!";if(!form.pricePerUnit||+form.pricePerUnit<=0)e.pricePerUnit="!";setErrs(e);return!Object.keys(e).length};

  const save=()=>{
    if(!validate())return;
    const now=new Date().toISOString();
    const total=+form.quantity*+form.pricePerUnit;
    const del={id:Date.now(),supplierId:+form.supplierId,rawId:+form.rawId,quantity:+form.quantity,pricePerUnit:+form.pricePerUnit,totalPrice:total,date:now,userId:currentUser.id};
    setDeliveries(p=>[...p,del]);
    setRawMaterials(p=>p.map(r=>r.id===+form.rawId?{...r,stock:+(r.stock+ +form.quantity).toFixed(3),updatedAt:now}:r));
    setRawMovements(p=>[...p,{id:Date.now(),rawId:+form.rawId,type:"in",quantity:+form.quantity,reason:`Поставка от ${suppliers.find(s=>s.id===+form.supplierId)?.name}`,date:now}]);
    const rawName=rawMaterials.find(r=>r.id===+form.rawId)?.name;
    const supName=suppliers.find(s=>s.id===+form.supplierId)?.name;
    addLog(`Поставка: ${rawName} x${form.quantity}`);
    addNotification({title:`Новая поставка: ${rawName}`,type:"информация",content:`Получено ${form.quantity} ед. ${rawName} от ${supName} на сумму ${total.toLocaleString("ru")}₽`,targetAll:true});
    setToast({message:"Поставка записана",type:"success"});setModal(false);
  };

  const saveSup=()=>{
    if(!supForm.name.trim()){setToast({message:"Укажите название",type:"error"});return}
    setSuppliers(p=>[...p,{id:Date.now(),name:supForm.name,contact:supForm.contact,email:supForm.email}]);
    addLog(`Поставщик: ${supForm.name}`);
    setToast({message:"Добавлен",type:"success"});setSupModal(false);setSupForm({name:"",contact:"",email:""});
  };

  const sorted=[...deliveries].sort((a,b)=>new Date(b.date)-new Date(a.date));
  const supStats=useMemo(()=>{
    const m={};deliveries.forEach(d=>{if(!m[d.supplierId])m[d.supplierId]={count:0,total:0};m[d.supplierId].count++;m[d.supplierId].total+=d.totalPrice});
    return suppliers.map(s=>({...s,...(m[s.id]||{count:0,total:0})})).sort((a,b)=>b.total-a.total);
  },[suppliers,deliveries]);

  return(
    <div>
      <PageH title="Поставки">
        <div style={{display:"flex",gap:5}}>
          {[["deliveries","Поставки"],["suppliers","Поставщики"],["analytics","Аналитика"]].map(([id,lb])=>(
            <button key={id} onClick={()=>setTab(id)} style={{padding:"6px 14px",borderRadius:7,border:`1px solid ${tab===id?C.primary:C.border}`,background:tab===id?C.primaryBg:C.surface,color:tab===id?C.primary:C.muted,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{lb}</button>
          ))}
        </div>
        {tab==="deliveries"&&<Btn onClick={openNew} icon={<I.plus size={15}/>}>Новая поставка</Btn>}
        {tab==="suppliers"&&<Btn onClick={()=>setSupModal(true)} icon={<I.plus size={15}/>}>Добавить</Btn>}
      </PageH>
      {tab==="deliveries"&&<Card s={{padding:0,overflow:"hidden"}}><div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><TH>Дата</TH><TH>Поставщик</TH><TH>Сырьё</TH><TH>Кол-во</TH><TH>Цена/ед</TH><TH>Сумма</TH></tr></thead>
          <tbody>{sorted.map(d=>{const sup=suppliers.find(s=>s.id===d.supplierId);const raw=rawMaterials.find(r=>r.id===d.rawId);return(
            <tr key={d.id} style={{borderBottom:`1px solid ${C.border}`}}>
              <TD s={{fontSize:12}}>{fmtDate(d.date)}</TD><TD s={{fontWeight:500}}>{sup?.name||"\u2014"}</TD><TD>{raw?.name||"\u2014"}</TD>
              <TD s={{fontWeight:600}}>{d.quantity} {raw?.unit}</TD><TD s={{color:C.muted}}>{d.pricePerUnit}₽</TD>
              <TD s={{fontWeight:700,color:C.primary}}>{d.totalPrice.toLocaleString("ru")}₽</TD>
            </tr>)})}</tbody>
        </table></div></Card>}
      {tab==="suppliers"&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
        {supStats.map(s=><Card key={s.id}><div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:6}}>{s.name}</div><div style={{fontSize:12,color:C.muted}}>{s.contact}</div><div style={{fontSize:12,color:C.dim,marginBottom:8}}>{s.email}</div><div style={{display:"flex",gap:8}}><Badge color="info">{s.count} поставок</Badge><Badge color="success">{s.total.toLocaleString("ru")}₽</Badge></div></Card>)}
      </div>}
      {tab==="analytics"&&<Card><Title>Объёмы закупок</Title>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={supStats.map(s=>({name:s.name,total:s.total/1000}))}><CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="name" tick={{fill:C.dim,fontSize:11}}/><YAxis tick={{fill:C.dim,fontSize:10}}/><Tooltip content={<GlassChartTooltip unit="thousands" />}/><Bar dataKey="total" fill={C.info} radius={[6,6,0,0]}/></BarChart>
        </ResponsiveContainer>
      </Card>}
      <Modal open={modal} onClose={()=>setModal(false)} title="Новая поставка">
        <Sel label="Поставщик" value={form.supplierId} onChange={e=>setForm({...form,supplierId:e.target.value})} error={errs.supplierId} options={[{value:"",label:"Выберите"},...suppliers.map(s=>({value:s.id,label:s.name}))]}/>
        <Sel label="Сырьё" value={form.rawId} onChange={e=>setForm({...form,rawId:e.target.value})} error={errs.rawId} options={[{value:"",label:"Выберите"},...rawMaterials.map(r=>({value:r.id,label:`${r.name} (${r.unit})`}))]}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
          <Inp label="Количество" type="number" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} error={errs.quantity}/>
          <Inp label="Цена за ед." type="number" value={form.pricePerUnit} onChange={e=>setForm({...form,pricePerUnit:e.target.value})} error={errs.pricePerUnit}/>
        </div>
        {form.quantity&&form.pricePerUnit&&<div style={{fontSize:14,fontWeight:700,color:C.primary,textAlign:"right"}}>Итого: {(+form.quantity*+form.pricePerUnit).toLocaleString("ru")}₽</div>}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}><Btn v="secondary" onClick={()=>setModal(false)}>Отмена</Btn><Btn onClick={save}>Записать</Btn></div>
      </Modal>
      <Modal open={supModal} onClose={()=>setSupModal(false)} title="Новый поставщик" width={420}>
        <Inp label="Название" value={supForm.name} onChange={e=>setSupForm({...supForm,name:e.target.value})}/>
        <Inp label="Контакт" value={supForm.contact} onChange={e=>setSupForm({...supForm,contact:e.target.value})}/>
        <Inp label="Email" value={supForm.email} onChange={e=>setSupForm({...supForm,email:e.target.value})}/>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:6}}><Btn v="secondary" onClick={()=>setSupModal(false)}>Отмена</Btn><Btn onClick={saveSup}>Добавить</Btn></div>
      </Modal>
      {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
    </div>
  );
};


export { DeliveriesPage };
