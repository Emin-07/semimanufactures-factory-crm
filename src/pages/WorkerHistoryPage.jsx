import { useState, useEffect, useCallback, useMemo, useContext, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area } from "recharts";
import { AppContext } from "../context/AppContext.js";
import { ROLES, JOB_TITLES, PAY_TYPES, STORE_STATUSES, STORE_STATUS_LABELS, ORDER_SOURCES, ATTENDANCE_TYPES, ATTENDANCE_TYPE_COLORS, BATCH_STATUSES, DEFECT_REASONS, PAYROLL_STATUSES, CATEGORIES, UNITS, STATUSES, TASK_STATUSES, RAW_CATEGORIES, RAW_UNITS, NOTIF_TYPES, MARK_TYPES, PLAN_STATUSES, ORDER_STATUSES, ORDER_PRIORITIES, BOARD_COLUMNS, MOVEMENT_TYPES, DEBT_STATUSES, CAMERA_SOURCE_TYPES, CAMERA_SOURCE_LABELS, CAMERA_ZONES } from "../constants/index.js";
import { fmtDate, fmtShort, fmtTime, daysBetween, relTime } from "../utils/dates.js";
import { formatDate } from "../utils/formatters.js";
import { C, CC } from "../theme/colors.js";
import { I } from "../icons/Icons.jsx";
import { EthnicBorder, EthnicCorner, Badge, Btn, Inp, Sel, Txa, Modal, Confirm, Stat, Toast, TH, TD, Card, Title, PageH, SearchBox } from "../components/ui/index.jsx";

// WORKER HISTORY PAGE
const WorkerHistoryPage = ()=>{
  const {users,tasks,taskEmployees,employeeHistory,marks,currentUser,products,productionOutputs}=useContext(AppContext);
  const role=ROLES.find(r=>r.id===currentUser.roleId);
  const isWorker=role?.name==="worker";
  const workers=users.filter(u=>u.roleId===3);
  const [selectedWorker,setSelectedWorker]=useState(isWorker?currentUser.id:(workers[0]?.id||""));
  const [monthFilter,setMonthFilter]=useState("");

  const worker=users.find(u=>u.id===+selectedWorker);
  const wTEs=taskEmployees.filter(te=>te.employeeId===+selectedWorker);
  const doneTEs=wTEs.filter(te=>te.status==="завершено"||te.status==="просрочено");
  const fromTasks=doneTEs.reduce((s,te)=>s+te.producedQty,0);
  const fromOutputs=(productionOutputs||[]).filter(o=>o.employeeId===+selectedWorker).reduce((s,o)=>s+o.quantity,0);
  const totalProduced=fromTasks+fromOutputs;
  const wTasks=tasks.filter(t=>(t.userIds||[]).includes(+selectedWorker));
  const doneTasks=wTasks.filter(t=>t.status==="завершено"||t.status==="просрочено");
  const onTimeTasks=doneTasks.filter(t=>t.status==="завершено"&&new Date(t.completedAt)<=new Date(t.deadline));

  const history=useMemo(()=>{
    let h=[...employeeHistory.filter(eh=>eh.employeeId===+selectedWorker)];
    if(monthFilter){
      h=h.filter(eh=>eh.date.startsWith(monthFilter));
    }
    return h.sort((a,b)=>new Date(b.date)-new Date(a.date));
  },[employeeHistory,selectedWorker,monthFilter]);

  // Generate month options from history
  const months=useMemo(()=>{
    const s=new Set();
    employeeHistory.filter(eh=>eh.employeeId===+selectedWorker).forEach(eh=>{s.add(eh.date.slice(0,7))});
    return [...s].sort().reverse();
  },[employeeHistory,selectedWorker]);

  return(
    <div>
      <PageH title="История работников">
        {!isWorker&&<select value={selectedWorker} onChange={e=>setSelectedWorker(e.target.value)} style={{padding:"7px 9px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,fontSize:12,fontFamily:"inherit"}}>
          {workers.map(w=><option key={w.id} value={w.id}>{w.name.split(" ").slice(0,2).join(" ")}</option>)}
        </select>}
        <select value={monthFilter} onChange={e=>setMonthFilter(e.target.value)} style={{padding:"7px 9px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,fontSize:12,fontFamily:"inherit"}}>
          <option value="">Все месяцы</option>
          {months.map(m=><option key={m} value={m}>{m}</option>)}
        </select>
      </PageH>

      {/* Worker profile + contributions */}
      {worker&&(
        <Card s={{marginBottom:16}} className="worker-summary-card">
          <div style={{display:"flex",flexWrap:"wrap",gap:16,alignItems:"center",marginBottom:4}}>
            <div style={{width:50,height:50,borderRadius:12,background:`linear-gradient(135deg, ${C.primary}25, ${C.primary}10)`,display:"flex",alignItems:"center",justifyContent:"center",color:C.primary,fontWeight:800,fontSize:20,border:`2px solid ${C.primary}30`,flexShrink:0}}>{worker.name.charAt(0)}</div>
            <div style={{flex:"1 1 200px",minWidth:0}}>
              <div style={{fontSize:17,fontWeight:700,color:C.text}}>{worker.name}</div>
              <div style={{fontSize:12,color:C.muted,marginTop:2}}>{ROLES.find(r=>r.id===worker.roleId)?.label}{" · "}{worker.email}</div>
            </div>
          </div>

          <Title>Рабочая сводка</Title>
          <div className="worker-summary-metrics">
            <div style={{background:C.bg,borderRadius:10,padding:"10px 12px",textAlign:"center",border:`1px solid ${C.border}`}}>
              <div className="number-text" style={{fontSize:18,fontWeight:800,color:C.primary}}>{doneTasks.length}</div>
              <div style={{fontSize:10,color:C.dim,marginTop:4}}>Выполнено</div>
            </div>
            <div style={{background:C.bg,borderRadius:10,padding:"10px 12px",textAlign:"center",border:`1px solid ${C.border}`}}>
              <div className="number-text" style={{fontSize:18,fontWeight:800,color:C.success}}>{totalProduced}</div>
              <div style={{fontSize:10,color:C.dim,marginTop:4}}>Произведено</div>
            </div>
            <div style={{background:C.bg,borderRadius:10,padding:"10px 12px",textAlign:"center",border:`1px solid ${C.border}`}}>
              <div className="number-text" style={{fontSize:18,fontWeight:800,color:doneTasks.length?(onTimeTasks.length/doneTasks.length*100)>=80?C.success:C.danger:C.dim}}>{doneTasks.length?(onTimeTasks.length/doneTasks.length*100).toFixed(0):0}%</div>
              <div style={{fontSize:10,color:C.dim,marginTop:4}}>В срок</div>
            </div>
            <div style={{background:C.bg,borderRadius:10,padding:"10px 12px",textAlign:"center",border:`1px solid ${C.border}`}}>
              <div className="number-text" style={{fontSize:18,fontWeight:800,color:C.info}}>{marks.filter(m=>m.employeeId===+selectedWorker&&m.markType==="присутствие").length}</div>
              <div style={{fontSize:10,color:C.dim,marginTop:4}}>Присутствие</div>
            </div>
          </div>

          <div style={{height:1,background:"rgba(255,255,255,.07)",margin:"4px 0 8px"}} />

          <div style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:8}}>Вклад по заданиям</div>
          <div className="worker-contribution-list">
            {doneTEs.slice(0,20).map(te=>{
              const task=tasks.find(t=>t.id===te.taskId);
              const prod=task?products.find(p=>p.id===task.productId):null;
              return(
                <div key={te.id} className="worker-contribution-row">
                  <div style={{minWidth:0}}>
                    <div className="single-line" style={{fontSize:13,fontWeight:600,color:C.text}}>{prod?.name||"—"}</div>
                    <div style={{fontSize:11,color:C.dim,marginTop:2}}>Задание #{te.taskId}</div>
                  </div>
                  <Badge color={te.status==="завершено"?"success":"danger"} s={{fontSize:11}}>{te.producedQty} {prod?.unit||"ед."}</Badge>
                  <span style={{fontSize:11,color:C.dim,whiteSpace:"nowrap"}}>{task?formatDate(task.completedAt):"—"}</span>
                </div>
              );
            })}
          </div>
          {doneTEs.length===0&&<div style={{textAlign:"center",padding:16,color:C.dim,fontSize:13}}>Нет выполненных заданий</div>}
        </Card>
      )}

      {/* History table */}
      <Card s={{padding:0,overflow:"hidden"}}>
        <div style={{padding:"16px 18px 0"}}><Title>История по дням</Title></div>
        <div style={{overflowX:"auto"}}>
          <table className="worker-history-table">
            <colgroup>
              <col style={{width:"16%"}} />
              <col style={{width:"16%"}} />
              <col style={{width:"14%"}} />
              <col style={{width:"14%"}} />
              <col style={{width:"16%"}} />
              <col />
            </colgroup>
            <thead><tr>
              <TH>Дата</TH><TH>Статус</TH><TH>Задания</TH><TH>Произведено</TH><TH>Время</TH><TH>Комментарий</TH>
            </tr></thead>
            <tbody>
              {history.map(h=>(
                <tr key={h.id} style={{borderBottom:`1px solid ${C.border}`,background:h.attendance==="absent"?C.dangerBg:"transparent"}}>
                  <TD s={{fontWeight:500,whiteSpace:"nowrap"}}>{h.date}</TD>
                  <TD><Badge color={h.attendance==="present"?"success":"danger"}>{h.attendance==="present"?"Был":"Отсутствовал"}</Badge></TD>
                  <TD s={{fontWeight:600,textAlign:"center"}}>{h.attendance==="present"?h.tasksCompleted:"\u2014"}</TD>
                  <TD s={{fontWeight:700,color:C.primary,textAlign:"center"}}>{h.attendance==="present"&&h.producedQty>0?h.producedQty:"\u2014"}</TD>
                  <TD s={{color:C.muted,fontSize:12,textAlign:"center"}}>{h.attendance==="present"&&h.workStart?`${h.workStart}\u2013${h.workEnd}`:"\u2014"}</TD>
                  <TD s={{color:C.dim,fontSize:12,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.comment||"\u2014"}</TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {history.length===0&&<div style={{textAlign:"center",padding:50,color:C.dim}}><I.clock size={36}/><p style={{marginTop:10}}>Нет записей</p></div>}
    </div>
  );
};


export { WorkerHistoryPage };
