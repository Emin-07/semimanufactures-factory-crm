import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

insert_marker = '// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n// MAIN APP'
idx = content.find(insert_marker)
print(f'Insert position: {idx}')

new_pages = r"""// ═══════════════════════════════════════════════════════════════
// BATCHES PAGE — Партии продукции
// ═══════════════════════════════════════════════════════════════
const BatchesPage = ()=>{
  const {batches,setBatches,products,currentUser,addLog}=useContext(AppContext);
  const role=ROLES.find(r=>r.id===currentUser.roleId);
  const isAdmin=role?.name==="admin"||role?.name==="owner";
  const [fStatus,setFStatus]=useState("all");
  const [fProduct,setFProduct]=useState("all");
  const [confirm,setConfirm]=useState(null);
  const [toast,setToast]=useState(null);

  const now=new Date();
  const filtered=useMemo(()=>{
    let l=[...(batches||[])];
    if(fStatus!=="all") l=l.filter(b=>b.status===fStatus);
    if(fProduct!=="all") l=l.filter(b=>b.productId===+fProduct);
    return l.sort((a,b)=>new Date(b.producedAt)-new Date(a.producedAt));
  },[batches,fStatus,fProduct]);

  const daysLeft=(expiresAt)=>{
    if(!expiresAt) return null;
    return Math.ceil((new Date(expiresAt)-now)/(86400000));
  };
  const expiryColor=(days)=>{
    if(days===null) return "info";
    if(days<0) return "danger";
    if(days<=3) return "danger";
    if(days<=7) return "orange";
    return "success";
  };

  const writeOff=(b)=>{
    setBatches(p=>p.map(x=>x.id===b.id?{...x,status:"списана",updatedAt:new Date().toISOString()}:x));
    const p=products.find(x=>x.id===b.productId);
    addLog(`Списана партия: ${p?.name||"?"} ${b.quantity}ед.`);
    setToast({message:"Партия списана",type:"success"});
    setConfirm(null);
  };

  const active=(batches||[]).filter(b=>b.status==="активна");
  const expiringSoon=active.filter(b=>daysLeft(b.expiresAt)!==null&&daysLeft(b.expiresAt)<=3);
  const totalActive=active.reduce((s,b)=>s+b.quantity,0);

  return(
    <div>
      <PageH title="Партии продукции">
        <select value={fProduct} onChange={e=>setFProduct(e.target.value)} style={{padding:"7px 9px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,fontSize:12,fontFamily:"inherit"}}>
          <option value="all">Все товары</option>
          {(products||[]).filter(p=>!p.deleted).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={fStatus} onChange={e=>setFStatus(e.target.value)} style={{padding:"7px 9px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,fontSize:12,fontFamily:"inherit"}}>
          <option value="all">Все статусы</option>
          {BATCH_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
      </PageH>

      <div style={{display:"flex",flexWrap:"wrap",gap:12,marginBottom:16}}>
        <Stat icon={<I.box size={18}/>} label="Активных партий" value={active.length} color={C.info}/>
        <Stat icon={<I.chart size={18}/>} label="Ед. в обороте" value={totalActive} color={C.success}/>
        {expiringSoon.length>0&&<Stat icon={<I.alert size={18}/>} label="Истекает ≤ 3 дней" value={expiringSoon.length} color={C.danger}/>}
      </div>

      <div style={{display:"grid",gap:8}}>
        {filtered.map(b=>{
          const prod=products.find(p=>p.id===b.productId);
          const days=daysLeft(b.expiresAt);
          const clr=b.status==="активна"?expiryColor(days):(b.status==="списана"?"danger":"muted");
          return(
            <Card key={b.id} s={{borderLeft:`3px solid ${C[clr]||C.border}`,opacity:b.status!=="активна"?0.7:1}}>
              <div style={{display:"flex",flexWrap:"wrap",gap:12,alignItems:"center"}}>
                <div style={{flex:"1 1 180px"}}>
                  <div style={{fontSize:14,fontWeight:700,color:C.text}}>{prod?.name||"—"}</div>
                  <div style={{fontSize:11,color:C.dim}}>Произведено: {fmtShort(b.producedAt)}{b.expiresAt&&` · Годен до: ${fmtShort(b.expiresAt)}`}</div>
                  {b.note&&<div style={{fontSize:11,color:C.dim,fontStyle:"italic"}}>{b.note}</div>}
                </div>
                <div style={{textAlign:"center",minWidth:60}}>
                  <div style={{fontSize:20,fontWeight:800,color:C.text}}>{b.quantity}</div>
                  <div style={{fontSize:10,color:C.dim}}>ед.</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <Badge color={clr==="muted"?"info":clr} s={{fontSize:10}}>{b.status}</Badge>
                  {days!==null&&b.status==="активна"&&(
                    <Badge color={expiryColor(days)} s={{fontSize:10}}>
                      {days<0?`просрочено ${-days}д`:days===0?"истекает сегодня":`${days}д`}
                    </Badge>
                  )}
                  {isAdmin&&b.status==="активна"&&(
                    <Btn v="ghost" sz="sm" onClick={()=>setConfirm({title:"Списать партию?",message:`${prod?.name||"?"} — ${b.quantity} ед.`,onConfirm:()=>writeOff(b)})} icon={<I.trash size={13}/>}/>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
        {filtered.length===0&&<div style={{textAlign:"center",padding:50,color:C.dim}}>Нет партий по выбранным фильтрам</div>}
      </div>

      {confirm&&<Confirm open={!!confirm} onClose={()=>setConfirm(null)} title={confirm.title} message={confirm.message} onConfirm={confirm.onConfirm}/>}
      {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// DEFECTS PAGE — Брак и списания
// ═══════════════════════════════════════════════════════════════
const DefectsPage = ()=>{
  const {defects,setDefects,users,products,batches,currentUser,addLog}=useContext(AppContext);
  const role=ROLES.find(r=>r.id===currentUser.roleId);
  const isAdmin=role?.name==="admin"||role?.name==="owner";
  const workers=users.filter(u=>u.status==="active"&&u.roleId===3);
  const ap=products.filter(p=>!p.deleted);

  const [modal,setModal]=useState(false);
  const [confirm,setConfirm]=useState(null);
  const [toast,setToast]=useState(null);
  const [fEmp,setFEmp]=useState("all");
  const [fProd,setFProd]=useState("all");
  const [errs,setErrs]=useState({});

  const emptyForm={employeeId:"",productId:"",batchId:"",quantity:"",reason:"",date:new Date().toISOString().slice(0,10),comment:""};
  const [form,setForm]=useState(emptyForm);

  const filtered=useMemo(()=>{
    let l=[...(defects||[])];
    if(fEmp!=="all") l=l.filter(d=>d.employeeId===+fEmp);
    if(fProd!=="all") l=l.filter(d=>d.productId===+fProd);
    return l.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  },[defects,fEmp,fProd]);

  const totalQty=filtered.reduce((s,d)=>s+d.quantity,0);

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
    const prod=ap.find(p=>p.id===+form.productId);
    const emp=form.employeeId?users.find(u=>u.id===+form.employeeId):null;
    setDefects(p=>[...(p||[]),{id,employeeId:form.employeeId?+form.employeeId:null,productId:+form.productId,batchId:form.batchId?+form.batchId:null,quantity:+form.quantity,reason:form.reason,date:form.date,comment:form.comment,createdBy:currentUser.id,createdAt:now}]);
    addLog(`Брак: ${prod?.name||"?"} ${form.quantity}ед.${emp?" — "+emp.name.split(" ")[0]:""}`);
    setToast({message:"Брак зарегистрирован",type:"success"});
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

  return(
    <div>
      <PageH title="Брак и списания">
        <select value={fEmp} onChange={e=>setFEmp(e.target.value)} style={{padding:"7px 9px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,fontSize:12,fontFamily:"inherit"}}>
          <option value="all">Все сотрудники</option>
          {workers.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <select value={fProd} onChange={e=>setFProd(e.target.value)} style={{padding:"7px 9px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,fontSize:12,fontFamily:"inherit"}}>
          <option value="all">Все товары</option>
          {ap.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {isAdmin&&<Btn onClick={()=>{setForm(emptyForm);setErrs({});setModal(true)}} icon={<I.plus size={15}/>}>Записать брак</Btn>}
      </PageH>

      <div style={{display:"flex",flexWrap:"wrap",gap:12,marginBottom:16}}>
        <Stat icon={<I.alert size={18}/>} label="Записей" value={(defects||[]).length} color={C.orange}/>
        <Stat icon={<I.trash size={18}/>} label="Ед. брака (фильтр)" value={totalQty} color={C.danger}/>
      </div>

      <div style={{display:"grid",gap:8}}>
        {filtered.map(d=>{
          const prod=ap.find(p=>p.id===d.productId);
          const emp=d.employeeId?users.find(u=>u.id===d.employeeId):null;
          const batch=d.batchId?(batches||[]).find(b=>b.id===d.batchId):null;
          return(
            <Card key={d.id} s={{borderLeft:`3px solid ${C.danger}`}}>
              <div style={{display:"flex",flexWrap:"wrap",gap:12,alignItems:"center"}}>
                <div style={{flex:"1 1 200px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                    <span style={{fontSize:14,fontWeight:700,color:C.text}}>{prod?.name||"—"}</span>
                    <Badge color="danger" s={{fontSize:10}}>{d.reason}</Badge>
                  </div>
                  {emp&&<div style={{fontSize:12,color:C.muted}}>Сотрудник: {emp.name}</div>}
                  <div style={{fontSize:11,color:C.dim}}>{fmtShort(d.date)}{batch&&` · Партия #${d.batchId}`}</div>
                  {d.comment&&<div style={{fontSize:11,color:C.dim,fontStyle:"italic"}}>{d.comment}</div>}
                </div>
                <div style={{textAlign:"center",minWidth:60}}>
                  <div style={{fontSize:20,fontWeight:800,color:C.danger}}>{d.quantity}</div>
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
          <Sel label="Партия (необязательно)" value={form.batchId} onChange={e=>setForm({...form,batchId:e.target.value})} options={[{value:"",label:"Не указана"},...prodBatches.map(b=>({value:b.id,label:`#${b.id} — ${b.quantity}ед. от ${fmtShort(b.producedAt)}`}))]}/>
        )}
        <Sel label="Сотрудник" value={form.employeeId} onChange={e=>setForm({...form,employeeId:e.target.value})} options={[{value:"",label:"Не указан"},...workers.map(w=>({value:w.id,label:w.name}))]}/>
        <Inp label="Количество (ед.)" type="number" min="1" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} error={errs.quantity}/>
        <Sel label="Причина" value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})} error={errs.reason} options={[{value:"",label:"Выберите"},...DEFECT_REASONS.map(r=>({value:r,label:r}))]}/>
        <Inp label="Дата" type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
        <Txa label="Комментарий" value={form.comment} onChange={e=>setForm({...form,comment:e.target.value})}/>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:6}}>
          <Btn v="secondary" onClick={()=>setModal(false)}>Отмена</Btn>
          <Btn v="danger" onClick={save}>Записать</Btn>
        </div>
      </Modal>

      {confirm&&<Confirm open={!!confirm} onClose={()=>setConfirm(null)} title={confirm.title} message={confirm.message} onConfirm={confirm.onConfirm}/>}
      {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
    </div>
  );
};

"""

content = content[:idx] + new_pages + content[idx:]
with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done. Lines:', content.count('\n'))
