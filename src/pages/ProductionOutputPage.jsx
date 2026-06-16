import { useState, useEffect, useCallback, useMemo, useContext, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area } from "recharts";
import { AppContext } from "../context/AppContext.js";
import { ROLES, JOB_TITLES, PAY_TYPES, STORE_STATUSES, STORE_STATUS_LABELS, ORDER_SOURCES, ATTENDANCE_TYPES, ATTENDANCE_TYPE_COLORS, BATCH_STATUSES, DEFECT_REASONS, PAYROLL_STATUSES, CATEGORIES, UNITS, STATUSES, TASK_STATUSES, RAW_CATEGORIES, RAW_UNITS, NOTIF_TYPES, MARK_TYPES, PLAN_STATUSES, ORDER_STATUSES, ORDER_PRIORITIES, BOARD_COLUMNS, MOVEMENT_TYPES, DEBT_STATUSES, CAMERA_SOURCE_TYPES, CAMERA_SOURCE_LABELS, CAMERA_ZONES } from "../constants/index.js";
import { fmtDate, fmtShort, fmtTime, daysBetween, relTime } from "../utils/dates.js";
import { C, CC } from "../theme/colors.js";
import { I } from "../icons/Icons.jsx";
import { EthnicBorder, EthnicCorner, Badge, Btn, Inp, Sel, Txa, Modal, Confirm, Stat, Toast, TH, TD, Card, Title, PageH, SearchBox } from "../components/ui/index.jsx";

// PRODUCTION OUTPUT PAGE
const ProductionOutputPage = ()=>{
  const {productionOutputs,setProductionOutputs,products,users,currentUser,addLog,addNotification,recipes,rawMaterials,setBatches,applyOutput,revertOutput,applyServerState}=useContext(AppContext);
  const role=ROLES.find(r=>r.id===currentUser.roleId);
  const isWorker=role?.name==="worker";
  const workers=users.filter(u=>u.roleId===3&&u.status==="active"&&!u.deleted);
  const ap=products.filter(p=>!p.deleted);

  const [modal,setModal]=useState(false);
  const [edit,setEdit]=useState(null);
  const [confirm,setConfirm]=useState(null);
  const [toast,setToast]=useState(null);
  const [search,setSearch]=useState("");
  const [fEmp,setFEmp]=useState("all");
  const [errs,setErrs]=useState({});

  const emptyForm={
    employeeId:isWorker?currentUser.id:(workers[0]?.id||""),
    productId:ap[0]?.id||"",
    quantity:"",
    date:new Date().toISOString().slice(0,16),
    comment:""
  };
  const [form,setForm]=useState(emptyForm);

  const list=useMemo(()=>{
    let l=[...(productionOutputs||[])];
    // Worker sees only their own records
    if(isWorker) l=l.filter(o=>o.employeeId===currentUser.id);
    else if(fEmp!=="all") l=l.filter(o=>o.employeeId===+fEmp);
    if(search){
      const s=search.toLowerCase();
      l=l.filter(o=>{
        const p=products.find(x=>x.id===o.productId);
        const u=users.find(x=>x.id===o.employeeId);
        return p?.name.toLowerCase().includes(s)||u?.name.toLowerCase().includes(s)||o.comment?.toLowerCase().includes(s);
      });
    }
    return l.sort((a,b)=>new Date(b.date)-new Date(a.date));
  },[productionOutputs,fEmp,search,products,users,isWorker,currentUser]);

  const openNew=()=>{setEdit(null);setForm(emptyForm);setErrs({});setModal(true)};
  const openEdit=(o)=>{
    setEdit(o);
    setForm({employeeId:o.employeeId,productId:o.productId,quantity:o.quantity,date:o.date.slice(0,16),comment:o.comment||""});
    setErrs({});setModal(true);
  };

  const validate=()=>{
    const e={};
    if(!form.employeeId) e.employeeId="!";
    if(!form.productId) e.productId="!";
    if(!form.quantity||+form.quantity<=0) e.quantity="Укажите > 0";
    if(!form.date) e.date="!";
    setErrs(e);return!Object.keys(e).length;
  };

  // applyOutput and revertOutput are provided via AppContext (defined in App())

  const save=async()=>{
    if(!validate()) return;
    const qty=+form.quantity;const productId=+form.productId;const employeeId=+form.employeeId;
    const now=new Date().toISOString();
    const curStock=products.find(p=>p.id===productId)?.stock||0;
    const prod=products.find(p=>p.id===productId);
    const emp=users.find(u=>u.id===employeeId);
    if(edit){
      // Edit is only accessible to manager/admin (workers see no edit button)
      const stockBefore=edit.productId===productId?Math.max(0,curStock-edit.quantity):curStock;
      revertOutput(edit);
      const newOut={...edit,productId,employeeId,quantity:qty,date:new Date(form.date).toISOString(),comment:form.comment,updatedAt:now};
      setProductionOutputs(p=>p.map(o=>o.id===edit.id?newOut:o));
      applyOutput(newOut,stockBefore);
      addLog(`Выпуск изменён: ${prod?.name} x${qty} → ${emp?.name?.split(" ").slice(0,2).join(" ")}`);
      setToast({message:"Запись обновлена",type:"success"});
    } else if(isWorker){
      // ── Worker path: server action endpoint ──
      // Workers cannot write manager-only keys, so delegate all derived updates.
      try{
        const r=await fetch("/api/actions/output-record",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({productId,employeeId,quantity:qty,date:form.date,comment:form.comment}),
        });
        const data=await r.json();
        if(!r.ok){setToast({message:data.error||"Ошибка сервера",type:"error"});return;}
        applyServerState(data.state);
        setToast({message:"Выпуск зафиксирован!",type:"success"});
      }catch(e){
        setToast({message:"Нет соединения с сервером",type:"error"});return;
      }
    } else {
      // ── Manager / Admin path (unchanged) ──
      const id=Date.now();
      const batchId=id+0.5;
      const expiresAt=new Date(new Date(form.date).getTime()+7*24*3600*1000).toISOString();
      // source:"manual" — one output, one batch, no taskId
      const newOut={id,productId,employeeId,quantity:qty,date:new Date(form.date).toISOString(),comment:form.comment,source:"manual",taskId:null,batchId,createdAt:now,createdBy:currentUser.id};
      setProductionOutputs(p=>[...(p||[]),newOut]);
      setBatches(p=>[...(p||[]),{id:batchId,productId,quantity:qty,producedAt:new Date(form.date).toISOString(),expiresAt,createdBy:currentUser.id,status:"активна",note:form.comment||"",taskId:null}]);
      applyOutput(newOut,curStock);
      // Batch created above; applyOutput handles stock/raw/movements/history/plans
      addLog(`Выпуск: ${prod?.name} x${qty} → ${emp?.name?.split(" ").slice(0,2).join(" ")}`);
      addNotification({title:`Выпуск: ${prod?.name} x${qty}`,type:"информация",content:`${emp?.name?.split(" ").slice(0,2).join(" ")} зафиксировал выпуск ${prod?.name} — ${qty} ${prod?.unit}`,targetAll:true});
      setToast({message:"Выпуск зафиксирован!",type:"success"});
    }
    setModal(false);
  };

  const doDelete=(o)=>{
    revertOutput(o);
    setProductionOutputs(p=>(p||[]).filter(x=>x.id!==o.id));
    const prod=products.find(p=>p.id===o.productId);
    addLog(`Выпуск удалён: ${prod?.name} x${o.quantity}`);
    setToast({message:"Запись удалена",type:"error"});
    setConfirm(null);
  };

  const totalQty=(productionOutputs||[]).reduce((s,o)=>s+o.quantity,0);
  const todayStr=new Date().toISOString().slice(0,10);
  const todayQty=(productionOutputs||[]).filter(o=>(o.date||"").startsWith(todayStr)).reduce((s,o)=>s+o.quantity,0);
  const selectedProd=ap.find(p=>p.id===+form.productId);

  return(
    <div>
      <PageH title="Выпуск готовой продукции">
        <SearchBox value={search} onChange={e=>setSearch(e.target.value)} ph="Поиск..."/>
        {!isWorker&&(
          <select value={fEmp} onChange={e=>setFEmp(e.target.value)} style={{padding:"7px 9px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,fontSize:12,fontFamily:"inherit"}}>
            <option value="all">Все сотрудники</option>
            {workers.map(w=><option key={w.id} value={w.id}>{w.name.split(" ").slice(0,2).join(" ")}</option>)}
          </select>
        )}
        <Btn onClick={openNew} icon={<I.plus size={15}/>}>Добавить выпуск</Btn>
      </PageH>

      <div style={{display:"flex",flexWrap:"wrap",gap:12,marginBottom:16}}>
        <Stat icon={<I.factory size={18}/>} label="Всего выпущено" value={`${totalQty} ед.`} color={C.success}/>
        <Stat icon={<I.check size={18}/>} label="Сегодня" value={`${todayQty} ед.`} color={C.primary}/>
        <Stat icon={<I.file size={18}/>} label="Записей всего" value={(productionOutputs||[]).length} color={C.info}/>
      </div>

      <Card s={{padding:0,overflow:"hidden"}}>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr><TH>Дата</TH><TH>Сотрудник</TH><TH>Продукт</TH><TH>Кол-во</TH><TH>Комментарий</TH><TH></TH></tr></thead>
            <tbody>
              {list.map(o=>{
                const prod=products.find(p=>p.id===o.productId);
                const emp=users.find(u=>u.id===o.employeeId);
                return(
                  <tr key={o.id} style={{borderBottom:`1px solid ${C.border}`}}>
                    <TD s={{fontSize:12,whiteSpace:"nowrap"}}>{fmtDate(o.date)}</TD>
                    <TD s={{fontWeight:500}}>{emp?.name?.split(" ").slice(0,2).join(" ")||"—"}</TD>
                    <TD>{prod?.name||"—"}</TD>
                    <TD s={{fontWeight:700,color:C.success}}>+{o.quantity} {prod?.unit||""}</TD>
                    <TD s={{color:C.dim,fontSize:12,maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.comment||"—"}</TD>
                    <TD><div style={{display:"flex",gap:4,alignItems:"center"}}>
                      {o.source==="task"
                        ? <span style={{fontSize:11,color:C.dim,padding:"3px 7px",background:C.surface2,borderRadius:5,border:`1px solid ${C.border}`}} title="Создан при завершении задания — редактирование через страницу Задания">#{o.taskId}</span>
                        : !isWorker&&<>
                            <Btn v="ghost" sz="sm" onClick={()=>openEdit(o)} icon={<I.edit size={14}/>}/>
                            <Btn v="ghost" sz="sm" onClick={()=>setConfirm({title:"Удалить выпуск?",message:`Удалить запись "${prod?.name} x${o.quantity}"? Остаток склада будет скорректирован.`,onConfirm:()=>doDelete(o)})} icon={<I.trash size={14}/>}/>
                          </>
                      }
                    </div></TD>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {list.length===0&&(
        <div style={{textAlign:"center",padding:50,color:C.dim}}>
          <I.factory size={36}/><p style={{marginTop:10,fontSize:13}}>Нет записей о выпуске.<br/>Нажмите «Добавить выпуск».</p>
        </div>
      )}

      <Modal open={modal} onClose={()=>setModal(false)} title={edit?"Редактировать выпуск":"Новый выпуск продукции"}>
        <Sel label="Сотрудник" value={form.employeeId}
          onChange={e=>setForm({...form,employeeId:e.target.value})}
          error={errs.employeeId}
          options={[{value:"",label:"Выберите"},...workers.map(w=>({value:w.id,label:w.name.split(" ").slice(0,2).join(" ")}))]}/>
        <Sel label="Продукт" value={form.productId}
          onChange={e=>setForm({...form,productId:e.target.value})}
          error={errs.productId}
          options={[{value:"",label:"Выберите"},...ap.map(p=>({value:p.id,label:`${p.name} (на складе: ${p.stock} ${p.unit})`}))]}/>
        <Inp label="Количество" type="number" min="1" step="1" value={form.quantity}
          onChange={e=>setForm({...form,quantity:e.target.value})} error={errs.quantity}/>
        <Inp label="Дата и время" type="datetime-local" value={form.date}
          onChange={e=>setForm({...form,date:e.target.value})} error={errs.date}/>
        <Txa label="Комментарий (необязательно)" value={form.comment}
          onChange={e=>setForm({...form,comment:e.target.value})} placeholder="Например: утренняя партия"/>
        {selectedProd&&form.quantity&&+form.quantity>0&&(
          <div style={{padding:"10px 14px",background:`${C.success}10`,borderRadius:8,border:`1px solid ${C.success}25`,marginBottom:12,fontSize:13}}>
            <span style={{color:C.muted}}>Склад после сохранения: </span>
            <span style={{fontWeight:700,color:C.success}}>
              {selectedProd.stock} → {selectedProd.stock+(edit&&edit.productId===+form.productId?-edit.quantity:0)+(+form.quantity)} {selectedProd.unit}
            </span>
          </div>
        )}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:6}}>
          <Btn v="secondary" onClick={()=>setModal(false)}>Отмена</Btn>
          <Btn v="success" onClick={save}>{edit?"Сохранить":"Зафиксировать выпуск"}</Btn>
        </div>
      </Modal>

      {confirm&&<Confirm open={!!confirm} onClose={()=>setConfirm(null)} title={confirm.title} message={confirm.message} onConfirm={confirm.onConfirm}/>}
      {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
    </div>
  );
};


export { ProductionOutputPage };
