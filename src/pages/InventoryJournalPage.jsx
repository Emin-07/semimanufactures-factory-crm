import { useState, useEffect, useCallback, useMemo, useContext, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area } from "recharts";
import { AppContext } from "../context/AppContext.js";
import { ROLES, JOB_TITLES, PAY_TYPES, STORE_STATUSES, STORE_STATUS_LABELS, ORDER_SOURCES, ATTENDANCE_TYPES, ATTENDANCE_TYPE_COLORS, BATCH_STATUSES, DEFECT_REASONS, PAYROLL_STATUSES, CATEGORIES, UNITS, STATUSES, TASK_STATUSES, RAW_CATEGORIES, RAW_UNITS, NOTIF_TYPES, MARK_TYPES, PLAN_STATUSES, ORDER_STATUSES, ORDER_PRIORITIES, BOARD_COLUMNS, MOVEMENT_TYPES, DEBT_STATUSES, CAMERA_SOURCE_TYPES, CAMERA_SOURCE_LABELS, CAMERA_ZONES } from "../constants/index.js";
import { fmtDate, fmtShort, fmtTime, daysBetween, relTime } from "../utils/dates.js";
import { C, CC } from "../theme/colors.js";
import { I } from "../icons/Icons.jsx";
import { EthnicBorder, EthnicCorner, Badge, Btn, Inp, Sel, Txa, Modal, Confirm, Stat, Toast, TH, TD, Card, Title, PageH, SearchBox } from "../components/ui/index.jsx";

// INVENTORY MOVEMENTS JOURNAL
const InventoryJournalPage = ()=>{
  const {inventoryMovements,products}=useContext(AppContext);
  const [fProduct,setFProduct]=useState("all");
  const [fType,setFType]=useState("all");
  const ap=products.filter(p=>!p.deleted);

  const filtered=useMemo(()=>{
    let list=[...inventoryMovements];
    if(fProduct!=="all") list=list.filter(m=>m.productId===+fProduct);
    if(fType!=="all") list=list.filter(m=>m.type===fType);
    return list.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  },[inventoryMovements,fProduct,fType]);

  return(
    <div>
      <PageH title="Движение товаров">
        <select value={fProduct} onChange={e=>setFProduct(e.target.value)} style={{padding:"7px 9px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,fontSize:12,fontFamily:"inherit"}}>
          <option value="all">Все товары</option>
          {ap.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={fType} onChange={e=>setFType(e.target.value)} style={{padding:"7px 9px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,fontSize:12,fontFamily:"inherit"}}>
          <option value="all">Все типы</option>
          {Object.entries(MOVEMENT_TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
      </PageH>
      <Card s={{padding:0,overflow:"hidden"}}><div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr><TH>Дата</TH><TH>Товар</TH><TH>Операция</TH><TH>Количество</TH><TH>Остаток</TH><TH>Ссылка</TH></tr></thead>
          <tbody>{filtered.map(m=>{
            const p=products.find(x=>x.id===m.productId);
            const isPlus=m.quantity>0;
            return(
              <tr key={m.id} style={{borderBottom:`1px solid ${C.border}`}}>
                <TD s={{fontSize:12,whiteSpace:"nowrap"}}>{fmtDate(m.createdAt)}</TD>
                <TD s={{fontWeight:500}}>{p?.name||"—"}</TD>
                <TD><Badge color={isPlus?"success":"danger"}>{MOVEMENT_TYPES[m.type]||m.type}</Badge></TD>
                <TD s={{fontWeight:700,color:isPlus?C.success:C.danger}}>{isPlus?"+":""}{m.quantity} {p?.unit||""}</TD>
                <TD s={{fontWeight:600}}>{m.balance} {p?.unit||""}</TD>
                <TD s={{color:C.dim,fontSize:11}}>{m.refId}</TD>
              </tr>
            );
          })}</tbody>
        </table>
      </div></Card>
      {filtered.length===0&&<div style={{textAlign:"center",padding:50,color:C.dim}}><I.file size={36}/><p style={{marginTop:10}}>Нет записей</p></div>}
    </div>
  );
};


export { InventoryJournalPage };
