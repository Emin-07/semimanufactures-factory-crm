import { useState, useEffect, useCallback, useMemo, useContext, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area } from "recharts";
import { AppContext } from "../context/AppContext.js";
import { ROLES, JOB_TITLES, PAY_TYPES, STORE_STATUSES, STORE_STATUS_LABELS, ORDER_SOURCES, ATTENDANCE_TYPES, ATTENDANCE_TYPE_COLORS, BATCH_STATUSES, DEFECT_REASONS, PAYROLL_STATUSES, CATEGORIES, UNITS, STATUSES, TASK_STATUSES, RAW_CATEGORIES, RAW_UNITS, NOTIF_TYPES, MARK_TYPES, PLAN_STATUSES, ORDER_STATUSES, ORDER_PRIORITIES, BOARD_COLUMNS, MOVEMENT_TYPES, DEBT_STATUSES, CAMERA_SOURCE_TYPES, CAMERA_SOURCE_LABELS, CAMERA_ZONES } from "../constants/index.js";
import { fmtDate, fmtShort, fmtTime, daysBetween, relTime } from "../utils/dates.js";
import { C, CC } from "../theme/colors.js";
import { I } from "../icons/Icons.jsx";
import { EthnicBorder, EthnicCorner, Badge, Btn, Inp, Sel, Txa, Modal, Confirm, Stat, Toast, TH, TD, Card, Title, PageH, SearchBox, EmptyState, StatusPill } from "../components/ui/index.jsx";
import { INIT_PRODUCTS } from "../data/initState.js";

function fmtElapsed(refTime, now) {
  const min = Math.floor((now - new Date(refTime).getTime()) / 60000);
  if (min < 60) return `${min}м`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}ч ${m}м` : `${h}ч`;
}

function elapsedColor(refTime, now) {
  const min = (now - new Date(refTime).getTime()) / 60000;
  if (min < 30) return "#52C97A";
  if (min < 90) return "#E8A838";
  return "#E85050";
}

const BOARD_COL_COLORS = {
  "новый":          { bg: "rgba(30,25,18,0.9)", border: "rgba(91,141,181,0.25)",  dot: "#5B8DB5", title: "#5B8DB5" },
  "сборка":         { bg: "rgba(30,25,18,0.9)", border: "rgba(212,130,58,0.25)", dot: "#D4823A", title: "#D4823A" },
  "в производстве": { bg: "rgba(30,25,18,0.9)", border: "rgba(200,150,62,0.25)", dot: "#C8963E", title: "#C8963E" },
  "готов":          { bg: "rgba(18,35,22,0.9)", border: "rgba(90,158,95,0.3)",   dot: "#5A9E5F", title: "#5A9E5F" },
};

const BoardOrderCard=({order,clients,products,now})=>{
  const client=clients.find(c=>c.id===order.clientId);
  const storeName=order.storeName||order.clientName||client?.name||"Магазин не указан";
  const packingStatus=order.packingStatus||"не начата";
  const deliveryStatus=order.deliveryStatus||"ожидает";
  const refTime=order.statusChangedAt||order.orderDate;
  const elapsed=fmtElapsed(refTime,now);
  const eColor=elapsedColor(refTime,now);
  const isDelayed=(now-new Date(refTime).getTime())>90*60000;
  const isCrit=order.priority==="срочный";
  const isImp=order.priority==="важный";
  return (
    <div style={{background:isDelayed?"rgba(232,80,80,0.06)":"rgba(255,255,255,0.03)",border:`1px solid ${isCrit?"rgba(232,80,80,0.4)":isDelayed?"rgba(232,80,80,0.2)":"rgba(255,255,255,0.07)"}`,borderRadius:10,padding:"12px 14px",marginBottom:8,position:"relative",animation:isCrit?"pulseBorder 2s infinite":"none"}}>
      {(isCrit||isImp)&&<div style={{position:"absolute",top:0,left:0,bottom:0,width:3,borderRadius:"10px 0 0 10px",background:isCrit?"#E85050":"#E8A838"}}/>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8,paddingLeft:(isCrit||isImp)?6:0}}>
        <div style={{display:"flex",alignItems:"center",gap:7}}>
          <span style={{fontSize:22,fontWeight:800,color:"#C8963E",letterSpacing:-1}}>#{order.id}</span>
          {isCrit&&<span style={{fontSize:10,fontWeight:700,background:"rgba(232,80,80,0.2)",color:"#E85050",border:"1px solid rgba(232,80,80,0.35)",borderRadius:4,padding:"2px 6px",letterSpacing:0.5}}>СРОЧНО</span>}
          {isImp&&!isCrit&&<span style={{fontSize:10,fontWeight:700,background:"rgba(232,168,56,0.15)",color:"#E8A838",border:"1px solid rgba(232,168,56,0.3)",borderRadius:4,padding:"2px 6px"}}>ВАЖНЫЙ</span>}
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          <div style={{fontSize:20,fontWeight:800,color:eColor,fontVariantNumeric:"tabular-nums"}}>{elapsed}</div>
          <div style={{fontSize:9,color:"#6B5D4D",letterSpacing:0.3}}>в статусе</div>
        </div>
      </div>
      <div style={{fontSize:16,fontWeight:700,color:"#F0E8DD",marginBottom:8,paddingLeft:(isCrit||isImp)?6:0}}>{storeName}</div>
      <div style={{paddingLeft:(isCrit||isImp)?6:0}}>
        {order.items.map((it,i)=>{
          const p=products.find(x=>x.id===it.productId);
          return <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#A89882",padding:"3px 0",borderTop:i>0?"1px solid rgba(255,255,255,0.04)":"none"}}><span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",paddingRight:8}}>{p?.name||"?"}</span><span style={{fontWeight:700,color:"#F0E8DD",flexShrink:0}}>{it.qty} {p?.unit||""}</span></div>;
        })}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8,paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.05)",paddingLeft:(isCrit||isImp)?6:0}}>
        <div style={{fontSize:11,color:"#6B5D4D"}}>{order.orderDate?new Date(order.orderDate).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})+" / "+new Date(order.orderDate).toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit"}):"—"}</div>
        <div style={{fontSize:14,fontWeight:700,color:"#C8963E"}}>{(order.total||0).toLocaleString("ru")} ₽</div>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:7,paddingLeft:(isCrit||isImp)?6:0}}>
        <StatusPill color={packingStatus==="готов к доставке"?"success":packingStatus==="фасуется"?"orange":"info"}>
          Фасовка: {packingStatus}
        </StatusPill>
        <StatusPill color={deliveryStatus==="доставлен"?"success":deliveryStatus==="в доставке"?"purple":"info"}>
          Доставка: {deliveryStatus}
        </StatusPill>
      </div>
      {order.note&&<div style={{marginTop:6,fontSize:11,color:"#A89882",fontStyle:"italic",background:"rgba(255,255,255,0.03)",borderRadius:5,padding:"4px 8px"}}>{order.note}</div>}
    </div>
  );
};

const BoardColumns=({orders,products,clients,now})=>(
  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,height:"100%",overflow:"hidden"}}>
    {BOARD_COLUMNS.map(col=>{
      const colOrders=[...orders].filter(o=>o.status===col.id).sort((a,b)=>{
        const pa=a.priority==="срочный"?0:a.priority==="важный"?1:2;
        const pb=b.priority==="срочный"?0:b.priority==="важный"?1:2;
        if(pa!==pb) return pa-pb;
        return new Date(a.orderDate)-new Date(b.orderDate);
      });
      const cc=BOARD_COL_COLORS[col.id]||{bg:"rgba(30,25,18,0.9)",border:"rgba(255,255,255,0.1)",dot:"#A89882",title:"#A89882"};
      const totalVal=colOrders.reduce((s,o)=>s+(o.total||0),0);
      const hasDelayed=colOrders.some(o=>(now-new Date(o.statusChangedAt||o.orderDate).getTime())>90*60000);
      return (
        <div key={col.id} style={{background:cc.bg,borderRadius:12,border:`1px solid ${cc.border}`,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0}}>
          <div style={{padding:"12px 14px",borderBottom:`1px solid ${cc.border}`,flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:9,height:9,borderRadius:"50%",background:cc.dot,boxShadow:`0 0 8px ${cc.dot}90`}}/>
                <span style={{fontSize:13,fontWeight:700,color:"#fff",letterSpacing:0.4}}>{col.label.toUpperCase()}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                {hasDelayed&&<span style={{fontSize:13,color:"#E85050",display:"inline-flex"}} title="Есть задержанные"><I.alert size={13}/></span>}
                <span style={{fontSize:26,fontWeight:800,color:cc.dot,lineHeight:1}}>{colOrders.length}</span>
              </div>
            </div>
            {colOrders.length>0&&<div style={{fontSize:11,color:cc.title,marginTop:3}}>{totalVal.toLocaleString("ru")} ₽</div>}
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"8px"}}>
            {colOrders.length===0
              ?<div style={{textAlign:"center",color:"rgba(255,255,255,0.15)",fontSize:12,paddingTop:24}}>нет заказов</div>
              :colOrders.map(o=><BoardOrderCard key={o.id} order={o} clients={clients} products={products} now={now}/>)
            }
          </div>
        </div>
      );
    })}
  </div>
);

const OrdersBoardStandalone=()=>{
  const [orders,setOrders]=useState([]);
  const [products,setProducts]=useState(INIT_PRODUCTS);
  const [now,setNow]=useState(Date.now());
  const [lastSync,setLastSync]=useState(null);
  const [syncing,setSyncing]=useState(false);

  useEffect(()=>{
    const poll=async()=>{
      setSyncing(true);
      try{
        const [o,p]=await Promise.all([
          fetch("/api/board/orders").then(r=>r.ok?r.json():null),
          fetch("/api/board/products").then(r=>r.ok?r.json():null),
        ]);
        if(Array.isArray(o)) setOrders(o);
        if(Array.isArray(p)) setProducts(p);
        setLastSync(Date.now());
      }catch(e){}
      setSyncing(false);
    };
    poll();
    const id=setInterval(poll,6000);
    return()=>clearInterval(id);
  },[]);

  useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id);},[]);

  const activeOrders=orders.filter(o=>!["отгружен","отменён"].includes(o.status));
  const urgentCount=activeOrders.filter(o=>o.priority==="срочный").length;
  const timeStr=new Date(now).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  const dateStr=new Date(now).toLocaleDateString("ru-RU",{weekday:"long",day:"numeric",month:"long"});

  return (
    <div style={{height:"100vh",display:"flex",flexDirection:"column",background:"#0F0C09",overflow:"hidden",color:"#F0E8DD"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Noto Sans',sans-serif;background:#0F0C09;overflow:hidden}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px}
        @keyframes pulseBorder{0%,100%{box-shadow:0 0 0 1px rgba(232,80,80,0.3)}50%{box-shadow:0 0 0 3px rgba(232,80,80,0.6)}}
        @keyframes pulseGlow{0%,100%{opacity:1}50%{opacity:0.3}}
        option{background:#1A1510;color:#F0E8DD}
      `}</style>
      <div style={{padding:"8px 20px",borderBottom:"1px solid rgba(255,255,255,0.05)",background:"rgba(0,0,0,0.4)",flexShrink:0,display:"flex",alignItems:"center",gap:20}}>
        <div style={{display:"flex",alignItems:"center",gap:10,minWidth:180}}>
          <div style={{width:34,height:34,borderRadius:9,background:"rgba(200,150,62,0.15)",display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid rgba(200,150,62,0.3)",fontSize:20,color:"#C8963E"}}>⬡</div>
          <div>
            <div style={{fontSize:14,fontWeight:800,color:"#F0E8DD",letterSpacing:1}}>ПАНЕЛЬ ЗАКАЗОВ</div>
            <div style={{fontSize:9,color:"#6B5D4D",letterSpacing:0.5}}>MEALIFY · ПРОИЗВОДСТВО</div>
          </div>
        </div>
        <div style={{flex:1,textAlign:"center"}}>
          <div style={{fontSize:36,fontWeight:800,color:"#fff",fontVariantNumeric:"tabular-nums",letterSpacing:3,lineHeight:1}}>{timeStr}</div>
          <div style={{fontSize:11,color:"#A89882",textTransform:"capitalize",marginTop:2}}>{dateStr}</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,minWidth:180,justifyContent:"flex-end"}}>
          {urgentCount>0&&(
            <div style={{background:"rgba(232,80,80,0.12)",border:"1px solid rgba(232,80,80,0.3)",borderRadius:8,padding:"6px 14px",textAlign:"center",animation:"pulseBorder 2s infinite"}}>
              <div style={{fontSize:24,fontWeight:800,color:"#E85050",lineHeight:1}}>{urgentCount}</div>
              <div style={{fontSize:9,color:"#E85050",letterSpacing:0.5}}>СРОЧНЫХ</div>
            </div>
          )}
          <div style={{background:"rgba(200,150,62,0.08)",border:"1px solid rgba(200,150,62,0.2)",borderRadius:8,padding:"6px 14px",textAlign:"center"}}>
            <div style={{fontSize:24,fontWeight:800,color:"#C8963E",lineHeight:1}}>{activeOrders.length}</div>
            <div style={{fontSize:9,color:"#A89882",letterSpacing:0.5}}>АКТИВНЫХ</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end"}}>
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:syncing?"#E8A838":"#52C97A",animation:syncing?"pulseGlow 1s infinite":"none"}}/>
              <span style={{fontSize:9,color:"#6B5D4D"}}>{syncing?"синхр...":lastSync?"синхр.":""}</span>
            </div>
            <button onClick={()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:5,color:"#6B5D4D",cursor:"pointer",fontSize:10,padding:"3px 9px",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:4}}><I.eye size={11}/> полный экран</button>
            <a href="/" style={{fontSize:9,color:"rgba(255,255,255,0.2)",textDecoration:"none"}}>← система</a>
          </div>
        </div>
      </div>
      <div style={{flex:1,padding:14,minHeight:0,overflow:"hidden"}}>
        <BoardColumns orders={orders} products={products} clients={[]} now={now}/>
      </div>
      <div style={{padding:"3px 20px",borderTop:"1px solid rgba(255,255,255,0.03)",flexShrink:0,display:"flex",justifyContent:"space-between"}}>
        <span style={{fontSize:9,color:"rgba(255,255,255,0.1)"}}>Синхронизация через backend API (каждые 6с). Разные устройства — через сервер. Вкладки одного браузера — мгновенно.</span>
        <span style={{fontSize:9,color:"rgba(255,255,255,0.1)",display:"inline-flex",alignItems:"center",gap:8}}>
          <span style={{display:"inline-flex",alignItems:"center",gap:4}}><span style={{width:7,height:7,borderRadius:"50%",background:"#52C97A"}}/> {"<30мин"}</span>
          <span style={{display:"inline-flex",alignItems:"center",gap:4}}><span style={{width:7,height:7,borderRadius:"50%",background:"#E8A838"}}/> {"30–90мин"}</span>
          <span style={{display:"inline-flex",alignItems:"center",gap:4}}><I.alert size={10}/> {">90мин"}</span>
        </span>
      </div>
    </div>
  );
};

const OrdersBoardPage=()=>{
  const {clientOrders,products,clients}=useContext(AppContext);
  const [now,setNow]=useState(Date.now());
  useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id);},[]);
  const openBoard=()=>window.open(window.location.href.split("?")[0]+"?board=1","_blank");
  const activeOrders=clientOrders.filter(o=>!["отгружен","отменён"].includes(o.status));
  const urgentCount=activeOrders.filter(o=>o.priority==="срочный").length;
  return (
    <div>
      <PageH title="Доска заказов">
        <Btn onClick={openBoard} icon={<I.eye size={15}/>}>Открыть полный экран</Btn>
      </PageH>
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <Stat icon={<I.tasks size={18}/>} label="Активных заказов" value={activeOrders.length} color={C.primary}/>
        {urgentCount>0&&<Stat icon={<I.alert size={18}/>} label="Срочных" value={urgentCount} color={C.danger}/>}
        <Stat icon={<I.check size={18}/>} label="Готово к отгрузке" value={clientOrders.filter(o=>o.status==="готов").length} color={C.success}/>
      </div>
      {activeOrders.length===0 ? (
        <EmptyState icon={<I.clipboard size={34}/>} title="Нет активных заказов" sub="Когда появятся новые, они сразу отобразятся на доске" />
      ) : (
        <div style={{height:"calc(100vh - 260px)",minHeight:420,overflow:"hidden"}}>
          <BoardColumns orders={activeOrders} products={products} clients={clients} now={now}/>
        </div>
      )}
    </div>
  );
};


export { OrdersBoardStandalone, OrdersBoardPage };
