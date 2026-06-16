import { useState, useEffect, useCallback, useMemo, useContext, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area } from "recharts";
import { AppContext } from "../context/AppContext.js";
import { ROLES, JOB_TITLES, PAY_TYPES, STORE_STATUSES, STORE_STATUS_LABELS, ORDER_SOURCES, ATTENDANCE_TYPES, ATTENDANCE_TYPE_COLORS, BATCH_STATUSES, DEFECT_REASONS, PAYROLL_STATUSES, CATEGORIES, UNITS, STATUSES, TASK_STATUSES, RAW_CATEGORIES, RAW_UNITS, NOTIF_TYPES, MARK_TYPES, PLAN_STATUSES, ORDER_STATUSES, ORDER_PRIORITIES, BOARD_COLUMNS, MOVEMENT_TYPES, DEBT_STATUSES, CAMERA_SOURCE_TYPES, CAMERA_SOURCE_LABELS, CAMERA_ZONES } from "../constants/index.js";
import { fmtDate, fmtShort, fmtTime, daysBetween, relTime } from "../utils/dates.js";
import { C, CC } from "../theme/colors.js";
import { I } from "../icons/Icons.jsx";
import { EthnicBorder, EthnicCorner, Badge, Btn, Inp, Sel, Txa, Modal, Confirm, Stat, Toast, TH, TD, Card, Title, PageH, SearchBox } from "../components/ui/index.jsx";

// DEFECTS PAGE — Брак и списания
const DefectsPage = ()=>{
  const {defects,setDefects,users,products,setProducts,batches,setBatches,inventoryMovements,setInventoryMovements,currentUser,addLog}=useContext(AppContext);
  const role=ROLES.find(r=>r.id===currentUser.roleId);
  const isAdmin=role?.name==="admin"||role?.name==="owner";
  const workers=users.filter(u=>u.status==="active"&&u.roleId===3&&!u.deleted);
  const ap=products.filter(p=>!p.deleted);

  const [modal,setModal]=useState(false);
  const [confirm,setConfirm]=useState(null);
  const [toast,setToast]=useState(null);
  const [fEmp,setFEmp]=useState("all");
  const [fProd,setFProd]=useState("all");
  const [errs,setErrs]=useState({});

  const emptyForm={employeeId:"",productId:"",batchId:"",quantity:"",reason:"",affectsStock:true,date:new Date().toISOString().slice(0,10),comment:""};
  const [form,setForm]=useState(emptyForm);

  const filtered=useMemo(()=>{
    let l=[...(defects||[])];
    if(fEmp!=="all") l=l.filter(d=>d.employeeId===+fEmp);
    if(fProd!=="all") l=l.filter(d=>d.productId===+fProd);
    return l.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  },[defects,fEmp,fProd]);

  const totalQtyStocked=filtered.filter(d=>d.affectsStock).reduce((s,d)=>s+d.quantity,0);
  const totalQtyAll=filtered.reduce((s,d)=>s+d.quantity,0);

  const validate=()=>{
    const e={};
    if(!form.productId) e.productId="!";
    if(!form.quantity||+form.quantity<=0) e.quantity="> 0";
    if(!form.reason) e.reason="!";
    setErrs(e);return!Object.keys(e).length;
  };

  const save=()=>{
    if(!validate()) return;
    const now=new Date().toISOString();
    const id=Date.now();
    const qty=+form.quantity;
    const prodId=+form.productId;
    const batchId=form.batchId?+form.batchId:null;
    const prod=ap.find(p=>p.id===prodId);
    const emp=form.employeeId?users.find(u=>u.id===+form.employeeId):null;
    const affectsStock=!!form.affectsStock;

    setDefects(p=>[...(p||[]),{id,employeeId:form.employeeId?+form.employeeId:null,productId:prodId,batchId,quantity:qty,reason:form.reason,affectsStock,date:form.date,comment:form.comment,createdBy:currentUser.id,createdAt:now}]);

    if(affectsStock){
      // Deduct from product stock
      setProducts(p=>p.map(x=>x.id===prodId?{...x,stock:Math.max(0,x.stock-qty),updatedAt:now}:x));
      // Create write-off movement
      setInventoryMovements(p=>[...(p||[]),{id:id+0.1,productId:prodId,type:"списание-брак",quantity:qty,balance:0,refId:`defect-${id}`,createdAt:now}]);
      // Deduct from batch if specified
      if(batchId){
        setBatches(p=>(p||[]).map(b=>{
          if(b.id!==batchId) return b;
          const nq=Math.max(0,b.quantity-qty);
          return{...b,quantity:nq,status:nq<=0?"списана":b.status,updatedAt:now};
        }));
      }
    }

    addLog(`Брак${affectsStock?" (со склада)":""}: ${prod?.name||"?"} ${qty}ед.${emp?" — "+emp.name.split(" ")[0]:""}`);
    setToast({message:affectsStock?"Брак записан, склад скорректирован":"Брак записан (без списания)",type:"success"});
    setModal(false);setForm(emptyForm);setErrs({});
  };

  const doDelete=d=>{
    setDefects(p=>(p||[]).filter(x=>x.id!==d.id));
    const prod=ap.find(p=>p.id===d.productId);
    addLog(`Удалён брак: ${prod?.name||"?"}`);
    setToast({message:"Удалено",type:"error"});
    setConfirm(null);
  };

  const prodBatches=(form.productId?(batches||[]).filter(b=>b.productId===+form.productId&&b.status==="активна"):[]);
  const selStyle={padding:"7px 9px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,fontSize:12,fontFamily:"inherit"};

  return(
    <div>
      <PageH title="Брак и списания">
        <select value={fEmp} onChange={e=>setFEmp(e.target.value)} style={selStyle}>
          <option value="all">Все сотрудники</option>
          {workers.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <select value={fProd} onChange={e=>setFProd(e.target.value)} style={selStyle}>
          <option value="all">Все товары</option>
          {ap.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {isAdmin&&<Btn onClick={()=>{setForm(emptyForm);setErrs({});setModal(true)}} icon={<I.plus size={15}/>}>Записать брак</Btn>}
      </PageH>

      <div style={{display:"flex",flexWrap:"wrap",gap:12,marginBottom:16}}>
        <Stat icon={<I.alert size={18}/>} label="Всего записей" value={(defects||[]).length} color={C.orange}/>
        <Stat icon={<I.trash size={18}/>} label="Ед. брака (фильтр)" value={totalQtyAll} color={C.danger}/>
        {totalQtyStocked>0&&<Stat icon={<I.box size={18}/>} label="Списано со склада" value={totalQtyStocked} color={C.danger}/>}
      </div>

      <div style={{display:"grid",gap:8}}>
        {filtered.map(d=>{
          const prod=ap.find(p=>p.id===d.productId);
          const emp=d.employeeId?users.find(u=>u.id===d.employeeId):null;
          const batch=d.batchId?(batches||[]).find(b=>b.id===d.batchId):null;
          return(
            <Card key={d.id} s={{borderLeft:`3px solid ${d.affectsStock?C.danger:C.orange}`}}>
              <div style={{display:"flex",flexWrap:"wrap",gap:12,alignItems:"center"}}>
                <div style={{flex:"1 1 200px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                    <span style={{fontSize:14,fontWeight:700,color:C.text}}>{prod?.name||"—"}</span>
                    <Badge color="danger" s={{fontSize:10}}>{d.reason}</Badge>
                    {d.affectsStock
                      ?<Badge color="danger" s={{fontSize:9}}>склад−</Badge>
                      :<Badge color="orange" s={{fontSize:9}}>только журнал</Badge>}
                  </div>
                  {emp&&<div style={{fontSize:12,color:C.muted}}>Сотрудник: {emp.name}</div>}
                  <div style={{fontSize:11,color:C.dim}}>{fmtShort(d.date)}{batch&&` · Партия ${batch.quantity>0?batch.quantity+"ед.":""}`}</div>
                  {d.comment&&<div style={{fontSize:11,color:C.dim,fontStyle:"italic"}}>{d.comment}</div>}
                </div>
                <div style={{textAlign:"center",minWidth:60}}>
                  <div style={{fontSize:20,fontWeight:800,color:d.affectsStock?C.danger:C.orange}}>{d.quantity}</div>
                  <div style={{fontSize:10,color:C.dim}}>ед.</div>
                </div>
                {isAdmin&&<Btn v="ghost" sz="sm" onClick={()=>setConfirm({title:"Удалить запись?",message:`${prod?.name||"?"} — ${d.quantity} ед.`,onConfirm:()=>doDelete(d)})} icon={<I.trash size={13}/>}/>}
              </div>
            </Card>
          );
        })}
        {filtered.length===0&&<div style={{textAlign:"center",padding:50,color:C.dim}}>Нет записей о браке</div>}
      </div>

      <Modal open={modal} onClose={()=>setModal(false)} title="Записать брак" width={460}>
        <Sel label="Товар" value={form.productId} onChange={e=>setForm({...form,productId:e.target.value,batchId:""})} error={errs.productId} options={[{value:"",label:"Выберите"},...ap.map(p=>({value:p.id,label:p.name}))]}/>
        {prodBatches.length>0&&(
          <Sel label="Партия" value={form.batchId} onChange={e=>setForm({...form,batchId:e.target.value})} options={[{value:"",label:"Не указана"},...prodBatches.map(b=>({value:b.id,label:`#${b.id} — ${b.quantity}ед. от ${fmtShort(b.producedAt)}`}))]}/>
        )}
        <Sel label="Сотрудник" value={form.employeeId} onChange={e=>setForm({...form,employeeId:e.target.value})} options={[{value:"",label:"Не указан"},...workers.map(w=>({value:w.id,label:w.name}))]}/>
        <Inp label="Количество (ед.)" type="number" min="1" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} error={errs.quantity}/>
        <Sel label="Причина" value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})} error={errs.reason} options={[{value:"",label:"Выберите"},...DEFECT_REASONS.map(r=>({value:r,label:r}))]}/>
        <Inp label="Дата" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
        <Txa label="Комментарий" value={form.comment} onChange={e=>setForm({...form,comment:e.target.value})}/>
        <div style={{display:"flex",alignItems:"center",gap:10,marginTop:8,padding:"10px 12px",background:form.affectsStock?C.dangerBg:C.bg,borderRadius:8,border:`1px solid ${form.affectsStock?C.danger+"30":C.border}`}}>
          <input type="checkbox" id="affectsStockChk" checked={!!form.affectsStock} onChange={e=>setForm({...form,affectsStock:e.target.checked})} style={{accentColor:C.danger,cursor:"pointer",width:16,height:16}}/>
          <label htmlFor="affectsStockChk" style={{fontSize:13,color:form.affectsStock?C.danger:C.muted,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>
            Списать со склада (уменьшить остаток товара)
          </label>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:10}}>
          <Btn v="secondary" onClick={()=>setModal(false)}>Отмена</Btn>
          <Btn v="danger" onClick={save}>Записать</Btn>
        </div>
      </Modal>

      {confirm&&<Confirm open={!!confirm} onClose={()=>setConfirm(null)} title={confirm.title} message={confirm.message} onConfirm={confirm.onConfirm}/>}
      {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
    </div>
  );
};


export { DefectsPage };
