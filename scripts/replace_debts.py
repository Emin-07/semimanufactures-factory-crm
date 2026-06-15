import re

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

new_debts = r"""// ═══════════════════════════════════════════════════════════════
// DEBTS PAGE — Долги магазинов
// ═══════════════════════════════════════════════════════════════
const DebtsPage = ()=>{
  const {debts,setDebts,clients,setClients,currentUser,addLog}=useContext(AppContext);
  const role=ROLES.find(r=>r.id===currentUser.roleId);
  const isAdmin=role?.name==="admin"||role?.name==="owner";
  const [modal,setModal]=useState(false);
  const [payModal,setPayModal]=useState(null);
  const [edit,setEdit]=useState(null);
  const [confirm,setConfirm]=useState(null);
  const [toast,setToast]=useState(null);
  const [search,setSearch]=useState("");
  const [fStatus,setFStatus]=useState("all");
  const [fStore,setFStore]=useState("all");
  const [errs,setErrs]=useState({});
  const [payErrs,setPayErrs]=useState({});

  const emptyForm={storeId:"",amount:"",description:"",date:new Date().toISOString().slice(0,10),dueDate:"",comment:""};
  const [form,setForm]=useState(emptyForm);
  const [payForm,setPayForm]=useState({amount:"",date:new Date().toISOString().slice(0,10),note:""});

  const filtered=useMemo(()=>{
    let l=[...(debts||[])];
    if(fStore!=="all") l=l.filter(d=>d.storeId===+fStore);
    if(fStatus!=="all") l=l.filter(d=>d.status===fStatus);
    if(search){const s=search.toLowerCase();l=l.filter(d=>{const st=clients.find(c=>c.id===d.storeId);return d.description?.toLowerCase().includes(s)||st?.name.toLowerCase().includes(s)||d.comment?.toLowerCase().includes(s);})}
    return l.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  },[debts,fStore,fStatus,search,clients]);

  const totalActive=(debts||[]).filter(d=>d.status!=="погашен").reduce((s,d)=>s+d.remaining,0);

  const storeSummary=useMemo(()=>{
    const m={};
    (debts||[]).filter(d=>d.status!=="погашен").forEach(d=>{
      if(!m[d.storeId]) m[d.storeId]={storeId:d.storeId,active:0,count:0};
      m[d.storeId].active+=d.remaining; m[d.storeId].count++;
    });
    return Object.values(m).sort((a,b)=>b.active-a.active);
  },[debts]);

  const validate=()=>{const e={};if(!form.storeId)e.storeId="!";if(!form.amount||+form.amount<=0)e.amount="> 0";if(!form.description?.trim())e.description="!";setErrs(e);return!Object.keys(e).length};

  const save=()=>{
    if(!validate()) return;
    const now=new Date().toISOString();
    const st=clients.find(c=>c.id===+form.storeId);
    if(edit){
      setDebts(p=>(p||[]).map(d=>d.id===edit.id?{...d,storeId:+form.storeId,amount:+form.amount,remaining:d.remaining+(+form.amount-d.amount),description:form.description,date:form.date,dueDate:form.dueDate||null,comment:form.comment,updatedAt:now}:d));
      addLog("Долг обновлён: "+form.description);setToast({message:"Обновлено",type:"success"});
    } else {
      setDebts(p=>[...(p||[]),{id:Date.now(),storeId:+form.storeId,amount:+form.amount,remaining:+form.amount,description:form.description,date:form.date,dueDate:form.dueDate||null,status:"активен",comment:form.comment,payments:[],createdAt:now}]);
      addLog("Долг: "+(st?.name||"?")+" — "+form.amount+"₽");setToast({message:"Долг записан",type:"success"});
    }
    setModal(false);
  };

  const doDelete=d=>{setDebts(p=>(p||[]).filter(x=>x.id!==d.id));addLog("Долг удалён: "+d.description);setToast({message:"Удалено",type:"error"});setConfirm(null)};

  const openPay=d=>{setPayModal(d);setPayForm({amount:"",date:new Date().toISOString().slice(0,10),note:""});setPayErrs({})};
  const savePay=()=>{
    const e={};if(!payForm.amount||+payForm.amount<=0)e.amount="> 0";if(+payForm.amount>payModal.remaining)e.amount="Не больше "+payModal.remaining+"₽";
    setPayErrs(e);if(Object.keys(e).length)return;
    const now=new Date().toISOString();
    setDebts(p=>(p||[]).map(d=>{
      if(d.id!==payModal.id) return d;
      const nr=+(d.remaining-+payForm.amount).toFixed(2);
      return{...d,remaining:nr,status:nr<=0?"погашен":nr<d.amount?"частично погашен":"активен",payments:[...(d.payments||[]),{id:Date.now(),amount:+payForm.amount,date:payForm.date,note:payForm.note}],updatedAt:now};
    }));
    if(payModal.storeId) setClients(p=>p.map(c=>c.id===payModal.storeId?{...c,lastPaymentDate:now}:c));
    const st=clients.find(c=>c.id===payModal.storeId);
    addLog("Оплата: "+(st?.name||"?")+" "+payForm.amount+"₽");setToast({message:"Платёж принят",type:"success"});setPayModal(null);
  };

  const statusColor=s=>s==="погашен"?"success":s==="частично погашен"?"orange":"danger";

  return(
    <div>
      <PageH title="Долги магазинов">
        <SearchBox value={search} onChange={e=>setSearch(e.target.value)} ph="Поиск..."/>
        <select value={fStore} onChange={e=>setFStore(e.target.value)} style={{padding:"7px 9px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,fontSize:12,fontFamily:"inherit"}}>
          <option value="all">Все магазины</option>
          {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={fStatus} onChange={e=>setFStatus(e.target.value)} style={{padding:"7px 9px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,fontSize:12,fontFamily:"inherit"}}>
          <option value="all">Все статусы</option>
          {DEBT_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        {isAdmin&&<Btn onClick={()=>{setEdit(null);setForm(emptyForm);setErrs({});setModal(true)}} icon={<I.plus size={15}/>}>Записать долг</Btn>}
      </PageH>

      <div style={{display:"flex",flexWrap:"wrap",gap:12,marginBottom:16}}>
        <Stat icon={<I.alert size={18}/>} label="Общий долг" value={totalActive.toLocaleString("ru")+"₽"} color={C.danger}/>
        <Stat icon={<I.users size={18}/>} label="Должников" value={storeSummary.length} color={C.orange}/>
      </div>

      {storeSummary.length>0&&(
        <Card s={{marginBottom:16}}>
          <Title>По магазинам</Title>
          <div style={{display:"grid",gap:6}}>
            {storeSummary.map(s=>{
              const st=clients.find(c=>c.id===s.storeId);
              return(
                <div key={s.storeId} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                  <div style={{flex:1,fontSize:13,fontWeight:600,color:C.text}}>{st?.name||"—"}</div>
                  {st?.status==="blacklist"&&<Badge color="danger" s={{fontSize:10}}>ЧС</Badge>}
                  {st?.lastPaymentDate&&<span style={{fontSize:10,color:C.dim}}>посл. оплата: {fmtShort(st.lastPaymentDate)}</span>}
                  <span style={{fontWeight:700,color:C.danger,fontSize:14,minWidth:80,textAlign:"right"}}>{s.active.toLocaleString("ru")}₽</span>
                  {isAdmin&&<button onClick={()=>{setForm({...emptyForm,storeId:s.storeId});setEdit(null);setErrs({});setModal(true)}} style={{fontSize:11,padding:"3px 9px",borderRadius:5,border:`1px solid ${C.primary}30`,background:`${C.primary}10`,color:C.primary,cursor:"pointer",fontFamily:"inherit"}}>+Долг</button>}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div style={{display:"grid",gap:10}}>
        {filtered.map(d=>{
          const st=clients.find(c=>c.id===d.storeId);
          const pct=d.amount>0?Math.round((1-d.remaining/d.amount)*100):100;
          const days=d.dueDate?Math.ceil((new Date(d.dueDate)-new Date())/(86400000)):null;
          return(
            <Card key={d.id} s={{borderLeft:`3px solid ${C[statusColor(d.status)]}`}}>
              <div style={{display:"flex",flexWrap:"wrap",gap:12,alignItems:"flex-start"}}>
                <div style={{flex:"1 1 200px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <span style={{fontSize:14,fontWeight:700,color:C.text}}>{d.description}</span>
                    <Badge color={statusColor(d.status)} s={{fontSize:10}}>{d.status}</Badge>
                    {days!==null&&days<0&&<Badge color="danger" s={{fontSize:10}}>Просрочен {-days}д</Badge>}
                    {days!==null&&days>=0&&days<=7&&<Badge color="orange" s={{fontSize:10}}>Срок через {days}д</Badge>}
                  </div>
                  <div style={{fontSize:12,color:C.muted,fontWeight:600}}>{st?.name||"—"}</div>
                  <div style={{fontSize:11,color:C.dim}}>{fmtShort(d.date)}{d.dueDate&&` · Срок: ${fmtShort(d.dueDate)}`}</div>
                  {d.comment&&<div style={{fontSize:11,color:C.dim,fontStyle:"italic",marginTop:2}}>{d.comment}</div>}
                </div>
                <div style={{textAlign:"right",minWidth:110}}>
                  <div style={{fontSize:20,fontWeight:800,color:d.status==="погашен"?C.success:C.danger}}>{d.remaining.toLocaleString("ru")}₽</div>
                  {d.remaining!==d.amount&&<div style={{fontSize:11,color:C.dim}}>из {d.amount.toLocaleString("ru")}₽</div>}
                </div>
                {isAdmin&&(
                  <div style={{display:"flex",gap:4,flexDirection:"column"}}>
                    {d.status!=="погашен"&&<Btn sz="sm" v="success" onClick={()=>openPay(d)} icon={<I.check size={13}/>}>Оплата</Btn>}
                    <div style={{display:"flex",gap:4}}>
                      <Btn v="ghost" sz="sm" onClick={()=>{setEdit(d);setForm({storeId:d.storeId,amount:d.amount,description:d.description,date:d.date,dueDate:d.dueDate||"",comment:d.comment||""});setErrs({});setModal(true)}} icon={<I.edit size={13}/>}/>
                      <Btn v="ghost" sz="sm" onClick={()=>setConfirm({title:"Удалить?",message:`Долг "${d.description}"`,onConfirm:()=>doDelete(d)})} icon={<I.trash size={13}/>}/>
                    </div>
                  </div>
                )}
              </div>
              {d.amount>0&&d.status!=="активен"&&(
                <div style={{marginTop:8}}>
                  <div style={{height:4,background:C.bg,borderRadius:2,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pct}%`,background:C.success,borderRadius:2}}/>
                  </div>
                  <div style={{fontSize:10,color:C.dim,marginTop:2}}>Погашено: {pct}%</div>
                </div>
              )}
              {(d.payments||[]).length>0&&(
                <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${C.border}`,display:"flex",flexWrap:"wrap",gap:6}}>
                  {(d.payments||[]).map(p=>(
                    <div key={p.id} style={{padding:"3px 9px",background:C.successBg,borderRadius:6,border:`1px solid ${C.success}20`,fontSize:11}}>
                      <span style={{fontWeight:700,color:C.success}}>-{p.amount.toLocaleString("ru")}₽</span>
                      <span style={{color:C.dim,marginLeft:5}}>{fmtShort(p.date)}{p.note&&" · "+p.note}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
        {filtered.length===0&&<div style={{textAlign:"center",padding:50,color:C.dim}}>Нет долгов по выбранным фильтрам</div>}
      </div>

      <Modal open={modal} onClose={()=>setModal(false)} title={edit?"Редактировать":"Долг магазина"} width={480}>
        <Sel label="Магазин" value={form.storeId} onChange={e=>setForm({...form,storeId:e.target.value})} error={errs.storeId} options={[{value:"",label:"Выберите"},...clients.map(c=>({value:c.id,label:c.name}))]}/>
        <Inp label="Сумма (₽)" type="number" min="1" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})} error={errs.amount}/>
        <Inp label="Описание" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} error={errs.description} placeholder="Долг за заказ #..."/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
          <Inp label="Дата" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
          <Inp label="Срок оплаты" type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})}/>
        </div>
        <Txa label="Комментарий" value={form.comment} onChange={e=>setForm({...form,comment:e.target.value})}/>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:6}}><Btn v="secondary" onClick={()=>setModal(false)}>Отмена</Btn><Btn onClick={save}>{edit?"Сохранить":"Добавить"}</Btn></div>
      </Modal>

      <Modal open={!!payModal} onClose={()=>setPayModal(null)} title="Принять оплату" width={380}>
        {payModal&&<>
          <div style={{padding:"8px 12px",background:C.surface2,borderRadius:8,marginBottom:12,fontSize:13}}>
            <div style={{fontWeight:700}}>{payModal.description}</div>
            <div style={{color:C.muted,fontSize:12}}>{clients.find(c=>c.id===payModal.storeId)?.name} · Остаток: {payModal.remaining.toLocaleString("ru")}₽</div>
          </div>
          <Inp label="Сумма (₽)" type="number" min="1" value={payForm.amount} onChange={e=>setPayForm({...payForm,amount:e.target.value})} error={payErrs.amount}/>
          <Inp label="Дата" type="date" value={payForm.date} onChange={e=>setPayForm({...payForm,date:e.target.value})}/>
          <Inp label="Примечание" value={payForm.note} onChange={e=>setPayForm({...payForm,note:e.target.value})} placeholder="Нал/Перевод..."/>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}><Btn v="secondary" onClick={()=>setPayModal(null)}>Отмена</Btn><Btn v="success" onClick={savePay}>Принять</Btn></div>
        </>}
      </Modal>

      {confirm&&<Confirm open={!!confirm} onClose={()=>setConfirm(null)} title={confirm.title} message={confirm.message} onConfirm={confirm.onConfirm}/>}
      {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
    </div>
  );
};

"""

content = content[:227837] + new_debts + content[246044:]
with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done. Lines:', content.count('\n'))
