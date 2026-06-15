import { useState, useEffect, useCallback, useMemo, useContext, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area } from "recharts";
import { AppContext } from "../context/AppContext.js";
import { ROLES, JOB_TITLES, PAY_TYPES, STORE_STATUSES, STORE_STATUS_LABELS, ORDER_SOURCES, ATTENDANCE_TYPES, ATTENDANCE_TYPE_COLORS, BATCH_STATUSES, DEFECT_REASONS, PAYROLL_STATUSES, CATEGORIES, UNITS, STATUSES, TASK_STATUSES, RAW_CATEGORIES, RAW_UNITS, NOTIF_TYPES, MARK_TYPES, PLAN_STATUSES, ORDER_STATUSES, ORDER_PRIORITIES, BOARD_COLUMNS, MOVEMENT_TYPES, DEBT_STATUSES, CAMERA_SOURCE_TYPES, CAMERA_SOURCE_LABELS, CAMERA_ZONES } from "../constants/index.js";
import { fmtDate, fmtShort, fmtTime, daysBetween, relTime } from "../utils/dates.js";
import { C, CC } from "../theme/colors.js";
import { I } from "../icons/Icons.jsx";
import { EthnicBorder, EthnicCorner, Badge, Btn, Inp, Sel, Txa, Modal, Confirm, Stat, Toast, TH, TD, Card, Title, PageH, SearchBox } from "../components/ui/index.jsx";

// RAW MATERIALS
const RawMaterialsPage = ()=>{
  const {rawMaterials,setRawMaterials,rawMovements,addLog}=useContext(AppContext);
  const [modal,setModal]=useState(false);
  const [histModal,setHistModal]=useState(null);
  const [edit,setEdit]=useState(null);
  const [toast,setToast]=useState(null);
  const [search,setSearch]=useState("");
  const [errs,setErrs]=useState({});
  const empty={name:"",category:RAW_CATEGORIES[0],unit:"кг",stock:"",minStock:"",costPerUnit:""};
  const [form,setForm]=useState(empty);

  const filtered=rawMaterials.filter(r=>r.name.toLowerCase().includes(search.toLowerCase()));
  const openNew=()=>{setEdit(null);setForm(empty);setErrs({});setModal(true)};
  const openEdit=r=>{setEdit(r);setForm({name:r.name,category:r.category,unit:r.unit,stock:r.stock,minStock:r.minStock,costPerUnit:r.costPerUnit});setErrs({});setModal(true)};
  const validate=()=>{const e={};if(!form.name.trim())e.name="!";if(form.stock===""||+form.stock<0)e.stock="!";if(!form.costPerUnit||+form.costPerUnit<=0)e.costPerUnit="!";setErrs(e);return!Object.keys(e).length};
  const save=()=>{if(!validate())return;const now=new Date().toISOString();if(edit){setRawMaterials(p=>p.map(r=>r.id===edit.id?{...r,...form,stock:+form.stock,minStock:+form.minStock,costPerUnit:+form.costPerUnit,updatedAt:now}:r));addLog(`Сырьё обновлено: ${form.name}`);setToast({message:"Обновлено",type:"success"})}else{setRawMaterials(p=>[...p,{id:Date.now(),...form,stock:+form.stock,minStock:+form.minStock,costPerUnit:+form.costPerUnit,updatedAt:now}]);addLog(`Сырьё добавлено: ${form.name}`);setToast({message:"Добавлено",type:"success"})}setModal(false)};

  return(
    <div>
      <PageH title="Склад сырья"><SearchBox value={search} onChange={e=>setSearch(e.target.value)}/><Btn onClick={openNew} icon={<I.plus size={15}/>}>Добавить</Btn></PageH>
      <Card s={{padding:0,overflow:"hidden"}}><div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><TH>Название</TH><TH>Категория</TH><TH>Остаток</TH><TH>Мин.</TH><TH>Цена/ед</TH><TH>Стоимость</TH><TH></TH></tr></thead>
          <tbody>{filtered.map(r=>{const low=r.stock<=r.minStock;return(
            <tr key={r.id} style={{borderBottom:`1px solid ${C.border}`,background:low?C.dangerBg:"transparent"}}>
              <TD s={{fontWeight:500}}>{r.name} {low&&<Badge color="danger" s={{marginLeft:6}}>!</Badge>}</TD>
              <TD><Badge color="purple">{r.category}</Badge></TD>
              <TD s={{fontWeight:600,color:low?C.danger:C.text}}>{r.stock} {r.unit}</TD>
              <TD s={{color:C.dim}}>{r.minStock}</TD>
              <TD s={{color:C.muted}}>{r.costPerUnit}₽</TD>
              <TD s={{fontWeight:600,color:C.success}}>{(r.stock*r.costPerUnit).toLocaleString("ru")}₽</TD>
              <TD><div style={{display:"flex",gap:4}}>
                <Btn v="ghost" sz="sm" onClick={()=>setHistModal(r.id)} icon={<I.clock size={14}/>}/>
                <Btn v="ghost" sz="sm" onClick={()=>openEdit(r)} icon={<I.edit size={14}/>}/>
              </div></TD>
            </tr>)})}</tbody>
        </table></div></Card>

      <Modal open={modal} onClose={()=>setModal(false)} title={edit?"Редактировать":"Новое сырьё"}>
        <Inp label="Название" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} error={errs.name}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
          <Sel label="Категория" value={form.category} onChange={e=>setForm({...form,category:e.target.value})} options={RAW_CATEGORIES.map(c=>({value:c,label:c}))}/>
          <Sel label="Ед. изм." value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})} options={RAW_UNITS.map(u=>({value:u,label:u}))}/>
          <Inp label="Остаток" type="number" value={form.stock} onChange={e=>setForm({...form,stock:e.target.value})} error={errs.stock}/>
          <Inp label="Мин. остаток" type="number" value={form.minStock} onChange={e=>setForm({...form,minStock:e.target.value})}/>
          <Inp label="Цена за ед." type="number" value={form.costPerUnit} onChange={e=>setForm({...form,costPerUnit:e.target.value})} error={errs.costPerUnit} cStyle={{gridColumn:"1/3"}}/>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:6}}><Btn v="secondary" onClick={()=>setModal(false)}>Отмена</Btn><Btn onClick={save}>{edit?"Сохранить":"Добавить"}</Btn></div>
      </Modal>

      <Modal open={!!histModal} onClose={()=>setHistModal(null)} title="История движения" width={480}>
        {histModal&&(()=>{
          const moves=rawMovements.filter(m=>m.rawId===histModal).sort((a,b)=>new Date(b.date)-new Date(a.date));
          const raw=rawMaterials.find(r=>r.id===histModal);
          return(<div>
            <p style={{color:C.muted,fontSize:13,marginBottom:10}}>{raw?.name}</p>
            {moves.length===0?<p style={{color:C.dim}}>Нет записей</p>:moves.map((m,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:`1px solid ${C.border}`}}>
                <Badge color={m.type==="in"?"success":"danger"}>{m.type==="in"?"+":"-"}{m.quantity}</Badge>
                <div style={{flex:1}}><div style={{fontSize:12,color:C.text}}>{m.reason}</div><div style={{fontSize:11,color:C.dim}}>{fmtDate(m.date)}</div></div>
              </div>
            ))}
          </div>);
        })()}
      </Modal>
      {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
    </div>
  );
};


export { RawMaterialsPage };
