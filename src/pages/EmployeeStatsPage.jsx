import { useState, useEffect, useCallback, useMemo, useContext, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area } from "recharts";
import { AppContext } from "../context/AppContext.js";
import { ROLES, JOB_TITLES, PAY_TYPES, STORE_STATUSES, STORE_STATUS_LABELS, ORDER_SOURCES, ATTENDANCE_TYPES, ATTENDANCE_TYPE_COLORS, BATCH_STATUSES, DEFECT_REASONS, PAYROLL_STATUSES, CATEGORIES, UNITS, STATUSES, TASK_STATUSES, RAW_CATEGORIES, RAW_UNITS, NOTIF_TYPES, MARK_TYPES, PLAN_STATUSES, ORDER_STATUSES, ORDER_PRIORITIES, BOARD_COLUMNS, MOVEMENT_TYPES, DEBT_STATUSES, CAMERA_SOURCE_TYPES, CAMERA_SOURCE_LABELS, CAMERA_ZONES } from "../constants/index.js";
import { fmtDate, fmtShort, fmtTime, daysBetween, relTime } from "../utils/dates.js";
import { C, CC } from "../theme/colors.js";
import { I } from "../icons/Icons.jsx";
import { EthnicBorder, EthnicCorner, Badge, Btn, Inp, Sel, Txa, Modal, Confirm, Stat, Toast, TH, TD, Card, Title, PageH, SearchBox } from "../components/ui/index.jsx";
import { GlassChartTooltip } from "../components/charts/GlassChartTooltip.jsx";

// EMPLOYEE STATISTICS / KPI
const EmployeeStatsPage = ()=>{
  const {users,tasks,marks,taskEmployees,productionOutputs}=useContext(AppContext);
  const workers=users.filter(u=>u.roleId===3);

  const stats=useMemo(()=>workers.map(w=>{
    const wTEs=taskEmployees.filter(te=>te.employeeId===w.id);
    const doneTEs=wTEs.filter(te=>te.status==="завершено"||te.status==="просрочено");
    const wTasks=tasks.filter(t=>(t.userIds||[]).includes(w.id));
    const done=wTasks.filter(t=>t.status==="завершено"||t.status==="просрочено");
    const onTime=done.filter(t=>t.status==="завершено"&&new Date(t.completedAt)<=new Date(t.deadline));
    const fromTasks=doneTEs.reduce((s,te)=>s+te.producedQty,0);
    const fromOutputs=(productionOutputs||[]).filter(o=>o.employeeId===w.id).reduce((s,o)=>s+o.quantity,0);
    const totalProduced=fromTasks+fromOutputs;
    const avgTime=done.length?done.reduce((s,t)=>{const hrs=(new Date(t.completedAt)-new Date(t.createdAt))/(1000*60*60);return s+hrs},0)/done.length:0;
    const activeDays=new Set(done.map(t=>fmtShort(t.completedAt))).size||1;
    const presenceMarks=marks.filter(m=>m.employeeId===w.id&&m.markType==="присутствие").length;
    return{
      id:w.id,name:w.name,shortName:w.name.split(" ").slice(0,2).join(" "),
      total:wTasks.length,done:done.length,pending:wTasks.filter(t=>t.status==="назначено"||t.status==="в работе").length,
      onTime:onTime.length,onTimePct:done.length?(onTime.length/done.length*100).toFixed(0):0,
      produced:totalProduced,avgTime:avgTime.toFixed(1),
      completionPct:wTasks.length?(done.length/wTasks.length*100).toFixed(0):0,
      perDay:(totalProduced/activeDays).toFixed(0),
      rating:done.length?(onTime.length/done.length*50+totalProduced/Math.max(1,wTasks.length)*50).toFixed(0):0,
      presenceMarks,
    };
  }).sort((a,b)=>b.rating-a.rating),[workers,tasks,marks,taskEmployees,productionOutputs]);

  const chartData=stats.map(s=>({name:s.shortName,План:s.total,Факт:s.done,Произведено:s.produced}));

  return(
    <div>
      <PageH title="Статистика сотрудников"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:14,marginBottom:18}}>
        <Card><Title>План vs Факт</Title>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
              <XAxis dataKey="name" tick={{fill:C.dim,fontSize:10}}/><YAxis tick={{fill:C.dim,fontSize:10}}/>
              <Tooltip content={<GlassChartTooltip />}/>
              <Legend wrapperStyle={{fontSize:12}}/>
              <Bar dataKey="План" fill={C.info} radius={[3,3,0,0]}/>
              <Bar dataKey="Факт" fill={C.success} radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card><Title>Рейтинг сотрудников</Title>
          {stats.map((s,i)=>{const pct=Math.min(100,+s.rating);return(
            <div key={s.id} style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:24,height:24,borderRadius:6,background:`${CC[i]}15`,color:CC[i],display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700}}>{i+1}</div>
                  <span style={{fontSize:13,color:C.text,fontWeight:500}}>{s.shortName}</span>
                </div>
                <span style={{fontSize:13,fontWeight:700,color:C.primary}}>{s.rating}</span>
              </div>
              <div style={{height:5,background:C.bg,borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${pct}%`,background:CC[i],borderRadius:3,transition:"width .5s"}}/>
              </div>
            </div>
          );})}
        </Card>
      </div>
      <Card s={{padding:0,overflow:"hidden"}}><div style={{overflowX:"auto"}}>
        <table className="worker-history-table" style={{width:"100%",borderCollapse:"collapse",tableLayout:"fixed"}}><thead><tr>
          <TH>Сотрудник</TH><TH>Заданий</TH><TH>Выполнено</TH><TH>% вып.</TH><TH>В срок</TH><TH>Произведено</TH><TH>Ср. время</TH><TH>В день</TH><TH>Присутствие</TH><TH>Рейтинг</TH>
        </tr></thead>
          <tbody>{stats.map((s,i)=>(
            <tr key={s.id} style={{borderBottom:`1px solid ${C.border}`}}>
              <TD s={{fontWeight:500}}><div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:24,height:24,borderRadius:6,background:`${CC[i]}15`,color:CC[i],display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700}}>{i+1}</div>
                {s.shortName}
              </div></TD>
              <TD s={{textAlign:"center"}}>{s.total}</TD>
              <TD s={{fontWeight:600,textAlign:"center"}}>{s.done}</TD>
              <TD s={{textAlign:"center"}}><Badge color={+s.completionPct>=80?"success":+s.completionPct>=50?"primary":"danger"}>{s.completionPct}%</Badge></TD>
              <TD s={{textAlign:"center"}}><Badge color={+s.onTimePct>=80?"success":+s.onTimePct>=50?"primary":"danger"}>{s.onTimePct}%</Badge></TD>
              <TD s={{fontWeight:700,color:C.success,textAlign:"center"}}>{s.produced}</TD>
              <TD s={{color:C.muted,textAlign:"center"}}>{s.avgTime}ч</TD>
              <TD s={{fontWeight:600,textAlign:"center"}}>{s.perDay}</TD>
              <TD s={{textAlign:"center"}}><Badge color="purple">{s.presenceMarks} дн.</Badge></TD>
              <TD s={{textAlign:"center"}}><span style={{fontSize:15,fontWeight:800,color:C.primary}}>{s.rating}</span></TD>
            </tr>
          ))}</tbody>
        </table></div></Card>
    </div>
  );
};


export { EmployeeStatsPage };
