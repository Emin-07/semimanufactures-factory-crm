import { useState, useMemo, useContext } from "react";
import { AppContext } from "../context/AppContext.js";
import { ROLES, NOTIF_TYPES } from "../constants/index.js";
import { fmtDate, relTime } from "../utils/dates.js";
import { buildDashboardWarnings } from "../utils/dashboardWarnings.js";
import { isWarningHidden } from "../utils/hiddenWarnings.js";
import { C } from "../theme/colors.js";
import { I } from "../icons/Icons.jsx";
import { EthnicBorder, EthnicCorner, Badge, Btn, Inp, Sel, Txa, Modal, Confirm, Stat, Toast, TH, TD, Card, Title, PageH, SearchBox } from "../components/ui/index.jsx";

// NOTIFICATIONS PAGE
const NotificationsPage = ()=>{
  const {
    notifications,setNotifications,setNotifsL,users,currentUser,addLog,
    rawMaterials,products,tasks,marks,productionOutputs,debts,
    hiddenWarningsMap,hideWarningItem,restoreWarningItem,
  } = useContext(AppContext);
  const [modal,setModal]=useState(false);
  const [edit,setEdit]=useState(null);
  const [confirm,setConfirm]=useState(null);
  const [toast,setToast]=useState(null);
  const [search,setSearch]=useState("");
  const [fType,setFType]=useState("all");
  const [fScope,setFScope]=useState("active");
  const [errs,setErrs]=useState({});
  const role=ROLES.find(r=>r.id===currentUser.roleId);
  const isAdmin=role?.name==="admin"||role?.name==="owner";

  const empty={title:"",type:"информация",content:"",targetAll:true,targetUsers:[]};
  const [form,setForm]=useState(empty);

  const baseNotifications = useMemo(() => {
    const list = isAdmin
      ? [...(notifications || [])]
      : (notifications || []).filter(n => n.targetAll || n.targetUsers?.includes(currentUser.id));
    return list.map(n => ({ ...n, kind: "notification" }));
  }, [notifications, isAdmin, currentUser]);

  const warningItems = useMemo(() => {
    return buildDashboardWarnings({
      rawMaterials,
      products,
      tasks,
      users,
      marks,
      productionOutputs,
      debts,
    }).map(w => ({ ...w, kind: "warning", hidden: isWarningHidden(hiddenWarningsMap, w.warningId || w.id) }));
  }, [rawMaterials, products, tasks, users, marks, productionOutputs, debts, hiddenWarningsMap]);

  const hasWarnings = warningItems.length > 0;

  const visible = useMemo(() => {
    let list = [...warningItems, ...baseNotifications];
    if (fScope === "hidden") list = list.filter(n => n.kind === "warning" && n.hidden);
    else list = list.filter(n => n.kind !== "warning" || !n.hidden);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(n => `${n.title || ""} ${n.content || ""}`.toLowerCase().includes(q));
    }
    if (fType !== "all") list = list.filter(n => n.type === fType);
    return list.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  }, [warningItems, baseNotifications, fScope, search, fType]);

  // Workers cannot write to dk_notifications directly — use the action endpoint
  // so they can still mark notifications as read for themselves.
  const markRead=async(id)=>{
    try{
      const r=await fetch("/api/actions/notifications/read",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({notificationId:id}),
      });
      if(!r.ok) return;
      const data=await r.json();
      if(data?.dk_notifications) setNotifsL(data.dk_notifications);
    }catch{}
  };

  const openNew=()=>{setEdit(null);setForm(empty);setErrs({});setModal(true)};
  const openEdit=n=>{setEdit(n);setForm({title:n.title,type:n.type,content:n.content,targetAll:n.targetAll,targetUsers:n.targetUsers||[]});setErrs({});setModal(true)};
  const validate=()=>{const e={};if(!form.title.trim())e.title="!";if(!form.content.trim())e.content="!";setErrs(e);return!Object.keys(e).length};

  const save=()=>{
    if(!validate())return;
    if(edit){
      setNotifications(p=>p.map(n=>n.id===edit.id?{...n,title:form.title,type:form.type,content:form.content,targetAll:form.targetAll,targetUsers:form.targetUsers}:n));
      addLog(`Уведомление обновлено: ${form.title}`);
      setToast({message:"Обновлено",type:"success"});
    }else{
      setNotifications(p=>[...p,{id:Date.now(),title:form.title,type:form.type,content:form.content,createdBy:currentUser.id,createdAt:new Date().toISOString(),readBy:[currentUser.id],targetAll:form.targetAll,targetUsers:form.targetUsers}]);
      addLog(`Уведомление создано: ${form.title}`);
      setToast({message:"Создано",type:"success"});
    }
    setModal(false);
  };

  const del=n=>{setConfirm({title:"Удалить уведомление?",message:`Удалить «${n.title}»?`,onConfirm:()=>{setNotifications(p=>p.filter(x=>x.id!==n.id));addLog(`Удалено уведомление: ${n.title}`);setToast({message:"Удалено",type:"error"});setConfirm(null)}})};

  const nColor=t=>t==="ошибка"?"danger":t==="предупреждение"?"orange":"info";
  const nIcon=(n)=>n.kind==="warning"||n.type==="ошибка"||n.type==="предупреждение"?<I.alert size={16}/>:<I.bell size={16}/>;

  return(
    <div>
      <PageH title="Уведомления">
        <SearchBox value={search} onChange={e=>setSearch(e.target.value)}/>
        <select value={fType} onChange={e=>setFType(e.target.value)} style={{padding:"7px 9px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,fontSize:12,fontFamily:"inherit"}}><option value="all">Все типы</option>{NOTIF_TYPES.map(t=><option key={t} value={t}>{t}</option>)}</select>
        {hasWarnings&&(
          <select value={fScope} onChange={e=>setFScope(e.target.value)} style={{padding:"7px 9px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,fontSize:12,fontFamily:"inherit"}}>
            <option value="active">Активные</option>
            <option value="hidden">Скрытые</option>
          </select>
        )}
        {isAdmin&&<Btn onClick={openNew} icon={<I.plus size={15}/>}>Создать</Btn>}
      </PageH>
      <div style={{display:"grid",gap:10}}>
        {visible.map(n=>{
          const isWarning=n.kind==="warning";
          const isRead=isWarning?false:n.readBy?.includes(currentUser.id);
          const author=n.createdBy===0?"Система":users.find(u=>u.id===n.createdBy)?.name?.split(" ").slice(0,2).join(" ")||"Система";
          const mutedHidden=isWarning&&n.hidden;
          return(
            <Card key={n.id} s={{padding:"12px 14px",opacity:isRead||mutedHidden?0.66:1}}>
              <div style={{display:"flex",flexWrap:"wrap",alignItems:"flex-start",gap:12}}>
                <div style={{width:30,height:30,borderRadius:8,background:`${n.type==="ошибка"?C.danger:n.type==="предупреждение"?C.orange:C.info}15`,color:n.type==="ошибка"?C.danger:n.type==="предупреждение"?C.orange:C.info,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{nIcon(n)}</div>
                <div style={{flex:1,minWidth:200}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2,minWidth:0}}>
                    <span className="notification-title" style={{fontSize:13,fontWeight:isRead?500:700,color:C.text}}>{n.title}</span>
                    {!isRead&&!isWarning&&<div style={{width:6,height:6,borderRadius:"50%",background:C.primary,flexShrink:0}}/>}
                    <Badge color={nColor(n.type)} s={{fontSize:10}}>{n.type}</Badge>
                  </div>
                  <div className="notification-body" style={{fontSize:12,color:C.muted,lineHeight:1.45,marginBottom:4}}>{n.content}</div>
                  <div style={{fontSize:10,color:C.dim,display:"flex",gap:10,flexWrap:"wrap"}}>
                    <span>{relTime(n.createdAt)}</span>
                    <span>{fmtDate(n.createdAt)}</span>
                    {isWarning?<span>Предупреждение панели</span>:<span>Автор: {author}</span>}
                    {!isWarning&&(n.targetAll?<span>Для всех</span>:<span>Для: {n.targetUsers?.map(uid=>users.find(u=>u.id===uid)?.name?.split(" ")[0]).join(", ")}</span>)}
                  </div>
                </div>
                <div style={{display:"flex",gap:5,flexShrink:0}}>
                  {!isWarning&&!isRead&&<Btn v="ghost" sz="sm" onClick={()=>markRead(n.id)}>Прочитано</Btn>}
                  {isWarning&&!n.hidden&&<Btn v="ghost" sz="sm" onClick={()=>hideWarningItem(n.warningId||n.id)}>Скрыть</Btn>}
                  {isWarning&&n.hidden&&<Btn v="ghost" sz="sm" onClick={()=>restoreWarningItem(n.warningId||n.id)}>Вернуть</Btn>}
                  {isAdmin&&!isWarning&&<Btn v="ghost" sz="sm" onClick={()=>openEdit(n)} icon={<I.edit size={13}/>}/>}
                  {isAdmin&&!isWarning&&<Btn v="ghost" sz="sm" onClick={()=>del(n)} icon={<I.trash size={13}/>}/>}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      {visible.length===0&&<div style={{textAlign:"center",padding:50,color:C.dim}}><I.bell size={36}/><p style={{marginTop:10}}>{fScope==="hidden"?"Нет скрытых предупреждений":"Нет уведомлений"}</p></div>}

      <Modal open={modal} onClose={()=>setModal(false)} title={edit?"Редактировать":"Новое уведомление"} width={520}>
        <Inp label="Заголовок" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} error={errs.title}/>
        <Sel label="Тип" value={form.type} onChange={e=>setForm({...form,type:e.target.value})} options={NOTIF_TYPES.map(t=>({value:t,label:t}))}/>
        <Txa label="Содержание" value={form.content} onChange={e=>setForm({...form,content:e.target.value})}/>
        <div style={{marginBottom:12}}>
          <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:13,color:C.text}}>
            <input type="checkbox" checked={form.targetAll} onChange={e=>setForm({...form,targetAll:e.target.checked,targetUsers:e.target.checked?[]:form.targetUsers})} style={{accentColor:C.primary}}/>
            Для всех пользователей
          </label>
        </div>
        {!form.targetAll&&(
          <div style={{marginBottom:12}}>
            <label style={{display:"block",fontSize:12,fontWeight:500,color:C.muted,marginBottom:6}}>Выберите получателей</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {users.map(u=>{
                const sel=form.targetUsers.includes(u.id);
                return <button key={u.id} onClick={()=>setForm({...form,targetUsers:sel?form.targetUsers.filter(x=>x!==u.id):[...form.targetUsers,u.id]})} style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${sel?C.primary:C.border}`,background:sel?C.primaryBg:C.surface,color:sel?C.primary:C.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:sel?600:400}}>{u.name.split(" ").slice(0,2).join(" ")}</button>;
              })}
            </div>
          </div>
        )}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:6}}><Btn v="secondary" onClick={()=>setModal(false)}>Отмена</Btn><Btn onClick={save}>{edit?"Сохранить":"Создать"}</Btn></div>
      </Modal>
      {confirm&&<Confirm open onClose={()=>setConfirm(null)} {...confirm}/>}
      {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
    </div>
  );
};


export { NotificationsPage };
