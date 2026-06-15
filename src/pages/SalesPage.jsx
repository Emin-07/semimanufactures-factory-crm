import { useState, useEffect, useCallback, useMemo, useContext, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area } from "recharts";
import { AppContext } from "../context/AppContext.js";
import { ROLES, JOB_TITLES, PAY_TYPES, STORE_STATUSES, STORE_STATUS_LABELS, ORDER_SOURCES, ATTENDANCE_TYPES, ATTENDANCE_TYPE_COLORS, BATCH_STATUSES, DEFECT_REASONS, PAYROLL_STATUSES, CATEGORIES, UNITS, STATUSES, TASK_STATUSES, RAW_CATEGORIES, RAW_UNITS, NOTIF_TYPES, MARK_TYPES, PLAN_STATUSES, ORDER_STATUSES, ORDER_PRIORITIES, BOARD_COLUMNS, MOVEMENT_TYPES, DEBT_STATUSES, CAMERA_SOURCE_TYPES, CAMERA_SOURCE_LABELS, CAMERA_ZONES } from "../constants/index.js";
import { fmtDate, fmtShort, fmtTime, daysBetween, relTime } from "../utils/dates.js";
import { C, CC } from "../theme/colors.js";
import { I } from "../icons/Icons.jsx";
import { EthnicBorder, EthnicCorner, Badge, Btn, Inp, Sel, Txa, Modal, Confirm, Stat, Toast, TH, TD, Card, Title, PageH, SearchBox } from "../components/ui/index.jsx";

// QUICK SALES
const SalesPage = ()=>{
  const {products,setProducts,clients,users,sales,setSales,inventoryMovements,setInventoryMovements,addLog,currentUser}=useContext(AppContext);
  const [modal,setModal]=useState(false);
  const [toast,setToast]=useState(null);
  const ap=products.filter(p=>!p.deleted);
  const [form,setForm]=useState({productId:ap[0]?.id||"",quantity:"",clientId:""});

  const sell=()=>{
    if(!form.productId||!form.quantity||+form.quantity<=0){setToast({message:"Укажите товар и количество",type:"error"});return}
    const p=products.find(x=>x.id===+form.productId);
    if(!p||p.stock<+form.quantity){setToast({message:`Недостаточно: ${p?.name||"?"} (на складе ${p?.stock||0})`,type:"error"});return}
    const now=new Date().toISOString();
    const saleId=Date.now();
    setSales(prev=>[...prev,{id:saleId,productId:+form.productId,quantity:+form.quantity,clientId:form.clientId?+form.clientId:null,soldBy:currentUser.id,createdAt:now}]);
    const newStock=p.stock-+form.quantity;
    setProducts(prev=>prev.map(x=>x.id===+form.productId?{...x,stock:newStock,updatedAt:now}:x));
    setInventoryMovements(prev=>[...prev,{id:Date.now()+Math.random(),productId:+form.productId,type:"sale",quantity:-+form.quantity,balance:newStock,refId:`sale-${saleId}`,createdAt:now}]);
    const revenue=p.sellPrice*+form.quantity;
    addLog(`Продажа: ${p.name} x${form.quantity} = ${revenue.toLocaleString("ru")} ₽`);
    setToast({message:`Продано: ${p.name} x${form.quantity}`,type:"success"});
    setForm({productId:ap[0]?.id||"",quantity:"",clientId:""});setModal(false);
  };

  // Stock indicator
  const stockInd=(p)=>{
    if(p.stock<=10) return {color:C.danger,label:"Критически"};
    if(p.stock<=30) return {color:C.primary,label:"Мало"};
    return {color:C.success,label:"Достаточно"};
  };

  return(
    <div>
      <PageH title="Продажи">
        <Btn onClick={()=>setModal(true)} icon={<I.plus size={15}/>}>Быстрая продажа</Btn>
      </PageH>

      {/* Stock overview with indicators */}
      <Card s={{marginBottom:16}}>
        <Title>Склад готовой продукции</Title>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
          {ap.map(p=>{
            const ind=stockInd(p);
            return(
              <div key={p.id} style={{padding:"10px 14px",background:C.bg,borderRadius:8,border:`1px solid ${ind.color}25`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <span style={{fontSize:13,fontWeight:600,color:C.text}}>{p.name}</span>
                  <span style={{width:8,height:8,borderRadius:"50%",background:ind.color}}/>
                </div>
                <div style={{fontSize:18,fontWeight:800,color:ind.color}}>{p.stock} <span style={{fontSize:12,fontWeight:400}}>{p.unit}</span></div>
                <div style={{fontSize:10,color:C.dim}}>{ind.label} · {p.sellPrice} ₽/{p.unit}</div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Sales history */}
      <Card s={{padding:0,overflow:"hidden"}}>
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`}}>
          <span style={{fontSize:14,fontWeight:700,color:C.text}}>История продаж</span>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr><TH>Дата</TH><TH>Товар</TH><TH>Кол-во</TH><TH>Сумма</TH><TH>Клиент</TH><TH>Продавец</TH></tr></thead>
            <tbody>{[...sales].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).map(s=>{
              const p=products.find(x=>x.id===s.productId);
              const cl=s.clientId?clients.find(c=>c.id===s.clientId):null;
              const seller=users.find(u=>u.id===s.soldBy);
              return(
                <tr key={s.id} style={{borderBottom:`1px solid ${C.border}`}}>
                  <TD s={{fontSize:12}}>{fmtShort(s.createdAt)}</TD>
                  <TD s={{fontWeight:500}}>{p?.name||"—"}</TD>
                  <TD s={{fontWeight:600}}>{s.quantity} {p?.unit}</TD>
                  <TD s={{fontWeight:700,color:C.primary}}>{((p?.sellPrice||0)*s.quantity).toLocaleString("ru")} ₽</TD>
                  <TD s={{color:C.muted}}>{cl?.name||"Розница"}</TD>
                  <TD s={{color:C.dim,fontSize:12}}>{seller?.name?.split(" ").slice(0,2).join(" ")||"—"}</TD>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </Card>

      <Modal open={modal} onClose={()=>setModal(false)} title="Быстрая продажа" width={420}>
        <Sel label="Товар" value={form.productId} onChange={e=>setForm({...form,productId:e.target.value})} options={ap.map(p=>({value:p.id,label:`${p.name} (${p.stock} ${p.unit})`}))}/>
        {form.productId&&(()=>{const p=products.find(x=>x.id===+form.productId);const ind=p?stockInd(p):{color:C.dim};return p?<div style={{fontSize:12,color:ind.color,marginBottom:8,marginTop:-8}}>На складе: {p.stock} {p.unit} · Цена: {p.sellPrice} ₽/{p.unit}</div>:null})()}
        <Inp label="Количество" type="number" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})}/>
        <Sel label="Клиент (опционально)" value={form.clientId} onChange={e=>setForm({...form,clientId:e.target.value})} options={[{value:"",label:"Розничная продажа"},...clients.map(c=>({value:c.id,label:c.name}))]}/>
        {form.productId&&form.quantity&&+form.quantity>0&&(()=>{const p=products.find(x=>x.id===+form.productId);const total=p?(p.sellPrice*+form.quantity):0;return<div style={{fontSize:15,fontWeight:700,color:C.primary,textAlign:"right"}}>Итого: {total.toLocaleString("ru")} ₽</div>})()}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10}}><Btn v="secondary" onClick={()=>setModal(false)}>Отмена</Btn><Btn v="success" onClick={sell}>Продать</Btn></div>
      </Modal>
      {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
    </div>
  );
};


export { SalesPage };
