import { useState, useMemo, useContext } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AppContext } from "../context/AppContext.js";
import { ROLES, STORE_STATUSES, STORE_STATUS_LABELS, ORDER_SOURCES, ORDER_STATUSES, ORDER_PRIORITIES } from "../constants/index.js";
import { fmtShort } from "../utils/dates.js";
import { formatMoney } from "../utils/formatters.js";
import { isStoreBlacklisted } from "../utils/storeStatus.js";
import { C } from "../theme/colors.js";
import { I } from "../icons/Icons.jsx";
import { Badge, Btn, Inp, Sel, Txa, Modal, Confirm, Toast, TH, TD, Card, PageH, IconBox } from "../components/ui/index.jsx";
import { useAppMotion } from "../motion/MotionProvider.jsx";
import { t } from "../motion/presets.js";

const actionMotion = {
  initial: { opacity: 0, y: 8, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -8, filter: "blur(6px)" },
  transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
};

const StoreCard = ({
  c,
  isAdmin,
  isSelected,
  onToggleSelect,
  onNewOrder,
  onEdit,
  onBlacklist,
  onUnblock,
  clientOrders,
  statusColor,
  statusLabel,
  stIco,
}) => {
  const { reduceMotion } = useAppMotion();
  const isBlacklisted = isStoreBlacklisted(c);
  const motionProps = reduceMotion ? {} : actionMotion;

  return (
    <Card
      className={`store-card${isBlacklisted ? " is-blacklisted" : ""}`}
      layout={!reduceMotion}
      s={{
        cursor: isBlacklisted ? "default" : "pointer",
        borderLeft: isBlacklisted ? undefined : `3px solid ${C[statusColor(c.status || "active")]}`,
      }}
      onClick={isBlacklisted ? undefined : () => onToggleSelect(c.id)}
    >
      <div className="store-card-header">
        <div className="store-card-title-wrap">
          <IconBox tone={isBlacklisted ? "danger" : statusColor(c.status || "active")} size={28}>
            <I.store size={14} />
          </IconBox>
          <div style={{ minWidth: 0 }}>
            <h3 className="store-title">
              <span className={isBlacklisted ? "strikeable-text" : ""}>{c.name}</span>
            </h3>
            <AnimatePresence>
              {isBlacklisted && (
                <motion.span
                  className="store-blacklist-badge"
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.92, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -4 }}
                  transition={t.base}
                  style={{ marginTop: 6, display: "inline-flex" }}
                >
                  <I.ban size={12} />
                  Чёрный список
                </motion.span>
              )}
              {!isBlacklisted && c.status && c.status !== "active" && (
                <Badge color={statusColor(c.status)} s={{ fontSize: 10, marginTop: 2 }}>
                  {statusLabel(c.status)}
                </Badge>
              )}
            </AnimatePresence>
          </div>
        </div>
        <div className="store-card-badges-top">
          {!isBlacklisted && <Badge color="info" s={{ fontSize: 10 }}>{c.activeOrders} акт.</Badge>}
          {c.totalDebt > 0 && (
            <Badge color="danger" s={{ fontSize: 10, opacity: isBlacklisted ? 0.72 : 1 }}>
              {formatMoney(c.totalDebt, { compact: true })} долг
            </Badge>
          )}
        </div>
      </div>

      {c.phone && (
        <div className="store-contact-row">
          <IconBox tone="info" size={24}><I.phone size={12} /></IconBox>
          <span className={`store-contact-text${isBlacklisted ? " strikeable-muted" : ""}`}>{c.phone}</span>
        </div>
      )}
      {c.whatsapp && (
        <div className="store-contact-row">
          <IconBox tone="success" size={24}><I.message size={12} /></IconBox>
          <span className={`store-contact-text${isBlacklisted ? " strikeable-muted" : ""}`}>{c.whatsapp}</span>
        </div>
      )}
      {c.address && (
        <div className="store-contact-row">
          <IconBox tone="neutral" size={24}><I.location size={12} /></IconBox>
          <span className={`store-contact-text${isBlacklisted ? " strikeable-muted" : ""}`}>{c.address}</span>
        </div>
      )}

      {isBlacklisted && c.blockReason && (
        <div className="store-block-reason">
          <I.alert size={14} />
          <span>Причина: {c.blockReason}</span>
        </div>
      )}

      {!isBlacklisted && (
        <div className="store-stats-row">
          <Badge color="success" s={{ fontSize: 10 }}>{formatMoney(c.totalSpent)} всего</Badge>
          {c.orderCount > 0 && <Badge color="primary" s={{ fontSize: 10 }}>{c.orderCount} заказов</Badge>}
        </div>
      )}

      <AnimatePresence mode="wait">
        {!isBlacklisted ? (
          <motion.div key="active-actions" className="store-card-actions" {...motionProps}>
            <Btn sz="sm" onClick={e => { e.stopPropagation(); onNewOrder(c.id); }}>Новый заказ</Btn>
            <Btn v="secondary" sz="sm" onClick={e => { e.stopPropagation(); onToggleSelect(c.id); }}>История</Btn>
            <Btn v="secondary" sz="sm" onClick={e => { e.stopPropagation(); onEdit(c); }}>Изменить</Btn>
            {isAdmin && (
              <Btn
                v="danger"
                sz="sm"
                onClick={e => { e.stopPropagation(); onBlacklist(c); }}
                style={{ background: "transparent", border: `1px solid ${C.danger}40` }}
              >
                В ЧС
              </Btn>
            )}
          </motion.div>
        ) : isAdmin ? (
          <motion.div key="blocked-actions" className="store-card-actions store-card-actions--blocked" {...motionProps}>
            <Btn
              v="secondary"
              sz="sm"
              className="store-unblock-btn"
              onClick={e => { e.stopPropagation(); onUnblock(c); }}
              icon={<I.unlock size={14} />}
            >
              Разблокировать
            </Btn>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!isBlacklisted && isSelected && (
        <div className="store-history-panel">
          <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>Последние заказы:</div>
          {clientOrders.filter(o => o.clientId === c.id).sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate)).slice(0, 5).map(o => (
            <div key={o.id} style={{ padding: "6px 0", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, color: C.text }}>
                  {(o.items || []).map(it => it.productName ? `${it.productName} x${it.qty}` : `? x${it.qty}`).join(", ")}
                </div>
                <div style={{ fontSize: 10, color: C.dim }}>
                  {fmtShort(o.orderDate)} {o.source ? `· ${o.source}` : ""} {o.shippedAt ? `· Отгружен: ${fmtShort(o.shippedAt)}` : ""}
                </div>
              </div>
              <Badge color={stIco(o.status)} s={{ fontSize: 10 }}>{o.status}</Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

// STORES & ORDERS (бывший Clients)
const ClientsPage = ()=>{
  const {clients,setClients,clientOrders,setClientOrders,products,setProducts,addLog,currentUser,users,sales,inventoryMovements,setInventoryMovements,addNotification,debts}=useContext(AppContext);
  const role=ROLES.find(r=>r.id===currentUser.roleId);
  const isAdmin=role?.name==="admin"||role?.name==="owner";
  const [tab,setTab]=useState("clients");
  const [modal,setModal]=useState(false);
  const [orderModal,setOrderModal]=useState(false);
  const [toast,setToast]=useState(null);
  const [errs,setErrs]=useState({});
  const [selectedClient,setSelectedClient]=useState(null);
  const [historyOrder,setHistoryOrder]=useState(null);
  const [editStore,setEditStore]=useState(null);
  const emptyStore={name:"",phone:"",whatsapp:"",address:"",contact:"",comment:"",status:"active",blockReason:""};
  const [form,setForm]=useState(emptyStore);
  const ap=products.filter(p=>!p.deleted);
  const [orderForm,setOrderForm]=useState({clientId:"",items:[{productId:ap[0]?.id||"",qty:""}],note:"",source:"WhatsApp",priority:"нормальный"});

  // Calculate reserved quantities — ALL active statuses including "сборка"
  const reserved=useMemo(()=>{
    const m={};
    clientOrders.filter(o=>!["отгружен","отменён"].includes(o.status)).forEach(o=>{
      (o.items||[]).forEach(it=>{m[it.productId]=(m[it.productId]||0)+it.qty});
    });
    return m;
  },[clientOrders]);

  const getAvailable=(productId)=>{
    const p=products.find(x=>x.id===productId);
    return (p?.stock||0)-(reserved[productId]||0);
  };

  const openNewClient=()=>{setEditStore(null);setForm(emptyStore);setErrs({});setModal(true)};
  const openEditStore=(c)=>{setEditStore(c);setForm({name:c.name,phone:c.phone||"",whatsapp:c.whatsapp||"",address:c.address||"",contact:c.contact||"",comment:c.comment||"",status:c.status||"active",blockReason:c.blockReason||""});setErrs({});setModal(true)};
  const saveClient=()=>{
    if(!form.name.trim()){setErrs({name:"!"});return}
    if(editStore){
      setClients(p=>p.map(c=>c.id===editStore.id?{...c,...form}:c));
      addLog(`Магазин обновлён: ${form.name}`);setToast({message:"Магазин обновлён",type:"success"});
    } else {
      setClients(p=>[...p,{id:Date.now(),name:form.name,phone:form.phone,whatsapp:form.whatsapp,address:form.address,contact:form.contact,comment:form.comment,status:form.status||"active",blockReason:form.blockReason||"",createdAt:new Date().toISOString()}]);
      addLog(`Магазин добавлен: ${form.name}`);setToast({message:"Магазин добавлен",type:"success"});
    }
    setModal(false);
  };

  const addOrderItem=()=>setOrderForm(f=>({...f,items:[...f.items,{productId:ap[0]?.id||"",qty:""}]}));
  const removeOrderItem=(i)=>setOrderForm(f=>({...f,items:f.items.filter((_,idx)=>idx!==i)}));
  const updateOrderItem=(i,field,val)=>setOrderForm(f=>({...f,items:f.items.map((it,idx)=>idx===i?{...it,[field]:val}:it)}));

  const openNewOrder=()=>{setOrderForm({clientId:clients.filter(c=>c.status!=="blacklist")[0]?.id||"",items:[{productId:ap[0]?.id||"",qty:""}],note:"",source:"WhatsApp",priority:"нормальный"});setErrs({});setOrderModal(true)};
  const openNewOrderForClient = (clientId) => {
    const store = clients.find(c => c.id === clientId);
    if (isStoreBlacklisted(store)) {
      setToast({ message: "Магазин в чёрном списке. Сначала разблокируйте его.", type: "warn" });
      return;
    }
    setOrderForm({ clientId, items: [{ productId: ap[0]?.id || "", qty: "" }], note: "", source: "WhatsApp", priority: "нормальный" });
    setErrs({});
    setOrderModal(true);
  };

  const blacklistStore = (c) => {
    setClients(p => p.map(x => x.id === c.id ? { ...x, status: "blacklist", blockReason: "заблокирован вручную" } : x));
    addLog(`Чёрный список: ${c.name}`);
    if (selectedClient === c.id) setSelectedClient(null);
  };

  const unblockStore = (c) => {
    setClients(p => p.map(x => x.id === c.id ? { ...x, status: "active", blockReason: "" } : x));
    addLog(`Разблок.: ${c.name}`);
  };

  const saveOrder=()=>{
    if(!orderForm.clientId){setErrs({clientId:"!"});return}
    const store=clients.find(c=>c.id===+orderForm.clientId);
    // Block blacklisted stores (unless admin/owner overrides)
    if(store?.status==="blacklist"&&!isAdmin){setToast({message:`${store.name} в чёрном списке — заказ запрещён`,type:"error"});return}
    if(store?.status==="blocked"&&!isAdmin){setToast({message:`${store.name} заблокирован`,type:"error"});return}
    const validItems=orderForm.items.filter(it=>it.productId&&it.qty&&+it.qty>0);
    if(!validItems.length){setToast({message:"Добавьте товары",type:"error"});return}
    for(const it of validItems){
      const avail=getAvailable(+it.productId);
      const pName=products.find(p=>p.id===+it.productId)?.name;
      if(+it.qty>avail){setToast({message:`Недостаточно: ${pName} (доступно ${avail})`,type:"error"});return}
    }
    const total=validItems.reduce((s,it)=>{const p=products.find(x=>x.id===+it.productId);return s+(p?p.sellPrice*+it.qty:0)},0);
    const now=new Date().toISOString();
    // Snapshot address at time of order
    const addressSnapshot=store?.address||"";
    const itemsSnapshot=validItems.map(it=>({productId:+it.productId,qty:+it.qty,productName:products.find(p=>p.id===+it.productId)?.name||"?",unit:products.find(p=>p.id===+it.productId)?.unit||"",packedQty:0,packedBy:null,packedAt:null}));
    setClientOrders(p=>[...p,{id:Date.now(),clientId:+orderForm.clientId,items:itemsSnapshot,orderDate:now,status:"новый",total,note:orderForm.note,source:orderForm.source||"вручную",priority:orderForm.priority||"нормальный",addressSnapshot,statusChangedAt:now,shippedAt:null,shippedBy:null,packingStatus:"не начата",readyForDeliveryAt:null,deliveryStatus:"ожидает",courierId:null,deliveryStartedAt:null,deliveredAt:null,deliveryComment:"",stockDeductedAt:null,history:[{from:null,to:"новый",userId:currentUser.id,userName:currentUser.name,at:now}]}]);
    addLog(`Заказ от ${store?.name} — ${total.toLocaleString("ru")} ₽ (${orderForm.source})`);
    setToast({message:"Заказ создан — товар зарезервирован",type:"success"});setOrderModal(false);
  };

  const updateOrderStatus=(order,newStatus)=>{
    const now=new Date().toISOString();
    setClientOrders(p=>p.map(o=>o.id===order.id?{...o,status:newStatus,statusChangedAt:now,history:[...(o.history||[]),{from:o.status,to:newStatus,userId:currentUser.id,userName:currentUser.name,at:now}]}:o));
    setToast({message:"Статус обновлён",type:"success"});
  };

  // SHIP ORDER — deduct stock
  const shipOrder=(order)=>{
    const now=new Date().toISOString();
    // Check stock availability
    for(const it of order.items){
      const p=products.find(x=>x.id===it.productId);
      if(!p||p.stock<it.qty){
        setToast({message:`Недостаточно: ${p?.name||"?"} (на складе ${p?.stock||0}, нужно ${it.qty})`,type:"error"});return;
      }
    }
    // Deduct stock and log movements
    order.items.forEach(it=>{
      setProducts(prev=>prev.map(p=>{
        if(p.id!==it.productId) return p;
        const newStock=p.stock-it.qty;
        return {...p,stock:newStock,updatedAt:now};
      }));
      const p=products.find(x=>x.id===it.productId);
      setInventoryMovements(prev=>[...prev,{id:Date.now()+Math.random(),productId:it.productId,type:"order_shipment",quantity:-it.qty,balance:(p?.stock||0)-it.qty,refId:`order-${order.id}`,createdAt:now}]);
    });
    setClientOrders(prev=>prev.map(o=>o.id===order.id?{...o,status:"отгружен",shippedAt:now,shippedBy:currentUser.id,history:[...(o.history||[]),{from:o.status,to:"отгружен",userId:currentUser.id,userName:currentUser.name,at:now}]}:o));
    const cName=clients.find(c=>c.id===order.clientId)?.name;
    addLog(`Отгрузка заказа #${order.id} для ${cName}`);
    addNotification({title:`Заказ #${order.id} отгружен`,type:"информация",content:`Заказ для ${cName} отгружен`,targetAll:true});
    setToast({message:"Заказ отгружен, товар списан со склада",type:"success"});
  };

  const clientStats=clients.map(c=>{
    const orders=clientOrders.filter(o=>o.clientId===c.id);
    const storeDebts=(debts||[]).filter(d=>d.storeId===c.id&&d.status!=="погашен");
    const totalDebt=storeDebts.reduce((s,d)=>s+d.remaining,0);
    return{...c,orderCount:orders.length,totalSpent:orders.reduce((s,o)=>s+o.total,0),totalDebt,activeOrders:orders.filter(o=>!["отгружен","отменён"].includes(o.status)).length};
  });

  const stIco=(s)=>s==="отгружен"?"success":s==="отменён"?"danger":s==="готов"?"purple":"info";
  const statusColor=(s)=>s==="blacklist"?"danger":s==="blocked"?"orange":"success";
  const statusLabel=(s)=>STORE_STATUS_LABELS[s]||s;

  return(
    <div>
      <PageH title="Магазины и заказы">
        <div style={{display:"flex",gap:5,alignItems:"center"}}>
          {[["clients","Магазины"],["orders","Заказы"]].map(([id,lb])=>(
            <button key={id} onClick={()=>setTab(id)} style={{padding:"6px 14px",borderRadius:7,border:`1px solid ${tab===id?C.primary:C.border}`,background:tab===id?C.primaryBg:C.surface,color:tab===id?C.primary:C.muted,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{lb}</button>
          ))}
          <button onClick={()=>window.open(window.location.href.split("?")[0]+"?board=1","_blank")} style={{padding:"6px 14px",borderRadius:7,border:`1px solid ${C.border}`,background:C.surface,color:C.muted,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5}}>⬡ Панель</button>
        </div>
        {tab==="clients"&&<Btn onClick={openNewClient} icon={<I.plus size={15}/>}>Новый магазин</Btn>}
        {tab==="orders"&&<Btn onClick={openNewOrder} icon={<I.plus size={15}/>}>Новый заказ</Btn>}
      </PageH>

      {tab==="clients"&&(
        <div className="stores-grid">
          {clientStats.map(c=>(
            <StoreCard
              key={c.id}
              c={c}
              isAdmin={isAdmin}
              isSelected={selectedClient===c.id}
              onToggleSelect={(id)=>setSelectedClient(selectedClient===id?null:id)}
              onNewOrder={openNewOrderForClient}
              onEdit={openEditStore}
              onBlacklist={blacklistStore}
              onUnblock={unblockStore}
              clientOrders={clientOrders}
              statusColor={statusColor}
              statusLabel={statusLabel}
              stIco={stIco}
            />
          ))}
          {clients.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:50,color:C.dim}}>Нет магазинов. Добавьте первый.</div>}
        </div>
      )}

      {tab==="orders"&&(
        <Card s={{padding:0,overflow:"hidden"}}><div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr><TH>#</TH><TH>Дата</TH><TH>Магазин</TH><TH>Товары</TH><TH>Сумма</TH><TH>Источник</TH><TH>Статус</TH><TH>Отгрузка</TH><TH></TH></tr></thead>
            <tbody>{[...clientOrders].sort((a,b)=>{const p={срочный:0,важный:1,нормальный:2};const pd=(p[a.priority]??2)-(p[b.priority]??2);return pd!==0?pd:new Date(b.orderDate)-new Date(a.orderDate)}).map(o=>{
              const cl=clients.find(c=>c.id===o.clientId);
              const shipper=o.shippedBy?users.find(u=>u.id===o.shippedBy):null;
              const rowBg=o.priority==="срочный"&&!["отгружен","отменён"].includes(o.status)?`${C.danger}08`:o.priority==="важный"&&!["отгружен","отменён"].includes(o.status)?`${C.orange}06`:"transparent";
              return(
                <tr key={o.id} style={{borderBottom:`1px solid ${C.border}`,background:rowBg}}>
                  <TD s={{fontWeight:600,color:C.dim}}>#{o.id}</TD>
                  <TD s={{fontSize:12,whiteSpace:"nowrap"}}>{fmtShort(o.orderDate)}</TD>
                  <TD s={{fontWeight:500}}>
                    {cl?.name||"—"}
                    {o.priority==="срочный"&&<span style={{marginLeft:5,fontSize:9,fontWeight:700,color:C.danger,background:`${C.danger}15`,padding:"1px 5px",borderRadius:3}}>СРОЧНО</span>}
                    {o.priority==="важный"&&<span style={{marginLeft:5,fontSize:9,fontWeight:700,color:C.orange,background:`${C.orange}15`,padding:"1px 5px",borderRadius:3}}>ВАЖНО</span>}
                    {o.addressSnapshot&&<div style={{fontSize:10,color:C.dim,display:"flex",alignItems:"center",gap:4}}><I.location size={10}/>{o.addressSnapshot}</div>}
                  </TD>
                  <TD s={{fontSize:12}}>{(o.items||[]).map(it=>it.productName?`${it.productName} x${it.qty}`:(products.find(x=>x.id===it.productId)?.name||"?")+" x"+it.qty).join(", ")}</TD>
                  <TD s={{fontWeight:700,color:C.primary}}>{(o.total||0).toLocaleString("ru")} ₽</TD>
                  <TD s={{fontSize:11,color:C.muted}}>{o.source||"—"}</TD>
                  <TD>
                    {!["отгружен","отменён"].includes(o.status)?
                      <select value={o.status} onChange={e=>updateOrderStatus(o,e.target.value)} style={{padding:"4px 6px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:5,color:C.text,fontSize:11,fontFamily:"inherit"}}>
                        {ORDER_STATUSES.filter(s=>s!=="отгружен").map(s=><option key={s} value={s}>{s}</option>)}
                      </select>
                      :<Badge color={stIco(o.status)}>{o.status}</Badge>
                    }
                  </TD>
                  <TD s={{fontSize:11,color:C.dim}}>
                    {o.shippedAt?<span>{fmtShort(o.shippedAt)}<br/><span style={{color:C.dim}}>{shipper?.name?.split(" ")[0]}</span></span>:<span>{(o.status==="готов")&&<Btn sz="sm" v="success" onClick={()=>shipOrder(o)} icon={<I.truck size={12}/>}>Отгрузить</Btn>}</span>}
                  </TD>
                  <TD>
                    {(o.history||[]).length>0&&<button onClick={()=>setHistoryOrder(o)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:11,padding:"2px 6px",borderRadius:4,textDecoration:"underline",fontFamily:"inherit"}}>История</button>}
                  </TD>
                </tr>
              );
            })}</tbody>
          </table>
        </div></Card>
      )}

      {/* New/Edit Store Modal */}
      <Modal open={modal} onClose={()=>setModal(false)} title={editStore?"Изменить магазин":"Новый магазин"} width={500}>
        <Inp label="Название магазина" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} error={errs.name}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
          <Inp label="Телефон" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/>
          <Inp label="WhatsApp" value={form.whatsapp} onChange={e=>setForm({...form,whatsapp:e.target.value})} placeholder="+7..."/>
          <Inp label="Контактное лицо" value={form.contact} onChange={e=>setForm({...form,contact:e.target.value})}/>
          <Inp label="Адрес доставки" value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/>
        </div>
        <Sel label="Статус" value={form.status} onChange={e=>setForm({...form,status:e.target.value})} options={STORE_STATUSES.map(s=>({value:s,label:STORE_STATUS_LABELS[s]}))}/>
        {form.status!=="active"&&<Inp label="Причина блокировки" value={form.blockReason} onChange={e=>setForm({...form,blockReason:e.target.value})}/>}
        <Txa label="Комментарий" value={form.comment} onChange={e=>setForm({...form,comment:e.target.value})}/>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:6}}><Btn v="secondary" onClick={()=>setModal(false)}>Отмена</Btn><Btn onClick={saveClient}>{editStore?"Сохранить":"Добавить"}</Btn></div>
      </Modal>

      {/* New Order Modal */}
      <Modal open={orderModal} onClose={()=>setOrderModal(false)} title="Новый заказ" width={560}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
          <Sel label="Магазин" value={orderForm.clientId} onChange={e=>setOrderForm({...orderForm,clientId:e.target.value})} error={errs.clientId} options={[{value:"",label:"Выберите"},...clients.map(c=>({value:c.id,label:`${c.name}${c.status!=="active"?" (!)":""}`}))]}/>
          <Sel label="Приоритет" value={orderForm.priority||"нормальный"} onChange={e=>setOrderForm({...orderForm,priority:e.target.value})} options={ORDER_PRIORITIES.map(p=>({value:p,label:p}))}/>
          <Sel label="Источник" value={orderForm.source||"WhatsApp"} onChange={e=>setOrderForm({...orderForm,source:e.target.value})} options={ORDER_SOURCES.map(s=>({value:s,label:s}))}/>
        </div>
        {orderForm.clientId&&(()=>{const st=clients.find(c=>c.id===+orderForm.clientId);return st?.status==="blacklist"?<div style={{padding:"8px 12px",background:`${C.danger}15`,border:`1px solid ${C.danger}30`,borderRadius:7,fontSize:12,color:C.danger,marginBottom:8,display:"flex",alignItems:"center",gap:6}}><I.alert size={13}/>Магазин в чёрном списке: {st.blockReason||"причина не указана"}</div>:st?.status==="blocked"?<div style={{padding:"8px 12px",background:`${C.orange}15`,border:`1px solid ${C.orange}30`,borderRadius:7,fontSize:12,color:C.orange,marginBottom:8,display:"flex",alignItems:"center",gap:6}}><I.alert size={13}/>Магазин заблокирован</div>:null;})()}
        <div style={{marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <label style={{fontSize:12,fontWeight:500,color:C.muted}}>Товары</label>
            <Btn v="secondary" sz="sm" onClick={addOrderItem} icon={<I.plus size={12}/>}>Добавить</Btn>
          </div>
          {orderForm.items.map((it,i)=>{
            const avail=it.productId?getAvailable(+it.productId):0;
            const shortage=it.qty&&+it.qty>avail;
            return(
              <div key={i} style={{display:"flex",gap:8,marginBottom:6,alignItems:"flex-end"}}>
                <div style={{flex:2}}>
                  <select value={it.productId} onChange={e=>updateOrderItem(i,"productId",e.target.value)} style={{width:"100%",padding:"7px 8px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:12,fontFamily:"inherit"}}>
                    {ap.map(p=><option key={p.id} value={p.id}>{p.name} — {p.sellPrice} ₽ (дост: {getAvailable(p.id)})</option>)}
                  </select>
                </div>
                <div style={{flex:1}}>
                  <input type="number" placeholder="Кол-во" value={it.qty} onChange={e=>updateOrderItem(i,"qty",e.target.value)} style={{width:"100%",padding:"7px 8px",background:C.bg,border:`1px solid ${shortage?C.danger:C.border}`,borderRadius:6,color:shortage?C.danger:C.text,fontSize:12,fontFamily:"inherit",boxSizing:"border-box"}}/>
                </div>
                {shortage&&<span style={{fontSize:10,color:C.danger,flexShrink:0}}>мало!</span>}
                {orderForm.items.length>1&&<button onClick={()=>removeOrderItem(i)} style={{background:"none",border:"none",color:C.danger,cursor:"pointer",padding:4}}><I.x size={14}/></button>}
              </div>
            );
          })}
          {(()=>{const t=orderForm.items.reduce((s,it)=>{const p=products.find(x=>x.id===+it.productId);return s+(p&&it.qty?p.sellPrice*(+it.qty):0)},0);return t>0?<div style={{textAlign:"right",fontSize:14,fontWeight:700,color:C.primary,marginTop:6}}>Итого: {t.toLocaleString("ru")} ₽</div>:null})()}
        </div>
        <Txa label="Примечание" value={orderForm.note} onChange={e=>setOrderForm({...orderForm,note:e.target.value})}/>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}><Btn v="secondary" onClick={()=>setOrderModal(false)}>Отмена</Btn><Btn onClick={saveOrder}>Создать заказ</Btn></div>
      </Modal>

      {/* Order history modal */}
      <Modal open={!!historyOrder} onClose={()=>setHistoryOrder(null)} title={`История заказа #${historyOrder?.id}`} width={420}>
        {historyOrder&&(
          <div>
            {(historyOrder.history||[]).length===0
              ? <div style={{color:C.dim,fontSize:13,textAlign:"center",padding:"16px 0"}}>История не записана</div>
              : (historyOrder.history||[]).map((h,i)=>(
                <div key={i} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"8px 0",borderBottom:i<(historyOrder.history.length-1)?`1px solid ${C.border}`:"none"}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:C.primary,marginTop:5,flexShrink:0}}/>
                  <div>
                    <div style={{fontSize:12,color:C.text}}>
                      {h.from?<><span style={{color:C.dim}}>{h.from}</span>{" → "}<span style={{fontWeight:600}}>{h.to}</span></>:<span style={{fontWeight:600}}>Создан: {h.to}</span>}
                    </div>
                    <div style={{fontSize:11,color:C.dim,marginTop:2}}>{h.userName} · {h.at?new Date(h.at).toLocaleString("ru",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"}):""}</div>
                  </div>
                </div>
              ))
            }
          </div>
        )}
      </Modal>
      {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
    </div>
  );
};


export { ClientsPage };
