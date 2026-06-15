import { useState, useEffect, useCallback, useMemo, useContext, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area } from "recharts";
import { AppContext } from "../context/AppContext.js";
import { ROLES, JOB_TITLES, PAY_TYPES, STORE_STATUSES, STORE_STATUS_LABELS, ORDER_SOURCES, ATTENDANCE_TYPES, ATTENDANCE_TYPE_COLORS, BATCH_STATUSES, DEFECT_REASONS, PAYROLL_STATUSES, CATEGORIES, UNITS, STATUSES, TASK_STATUSES, RAW_CATEGORIES, RAW_UNITS, NOTIF_TYPES, MARK_TYPES, PLAN_STATUSES, ORDER_STATUSES, ORDER_PRIORITIES, BOARD_COLUMNS, MOVEMENT_TYPES, DEBT_STATUSES, CAMERA_SOURCE_TYPES, CAMERA_SOURCE_LABELS, CAMERA_ZONES } from "../constants/index.js";
import { fmtDate, fmtShort, fmtTime, daysBetween, relTime } from "../utils/dates.js";
import { formatMoney, formatPercent } from "../utils/formatters.js";
import { C, CC } from "../theme/colors.js";
import { I } from "../icons/Icons.jsx";
import { EthnicBorder, EthnicCorner, Badge, Btn, Inp, Sel, Txa, Modal, Confirm, Stat, Toast, TH, TD, Card, Title, PageH, SearchBox, MetricCard } from "../components/ui/index.jsx";
import { GlassChartTooltip } from "../components/charts/GlassChartTooltip.jsx";

// PROFIT ANALYTICS
const ProfitAnalyticsPage = ()=>{
  const {products,tasks,taskEmployees,rawMaterials,recipes,deliveries}=useContext(AppContext);
  const ap=products.filter(p=>!p.deleted);

  // Calculate real profit per product using recipes
  const profitData=useMemo(()=>{
    return ap.map(p=>{
      const recipe=recipes.find(r=>r.productId===p.id);
      const recipeCost=recipe?recipe.items.reduce((s,it)=>{const raw=rawMaterials.find(r=>r.id===it.rawId);return s+(raw?.costPerUnit||0)*it.qty},0):p.costPrice;
      const profit=p.sellPrice-recipeCost;
      const margin=recipeCost>0?(profit/recipeCost*100):0;
      // Total produced from tasks
      const produced=tasks.filter(t=>t.productId===p.id&&(t.status==="завершено"||t.status==="просрочено")).reduce((s,t)=>s+t.quantity,0);
      const totalRevenue=produced*p.sellPrice;
      const totalCost=produced*recipeCost;
      const totalProfit=produced*profit;
      return{id:p.id,name:p.name,category:p.category,unit:p.unit,costPrice:+recipeCost.toFixed(2),sellPrice:p.sellPrice,profit:+profit.toFixed(2),margin:+margin.toFixed(1),produced,totalRevenue,totalCost,totalProfit:+totalProfit.toFixed(0),stock:p.stock};
    }).sort((a,b)=>b.totalProfit-a.totalProfit);
  },[ap,recipes,rawMaterials,tasks]);

  const totalRevAll=profitData.reduce((s,p)=>s+p.totalRevenue,0);
  const totalProfitAll=profitData.reduce((s,p)=>s+p.totalProfit,0);
  const totalCostAll=profitData.reduce((s,p)=>s+p.totalCost,0);
  const bestProduct=profitData[0];
  const totalDeliveryCost=deliveries.reduce((s,d)=>s+d.totalPrice,0);

  const chartData=profitData.filter(p=>p.totalProfit>0).slice(0,8).map(p=>({name:p.name.length>12?p.name.slice(0,12)+"\u2026":p.name,profit:p.totalProfit/1000,revenue:p.totalRevenue/1000,cost:p.totalCost/1000}));
  const marginChart=profitData.filter(p=>p.produced>0).map(p=>({name:p.name.length>12?p.name.slice(0,12)+"\u2026":p.name,margin:p.margin}));

  return(
    <div>
      <PageH title="Аналитика прибыли"/>

      {/* Financial summary cards */}
      <div style={{display:"flex",flexWrap:"wrap",gap:12,marginBottom:22}}>
        <Stat icon={<I.chart size={18}/>} label="Общий доход" value={formatMoney(totalRevAll, { compact: true })} color={C.primary}/>
        <Stat icon={<I.star size={18}/>} label="Общая прибыль" value={formatMoney(totalProfitAll, { compact: true })} color={C.success}/>
        <Stat icon={<I.raw size={18}/>} label="Затраты (производство)" value={formatMoney(totalCostAll, { compact: true })} color={C.danger}/>
        <Stat icon={<I.truck size={18}/>} label="Затраты (закупки)" value={formatMoney(totalDeliveryCost, { compact: true })} color={C.orange}/>
      </div>

      {bestProduct && bestProduct.totalProfit > 0 ? (
        <Card s={{marginBottom:16,padding:"16px 18px",background:`linear-gradient(135deg, ${C.primary}08, ${C.success}05)`,border:`1px solid ${C.primary}25`}}>
          <div style={{display:"flex",alignItems:"flex-start",gap:14}}>
            <div style={{width:44,height:44,borderRadius:11,background:"rgba(216,169,61,.14)",display:"flex",alignItems:"center",justifyContent:"center",color:C.primary,flexShrink:0}}><I.star size={20}/></div>
            <div style={{flex:1}}>
              <div style={{fontSize:11,color:C.dim,textTransform:"uppercase",letterSpacing:"0.04em",marginBottom:4}}>Самый прибыльный товар</div>
              <div style={{fontSize:18,fontWeight:800,color:C.text,marginBottom:10}}>{bestProduct.name}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                <span style={{padding:"5px 10px",borderRadius:999,fontSize:12,fontWeight:600,color:C.success,background:"rgba(116,216,137,.12)",border:"1px solid rgba(116,216,137,.25)"}}>
                  Прибыль {formatMoney(bestProduct.totalProfit)}
                </span>
                <span style={{padding:"5px 10px",borderRadius:999,fontSize:12,fontWeight:600,color:C.primary,background:"rgba(216,169,61,.12)",border:"1px solid rgba(216,169,61,.25)"}}>
                  Маржа {formatPercent(bestProduct.margin)}
                </span>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card s={{marginBottom:16,padding:"20px",textAlign:"center",color:C.dim,fontSize:13}}>Пока нет данных по продажам</Card>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(340px,1fr))",gap:14,marginBottom:18}}>
        {/* Revenue vs Profit chart */}
        <Card><Title>Доход vs Прибыль (тыс. ₽)</Title>
          {chartData.length <= 1 ? (
            <div style={{padding:"10px 4px 2px"}}>
              <MetricCard
                label={chartData[0]?.name || "Недостаточно данных"}
                value={chartData[0] ? `${chartData[0].revenue.toFixed(1)}k / ${chartData[0].profit.toFixed(1)}k` : "0 / 0"}
                tone={chartData[0]?.profit >= 0 ? "success" : "danger"}
                sub="Доход / прибыль за текущий период"
              />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} style={{ background: "transparent" }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} fill="transparent"/>
                <XAxis dataKey="name" tick={{fill:C.dim,fontSize:9}}/><YAxis tick={{fill:C.dim,fontSize:10}}/>
                <Tooltip content={<GlassChartTooltip unit="thousands" />}/>
                <Legend wrapperStyle={{fontSize:11,color:C.muted}}/>
                <Bar dataKey="revenue" fill={C.info} radius={[6,6,0,0]} name="Доход" maxBarSize={52}/>
                <Bar dataKey="profit" fill={C.success} radius={[6,6,0,0]} name="Прибыль" maxBarSize={52}/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Margin chart */}
        <Card><Title>Маржинальность (%)</Title>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={marginChart} layout="vertical" margin={{left:5}} style={{ background: "transparent" }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} fill="transparent"/>
              <XAxis type="number" tick={{fill:C.dim,fontSize:10}}/>
              <YAxis dataKey="name" type="category" width={100} tick={{fill:C.muted,fontSize:10}}/>
              <Tooltip content={<GlassChartTooltip unit="percent" />}/>
              <Bar dataKey="margin" fill={C.primary} radius={[0,6,6,0]} maxBarSize={52}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Detailed profit table */}
      <Card s={{padding:0,overflow:"hidden"}}>
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`}}>
          <span style={{fontSize:14,fontWeight:700,color:C.text}}>Прибыльность по товарам</span>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr><TH>Товар</TH><TH>Себестоимость</TH><TH>Цена</TH><TH>Прибыль/ед</TH><TH>Маржа</TH><TH>Произведено</TH><TH>Общая прибыль</TH></tr></thead>
            <tbody>{profitData.map((p,i)=>(
              <tr key={p.id} style={{borderBottom:`1px solid ${C.border}`}}>
                <TD s={{fontWeight:500}}><div style={{display:"flex",alignItems:"center",gap:6}}>
                  {i===0&&<span style={{fontSize:14}}>&#127942;</span>}
                  {p.name}
                </div></TD>
                <TD s={{color:C.muted}}>{formatMoney(p.costPrice)}</TD>
                <TD>{formatMoney(p.sellPrice)}</TD>
                <TD s={{fontWeight:600,color:p.profit>0?C.success:C.danger}}>{formatMoney(p.profit)}</TD>
                <TD><Badge color={p.margin>=50?"success":p.margin>=20?"primary":"danger"}>{formatPercent(p.margin)}</Badge></TD>
                <TD>{p.produced} {p.unit}</TD>
                <TD s={{fontWeight:700,color:C.success}}>{formatMoney(p.totalProfit)}</TD>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div style={{padding:"12px 16px",borderTop:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between"}}>
          <span style={{fontSize:14,fontWeight:700,color:C.text}}>Итого:</span>
          <span style={{fontSize:16,fontWeight:800,color:C.success}}>{formatMoney(totalProfitAll)}</span>
        </div>
      </Card>
    </div>
  );
};


export { ProfitAnalyticsPage };
