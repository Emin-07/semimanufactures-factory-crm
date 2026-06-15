import { useState, useEffect, useCallback, useMemo, useContext, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area } from "recharts";
import { AppContext } from "../context/AppContext.js";
import { ROLES, JOB_TITLES, PAY_TYPES, STORE_STATUSES, STORE_STATUS_LABELS, ORDER_SOURCES, ATTENDANCE_TYPES, ATTENDANCE_TYPE_COLORS, BATCH_STATUSES, DEFECT_REASONS, PAYROLL_STATUSES, CATEGORIES, UNITS, STATUSES, TASK_STATUSES, RAW_CATEGORIES, RAW_UNITS, NOTIF_TYPES, MARK_TYPES, PLAN_STATUSES, ORDER_STATUSES, ORDER_PRIORITIES, BOARD_COLUMNS, MOVEMENT_TYPES, DEBT_STATUSES, CAMERA_SOURCE_TYPES, CAMERA_SOURCE_LABELS, CAMERA_ZONES } from "../constants/index.js";
import { fmtDate, fmtShort, fmtTime, daysBetween, relTime } from "../utils/dates.js";
import { formatMoney } from "../utils/formatters.js";
import { C, CC } from "../theme/colors.js";
import { I } from "../icons/Icons.jsx";
import { EthnicBorder, EthnicCorner, Badge, Btn, Inp, Sel, Txa, Modal, Confirm, Stat, Toast, TH, TD, Card, Title, PageH, SearchBox } from "../components/ui/index.jsx";
import { GlassChartTooltip } from "../components/charts/GlassChartTooltip.jsx";

// REPORTS
const ReportsPage = ()=>{
  const {products,tasks,rawMaterials,deliveries,rawMovements}=useContext(AppContext);
  const [tab,setTab]=useState("stock");
  const ap=products.filter(p=>!p.deleted);
  const tabs=[{id:"stock",l:"Продукция"},{id:"raw",l:"Сырьё"},{id:"production",l:"Производство"},{id:"purchases",l:"Закупки"},{id:"profit",l:"Прибыль"}];

  const prodData=useMemo(()=>{
    const m={};tasks.filter(t=>t.status==="завершено").forEach(t=>{const p=products.find(x=>x.id===t.productId);const k=p?.name||"?";m[k]=(m[k]||0)+t.quantity});
    return Object.entries(m).map(([name,qty])=>({name:name.length>14?name.slice(0,14)+"\u2026":name,qty})).sort((a,b)=>b.qty-a.qty);
  },[tasks,products]);

  const rawConsumption=useMemo(()=>{
    const m={};rawMovements.filter(x=>x.type==="out").forEach(x=>{const r=rawMaterials.find(rr=>rr.id===x.rawId);const k=r?.name||"?";m[k]=(m[k]||0)+x.quantity});
    return Object.entries(m).map(([name,qty])=>({name:name.length>14?name.slice(0,14)+"\u2026":name,qty:+qty.toFixed(1)})).sort((a,b)=>b.qty-a.qty);
  },[rawMovements,rawMaterials]);

  return(
    <div>
      <PageH title="Отчёты"/>
      <div style={{display:"flex",gap:5,marginBottom:18,flexWrap:"wrap"}}>
        {tabs.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"6px 14px",borderRadius:7,border:`1px solid ${tab===t.id?C.primary:C.border}`,background:tab===t.id?C.primaryBg:C.surface,color:tab===t.id?C.primary:C.muted,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{t.l}</button>)}
      </div>
      {tab==="stock"&&<Card><Title>Остатки готовой продукции</Title>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={ap.map(p=>({name:p.name.length>14?p.name.slice(0,14)+"\u2026":p.name,stock:p.stock}))} layout="vertical" margin={{left:10}} style={{ background: "transparent" }}>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} fill="transparent"/><XAxis type="number" tick={{fill:C.dim,fontSize:10}}/><YAxis dataKey="name" type="category" width={120} tick={{fill:C.muted,fontSize:11}}/>
            <Tooltip content={<GlassChartTooltip />}/><Bar dataKey="stock" fill={C.primary} radius={[0,4,4,0]} maxBarSize={52}/>
          </BarChart>
        </ResponsiveContainer>
        <div style={{marginTop:14,overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><TH>Товар</TH><TH>Категория</TH><TH>Остаток</TH><TH>Цена</TH><TH>Стоимость</TH></tr></thead>
          <tbody>{ap.sort((a,b)=>b.stock-a.stock).map(p=>(
            <tr key={p.id} style={{borderBottom:`1px solid ${C.border}`}}><TD s={{fontWeight:500}}>{p.name}</TD><TD><Badge color="purple">{p.category}</Badge></TD><TD s={{fontWeight:600,color:p.stock<20?C.danger:C.text}}>{p.stock} {p.unit}</TD><TD s={{color:C.muted}}>{formatMoney(p.sellPrice)}</TD><TD s={{fontWeight:600,color:C.success}}>{formatMoney(p.stock*p.sellPrice)}</TD></tr>
          ))}</tbody></table></div>
      </Card>}
      {tab==="raw"&&<Card><Title>Склад сырья</Title>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={rawMaterials.map(r=>({name:r.name.length>12?r.name.slice(0,12)+"\u2026":r.name,stock:r.stock,min:r.minStock}))} style={{ background: "transparent" }}><CartesianGrid strokeDasharray="3 3" stroke={C.border} fill="transparent"/><XAxis dataKey="name" tick={{fill:C.dim,fontSize:9}}/><YAxis tick={{fill:C.dim,fontSize:10}}/><Tooltip content={<GlassChartTooltip />}/><Legend wrapperStyle={{fontSize:11}}/><Bar dataKey="stock" fill={C.info} radius={[3,3,0,0]} name="Остаток" maxBarSize={52}/><Bar dataKey="min" fill={C.danger} radius={[3,3,0,0]} name="Минимум" maxBarSize={52}/></BarChart>
        </ResponsiveContainer>
      </Card>}
      {tab==="production"&&<Card><Title>Производство по товарам</Title>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={prodData} style={{ background: "transparent" }}><CartesianGrid strokeDasharray="3 3" stroke={C.border} fill="transparent"/><XAxis dataKey="name" tick={{fill:C.dim,fontSize:10}}/><YAxis tick={{fill:C.dim,fontSize:10}}/><Tooltip content={<GlassChartTooltip />}/><Bar dataKey="qty" fill={C.success} radius={[4,4,0,0]} name="Произведено" maxBarSize={52}/></BarChart>
        </ResponsiveContainer>
        {rawConsumption.length>0&&<><Title>Расход сырья</Title>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={rawConsumption} style={{ background: "transparent" }}><CartesianGrid strokeDasharray="3 3" stroke={C.border} fill="transparent"/><XAxis dataKey="name" tick={{fill:C.dim,fontSize:10}}/><YAxis tick={{fill:C.dim,fontSize:10}}/><Tooltip content={<GlassChartTooltip />}/><Bar dataKey="qty" fill={C.danger} radius={[4,4,0,0]} name="Расход" maxBarSize={52}/></BarChart>
          </ResponsiveContainer></>}
      </Card>}
      {tab==="purchases"&&<Card><Title>Закупки</Title>
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><TH>Дата</TH><TH>Сырьё</TH><TH>Кол-во</TH><TH>Цена</TH><TH>Сумма</TH></tr></thead>
          <tbody>{[...deliveries].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(d=>{const raw=rawMaterials.find(r=>r.id===d.rawId);return(
            <tr key={d.id} style={{borderBottom:`1px solid ${C.border}`}}><TD s={{fontSize:12}}>{fmtShort(d.date)}</TD><TD s={{fontWeight:500}}>{raw?.name}</TD><TD>{d.quantity} {raw?.unit}</TD><TD s={{color:C.muted}}>{formatMoney(d.pricePerUnit)}</TD><TD s={{fontWeight:700,color:C.primary}}>{formatMoney(d.totalPrice)}</TD></tr>
          )})}</tbody></table></div>
        <div style={{marginTop:12,textAlign:"right",fontSize:15,fontWeight:700,color:C.primary}}>Итого: {formatMoney(deliveries.reduce((s,d)=>s+d.totalPrice,0))}</div>
      </Card>}
      {tab==="profit"&&<Card><Title>Прибыль по товарам</Title>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={ap.map(p=>({name:p.name.length>14?p.name.slice(0,14)+"\u2026":p.name,profit:(p.sellPrice-p.costPrice)*p.stock})).sort((a,b)=>b.profit-a.profit)} style={{ background: "transparent" }}><CartesianGrid strokeDasharray="3 3" stroke={C.border} fill="transparent"/><XAxis dataKey="name" tick={{fill:C.dim,fontSize:10}}/><YAxis tick={{fill:C.dim,fontSize:10}}/><Tooltip content={<GlassChartTooltip unit="money" />}/><Bar dataKey="profit" fill={C.success} radius={[4,4,0,0]} name="Прибыль" maxBarSize={52}/></BarChart>
        </ResponsiveContainer>
        <div style={{marginTop:14,overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><TH>Товар</TH><TH>Себестоимость</TH><TH>Цена</TH><TH>Маржа</TH><TH>Прибыль</TH></tr></thead>
          <tbody>{ap.sort((a,b)=>(b.sellPrice-b.costPrice)*b.stock-(a.sellPrice-a.costPrice)*a.stock).map(p=>(
            <tr key={p.id} style={{borderBottom:`1px solid ${C.border}`}}><TD s={{fontWeight:500}}>{p.name}</TD><TD s={{color:C.muted}}>{formatMoney(p.costPrice)}</TD><TD>{formatMoney(p.sellPrice)}</TD><TD><Badge color="primary">{((p.sellPrice-p.costPrice)/p.costPrice*100).toFixed(0)}%</Badge></TD><TD s={{fontWeight:700,color:C.success}}>{formatMoney((p.sellPrice-p.costPrice)*p.stock)}</TD></tr>
          ))}</tbody></table></div>
      </Card>}
    </div>
  );
};


export { ReportsPage };
