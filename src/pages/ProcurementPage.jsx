import { useState, useEffect, useCallback, useMemo, useContext, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area } from "recharts";
import { AppContext } from "../context/AppContext.js";
import { ROLES, JOB_TITLES, PAY_TYPES, STORE_STATUSES, STORE_STATUS_LABELS, ORDER_SOURCES, ATTENDANCE_TYPES, ATTENDANCE_TYPE_COLORS, BATCH_STATUSES, DEFECT_REASONS, PAYROLL_STATUSES, CATEGORIES, UNITS, STATUSES, TASK_STATUSES, RAW_CATEGORIES, RAW_UNITS, NOTIF_TYPES, MARK_TYPES, PLAN_STATUSES, ORDER_STATUSES, ORDER_PRIORITIES, BOARD_COLUMNS, MOVEMENT_TYPES, DEBT_STATUSES, CAMERA_SOURCE_TYPES, CAMERA_SOURCE_LABELS, CAMERA_ZONES } from "../constants/index.js";
import { fmtDate, fmtShort, fmtTime, daysBetween, relTime } from "../utils/dates.js";
import { formatMoney } from "../utils/formatters.js";
import { C, CC } from "../theme/colors.js";
import { I } from "../icons/Icons.jsx";
import { EthnicBorder, EthnicCorner, Badge, Btn, Inp, Sel, Txa, Modal, Confirm, Stat, Toast, TH, TD, Card, Title, PageH, SearchBox } from "../components/ui/index.jsx";

// PROCUREMENT (Auto-calculated purchase recommendations)
const ProcurementPage = ()=>{
  const {productionPlans,products,rawMaterials,recipes}=useContext(AppContext);

  // Only future/active plans
  const activePlans=productionPlans.filter(p=>p.status==="запланирован"||p.status==="в процессе");

  // Calculate total raw materials needed
  const procurement=useMemo(()=>{
    const needs={};
    activePlans.forEach(plan=>{
      const recipe=recipes.find(r=>r.productId===plan.productId);
      if(!recipe) return;
      const remaining=plan.plannedQty-plan.completedQty;
      if(remaining<=0) return;
      recipe.items.forEach(it=>{
        if(!needs[it.rawId]) needs[it.rawId]={needed:0,rawId:it.rawId};
        needs[it.rawId].needed+=it.qty*remaining;
      });
    });
    return Object.values(needs).map(n=>{
      const raw=rawMaterials.find(r=>r.id===n.rawId);
      const needed=+n.needed.toFixed(2);
      const available=raw?.stock||0;
      const toOrder=Math.max(0,+(needed-available).toFixed(2));
      const estCost=toOrder*(raw?.costPerUnit||0);
      return{rawId:n.rawId,name:raw?.name||"?",category:raw?.category||"",unit:raw?.unit||"",needed,available,toOrder,estCost,shortage:toOrder>0};
    }).sort((a,b)=>b.toOrder-a.toOrder);
  },[activePlans,recipes,rawMaterials]);

  const totalCost=procurement.reduce((s,p)=>s+p.estCost,0);
  const shortages=procurement.filter(p=>p.shortage);

  // Breakdown by plan
  const planBreakdown=activePlans.map(plan=>{
    const prod=products.find(p=>p.id===plan.productId);
    const recipe=recipes.find(r=>r.productId===plan.productId);
    const remaining=plan.plannedQty-plan.completedQty;
    const items=recipe?recipe.items.map(it=>{const raw=rawMaterials.find(r=>r.id===it.rawId);return{name:raw?.name||"?",qty:+(it.qty*remaining).toFixed(2),unit:raw?.unit||""};}):[];
    return{id:plan.id,product:prod?.name||"?",date:plan.productionDate,remaining,items,unit:prod?.unit||""};
  });

  return(
    <div>
      <PageH title="Рекомендации по закупкам"/>

      {/* Alerts */}
      {shortages.length>0&&(
        <div style={{background:C.dangerBg,border:`1px solid rgba(196,78,61,.2)`,borderRadius:10,padding:"12px 16px",marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><I.alert size={16}/><span style={{fontSize:14,fontWeight:700,color:C.danger}}>Нужно заказать ({shortages.length} позиций):</span></div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {shortages.map(s=><Badge key={s.rawId} color="danger">{s.name} — {s.toOrder} {s.unit}</Badge>)}
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div style={{display:"flex",flexWrap:"wrap",gap:12,marginBottom:18}}>
        <Stat icon={<I.tasks size={18}/>} label="Активных планов" value={activePlans.length} color={C.info}/>
        <Stat icon={<I.raw size={18}/>} label="Позиций сырья" value={procurement.length} color={C.primary}/>
        <Stat icon={<I.alert size={18}/>} label="Нехватка" value={shortages.length} color={shortages.length>0?C.danger:C.success}/>
        <Stat icon={<I.star size={18}/>} label="Ориент. стоимость" value={formatMoney(totalCost, { compact: true })} color={C.primary}/>
      </div>

      {/* Main procurement table */}
      <Card s={{padding:0,overflow:"hidden",marginBottom:16}}>
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`}}>
          <span style={{fontSize:14,fontWeight:700,color:C.text}}>Сводная таблица закупок</span>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr><TH>Сырьё</TH><TH>Категория</TH><TH>Нужно</TH><TH>На складе</TH><TH>Заказать</TH><TH>Ориент. цена</TH></tr></thead>
            <tbody>{procurement.map(p=>(
              <tr key={p.rawId} style={{borderBottom:`1px solid ${C.border}`,background:p.shortage?C.dangerBg:"transparent"}}>
                <TD s={{fontWeight:500}}>{p.name} {p.shortage&&<Badge color="danger" s={{marginLeft:4}}>!</Badge>}</TD>
                <TD><Badge color="purple">{p.category}</Badge></TD>
                <TD s={{fontWeight:600}}>{p.needed} {p.unit}</TD>
                <TD s={{color:p.shortage?C.danger:C.text}}>{p.available} {p.unit}</TD>
                <TD s={{fontWeight:700,color:p.shortage?C.danger:C.success}}>{p.toOrder>0?p.toOrder:"\u2713"} {p.toOrder>0?p.unit:""}</TD>
                <TD s={{color:C.muted}}>{p.estCost>0?`${p.estCost.toLocaleString("ru")}₽`:"\u2014"}</TD>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>

      {/* Plan breakdown */}
      <Card>
        <Title>Расход по планам</Title>
        {planBreakdown.map(pb=>(
          <div key={pb.id} style={{marginBottom:14,padding:12,background:C.bg,borderRadius:8,border:`1px solid ${C.border}`}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <span style={{fontSize:13,fontWeight:600,color:C.text}}>{pb.product} — {pb.remaining} {pb.unit}</span>
              <span style={{fontSize:11,color:C.dim}}>{pb.date}</span>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {pb.items.map((it,i)=><Badge key={i} color="info" s={{fontSize:11}}>{it.name}: {it.qty} {it.unit}</Badge>)}
            </div>
          </div>
        ))}
        {planBreakdown.length===0&&<div style={{textAlign:"center",padding:20,color:C.dim,fontSize:13}}>Нет активных планов</div>}
      </Card>
    </div>
  );
};


export { ProcurementPage };
