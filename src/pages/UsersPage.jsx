import { useState, useEffect, useCallback, useMemo, useContext, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area } from "recharts";
import { AppContext } from "../context/AppContext.js";
import { ROLES, JOB_TITLES, PAY_TYPES, STORE_STATUSES, STORE_STATUS_LABELS, ORDER_SOURCES, ATTENDANCE_TYPES, ATTENDANCE_TYPE_COLORS, BATCH_STATUSES, DEFECT_REASONS, PAYROLL_STATUSES, CATEGORIES, UNITS, STATUSES, TASK_STATUSES, RAW_CATEGORIES, RAW_UNITS, NOTIF_TYPES, MARK_TYPES, PLAN_STATUSES, ORDER_STATUSES, ORDER_PRIORITIES, BOARD_COLUMNS, MOVEMENT_TYPES, DEBT_STATUSES, CAMERA_SOURCE_TYPES, CAMERA_SOURCE_LABELS, CAMERA_ZONES } from "../constants/index.js";
import { fmtDate, fmtShort, fmtTime, daysBetween, relTime } from "../utils/dates.js";
import { C, CC } from "../theme/colors.js";
import { I } from "../icons/Icons.jsx";
import { EthnicBorder, EthnicCorner, Badge, Btn, Inp, Sel, Txa, Modal, Confirm, Stat, Toast, TH, TD, Card, Title, PageH, SearchBox } from "../components/ui/index.jsx";
import { apiFetch } from "../api/client.js";

// USERS
const UsersPage = ()=>{
  const {users,setUsers,addLog,currentUser,baseSalaries,setBaseSalaries,applyServerState}=useContext(AppContext);
  const [modal,setModal]=useState(false);
  const [edit,setEdit]=useState(null);
  const [search,setSearch]=useState("");
  const [toast,setToast]=useState(null);
  const [confirm,setConfirm]=useState(null);
  const emptyForm={name:"",email:"",password:"",roleId:2,status:"active",baseSalary:"",jobTitle:"",payType:"сдельная",dailyNorm:"",pieceRate:"",fixedDayRate:"",comment:""};
  const [form,setForm]=useState(emptyForm);
  const [errs,setErrs]=useState({});

  const filtered=users.filter(u=>!u.deleted&&(u.name.toLowerCase().includes(search.toLowerCase())||u.email.toLowerCase().includes(search.toLowerCase())));
  const openNew=()=>{setEdit(null);setForm(emptyForm);setErrs({});setModal(true)};
  const openEdit=u=>{setEdit(u);setForm({name:u.name,email:u.email,password:"",roleId:u.roleId,status:u.status,baseSalary:baseSalaries[u.id]||"",jobTitle:u.jobTitle||"",payType:u.payType||"сдельная",dailyNorm:u.dailyNorm||"",pieceRate:u.pieceRate||"",fixedDayRate:u.fixedDayRate||"",comment:u.comment||""});setErrs({});setModal(true)};
  const validate=()=>{const e={};if(!form.name.trim())e.name="!";if(!form.email.trim())e.email="!";else if(!/\S+@\S+\.\S+/.test(form.email))e.email="Email";if(!edit&&!form.password)e.password="!";setErrs(e);return!Object.keys(e).length};
  const save=async()=>{
    if(!validate())return;
    const sal=form.baseSalary?+form.baseSalary:0;
    const extra={jobTitle:form.jobTitle,payType:form.payType,dailyNorm:form.dailyNorm?+form.dailyNorm:0,pieceRate:form.pieceRate?+form.pieceRate:0,fixedDayRate:form.fixedDayRate?+form.fixedDayRate:0,comment:form.comment};
    if(edit){
      try{
        // Update via server endpoint (validates + preserves password hash).
        // Response state is applied locally only (applyServerState) — never re-posted
        // to /api/state/dk_users, which would overwrite the server's password hashes
        // with whatever sanitized (passwordless) copy the client currently holds.
        const r=await apiFetch(`/api/admin/users/${edit.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:form.name,email:form.email,roleId:+form.roleId,status:form.status,...extra})});
        if(!r){setToast({message:"Нет соединения с сервером",type:"error"});return;}
        const d=await r.json();
        if(!r.ok){setToast({message:d.error||"Ошибка",type:"error"});return;}
        applyServerState(d.state);
        if(form.password){
          const pr=await apiFetch(`/api/admin/users/${edit.id}/password`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({newPassword:form.password})});
          if(pr&&pr.ok){const pd=await pr.json();if(pd.state)applyServerState(pd.state);}
        }
        if(sal>0) setBaseSalaries(p=>({...p,[edit.id]:sal}));
        else setBaseSalaries(p=>{const n={...p};delete n[edit.id];return n;});
        addLog(`Обновлён: ${form.name}`);setToast({message:"Обновлён",type:"success"});
      }catch{setToast({message:"Ошибка сети",type:"error"});return;}
    }else{
      try{
        // Create via server — password hashed server-side atomically, no race condition.
        const r=await apiFetch("/api/admin/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:form.name,email:form.email,password:form.password,roleId:+form.roleId,status:form.status,...extra})});
        if(!r){setToast({message:"Нет соединения с сервером",type:"error"});return;}
        const d=await r.json();
        if(!r.ok){setToast({message:d.error||"Ошибка",type:"error"});return;}
        applyServerState(d.state);
        if(sal>0) setBaseSalaries(p=>({...p,[d.user.id]:sal}));
        addLog(`Создан: ${form.name}`);setToast({message:"Создан",type:"success"});
      }catch{setToast({message:"Ошибка сети",type:"error"});return;}
    }
    setModal(false);
  };
  const toggleBlock=async(u)=>{
    try{
      const r=await apiFetch(`/api/admin/users/${u.id}/block`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({blocked:u.status==="active"})});
      if(!r){setToast({message:"Нет соединения с сервером",type:"error"});return;}
      const d=await r.json();
      if(!r.ok){setToast({message:d.error||"Ошибка",type:"error"});return;}
      applyServerState(d.state);
      const blocked=d.user.status==="blocked";
      addLog(`${blocked?"Заблок.":"Разблок."}: ${u.name}`);
      setToast({message:blocked?"Заблокирован":"Разблокирован",type:blocked?"error":"success"});
    }catch{setToast({message:"Ошибка сети",type:"error"});}
  };
  const del=u=>{setConfirm({title:"Удалить?",message:`Удалить "${u.name}"? Запись попадёт в корзину — её можно восстановить.`,onConfirm:()=>{
    const now=new Date().toISOString();
    setUsers(prev=>prev.map(x=>x.id===u.id?{...x,deleted:true,deletedAt:now,deletedBy:currentUser.id,deletedByName:currentUser.name,deletedReason:""}:x));
    addLog(`Удалён: ${u.name}`);setToast({message:"Удалён",type:"error"});setConfirm(null);
  }})};

  return(
    <div>
      <PageH title="Пользователи"><SearchBox value={search} onChange={e=>setSearch(e.target.value)}/><Btn onClick={openNew} icon={<I.plus size={15}/>}>Добавить</Btn></PageH>
      <Card s={{padding:0,overflow:"hidden"}}><div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><TH>ФИО</TH><TH>Должность</TH><TH>Роль</TH><TH>Оплата</TH><TH>Статус</TH><TH></TH></tr></thead>
          <tbody>{filtered.map(u=>{const role=ROLES.find(r=>r.id===u.roleId);return(
            <tr key={u.id} style={{borderBottom:`1px solid ${C.border}`}}>
              <TD s={{fontWeight:500}}>
                <div>{u.name}</div>
                <div style={{fontSize:10,color:C.dim}}>{u.email}</div>
                {u.hasPassword===false&&<div style={{fontSize:10,color:C.danger}}>Пароль не задан — задайте новый пароль</div>}
              </TD>
              <TD s={{color:C.muted,fontSize:12}}>{u.jobTitle||"—"}</TD>
              <TD><Badge color={u.roleId===1?"danger":u.roleId===2?"info":"primary"}>{role?.label}</Badge></TD>
              <TD s={{fontSize:12}}>
                <div style={{color:C.muted}}>{u.payType||"—"}</div>
                {u.payType==="сдельная"&&u.pieceRate>0&&<div style={{color:C.dim,fontSize:10}}>{u.pieceRate}₽/ед.</div>}
                {(u.payType==="фиксированная"||u.payType==="смешанная")&&baseSalaries[u.id]>0&&<div style={{color:C.dim,fontSize:10}}>{baseSalaries[u.id].toLocaleString("ru")}₽/мес</div>}
              </TD>
              <TD><Badge color={u.status==="active"?"success":"danger"}>{u.status==="active"?"Активен":"Заблок."}</Badge></TD>
              <TD><div style={{display:"flex",gap:4}}><Btn v="ghost" sz="sm" onClick={()=>openEdit(u)} icon={<I.edit size={14}/>}/>{u.id!==currentUser.id&&<Btn v="ghost" sz="sm" onClick={()=>toggleBlock(u)} icon={u.status==="active"?<I.lock size={14}/>:<I.unlock size={14}/>}/>}{u.id!==currentUser.id&&<Btn v="ghost" sz="sm" onClick={()=>del(u)} icon={<I.trash size={14}/>}/>}</div></TD>
            </tr>)})}</tbody>
        </table></div></Card>
      <Modal open={modal} onClose={()=>setModal(false)} title={edit?"Редактировать":"Новый сотрудник"} width={480}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
          <Inp label="ФИО" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} error={errs.name}/>
          <Inp label="Email" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} error={errs.email}/>
        </div>
        <Inp label={edit?"Новый пароль (оставить пустым = не менять)":"Пароль"} type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} error={errs.password}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
          <Sel label="Роль" value={form.roleId} onChange={e=>setForm({...form,roleId:+e.target.value})} options={ROLES.map(r=>({value:r.id,label:r.label}))}/>
          <Sel label="Должность" value={form.jobTitle} onChange={e=>setForm({...form,jobTitle:e.target.value})} options={[{value:"",label:"Не указана"},...JOB_TITLES.map(t=>({value:t,label:t}))]}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
          <Sel label="Тип оплаты" value={form.payType} onChange={e=>setForm({...form,payType:e.target.value})} options={PAY_TYPES.map(t=>({value:t,label:t}))}/>
          <Sel label="Статус" value={form.status} onChange={e=>setForm({...form,status:e.target.value})} options={[{value:"active",label:"Активен"},{value:"blocked",label:"Заблокирован"}]}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:"0 12px"}}>
          <Inp label="Ставка ₽/мес" type="number" min="0" value={form.baseSalary} onChange={e=>setForm({...form,baseSalary:e.target.value})} placeholder="0"/>
          <Inp label="Ставка ₽/день" type="number" min="0" value={form.fixedDayRate} onChange={e=>setForm({...form,fixedDayRate:e.target.value})} placeholder="0"/>
          <Inp label="Сдельная ₽/ед." type="number" min="0" value={form.pieceRate} onChange={e=>setForm({...form,pieceRate:e.target.value})} placeholder="0"/>
          <Inp label="Норма ед./день" type="number" min="0" value={form.dailyNorm} onChange={e=>setForm({...form,dailyNorm:e.target.value})} placeholder="0"/>
        </div>
        <Txa label="Комментарий" value={form.comment} onChange={e=>setForm({...form,comment:e.target.value})} placeholder="Заметки..."/>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:6}}><Btn v="secondary" onClick={()=>setModal(false)}>Отмена</Btn><Btn onClick={save}>{edit?"Сохранить":"Создать"}</Btn></div>
      </Modal>
      {confirm&&<Confirm open onClose={()=>setConfirm(null)} {...confirm}/>}
      {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
    </div>
  );
};


export { UsersPage };
