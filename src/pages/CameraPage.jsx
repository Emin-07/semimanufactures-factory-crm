import { useState, useEffect, useCallback, useMemo, useContext, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area } from "recharts";
import { AppContext } from "../context/AppContext.js";
import { ROLES, JOB_TITLES, PAY_TYPES, STORE_STATUSES, STORE_STATUS_LABELS, ORDER_SOURCES, ATTENDANCE_TYPES, ATTENDANCE_TYPE_COLORS, BATCH_STATUSES, DEFECT_REASONS, PAYROLL_STATUSES, CATEGORIES, UNITS, STATUSES, TASK_STATUSES, RAW_CATEGORIES, RAW_UNITS, NOTIF_TYPES, MARK_TYPES, PLAN_STATUSES, ORDER_STATUSES, ORDER_PRIORITIES, BOARD_COLUMNS, MOVEMENT_TYPES, DEBT_STATUSES, CAMERA_SOURCE_TYPES, CAMERA_SOURCE_LABELS, CAMERA_ZONES } from "../constants/index.js";
import { fmtDate, fmtShort, fmtTime, daysBetween, relTime } from "../utils/dates.js";
import { C, CC } from "../theme/colors.js";
import { I } from "../icons/Icons.jsx";
import { EthnicBorder, EthnicCorner, Badge, Btn, Inp, Sel, Txa, Modal, Confirm, Stat, Toast, TH, TD, Card, Title, PageH, SearchBox, IconBox } from "../components/ui/index.jsx";

// CAMERAS

// Animated demo "camera feed" — no external dependencies
const DemoCameraFeed = ({camId, name}) => {
  const palettes = [
    ["#0a2010","#0a1020"],["#201008","#100a20"],["#10200a","#202010"],["#0a1020","#200a10"],
    ["#101820","#081018"],["#180808","#080818"],
  ];
  const [a,b] = palettes[camId % palettes.length];
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t+1), 1000); return () => clearInterval(id); }, []);
  const ts = new Date().toLocaleTimeString("ru-RU", {hour:"2-digit",minute:"2-digit",second:"2-digit"});
  const ds = new Date().toLocaleDateString("ru-RU", {day:"2-digit",month:"2-digit",year:"numeric"});
  // Simulate subtle motion: slight gradient shift per tick
  const shift = (tick % 10) * 3;
  return (
    <div style={{width:"100%",height:"100%",background:`linear-gradient(${135+shift}deg, ${a}, ${b})`,position:"relative",overflow:"hidden"}}>
      {/* CRT scanlines */}
      <div style={{position:"absolute",inset:0,backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,.07) 3px,rgba(0,0,0,.07) 4px)",pointerEvents:"none",zIndex:1}}/>
      {/* Noise overlay */}
      <div style={{position:"absolute",inset:0,opacity:.04,backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E")`,pointerEvents:"none",zIndex:2}}/>
      {/* Center icon */}
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",zIndex:3}}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5">
          <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
        </svg>
      </div>
      {/* Demo label */}
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",zIndex:4,flexDirection:"column",gap:4}}>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.18)",fontFamily:"monospace",letterSpacing:2,marginTop:40}}>ДЕМО РЕЖИМ</div>
      </div>
      {/* REC dot */}
      <div style={{position:"absolute",top:8,left:10,display:"flex",alignItems:"center",gap:5,zIndex:5}}>
        <div style={{width:7,height:7,borderRadius:"50%",background:"#ff3a3a",animation:"pulseGlow 1s infinite"}}/>
        <span style={{fontSize:10,color:"rgba(255,255,255,0.6)",fontFamily:"monospace",letterSpacing:1}}>REC</span>
      </div>
      {/* Camera ID top-right */}
      <div style={{position:"absolute",top:8,right:10,fontSize:10,color:"rgba(255,255,255,0.3)",fontFamily:"monospace",zIndex:5}}>CAM{String(camId).padStart(2,"0")}</div>
      {/* Timestamp */}
      <div style={{position:"absolute",bottom:8,left:10,zIndex:5}}>
        <div style={{fontSize:11,color:"rgba(0,255,80,0.7)",fontFamily:"monospace",letterSpacing:1}}>{ts}</div>
        <div style={{fontSize:9,color:"rgba(0,255,80,0.4)",fontFamily:"monospace"}}>{ds}</div>
      </div>
    </div>
  );
};

// Renders the actual camera feed based on source type
const CameraFeed = ({cam}) => {
  const [imgKey, setImgKey] = useState(0);
  const [errored, setErrored] = useState(false);

  // Refresh snapshot periodically for "image" type
  useEffect(() => {
    if(cam.type !== "image" || !cam.url) return;
    const sec = Math.max(2, cam.refreshSec || 5);
    const id = setInterval(() => { setImgKey(k => k+1); setErrored(false); }, sec * 1000);
    return () => clearInterval(id);
  }, [cam.type, cam.url, cam.refreshSec]);

  if(!cam.enabled) return (
    <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:"#0f0c09",flexDirection:"column",gap:6}}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
      <span style={{fontSize:11,color:"rgba(255,255,255,0.2)"}}>Камера отключена</span>
    </div>
  );

  if(cam.type === "demo" || !cam.url) return <DemoCameraFeed camId={cam.id} name={cam.name}/>;

  if(cam.type === "iframe") return (
    <iframe
      src={cam.url}
      title={cam.name}
      style={{width:"100%",height:"100%",border:"none",display:"block"}}
      sandbox="allow-scripts allow-same-origin allow-forms"
      allowFullScreen
      onError={()=>setErrored(true)}
    />
  );

  if(cam.type === "image" || cam.type === "mjpeg") {
    if(errored) return (
      <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:"#1a0a0a",flexDirection:"column",gap:8}}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C44E3D" strokeWidth="1.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <span style={{fontSize:11,color:"#C44E3D"}}>Источник недоступен</span>
        <span style={{fontSize:9,color:"rgba(255,255,255,0.2)",maxWidth:160,textAlign:"center",wordBreak:"break-all"}}>{cam.url}</span>
        <button onClick={()=>{setErrored(false);setImgKey(k=>k+1)}} style={{fontSize:10,color:"#C8963E",background:"none",border:"1px solid #C8963E40",borderRadius:4,padding:"3px 10px",cursor:"pointer",marginTop:4}}>Повторить</button>
      </div>
    );
    return (
      <img
        key={`${imgKey}`}
        src={cam.type==="image"?`${cam.url}${cam.url.includes("?")?"&":"?"}_t=${imgKey}`:cam.url}
        alt={cam.name}
        style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}
        onError={()=>setErrored(true)}
        onLoad={()=>setErrored(false)}
      />
    );
  }

  if(cam.type === "mp4" || cam.type === "hls") return (
    <video
      key={cam.url}
      src={cam.url}
      autoPlay muted loop playsInline
      style={{width:"100%",height:"100%",objectFit:"cover",display:"block",background:"#000"}}
      onError={()=>setErrored(true)}
    >
      {cam.type==="hls"&&<source src={cam.url} type="application/x-mpegURL"/>}
      {cam.type==="mp4"&&<source src={cam.url} type="video/mp4"/>}
    </video>
  );

  if(cam.type === "rtsp") return (
    <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:"#0f0c09",flexDirection:"column",gap:8,padding:16}}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E8A838" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <span style={{fontSize:12,color:"#E8A838",fontWeight:600}}>RTSP не поддерживается</span>
      <span style={{fontSize:10,color:"rgba(255,255,255,0.3)",textAlign:"center",lineHeight:1.5}}>Браузер не воспроизводит RTSP напрямую. Используйте WebRTC-шлюз (напр. go2rtc, MediaMTX) и выберите тип "iframe" или "HLS".</span>
    </div>
  );

  return <DemoCameraFeed camId={cam.id} name={cam.name}/>;
};

// Camera tile: feed + overlay label
const CameraTile = ({cam, onFullscreen}) => {
  const isAvailable = cam.enabled && cam.type !== "rtsp";
  const year = new Date().getFullYear();
  return (
    <div
      className="camera-card"
      style={{
        position:"relative",background:"#080604",borderRadius:14,overflow:"hidden",
        border:`1px solid ${isAvailable?"rgba(255,255,255,0.10)":"rgba(255,107,95,0.25)"}`,
        cursor:"pointer",minHeight:280,aspectRatio:"16/9",
      }}
      onDoubleClick={()=>onFullscreen(cam)}
    >
      <CameraFeed cam={cam}/>
      <div className="camera-overlay-top" style={{
        position:"absolute",top:0,left:0,right:0,padding:14,
        background:"linear-gradient(to bottom, rgba(0,0,0,.58), transparent)",
        display:"flex",justifyContent:"space-between",alignItems:"flex-start",pointerEvents:"none",zIndex:6,
      }}>
        <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 8px",borderRadius:8,background:"rgba(0,0,0,.35)"}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:"#ff3a3a",boxShadow:"0 0 6px rgba(255,58,58,.6)"}}/>
          <span style={{fontSize:10,color:"rgba(255,255,255,.75)",fontFamily:"monospace",letterSpacing:1}}>REC</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:5,padding:"4px 8px",borderRadius:8,background:"rgba(0,0,0,.35)"}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:isAvailable?"#74D889":"#FF6B5F"}}/>
          <span style={{fontSize:10,color:isAvailable?"rgba(116,216,137,.9)":"rgba(255,107,95,.9)",fontWeight:600}}>{isAvailable?"ONLINE":"OFFLINE"}</span>
        </div>
      </div>
      <div className="camera-overlay-bottom" style={{
        position:"absolute",bottom:0,left:0,right:0,padding:"28px 14px 14px",
        background:"linear-gradient(to top, rgba(0,0,0,.72), transparent)",
        pointerEvents:"none",zIndex:6,
      }}>
        <div style={{fontSize:14,fontWeight:700,color:C.text,lineHeight:1.3,marginBottom:4}}>{cam.name}</div>
        <div style={{fontSize:11,color:C.muted}}>{cam.zone || "Цех"} · Камера #{cam.id} · {year}</div>
      </div>
    </div>
  );
};

// Camera page
const CameraPage = () => {
  const {cameras, setCameras, currentUser} = useContext(AppContext);
  const role = ROLES.find(r => r.id === currentUser.roleId);
  const canManage = role?.name === "admin" || role?.name === "owner";
  const [tab, setTab] = useState("view");
  const [layout, setLayout] = useState(4); // 1, 4, 9
  const [fullscreenCam, setFullscreenCam] = useState(null);
  const [modal, setModal] = useState(false);
  const [editCam, setEditCam] = useState(null);
  const [form, setForm] = useState({name:"",zone:"Цех",type:"demo",url:"",description:"",enabled:true,refreshSec:5});
  const [errs, setErrs] = useState({});

  const activeCams = cameras.filter(c => c.enabled || tab === "manage");
  const displayCams = cameras.filter(c => c.enabled);

  const openAdd = () => {
    setEditCam(null);
    setForm({name:"",zone:"Цех",type:"demo",url:"",description:"",enabled:true,refreshSec:5});
    setErrs({});
    setModal(true);
  };

  const openEdit = (cam) => {
    setEditCam(cam);
    setForm({name:cam.name,zone:cam.zone||"Цех",type:cam.type,url:cam.url||"",description:cam.description||"",enabled:cam.enabled,refreshSec:cam.refreshSec||5});
    setErrs({});
    setModal(true);
  };

  const saveCamera = () => {
    if(!form.name.trim()) { setErrs({name:"Введите название"}); return; }
    if(form.type !== "demo" && form.type !== "rtsp" && !form.url.trim()) { setErrs({url:"Укажите URL"}); return; }
    if(editCam) {
      setCameras(p => p.map(c => c.id === editCam.id ? {...c,...form,id:c.id} : c));
    } else {
      setCameras(p => [...p, {...form, id:Date.now()}]);
    }
    setModal(false);
  };

  const deleteCamera = (id) => setCameras(p => p.filter(c => c.id !== id));
  const toggleCamera = (id) => setCameras(p => p.map(c => c.id === id ? {...c, enabled:!c.enabled} : c));

  // Grid columns based on layout
  const gridCols = layout === 1 ? 1 : layout === 4 ? 2 : 3;

  // Fullscreen overlay
  if(fullscreenCam) return (
    <div style={{position:"fixed",inset:0,background:"#000",zIndex:9999,display:"flex",flexDirection:"column"}}>
      <div style={{flexShrink:0,padding:"8px 16px",background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
        <div>
          <span style={{fontSize:14,fontWeight:700,color:"#fff"}}>{fullscreenCam.name}</span>
          <span style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginLeft:10}}>{fullscreenCam.zone}</span>
        </div>
        <button onClick={()=>setFullscreenCam(null)} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,color:"#fff",cursor:"pointer",padding:"5px 14px",fontSize:12,fontFamily:"inherit"}}>✕ Закрыть</button>
      </div>
      <div style={{flex:1,overflow:"hidden"}}>
        <CameraFeed cam={fullscreenCam}/>
      </div>
    </div>
  );

  return (
    <div>
      <PageH title="Камеры">
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {canManage && [["view","Просмотр"],["manage","Управление"]].map(([id,lb]) => (
            <button key={id} onClick={()=>setTab(id)} style={{padding:"6px 14px",borderRadius:7,border:`1px solid ${tab===id?C.primary:C.border}`,background:tab===id?C.primaryBg:C.surface,color:tab===id?C.primary:C.muted,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{lb}</button>
          ))}
          {tab==="view" && [1,4,9].map(n => (
            <button key={n} onClick={()=>setLayout(n)} style={{padding:"5px 12px",borderRadius:7,border:`1px solid ${layout===n?C.primary:C.border}`,background:layout===n?C.primaryBg:C.surface,color:layout===n?C.primary:C.muted,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              {n===1?"1×1":n===4?"2×2":"3×3"}
            </button>
          ))}
        </div>
        {tab==="manage"&&canManage&&<Btn onClick={openAdd} icon={<I.plus size={15}/>}>Добавить камеру</Btn>}
      </PageH>

      {/* View tab */}
      {tab==="view" && (
        <>
          {displayCams.length===0 ? (
            <Card><div style={{textAlign:"center",padding:"40px 20px",color:C.muted}}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{opacity:.3,marginBottom:12}}><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              <div style={{fontSize:14}}>Нет активных камер</div>
              {canManage&&<div style={{fontSize:12,marginTop:6,color:C.dim}}>Добавьте камеры на вкладке «Управление»</div>}
            </div></Card>
          ) : (
            <div style={{display:"grid",gridTemplateColumns:`repeat(${gridCols},1fr)`,gap:12}}>
              {displayCams.slice(0, layout).map(cam => (
                <CameraTile key={cam.id} cam={cam} onFullscreen={setFullscreenCam}/>
              ))}
              {/* Empty slots to fill grid */}
              {displayCams.length < layout && Array.from({length: layout - displayCams.length}).map((_,i) => (
                <div key={`empty-${i}`} style={{background:"rgba(255,255,255,0.015)",borderRadius:10,border:"1px dashed rgba(255,255,255,0.06)",aspectRatio:"16/9",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <span style={{fontSize:11,color:"rgba(255,255,255,0.1)"}}>—</span>
                </div>
              ))}
            </div>
          )}
          {displayCams.length > layout && (
            <div style={{marginTop:10,fontSize:12,color:C.dim,textAlign:"center"}}>
              Показано {layout} из {displayCams.length} активных. Переключите сетку выше.
            </div>
          )}
          <div style={{marginTop:12,padding:"8px 14px",background:C.surface,borderRadius:8,border:`1px solid ${C.border}`,fontSize:11,color:C.dim}}>
            💡 Двойной клик на камере — полный экран. Конфигурация хранится в localStorage этого браузера.
          </div>
        </>
      )}

      {/* Manage tab */}
      {tab==="manage"&&canManage && (
        <Card s={{padding:0,overflow:"hidden"}}>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr><TH>Камера</TH><TH>Зона</TH><TH>Тип</TH><TH>URL</TH><TH>Статус</TH><TH></TH></tr></thead>
              <tbody>{cameras.map(cam => (
                <tr key={cam.id} style={{borderBottom:`1px solid ${C.border}`,opacity:cam.enabled?1:0.5}}>
                  <TD s={{fontWeight:600}}>
                    <div>{cam.name}</div>
                    {cam.description&&<div style={{fontSize:11,color:C.dim,fontWeight:400}}>{cam.description}</div>}
                  </TD>
                  <TD><Badge color="info">{cam.zone}</Badge></TD>
                  <TD><code style={{fontSize:11,color:C.primary,background:C.primaryBg,padding:"2px 6px",borderRadius:4}}>{CAMERA_SOURCE_LABELS[cam.type]||cam.type}</code></TD>
                  <TD s={{fontSize:11,color:C.dim,maxWidth:200}}>
                    <div style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cam.url||<span style={{opacity:.4}}>—</span>}</div>
                  </TD>
                  <TD>
                    <button onClick={()=>toggleCamera(cam.id)} style={{padding:"3px 10px",borderRadius:5,border:`1px solid ${cam.enabled?"rgba(82,201,122,0.3)":"rgba(196,78,61,0.3)"}`,background:cam.enabled?"rgba(82,201,122,0.08)":"rgba(196,78,61,0.08)",color:cam.enabled?"#52C97A":"#C44E3D",fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>
                      {cam.enabled?"Вкл":"Выкл"}
                    </button>
                  </TD>
                  <TD>
                    <div style={{display:"flex",gap:4}}>
                      <Btn v="secondary" sz="sm" onClick={()=>openEdit(cam)} icon={<I.edit size={12}/>}>Ред.</Btn>
                      <Btn v="danger" sz="sm" onClick={()=>deleteCamera(cam.id)} icon={<I.trash size={12}/>}/>
                    </div>
                  </TD>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add/Edit camera modal */}
      <Modal open={modal} onClose={()=>setModal(false)} title={editCam?"Редактировать камеру":"Добавить камеру"} width={520}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
          <Inp label="Название" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} error={errs.name}/>
          <Sel label="Зона" value={form.zone} onChange={e=>setForm({...form,zone:e.target.value})} options={CAMERA_ZONES.map(z=>({value:z,label:z}))}/>
          <Sel label="Тип источника" value={form.type} onChange={e=>setForm({...form,type:e.target.value,url:""})} options={CAMERA_SOURCE_TYPES.map(t=>({value:t,label:CAMERA_SOURCE_LABELS[t]}))}/>
          {form.type==="image"&&<Inp label="Обновл. (сек)" value={form.refreshSec} onChange={e=>setForm({...form,refreshSec:+e.target.value})} type="number" min={1} max={60}/>}
        </div>
        {form.type==="rtsp"&&(
          <div style={{display:"flex",alignItems:"flex-start",gap:10,padding:"8px 12px",background:"rgba(232,168,56,0.08)",border:"1px solid rgba(232,168,56,0.25)",borderRadius:7,fontSize:11,color:"#E8A838",marginBottom:8}}>
            <IconBox tone="warning" size={28}><I.alert size={14}/></IconBox>
            <span>RTSP не воспроизводится браузером напрямую. Настройте WebRTC-шлюз (go2rtc / MediaMTX) и выберите тип &quot;iframe&quot; с URL шлюза.</span>
          </div>
        )}
        {form.type==="hls"&&(
          <div style={{display:"flex",alignItems:"flex-start",gap:10,padding:"8px 12px",background:"rgba(91,141,181,0.08)",border:"1px solid rgba(91,141,181,0.2)",borderRadius:7,fontSize:11,color:C.info,marginBottom:8}}>
            <IconBox tone="info" size={28}><I.alert size={14}/></IconBox>
            <span>HLS (.m3u8) воспроизводится нативно в Safari. В Chrome/Firefox требуется прокси с поддержкой HLS или конвертация.</span>
          </div>
        )}
        {form.type!=="demo"&&form.type!=="rtsp"&&(
          <Inp label="URL потока / источника" value={form.url} onChange={e=>setForm({...form,url:e.target.value})} error={errs.url}/>
        )}
        <Inp label="Описание (необязательно)" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
          <input type="checkbox" id="cam-enabled" checked={form.enabled} onChange={e=>setForm({...form,enabled:e.target.checked})} style={{accentColor:C.primary}}/>
          <label htmlFor="cam-enabled" style={{fontSize:13,color:C.muted,cursor:"pointer"}}>Камера активна</label>
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:6}}>
          <Btn v="secondary" onClick={()=>setModal(false)}>Отмена</Btn>
          <Btn onClick={saveCamera}>{editCam?"Сохранить":"Добавить"}</Btn>
        </div>
      </Modal>
    </div>
  );
};
const BOARD_COL_COLORS = {
  "новый":          {bg:"rgba(20,32,52,0.9)",  border:"rgba(74,144,226,0.3)",  dot:"#4A90E2", title:"#7BB8F5"},
  "сборка":         {bg:"rgba(38,28,10,0.9)",  border:"rgba(232,168,56,0.3)",  dot:"#E8A838", title:"#F0C060"},
  "в производстве": {bg:"rgba(32,20,8,0.9)",   border:"rgba(200,150,62,0.3)",  dot:"#C8963E", title:"#E8B060"},
  "готов":          {bg:"rgba(8,36,14,0.9)",   border:"rgba(82,201,122,0.3)",  dot:"#52C97A", title:"#80E8A0"},
};

const fmtElapsed=(since,now)=>{
  if(!since) return "";
  const ms=now-new Date(since).getTime();
  if(ms<0) return "0с";
  const s=Math.floor(ms/1000);
  if(s<60) return `${s}с`;
  const m=Math.floor(s/60);
  if(m<60) return `${m}мин`;
  const h=Math.floor(m/60);
  return `${h}ч ${m%60}м`;
};

const elapsedColor=(since,now)=>{
  if(!since) return "#A89882";
  const m=(now-new Date(since).getTime())/60000;
  if(m<30) return "#52C97A";
  if(m<90) return "#E8A838";
  return "#E85050";
};


export { CameraPage };
