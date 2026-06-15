import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";
import { AppContext } from "./context/AppContext.js";
import { ROLES } from "./constants/index.js";
import { INIT_USERS, INIT_PRODUCTS, INIT_RAW_MATERIALS, INIT_RECIPES, INIT_TASKS, INIT_TASK_EMPLOYEES, INIT_EMPLOYEE_HISTORY, INIT_PRODUCTION_PLANS, INIT_CLIENTS, INIT_CLIENT_ORDERS, INIT_SALES, INIT_INVENTORY_MOVEMENTS, INIT_SUPPLIERS, INIT_DELIVERIES, INIT_RAW_MOVEMENTS, INIT_NOTIFICATIONS, INIT_MARKS, INIT_PRODUCTION_OUTPUTS, INIT_DEBTS, INIT_BATCHES, INIT_DEFECTS, INIT_CAMERAS, INIT_BONUS_RULES, INIT_BASE_SALARIES } from "./data/initState.js";
import { C } from "./theme/colors.js";
import { I } from "./icons/Icons.jsx";
import { usePersisted } from "./hooks/usePersisted.js";
import { setUnauthorizedHandler, setWriteErrorHandler } from "./api/client.js";
import { apiFetch } from "./api/client.js";
import { EthnicBorder, Badge, Btn, AppLoader } from "./components/ui/index.jsx";
import { MotionProvider, useMotionVariants } from "./motion/MotionProvider.jsx";
import { pageTransition, spring, stagger, listItem } from "./motion/presets.js";


// Pages and components
import { LoginPage } from "./pages/LoginPage.jsx";
import { NotificationBell } from "./components/layout/NotificationBell.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { UsersPage } from "./pages/UsersPage.jsx";
import { ProductsPage } from "./pages/ProductsPage.jsx";
import { TasksPage } from "./pages/TasksPage.jsx";
import { RawMaterialsPage } from "./pages/RawMaterialsPage.jsx";
import { DeliveriesPage } from "./pages/DeliveriesPage.jsx";
import { EmployeeStatsPage } from "./pages/EmployeeStatsPage.jsx";
import { NotificationsPage } from "./pages/NotificationsPage.jsx";
import { MarksPage } from "./pages/MarksPage.jsx";
import { ReportsPage } from "./pages/ReportsPage.jsx";
import { WorkerHistoryPage } from "./pages/WorkerHistoryPage.jsx";
import { ClientsPage } from "./pages/ClientsPage.jsx";
import { SalesPage } from "./pages/SalesPage.jsx";
import { InventoryJournalPage } from "./pages/InventoryJournalPage.jsx";
import { ProductionPlanPage } from "./pages/ProductionPlanPage.jsx";
import { ProcurementPage } from "./pages/ProcurementPage.jsx";
import { ProfitAnalyticsPage } from "./pages/ProfitAnalyticsPage.jsx";
import { LogsPage } from "./pages/LogsPage.jsx";
import { DebtsPage } from "./pages/DebtsPage.jsx";
import { PayrollPage } from "./pages/PayrollPage.jsx";
import { ProductionOutputPage } from "./pages/ProductionOutputPage.jsx";
import { CameraPage } from "./pages/CameraPage.jsx";
import { OrdersBoardStandalone, OrdersBoardPage } from "./pages/OrdersBoardPage.jsx";
import { BatchesPage } from "./pages/BatchesPage.jsx";
import { DefectsPage } from "./pages/DefectsPage.jsx";
import { PackingPage } from "./pages/PackingPage.jsx";
import { DeliveryPage } from "./pages/DeliveryPage.jsx";
import { TrashPage } from "./pages/TrashPage.jsx";
import { getJobProfile, isManagerLike, isSuperAdmin, roleChipLabel, pageTitle } from "./utils/roles.js";
import { formatMoney } from "./utils/formatters.js";
import { APP_BRAND, APP_TAGLINE } from "./constants/brand.js";
import { loadHiddenWarnings, hideWarning, restoreWarning } from "./utils/hiddenWarnings.js";

// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function App(){
  // Session is server-side. On mount we check /api/auth/me to restore the session.
  // localStorage only stores {id, name, roleId} as a UI hint to avoid flicker — never password.
  const [currentUser,setCurrentUser]=useState(()=>{
    try{const s=localStorage.getItem("dk_session_hint");return s?JSON.parse(s):null;}catch{return null;}
  });
  const [sessionChecked,setSessionChecked]=useState(false);
  // Check session on mount and every 2 minutes.
  // This catches: role changes, account blocking, session expiry.
  useEffect(()=>{
    let mounted=true;
    const checkMe=()=>{
      fetch("/api/auth/me")
        .then(r=>r.ok?r.json():null)
        .then(user=>{
          if(!mounted) return;
          if(user){
            const hint={id:user.id,name:user.name,roleId:user.roleId};
            localStorage.setItem("dk_session_hint",JSON.stringify(hint));
            setCurrentUser(prev=>{
              // Only update if something actually changed (prevents re-renders)
              if(!prev||prev.id!==user.id||prev.roleId!==user.roleId||prev.status!==user.status) return user;
              return prev;
            });
          } else {
            localStorage.removeItem("dk_session_hint");
            setCurrentUser(null);
          }
        })
        .catch(()=>{/* server offline — keep current state */})
        .finally(()=>{if(mounted) setSessionChecked(true);});
    };
    checkMe();
    const t=setInterval(checkMe,2*60*1000); // re-check every 2 min
    return()=>{mounted=false;clearInterval(t);};
  },[]);
  const [users,setUsers]=usePersisted("dk_users",INIT_USERS);
  const [products,setProducts,setProductsL]=usePersisted("dk_products",INIT_PRODUCTS);
  const [tasks,setTasks,setTasksL]=usePersisted("dk_tasks",INIT_TASKS);
  const [rawMaterials,setRawMaterials,setRawMatsL]=usePersisted("dk_raw_mats",INIT_RAW_MATERIALS);
  const [recipes,setRecipes]=usePersisted("dk_recipes",INIT_RECIPES);
  const [taskEmployees,setTaskEmployees,setTaskEmpL]=usePersisted("dk_task_emps",INIT_TASK_EMPLOYEES);
  const [employeeHistory,setEmployeeHistory,setEmpHistL]=usePersisted("dk_emp_hist",INIT_EMPLOYEE_HISTORY);
  const [productionPlans,setProductionPlans,setPlansL]=usePersisted("dk_prod_plans",INIT_PRODUCTION_PLANS);
  const [clients,setClients]=usePersisted("dk_clients",INIT_CLIENTS);
  const [clientOrders,setClientOrders,setClientOrdersL]=usePersisted("dk_client_orders",INIT_CLIENT_ORDERS);
  const [sales,setSales]=usePersisted("dk_sales",INIT_SALES);
  const [inventoryMovements,setInventoryMovements,setInvMoveL]=usePersisted("dk_inv_move",INIT_INVENTORY_MOVEMENTS);
  const [productionOutputs,setProductionOutputs,setOutputsL]=usePersisted("dk_prod_outputs",INIT_PRODUCTION_OUTPUTS);
  const [bonusRules,setBonusRules]=usePersisted("dk_bonus_rules",INIT_BONUS_RULES);
  const [baseSalaries,setBaseSalaries]=usePersisted("dk_base_salaries",INIT_BASE_SALARIES);
  const [debts,setDebts]=usePersisted("dk_debts",INIT_DEBTS);
  const [batches,setBatches,setBatchesL]=usePersisted("dk_batches",INIT_BATCHES);
  const [defects,setDefects]=usePersisted("dk_defects",INIT_DEFECTS);
  const [payrollRecords,setPayrollRecords]=usePersisted("dk_payroll",[]);
  const [cameras,setCameras]=usePersisted("dk_cameras",INIT_CAMERAS);
  const [suppliers,setSuppliers]=usePersisted("dk_suppliers",INIT_SUPPLIERS);
  const [deliveries,setDeliveries]=usePersisted("dk_deliveries",INIT_DELIVERIES);
  const [rawMovements,setRawMovements,setRawMovsL]=usePersisted("dk_raw_movements",INIT_RAW_MOVEMENTS);
  const [notifications,setNotifications,setNotifsL]=usePersisted("dk_notifications",INIT_NOTIFICATIONS);
  const [marks,setMarks]=usePersisted("dk_marks",INIT_MARKS);
  const [logs,setLogs,setLogsL]=usePersisted("dk_logs",[]);
  const [page,setPage]=useState("dashboard");
  const [sideOpen,setSideOpen]=useState(false);
  const [openGroups,setOpenGroups]=useState(()=>new Set(["main"]));
  const [hiddenWarningsMap,setHiddenWarningsMap]=useState(()=>loadHiddenWarnings());
  const hideWarningItem=useCallback((id)=>setHiddenWarningsMap(m=>hideWarning(m,id)),[]);
  const restoreWarningItem=useCallback((id)=>setHiddenWarningsMap(m=>restoreWarning(m,id)),[]);
  const [isMobile,setIsMobile]=useState(()=>typeof window!=="undefined"&&window.innerWidth<=768);
  const [serverOnline,setServerOnline]=useState(true);
  const [saveError,setSaveError]=useState(null); // {key,status,ts}
  const [introDone,setIntroDone]=useState(()=>!currentUser);
  useEffect(()=>{
    document.title=currentUser?`${pageTitle(page,currentUser)} · ${APP_BRAND}`:APP_BRAND;
  },[currentUser,page]);
  useEffect(()=>{
    if(introDone||!currentUser||!sessionChecked) return;
    const tm=setTimeout(()=>setIntroDone(true),900);
    return()=>clearTimeout(tm);
  },[introDone,currentUser,sessionChecked]);
  useEffect(()=>{
    const check=()=>{fetch("/api/ping",{cache:"no-store"}).then(()=>setServerOnline(true)).catch(()=>setServerOnline(false))};
    check();const t=setInterval(check,15000);return()=>clearInterval(t);
  },[]);
  // Toast auto-dismiss for write errors
  useEffect(()=>{
    if(!saveError) return;
    const t=setTimeout(()=>setSaveError(null),4000);
    return()=>clearTimeout(t);
  },[saveError]);
  useEffect(()=>{
    const h=()=>setIsMobile(window.innerWidth<=768);
    window.addEventListener("resize",h);return()=>window.removeEventListener("resize",h);
  },[]);

  // Applies state returned by action endpoints directly to local React state,
  // without triggering server POSTs. Prevents 403 on manager-only keys for workers.
  const applyServerState=useCallback((state)=>{
    if(state.dk_tasks)          setTasksL(state.dk_tasks);
    if(state.dk_task_emps)      setTaskEmpL(state.dk_task_emps);
    if(state.dk_prod_outputs)   setOutputsL(state.dk_prod_outputs);
    if(state.dk_batches)        setBatchesL(state.dk_batches);
    if(state.dk_products)       setProductsL(state.dk_products);
    if(state.dk_raw_mats)       setRawMatsL(state.dk_raw_mats);
    if(state.dk_raw_movements)  setRawMovsL(state.dk_raw_movements);
    if(state.dk_inv_move)       setInvMoveL(state.dk_inv_move);
    if(state.dk_emp_hist)       setEmpHistL(state.dk_emp_hist);
    if(state.dk_prod_plans)     setPlansL(state.dk_prod_plans);
    if(state.dk_notifications)  setNotifsL(state.dk_notifications);
    if(state.dk_logs)           setLogsL(state.dk_logs);
    if(state.dk_client_orders)  setClientOrdersL(state.dk_client_orders);
    if(state.dk_inv_move)       setInvMoveL(state.dk_inv_move);
  },[setTasksL,setTaskEmpL,setOutputsL,setBatchesL,setProductsL,setRawMatsL,setRawMovsL,setInvMoveL,setEmpHistL,setPlansL,setNotifsL,setLogsL,setClientOrdersL]);

  const addLog=useCallback(msg=>{
    if(!currentUser) return;
    apiFetch("/api/actions/log",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({message:String(msg)}),
    }).catch(()=>{});
  },[currentUser]);

  const addNotification=useCallback((data)=>{
    setNotifications(p=>[...p,{
      id:Date.now()+Math.random(),
      title:data.title||"Уведомление",
      type:data.type||"информация",
      content:data.content||"",
      createdBy:currentUser?.id||0,
      createdAt:new Date().toISOString(),
      readBy:currentUser?[currentUser.id]:[],
      targetAll:data.targetAll||false,
      targetUsers:data.targetUsers||[],
    }]);
  },[currentUser]);

  // ── Single source of truth for production output ──
  // Called by BOTH task completion and manual entry in ProductionOutputPage.
  // Creates: stock+, inventoryMovements, rawMaterials-, rawMovements, employeeHistory, productionPlans, batch.
  const applyOutput=useCallback((out,stockBefore)=>{
    const newBalance=stockBefore+out.quantity;
    setProducts(p=>p.map(x=>x.id===out.productId?{...x,stock:x.stock+out.quantity,updatedAt:new Date().toISOString()}:x));
    setInventoryMovements(p=>[...(p||[]),{id:out.id+0.1,productId:out.productId,type:"output",quantity:out.quantity,balance:newBalance,refId:`output-${out.id}`,createdAt:out.date}]);
    const recipe=recipes.find(r=>r.productId===out.productId);
    if(recipe?.items?.length){
      setRawMaterials(prev=>prev.map(rm=>{
        const item=recipe.items.find(i=>i.rawId===rm.id);
        if(!item) return rm;
        return{...rm,stock:Math.max(0,+(rm.stock-item.qty*out.quantity).toFixed(4)),updatedAt:new Date().toISOString()};
      }));
      setRawMovements(prev=>[...(prev||[]),...recipe.items.map(item=>({
        id:Date.now()+Math.random(),rawId:item.rawId,type:"расход",quantity:+(item.qty*out.quantity).toFixed(4),
        refId:`output-${out.id}`,note:`Выпуск: ${out.quantity} ед. #${out.productId}`,createdAt:out.date
      }))]);
    }
    const ds=out.date.slice(0,10);
    setEmployeeHistory(p=>{
      const ex=p.find(h=>h.employeeId===out.employeeId&&h.date===ds);
      if(ex) return p.map(h=>h.id===ex.id?{...h,producedQty:h.producedQty+out.quantity}:h);
      return[...p,{id:Date.now()+Math.random(),employeeId:out.employeeId,date:ds,attendance:"present",tasksCompleted:0,producedQty:out.quantity,comment:""}];
    });
    setProductionPlans(p=>p.map(pl=>{
      if(pl.productId===out.productId&&pl.productionDate===ds&&pl.status!=="отменён"){
        const nc=Math.min(pl.plannedQty,pl.completedQty+out.quantity);
        return{...pl,completedQty:nc,status:nc>=pl.plannedQty?"выполнен":"в процессе"};
      }return pl;
    }));
    // NOTE: batch is NOT created here. It is created once by the caller:
    //   - doComplete creates 1 batch for the whole task (all workers summed)
    //   - save() in ProductionOutputPage creates 1 batch for a manual entry
    // This prevents N batches when N workers share one task.
  },[recipes,setProducts,setInventoryMovements,setRawMaterials,setRawMovements,setEmployeeHistory,setProductionPlans]);

  // Fully reverses an applyOutput call (stock, movements, raw, history, plans).
  // For task-outputs: only the LAST worker's revert also removes the shared batch (via out.batchId).
  // For manual outputs: out.batchId === out.id + 0.5.
  const revertOutput=useCallback((out)=>{
    setProducts(p=>p.map(x=>x.id===out.productId?{...x,stock:Math.max(0,x.stock-out.quantity),updatedAt:new Date().toISOString()}:x));
    setInventoryMovements(p=>(p||[]).filter(m=>m.refId!==`output-${out.id}`));
    const recipe=recipes.find(r=>r.productId===out.productId);
    if(recipe?.items?.length){
      setRawMaterials(prev=>prev.map(rm=>{
        const item=recipe.items.find(i=>i.rawId===rm.id);
        if(!item) return rm;
        return{...rm,stock:+(rm.stock+item.qty*out.quantity).toFixed(4),updatedAt:new Date().toISOString()};
      }));
      setRawMovements(prev=>(prev||[]).filter(m=>m.refId!==`output-${out.id}`));
    }
    // Remove associated batch (each output carries batchId set at creation time)
    if(out.batchId) setBatches(prev=>(prev||[]).filter(b=>b.id!==out.batchId));
    const ds=out.date.slice(0,10);
    setEmployeeHistory(p=>p.map(h=>h.employeeId===out.employeeId&&h.date===ds?{...h,producedQty:Math.max(0,h.producedQty-out.quantity)}:h));
    setProductionPlans(p=>p.map(pl=>{
      if(pl.productId===out.productId&&pl.productionDate===ds&&pl.status!=="отменён"){
        const nc=Math.max(0,pl.completedQty-out.quantity);
        return{...pl,completedQty:nc,status:nc>=pl.plannedQty?"выполнен":nc>0?"в процессе":"запланирован"};
      }return pl;
    }));
  },[recipes,setProducts,setInventoryMovements,setRawMaterials,setRawMovements,setBatches,setEmployeeHistory,setProductionPlans]);

  const handleLogin=u=>{
    // Store only safe hint (no password) for UI restore on page reload
    const hint={id:u.id,name:u.name,roleId:u.roleId};
    localStorage.setItem("dk_session_hint",JSON.stringify(hint));
    setCurrentUser(u);setPage("dashboard");setIntroDone(false);
    apiFetch("/api/actions/log",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({message:"Вход в систему"}),
    }).catch(()=>{});
  };
  const handleLogout=()=>{
    if(currentUser)addLog("Выход");
    fetch("/api/auth/logout",{method:"POST"}).catch(()=>{});
    localStorage.removeItem("dk_session_hint");
    setCurrentUser(null);setPage("dashboard");
  };

  // Register global 401 handler so any usePersisted 401 forces logout
  useEffect(()=>{
    setUnauthorizedHandler(()=>{
      localStorage.removeItem("dk_session_hint");
      setCurrentUser(null);setPage("dashboard");
    });
    return()=>setUnauthorizedHandler(null);
  },[]);

  // Register global write-error handler so any usePersisted save failure
  // surfaces as a visible toast instead of silently rolling back on the next poll.
  useEffect(()=>{
    setWriteErrorHandler((info)=>setSaveError({...info,ts:Date.now()}));
    return()=>setWriteErrorHandler(null);
  },[]);

  const production = tasks.filter(t=>t.status==="завершено").map(t=>({id:t.id,productId:t.productId,userIds:t.userIds||[],quantity:t.quantity,date:t.completedAt,note:t.note}));

  const ctx=useMemo(()=>({
    users,setUsers,products,setProducts,tasks,setTasks,rawMaterials,setRawMaterials,recipes,setRecipes,
    taskEmployees,setTaskEmployees,employeeHistory,setEmployeeHistory,
    productionPlans,setProductionPlans,
    clients,setClients,clientOrders,setClientOrders,setClientOrdersL,
    sales,setSales,inventoryMovements,setInventoryMovements,
    suppliers,setSuppliers,deliveries,setDeliveries,rawMovements,setRawMovements,
    notifications,setNotifications,setNotifsL,marks,setMarks,
    logs,setLogs,addLog,addNotification,currentUser,production,
    setPage,hiddenWarningsMap,hideWarningItem,restoreWarningItem,
    productionOutputs,setProductionOutputs,
    bonusRules,setBonusRules,baseSalaries,setBaseSalaries,
    debts,setDebts,
    batches,setBatches,defects,setDefects,
    payrollRecords,setPayrollRecords,
    cameras,setCameras,
    applyOutput,revertOutput,applyServerState,
  }),[users,products,tasks,rawMaterials,recipes,taskEmployees,employeeHistory,productionPlans,clients,clientOrders,sales,inventoryMovements,suppliers,deliveries,rawMovements,notifications,marks,logs,addLog,addNotification,currentUser,production,page,hiddenWarningsMap,hideWarningItem,restoreWarningItem,productionOutputs,bonusRules,baseSalaries,debts,batches,defects,payrollRecords,cameras,applyOutput,revertOutput,applyServerState,setClientOrdersL]);

  const pageVariants = useMotionVariants(pageTransition);

  const globalStyles = `
    :root{
      --ease-out-soft:cubic-bezier(.16,1,.3,1);
      --ease-in-out-soft:cubic-bezier(.65,0,.35,1);
      --motion-fast:160ms;
      --motion-base:240ms;
      --motion-smooth:420ms;
    }
    *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
    html{scroll-behavior:smooth}
    body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:${C.bg};color:${C.text};overflow:hidden;font-feature-settings:"tnum" 1,"cv02" 1,"cv03" 1;-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
    input,select,textarea,button{font-family:inherit}
    ::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.14);border-radius:3px}
    @keyframes slideIn{from{transform:translateX(80px);opacity:0}to{transform:translateX(0);opacity:1}}
    @keyframes fadeUp{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}
    @keyframes softFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
    @keyframes pulseBorder{0%,100%{box-shadow:0 0 0 1px rgba(255,107,95,.22),0 4px 16px rgba(255,107,95,.06)}50%{box-shadow:0 0 0 2px rgba(255,107,95,.38),0 8px 24px rgba(255,107,95,.12)}}
    @keyframes pulseGlow{0%,100%{opacity:1}50%{opacity:0.35}}
    @keyframes skeletonShimmer{0%{transform:translateX(-120%)}100%{transform:translateX(120%)}}
    @keyframes ambientGradient{
      0%{transform:translate3d(-1%,-1%,0) scale(1)}
      50%{transform:translate3d(1%,1.5%,0) scale(1.035)}
      100%{transform:translate3d(1.5%,-1%,0) scale(1.02)}
    }
    @keyframes btnShine{
      0%{transform:translateX(-120%) skewX(-12deg)}
      100%{transform:translateX(220%) skewX(-12deg)}
    }
    option{background:#1a1612;color:${C.text}}
    .motion-safe{
      transition:transform var(--motion-base) var(--ease-out-soft),opacity var(--motion-base) var(--ease-out-soft),
        background var(--motion-base) var(--ease-out-soft),border-color var(--motion-base) var(--ease-out-soft),
        box-shadow var(--motion-base) var(--ease-out-soft),color var(--motion-base) var(--ease-out-soft);
    }
    .page-motion{min-height:100%;will-change:transform,opacity}
    .page-canvas{scroll-behavior:smooth;overscroll-behavior:contain}
    .skeleton{position:relative;overflow:hidden;background:rgba(255,255,255,.055);border-radius:12px}
    .skeleton::after{
      content:"";position:absolute;inset:0;transform:translateX(-120%);
      background:linear-gradient(90deg,transparent,rgba(255,255,255,.10),transparent);
      animation:skeletonShimmer 1.4s ease-in-out infinite;
    }
    .btn-primary-shine{position:relative;overflow:hidden}
    .btn-primary-shine::after{
      content:"";position:absolute;inset:0;width:40%;
      background:linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent);
      animation:btnShine 3.2s ease-in-out infinite;
      pointer-events:none;
    }
    .nav-item,.nav-sub-item{position:relative;overflow:hidden}
    .active-nav-pill{
      position:absolute;inset:0;border-radius:12px;z-index:0;
      background:rgba(211,166,70,.13);border:1px solid rgba(211,166,70,.22);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 8px 24px rgba(211,166,70,.08);
    }
    .nav-item-content,.nav-sub-content{position:relative;z-index:1;display:flex;align-items:center;gap:9px;width:100%}
    .filter-pill-track{position:relative;display:inline-flex}
    .notification-filter-pill{
      position:absolute;inset:0;border-radius:999px;z-index:0;
      background:rgba(211,166,70,.14);border:1px solid rgba(211,166,70,.35);
    }
    .app-bg{
      min-height:100vh;height:100vh;
      padding:24px;
      background:
        radial-gradient(circle at 18% 12%, rgba(211,166,70,.18), transparent 32%),
        radial-gradient(circle at 82% 18%, rgba(72,224,213,.11), transparent 30%),
        radial-gradient(circle at 55% 95%, rgba(167,139,250,.10), transparent 36%),
        linear-gradient(135deg, #0f0d0a 0%, #17130f 48%, #211a13 100%);
      color:${C.text};
      overflow:hidden;
      position:relative;
    }
    .app-bg.login-viewport{overflow:visible}
    .login-viewport{padding:0 !important;display:flex;align-items:stretch;justify-content:center;overflow:visible}
    .login-shell{
      display:grid;
      grid-template-columns:minmax(360px,1fr) 440px;
      width:min(1120px,calc(100vw - 48px));
      min-height:100vh;
      margin:0 auto;
      gap:clamp(64px,8vw,120px);
      align-items:center;
    }
    .login-brand-panel{
      position:relative;min-height:clamp(480px,72vh,640px);width:100%;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;overflow:visible;
      padding:56px 0;
    }
    .login-brand-content{position:relative;z-index:2;max-width:430px}
    .login-logo-mark{margin-bottom:24px}
    .login-brand-visual{
      position:absolute;inset:0;width:100%;height:100%;z-index:1;pointer-events:none;opacity:.94;
    }
    .brand-grid{
      position:absolute;inset:0;opacity:.13;
      background-image:
        linear-gradient(rgba(248,241,229,.08) 1px, transparent 1px),
        linear-gradient(90deg, rgba(248,241,229,.08) 1px, transparent 1px);
      background-size:42px 42px;
      animation:brandGridDrift 18s linear infinite;
    }
    .login-brand-visual::before{
      content:"";position:absolute;inset:0;
      background:
        radial-gradient(circle at 28% 42%, rgba(216,169,61,.22), transparent 34%),
        radial-gradient(circle at 56% 62%, rgba(98,214,204,.12), transparent 32%),
        radial-gradient(circle at 40% 84%, rgba(167,139,250,.13), transparent 38%);
      filter:blur(22px);
      animation:brandAura 9s ease-in-out infinite alternate;
    }
    .brand-node{
      position:absolute;width:9px;height:9px;border-radius:999px;
      background:rgba(240,202,104,.9);
      box-shadow:0 0 0 6px rgba(216,169,61,.08), 0 0 24px rgba(216,169,61,.34);
      animation:brandNodePulse 2.8s ease-in-out infinite;
    }
    .node-a{left:20%;top:36%}
    .node-b{left:38%;top:24%;animation-delay:.5s}
    .node-c{left:48%;top:62%;animation-delay:1s}
    .brand-route{
      position:absolute;height:1px;transform-origin:left center;
      background:linear-gradient(90deg, transparent, rgba(240,202,104,.38), rgba(98,214,204,.22), transparent);
      opacity:.55;overflow:hidden;
    }
    .brand-route::after{
      content:"";position:absolute;inset:0;width:32%;
      background:linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent);
      transform:translateX(-120%);
      animation:brandRouteLight 3.8s ease-in-out infinite;
    }
    .route-a{left:18%;top:38%;width:min(240px,52%);transform:rotate(-18deg)}
    .route-b{left:34%;top:28%;width:min(200px,44%);transform:rotate(38deg)}
    .route-b::after{animation-delay:1.4s}
    .brand-orbit-wrap{position:absolute;pointer-events:none}
    .brand-orbit-wrap-one{width:min(320px,70%,58vh);aspect-ratio:1;left:40%;top:50%;transform:translate(-50%,-50%)}
    .brand-orbit-wrap-two{width:min(210px,48%,38vh);aspect-ratio:1;left:43%;top:50%;transform:translate(-50%,-50%)}
    .brand-orbit{
      position:absolute;inset:0;border-radius:999px;
      border:1px solid rgba(248,241,229,.08);
      box-shadow:inset 0 0 30px rgba(255,255,255,.025);
    }
    .brand-orbit-one{animation:brandFloatOne 12s ease-in-out infinite alternate}
    .brand-orbit-two{border-color:rgba(216,169,61,.10);animation:brandFloatTwo 14s ease-in-out infinite alternate}
    .brand-silhouettes{
      position:absolute;inset:0;width:100%;height:100%;opacity:.55;pointer-events:none;
    }
    @keyframes brandGridDrift{
      from{transform:translate3d(0,0,0)}
      to{transform:translate3d(-42px,-42px,0)}
    }
    @keyframes brandAura{
      from{transform:translate3d(-1%,-1%,0) scale(1);opacity:.78}
      to{transform:translate3d(1.5%,1%,0) scale(1.04);opacity:.95}
    }
    @keyframes brandNodePulse{
      0%,100%{transform:scale(1);opacity:.75}
      50%{transform:scale(1.35);opacity:1}
    }
    @keyframes brandRouteLight{
      0%{transform:translateX(-130%);opacity:0}
      18%{opacity:1}
      70%{opacity:1}
      100%{transform:translateX(330%);opacity:0}
    }
    @keyframes brandFloatOne{
      from{transform:translate3d(-8px,6px,0) rotate(-2deg)}
      to{transform:translate3d(10px,-8px,0) rotate(3deg)}
    }
    @keyframes brandFloatTwo{
      from{transform:translate3d(8px,-4px,0) rotate(3deg)}
      to{transform:translate3d(-10px,8px,0) rotate(-2deg)}
    }
    @media (prefers-reduced-motion: reduce){
      .brand-grid,.login-brand-visual::before,.brand-node,.brand-route::after,.brand-orbit{
        animation:none !important;
      }
    }
    .login-brand-title{font-size:clamp(34px,4vw,52px);font-weight:800;color:${C.text};line-height:1.08;letter-spacing:-.02em;margin:0 0 12px}
    .login-brand-sub{font-size:15px;color:${C.muted};line-height:1.55;max-width:380px;margin:0}
    .login-auth-column,.login-panel{
      display:flex;flex-direction:column;justify-content:center;
      padding:32px 0;
      background:transparent;
    }
    .login-form-card{
      position:relative;z-index:1;isolation:isolate;
      background:linear-gradient(180deg, rgba(255,255,255,.085), rgba(255,255,255,.035));
      border:1px solid rgba(255,255,255,.10);
      border-radius:22px;
      overflow:hidden;
      box-shadow:0 32px 80px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.08);
    }
    .login-form-card::before{
      content:"";position:absolute;inset:-40% -20% auto -20%;height:55%;
      background:radial-gradient(circle at 50% 0%, rgba(216,169,61,.18), transparent 62%);
      z-index:-1;opacity:.22;pointer-events:none;
    }
    .login-demo-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .demo-account-card{
      position:relative;overflow:hidden;display:flex;align-items:center;gap:10px;
      min-height:54px;padding:12px 14px;border-radius:16px;
      background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.11);
      cursor:pointer;font-family:inherit;text-align:left;width:100%;
      transition:transform .22s cubic-bezier(.16,1,.3,1),background .32s cubic-bezier(.16,1,.3,1),border-color .32s cubic-bezier(.16,1,.3,1),box-shadow .32s cubic-bezier(.16,1,.3,1);
    }
    .demo-account-card:hover{transform:translateY(-2px)}
    .demo-account-card.selected{transform:translateY(-2px) scale(1.01)}
    .demo-account-card[data-tone="director"]:hover,.demo-account-card[data-tone="director"].selected{background:linear-gradient(135deg,rgba(255,107,95,.24),rgba(255,107,95,.08));border-color:rgba(255,107,95,.38);box-shadow:0 14px 34px rgba(255,107,95,.10)}
    .demo-account-card[data-tone="manager"]:hover,.demo-account-card[data-tone="manager"].selected{background:linear-gradient(135deg,rgba(121,184,216,.24),rgba(121,184,216,.08));border-color:rgba(121,184,216,.38)}
    .demo-account-card[data-tone="owner"]:hover,.demo-account-card[data-tone="owner"].selected{background:linear-gradient(135deg,rgba(167,139,250,.24),rgba(167,139,250,.08));border-color:rgba(167,139,250,.38)}
    .demo-account-card[data-tone="lepstitsa"]:hover,.demo-account-card[data-tone="lepstitsa"].selected{background:linear-gradient(135deg,rgba(216,169,61,.24),rgba(216,169,61,.08));border-color:rgba(216,169,61,.38)}
    .demo-account-card[data-tone="packer"]:hover,.demo-account-card[data-tone="packer"].selected{background:linear-gradient(135deg,rgba(98,214,204,.22),rgba(98,214,204,.08));border-color:rgba(98,214,204,.35)}
    .demo-account-card[data-tone="courier"]:hover,.demo-account-card[data-tone="courier"].selected{background:linear-gradient(135deg,rgba(242,168,75,.24),rgba(242,168,75,.08));border-color:rgba(242,168,75,.38)}
    .hero-kpi-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;align-items:stretch;min-width:0}
    @media(max-width:1280px){.hero-kpi-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media(max-width:640px){.hero-kpi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    .hero-metric-strip-wrap{min-height:104px;margin-bottom:16px;min-width:0}
    .hero-chart-wrap{height:140px;min-height:140px;flex-shrink:0}
    .metric-strip{display:flex;flex-wrap:nowrap;gap:12px;width:100%;min-width:0;align-items:stretch;overflow:hidden}
    .metric-strip:not(.is-mobile){min-height:104px}
    .metric-strip.is-mobile{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));overflow:visible;flex-wrap:unset;min-height:0}
    .expandable-metric-card{
      position:relative;min-width:0;min-height:88px;padding:14px 16px;border-radius:18px;overflow:hidden;
      box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;
      appearance:none;text-align:left;color:inherit;font:inherit;cursor:default;
      background:linear-gradient(180deg,rgba(255,255,255,.075),rgba(255,255,255,.035));
      border:1px solid rgba(255,255,255,.09);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 12px 34px rgba(0,0,0,.20);
      transition:border-color .32s cubic-bezier(.16,1,.3,1),box-shadow .32s cubic-bezier(.16,1,.3,1),background .32s cubic-bezier(.16,1,.3,1);
    }
    .expandable-metric-card.is-expanded-mobile{grid-column:1/-1;width:100% !important}
    .expandable-metric-card.is-clickable{cursor:pointer}
    .expandable-metric-card.is-clickable:hover{
      border-color:rgba(216,169,61,.30);
    }
    .expandable-metric-card.is-expanded{
      border-color:rgba(216,169,61,.32);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 22px 60px rgba(0,0,0,.30),0 0 46px rgba(216,169,61,.10);
    }
    .expandable-metric-card.is-clickable::after{
      content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;
      background:radial-gradient(circle at 50% 0%,rgba(216,169,61,.16),transparent 55%);
      transition:opacity .25s cubic-bezier(.16,1,.3,1);
    }
    .expandable-metric-card.is-clickable:hover::after,.expandable-metric-card.is-expanded::after{opacity:1}
    .expandable-metric-card:focus-visible{outline:2px solid rgba(216,169,61,.55);outline-offset:3px}
    .metric-topline{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}
    .metric-label,.metric-value-inner,.metric-subtitle{min-width:0;overflow:hidden;text-overflow:ellipsis}
    .metric-label{
      font-size:10.5px;line-height:1.15;letter-spacing:.045em;text-transform:uppercase;
      color:rgba(248,241,229,.50);white-space:nowrap;flex:1;
    }
    .metric-value{margin-top:8px;font-size:clamp(22px,2.2vw,30px);line-height:.95;font-weight:850;font-variant-numeric:tabular-nums;min-width:0}
    .metric-value-inner{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .metric-subtitle{margin-top:8px;font-size:11px;line-height:1.25;color:rgba(248,241,229,.50);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .expandable-metric-card.is-expanded .metric-subtitle{max-width:none}
    .metric-expand-indicator{
      flex:0 0 auto;display:inline-flex;align-items:center;gap:4px;
      font-size:10px;line-height:1;color:rgba(216,169,61,.78);
      opacity:0;transform:translateY(-2px);
      transition:opacity .2s cubic-bezier(.16,1,.3,1),transform .2s cubic-bezier(.16,1,.3,1);
    }
    .metric-expand-text{white-space:nowrap}
    .expandable-metric-card.is-clickable:hover .metric-expand-indicator,.expandable-metric-card.is-expanded .metric-expand-indicator{opacity:1;transform:translateY(0)}
    @media(max-width:420px){
      .metric-strip.is-mobile{grid-template-columns:1fr}
    }
    .hero-kpi-card,.metric-card.hero-kpi{min-width:0;min-height:88px;padding:14px 16px;overflow:hidden}
    .hero-kpi-label,.metric-card.hero-kpi .hero-kpi-label{font-size:10.5px;line-height:1.15;text-transform:uppercase;letter-spacing:.045em;color:rgba(248,241,229,.48);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:0}
    .hero-kpi-value,.metric-card.hero-kpi .metric-value{margin-top:8px;font-size:clamp(22px,2.4vw,30px);line-height:.96;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}
    .hero-kpi-sub,.metric-card.hero-kpi .hero-kpi-sub{margin-top:8px;font-size:11px;line-height:1.25;color:rgba(248,241,229,.52);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .chart-empty-state{min-height:96px;display:grid;place-items:center;text-align:center;border-radius:16px;background:rgba(255,255,255,.035);border:1px dashed rgba(255,255,255,.10);padding:20px 16px;gap:6px}
    .dashboard-page,.dashboard-page *{min-width:0}
    .dashboard-card,.glass-card.dashboard-card,.glass-card.activity-section,.glass-card.dashboard-attendance-widget{padding:20px !important;border-radius:22px;overflow:hidden}
    .dashboard-card-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px;min-width:0}
    .dashboard-card-title-group{min-width:0;display:grid;gap:4px;flex:1}
    .dashboard-card-title{min-width:0;font-size:16px;line-height:1.2;font-weight:850;color:${C.text};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin:0}
    .dashboard-card-subtitle{min-width:0;font-size:12px;line-height:1.35;color:rgba(248,241,229,.48);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .dashboard-card-action{flex:0 0 auto;white-space:nowrap;padding:4px 8px;margin-right:0;border:none;background:none;color:${C.primary};font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;border-radius:8px;transition:background .18s ease}
    .dashboard-card-action:hover{background:rgba(255,255,255,.06)}
    .dashboard-inner-panel{padding:14px;border-radius:16px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07)}
    .activity-section{min-height:340px;padding:22px !important}
    .activity-section .dashboard-card-header{margin-bottom:18px}
    .activity-list{display:grid;gap:12px}
    .activity-row{min-width:0;min-height:64px;display:grid;grid-template-columns:44px minmax(0,1fr);gap:14px;align-items:center;padding:14px 16px;border-radius:16px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07)}
    .activity-icon{width:40px;height:40px;display:grid;place-items:center;flex:0 0 auto}
    .activity-content{min-width:0;display:grid;gap:4px}
    .activity-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;line-height:1.25;font-weight:800;color:${C.text}}
    .activity-details{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px;color:rgba(248,241,229,.64)}
    .activity-meta{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:rgba(248,241,229,.44)}
    .dashboard-attendance-widget{width:100%;min-width:0;padding:20px !important;border-radius:22px;overflow:hidden}
    .dashboard-attendance-header{width:100%;min-width:0;display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:0}
    .dashboard-attendance-title{min-width:0;margin:0;font-size:16px;line-height:1.2;font-weight:850;color:${C.text};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
    .dashboard-attendance-link{flex:0 0 auto;white-space:nowrap;padding:4px 8px;font-size:12px}
    .dashboard-attendance-stats{width:100%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:16px}
    .attendance-mini-stat{
      min-width:0;width:100%;min-height:92px;padding:14px 10px;border-radius:16px;
      display:grid;align-content:center;justify-items:center;text-align:center;
      background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);
    }
    .attendance-mini-stat-value{font-size:18px;line-height:1;font-weight:850;font-variant-numeric:tabular-nums}
    .attendance-mini-stat-label{margin-top:6px;font-size:10px;line-height:1.2;color:rgba(248,241,229,.48)}
    .dashboard-attendance-alert{width:100%;min-width:0;margin-top:14px;padding:15px 16px;border-radius:18px;background:rgba(255,107,95,.075);border:1px solid rgba(255,107,95,.18)}
    .dashboard-attendance-alert-title{margin:0 0 10px;font-size:13px;line-height:1.2;font-weight:850;color:rgba(248,241,229,.74)}
    .dashboard-attendance-alert-list{display:grid;gap:8px}
    .dashboard-attendance-alert-row{min-width:0;display:grid;grid-template-columns:7px minmax(0,1fr);gap:9px;align-items:center}
    .dashboard-attendance-alert-dot{width:6px;height:6px;border-radius:999px;background:#F2A84B;flex-shrink:0}
    .dashboard-attendance-alert-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:${C.text}}
    .dashboard-attendance-alert-hint{color:rgba(248,241,229,.44)}
    .dashboard-attendance-alert-more{margin-top:10px;font-size:11px;color:rgba(248,241,229,.44)}
    @media(max-width:480px){
      .dashboard-attendance-widget{padding:16px !important}
      .dashboard-attendance-stats{gap:8px}
      .attendance-mini-stat{min-height:78px;padding:12px 8px}
    }
    @media(max-width:380px){
      .dashboard-attendance-stats{grid-template-columns:1fr}
    }
    .activity-card{overflow:hidden}
    .tech-map-card{padding:18px;border-radius:18px;background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.03));border:1px solid rgba(216,169,61,.16);box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 18px 50px rgba(0,0,0,.22)}
    .tech-map-header{display:flex;align-items:center;gap:12px;margin-bottom:14px}
    .tech-step-list{position:relative;display:grid;gap:10px}
    .tech-step{display:grid;grid-template-columns:30px minmax(0,1fr);gap:12px;align-items:start;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.06);transition:background .2s ease,border-color .2s ease}
    .tech-step:hover{background:rgba(255,255,255,.055);border-color:rgba(216,169,61,.14)}
    .tech-step-number{width:30px;height:30px;display:grid;place-items:center;border-radius:999px;background:rgba(216,169,61,.14);color:#F0CA68;font-weight:800;font-size:12px;flex-shrink:0}
    .tech-step-text{min-width:0;color:rgba(248,241,229,.88);line-height:1.35;font-size:13px}
    .worker-summary-card{display:grid;gap:16px}
    .worker-summary-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}
    .worker-contribution-list{display:grid;gap:0}
    .worker-contribution-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:14px;align-items:center;padding:12px 0;border-top:1px solid rgba(255,255,255,.07)}
    .worker-history-table{width:100%;border-collapse:collapse;table-layout:fixed}
    .worker-history-table th:nth-child(3),.worker-history-table td:nth-child(3){text-align:center;font-variant-numeric:tabular-nums}
    .worker-history-table th:nth-child(4),.worker-history-table td:nth-child(4){text-align:center;font-variant-numeric:tabular-nums}
    .worker-history-table th:nth-child(5),.worker-history-table td:nth-child(5){text-align:center}
    .app-toast{
      position:fixed;top:20px;left:0;right:0;margin:0 auto;width:fit-content;z-index:99999;
      display:inline-flex;align-items:center;gap:10px;
      min-height:44px;max-width:min(420px,calc(100vw - 32px));
      padding:12px 16px;border-radius:999px;
      background:rgba(53,66,41,.92);border:1px solid rgba(116,216,137,.26);
      box-shadow:0 18px 60px rgba(0,0,0,.32),inset 0 1px 0 rgba(255,255,255,.06);
      color:rgba(248,241,229,.96);backdrop-filter:blur(18px);pointer-events:auto;
    }
    .app-toast--success{border-color:rgba(116,216,137,.26)}
    .app-toast--error{border-color:rgba(255,107,95,.32);background:rgba(66,41,41,.92)}
    .app-toast--info{border-color:rgba(91,141,181,.32);background:rgba(41,50,66,.92)}
    .app-toast--warn{border-color:rgba(216,169,61,.32);background:rgba(66,58,41,.92)}
    .app-toast-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
    .app-toast--success .app-toast-dot{background:${C.success}}
    .app-toast--error .app-toast-dot{background:${C.danger}}
    .app-toast--info .app-toast-dot{background:${C.info}}
    .app-toast--warn .app-toast-dot{background:${C.primary}}
    .app-toast-text{font-size:13px;line-height:1.25;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .products-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}
    .product-card{position:relative;display:flex;flex-direction:column;min-height:320px;min-width:0;padding:16px 16px 14px !important}
    .product-card-header{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;min-width:0}
    .product-card-title{min-height:48px;margin:0;font-size:15px;font-weight:700;color:${C.text};line-height:1.25;flex:1;min-width:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .product-card-category{margin-top:10px}
    .product-card-description{margin:10px 0 0;min-height:42px;font-size:12px;line-height:1.35;color:rgba(248,241,229,.64);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .product-card-metrics{margin-top:14px}
    .product-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .product-metric{min-width:0;padding:10px;border-radius:10px;background:${C.bg}}
    .product-metric-value{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}
    .product-card-recipe{margin-top:14px;min-height:40px;display:flex;align-items:center;width:100%;min-width:0}
    .product-card-recipe-btn{width:100%;min-width:0}
    .product-card-recipe-empty{display:flex;align-items:center;min-height:40px;padding:0 4px;font-size:11px;color:rgba(248,241,229,.42);min-width:0}
    .product-card-recipe-empty--placeholder{visibility:hidden}
    .product-card-actions{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:14px}
    .product-card-main-actions{display:flex;align-items:center;gap:10px;min-width:0;flex:1}
    .product-card,.product-card *{min-width:0}
    .product-delete-btn{width:38px;height:38px;flex:0 0 auto;border-radius:12px;padding:0;display:inline-flex;align-items:center;justify-content:center}
    .money-text,.number-text{font-variant-numeric:tabular-nums;white-space:nowrap}
    .single-line{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .two-line{min-width:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .dashboard-kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;min-width:0}
    .notification-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .notification-body{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .payroll-row{display:grid;grid-template-columns:minmax(220px,1.5fr) minmax(70px,.4fr) minmax(80px,.45fr) minmax(90px,.55fr) minmax(120px,.65fr) minmax(170px,.9fr) 88px;gap:14px;align-items:center;min-width:0}
    @media(max-width:900px){.payroll-row{grid-template-columns:1fr;gap:10px}}
    .marks-page{display:grid;gap:18px;padding-bottom:28px;min-width:0}
    .marks-page-header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:4px;min-width:0}
    .marks-page-title{margin:0;font-size:clamp(24px,2.2vw,32px);line-height:1.08;font-weight:850;letter-spacing:-.03em;color:${C.text}}
    .marks-page-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end}
    .marks-filter-input{padding:8px 10px;background:${C.bg};border:1px solid ${C.border};border-radius:10px;color:${C.text};font-size:12px;font-family:inherit}
    .marks-page .attendance-summary-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .marks-page .attendance-summary-card{
      min-width:0;min-height:86px;padding:16px 18px;border-radius:18px;overflow:hidden;
      background:linear-gradient(180deg,rgba(255,255,255,.075),rgba(255,255,255,.035));
      border:1px solid rgba(255,255,255,.09);
      box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 12px 34px rgba(0,0,0,.18);
    }
    .marks-page .attendance-summary-label{font-size:10.5px;line-height:1.15;letter-spacing:.045em;text-transform:uppercase;color:rgba(248,241,229,.48);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .marks-page .attendance-summary-value{margin-top:10px;font-size:30px;line-height:.95;font-weight:850;font-variant-numeric:tabular-nums}
    .marks-page .attendance-summary-card[data-tone="success"] .attendance-summary-value{color:${C.success}}
    .marks-page .attendance-summary-card[data-tone="warning"] .attendance-summary-value{color:${C.orange}}
    .marks-page .attendance-summary-card[data-tone="neutral"] .attendance-summary-value{color:${C.muted}}
    .marks-page .attendance-summary-card[data-tone="info"] .attendance-summary-value{color:${C.info}}
    .marks-page .attendance-summary-card[data-tone="primary"] .attendance-summary-value{color:${C.primary}}
    @media(max-width:900px){.marks-page .attendance-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:460px){.marks-page .attendance-summary-grid{grid-template-columns:1fr}}
    .attendance-panel{padding:20px !important;border-radius:22px;overflow:hidden}
    .attendance-panel-header{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:16px;min-width:0}
    .attendance-panel-title{font-size:16px;line-height:1.2;font-weight:850;color:${C.text}}
    .attendance-list{display:grid;gap:0;min-width:0}
    .attendance-table-head{
      display:grid;grid-template-columns:minmax(240px,1.3fr) 140px 180px 110px minmax(230px,auto);
      gap:16px;align-items:center;padding:0 14px 10px;
      color:rgba(248,241,229,.38);font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.045em;
    }
    .attendance-row{
      display:grid;grid-template-columns:minmax(240px,1.3fr) 140px 180px 110px minmax(230px,auto);
      gap:16px;align-items:center;min-width:0;min-height:76px;padding:14px;border-radius:16px;
      background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);
      transition:background .18s cubic-bezier(.16,1,.3,1),border-color .18s cubic-bezier(.16,1,.3,1),transform .18s cubic-bezier(.16,1,.3,1);
    }
    .attendance-row+.attendance-row{margin-top:10px}
    .attendance-row:hover{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.13)}
    .attendance-row[data-status="active"]{border-left:3px solid rgba(116,216,137,.65)}
    .attendance-row[data-status="missing"]{border-left:3px solid rgba(242,168,75,.65)}
    .attendance-row[data-status="closed"]{border-left:3px solid rgba(121,184,216,.60)}
    .attendance-row[data-status="absent"]{border-left:3px solid rgba(255,107,95,.65)}
    .attendance-person-cell{min-width:0;display:flex;align-items:center;gap:12px}
    .attendance-avatar{width:38px;height:38px;flex:0 0 auto;border-radius:12px;display:grid;place-items:center;font-weight:700;font-size:14px}
    .attendance-person-info{min-width:0;display:grid;gap:3px}
    .attendance-person-name{min-width:0;font-size:14px;line-height:1.22;font-weight:700;color:rgba(248,241,229,.90);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .attendance-person-role{min-width:0;font-size:12px;line-height:1.2;font-weight:500;color:rgba(248,241,229,.48);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .attendance-status-cell{min-width:0;display:flex;align-items:center}
    .attendance-status-pill,.attendance-readonly-pill{
      max-width:100%;display:inline-flex;align-items:center;gap:6px;min-height:26px;padding:5px 9px;
      border-radius:999px;font-size:11px;line-height:1;font-weight:700;white-space:nowrap;
      border:1px solid transparent;
    }
    .attendance-status-pill[data-tone="success"],.attendance-readonly-pill[data-tone="success"]{background:rgba(116,216,137,.12);border-color:rgba(116,216,137,.24);color:#8fd89a}
    .attendance-status-pill[data-tone="warning"],.attendance-readonly-pill[data-tone="warning"]{background:rgba(242,168,75,.12);border-color:rgba(242,168,75,.24);color:#f0b56a}
    .attendance-status-pill[data-tone="info"],.attendance-readonly-pill[data-tone="info"]{background:rgba(121,184,216,.12);border-color:rgba(121,184,216,.24);color:#8ec0e8}
    .attendance-status-pill[data-tone="danger"],.attendance-readonly-pill[data-tone="danger"]{background:rgba(255,107,95,.12);border-color:rgba(255,107,95,.24);color:#f09588}
    .attendance-time-cell{min-width:0;display:grid;gap:4px;font-size:12px;line-height:1.25;color:rgba(248,241,229,.52)}
    .attendance-time-line{display:flex;align-items:center;gap:6px;min-width:0}
    .attendance-time-label{color:rgba(248,241,229,.38);flex:0 0 auto}
    .attendance-time-value{color:rgba(248,241,229,.68);font-variant-numeric:tabular-nums;min-width:0}
    .attendance-output-cell{min-width:0;display:flex;justify-content:center}
    .attendance-output-pill{
      min-width:56px;justify-content:center;display:inline-flex;align-items:center;min-height:28px;padding:5px 10px;
      border-radius:999px;font-size:11px;font-weight:750;font-variant-numeric:tabular-nums;white-space:nowrap;
      border:1px solid transparent;
    }
    .attendance-output-pill[data-tone="success"]{background:rgba(116,216,137,.12);border-color:rgba(116,216,137,.22);color:#8fd89a}
    .attendance-output-pill[data-tone="neutral"]{background:rgba(121,184,216,.10);border-color:rgba(121,184,216,.18);color:rgba(248,241,229,.58)}
    .attendance-actions-cell{min-width:0;display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap}
    .attendance-action-btn{min-height:34px !important;padding:0 12px !important;border-radius:999px !important;font-size:12px !important;font-weight:700 !important;white-space:nowrap}
    .attendance-btn-success{
      color:rgba(214,255,224,.96) !important;
      background:linear-gradient(180deg, rgba(116,216,137,.22), rgba(116,216,137,.12)) !important;
      border:1px solid rgba(116,216,137,.32) !important;
      box-shadow:0 10px 26px rgba(116,216,137,.12), inset 0 1px 0 rgba(255,255,255,.08) !important;
    }
    .attendance-btn-success:hover{
      background:linear-gradient(180deg, rgba(116,216,137,.28), rgba(116,216,137,.16)) !important;
      border-color:rgba(116,216,137,.42) !important;
    }
    .marks-worker-panel{padding:18px 20px !important;border-radius:22px;margin-bottom:0}
    .marks-worker-panel-title{font-size:15px;line-height:1.2;font-weight:850;color:${C.text};margin-bottom:14px}
    .marks-worker-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
    .marks-records-panel{padding:0 !important;overflow:hidden;border-radius:22px}
    @media(max-width:860px){
      .attendance-table-head{display:none}
      .attendance-row{grid-template-columns:1fr;gap:12px;min-height:auto;padding:14px}
      .attendance-person-cell{align-items:flex-start}
      .attendance-status-cell,.attendance-time-cell,.attendance-output-cell,.attendance-actions-cell{width:100%}
      .attendance-output-cell{justify-content:flex-start}
      .attendance-actions-cell{justify-content:stretch}
      .attendance-actions-cell .attendance-action-btn,.attendance-actions-cell .attendance-readonly-pill{flex:1 1 auto;justify-content:center}
    }
    @media(max-width:640px){.activity-row{grid-template-columns:40px minmax(0,1fr)}}
    .stores-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:12px;min-width:0}
    .store-card{
      position:relative;overflow:hidden;display:flex;flex-direction:column;
      transition:border-color .32s cubic-bezier(.16,1,.3,1),background .32s cubic-bezier(.16,1,.3,1),box-shadow .32s cubic-bezier(.16,1,.3,1),opacity .32s cubic-bezier(.16,1,.3,1),transform .22s cubic-bezier(.16,1,.3,1);
    }
    .store-card.is-blacklisted{
      border-color:rgba(255,107,95,.36) !important;
      background:linear-gradient(180deg,rgba(255,107,95,.065),rgba(255,255,255,.028)),rgba(22,18,15,.72) !important;
      box-shadow:inset 3px 0 0 rgba(255,107,95,.82),inset 0 1px 0 rgba(255,255,255,.06),0 18px 50px rgba(0,0,0,.22) !important;
      cursor:default;
    }
    .store-card.is-blacklisted::before{
      content:"";position:absolute;inset:0;pointer-events:none;border-radius:inherit;
      background:radial-gradient(circle at 12% 0%,rgba(255,107,95,.13),transparent 34%);opacity:1;
    }
    .store-card-header{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:6px;min-width:0;position:relative;z-index:1}
    .store-card-title-wrap{display:flex;align-items:flex-start;gap:8px;min-width:0;flex:1}
    .store-title{margin:0;font-size:15px;line-height:1.2;font-weight:700;min-width:0}
    .store-card.is-blacklisted .store-title{color:rgba(248,241,229,.58)}
    .store-card-badges-top{display:flex;gap:5px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end}
    .store-contact-row{display:flex;align-items:center;gap:8px;margin-top:4px;min-width:0;position:relative;z-index:1}
    .store-contact-text{font-size:12px;color:rgba(248,241,229,.64);min-width:0;overflow:hidden;text-overflow:ellipsis}
    .store-contact-row .store-contact-text{font-size:11px;color:rgba(248,241,229,.52)}
    .store-stats-row{margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;position:relative;z-index:1}
    .store-card-actions{margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;position:relative;z-index:1}
    .store-card-actions--blocked{margin-top:18px;justify-content:flex-end}
    .store-unblock-btn{min-height:38px !important;padding:0 14px !important;border-radius:999px !important;font-weight:800 !important;color:rgba(248,241,229,.92) !important;background:rgba(255,255,255,.075) !important;border:1px solid rgba(255,255,255,.12) !important}
    .store-unblock-btn:hover{background:rgba(255,255,255,.11) !important;border-color:rgba(255,255,255,.18) !important}
    .strikeable-text,.strikeable-muted{position:relative;display:inline-block;max-width:100%;min-width:0}
    .strikeable-text::after,.strikeable-muted::after{
      content:"";position:absolute;left:-2px;top:54%;width:0;height:2px;border-radius:999px;
      background:rgba(255,107,95,.88);box-shadow:0 0 14px rgba(255,107,95,.26);transform:translateY(-50%);
      transition:width .42s cubic-bezier(.16,1,.3,1);
    }
    .strikeable-muted::after{left:0;height:1px;background:rgba(255,107,95,.58);box-shadow:none}
    .store-card.is-blacklisted .strikeable-text::after{width:calc(100% + 4px)}
    .store-card.is-blacklisted .strikeable-muted::after{width:100%}
    .store-card.is-blacklisted .strikeable-muted{color:rgba(248,241,229,.58)}
    .store-blacklist-badge{
      display:inline-flex;align-items:center;gap:6px;min-height:24px;padding:5px 9px;border-radius:999px;
      font-size:11px;font-weight:800;color:rgba(255,132,121,.96);background:rgba(255,107,95,.13);border:1px solid rgba(255,107,95,.22);
    }
    .store-block-reason{
      display:inline-flex;align-items:center;gap:8px;margin-top:10px;max-width:100%;padding:8px 10px;border-radius:12px;
      color:rgba(255,132,121,.92);background:rgba(255,107,95,.08);border:1px solid rgba(255,107,95,.14);
      font-size:12px;line-height:1.25;position:relative;z-index:1;
    }
    .store-block-reason span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .store-history-panel{margin-top:12px;border-top:1px solid rgba(255,255,255,.08);padding-top:10px;position:relative;z-index:1}
    @media(max-width:520px){
      .store-card-actions--blocked{justify-content:stretch}
      .store-card-actions--blocked .store-unblock-btn{width:100%;justify-content:center}
    }
    .card,.glass-card,.metric-card,.task-card,.product-card,.store-card,.payroll-row,.attendance-row{min-width:0}
    .card-title,.card-text,.metric-label,.product-name,.store-name,.employee-name{min-width:0;overflow:hidden;text-overflow:ellipsis}
    @media(max-width:960px){
      .login-shell{grid-template-columns:1fr;width:100%;max-width:560px;min-height:auto;gap:32px;padding:0}
      .login-brand-panel{align-items:center;text-align:center;min-height:clamp(420px,58vh,520px);padding:32px 0 0}
      .login-brand-content{margin:0 auto}
      .login-brand-sub{margin:0 auto}
      .brand-orbit-wrap-one{width:min(300px,88%,52vh);left:50%}
      .brand-orbit-wrap-two{width:min(200px,62%,36vh);left:50%}
      .login-panel{padding:0 0 40px}
      .login-viewport{padding:24px !important;align-items:center}
    }
    .app-bg::before{
      content:"";
      position:fixed;inset:0;pointer-events:none;opacity:.035;
      background-image:radial-gradient(circle at 1px 1px, rgba(255,255,255,.35) 1px, transparent 0);
      background-size:22px 22px;
      mix-blend-mode:overlay;
    }
    .app-bg::after{
      content:"";position:fixed;inset:-20%;pointer-events:none;
      background:
        radial-gradient(circle at 20% 20%, rgba(211,166,70,.14), transparent 28%),
        radial-gradient(circle at 80% 30%, rgba(72,224,213,.10), transparent 30%),
        radial-gradient(circle at 55% 85%, rgba(167,139,250,.10), transparent 34%);
      filter:blur(24px);opacity:.85;
      animation:ambientGradient 18s ease-in-out infinite alternate;
    }
    .app-shell{
      position:relative;z-index:1;
      max-width:1540px;height:calc(100vh - 48px);
      margin:0 auto;
      display:grid;grid-template-columns:260px minmax(0,1fr);
      overflow:hidden;
      border-radius:30px;
      background:rgba(31,29,24,.58);
      border:1px solid rgba(255,255,255,.12);
      box-shadow:0 32px 110px rgba(0,0,0,.50), inset 0 1px 0 rgba(255,255,255,.10);
      backdrop-filter:blur(30px) saturate(130%);
      -webkit-backdrop-filter:blur(30px) saturate(130%);
    }
    .glass-sidebar{
      min-height:0;display:flex;flex-direction:column;
      background:linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.025));
      border-right:1px solid rgba(255,255,255,.09);
    }
    .app-workspace{min-width:0;min-height:0;display:flex;flex-direction:column}
    .glass-topbar{
      min-height:62px;display:flex;align-items:center;gap:12px;
      padding:12px 20px;
      background:rgba(255,255,255,.035);
      border-bottom:1px solid rgba(255,255,255,.08);
      backdrop-filter:blur(20px);
      -webkit-backdrop-filter:blur(20px);
      flex-shrink:0;
    }
    .page-canvas{flex:1;min-height:0;overflow:auto;padding:22px}
    .glass-chip{
      display:flex;align-items:center;gap:8px;
      padding:6px 12px;
      background:rgba(255,255,255,.055);
      border:1px solid rgba(255,255,255,.09);
      border-radius:999px;
      cursor:pointer;
      transition:background .18s ease,border-color .18s ease,transform .18s ease;
    }
    .glass-chip:hover{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.14)}
    .nav-item{
      display:flex;align-items:center;gap:9px;width:100%;
      padding:10px 14px;border:none;border-radius:12px;
      background:transparent;color:${C.muted};
      font-size:13px;font-weight:500;cursor:pointer;
      font-family:inherit;text-align:left;margin-bottom:2px;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      transition:background .18s ease,border-color .18s ease,color .18s ease,box-shadow .18s ease;
    }
    .nav-item:hover{background:rgba(255,255,255,.06);color:${C.text}}
    .nav-item.active{color:${C.primary}}
    .nav-sub-item{
      display:flex;align-items:center;gap:9px;width:100%;
      padding:8px 12px 8px 38px;border:none;border-radius:12px;
      background:transparent;color:${C.dim};
      font-size:12px;font-weight:400;cursor:pointer;
      font-family:inherit;margin-bottom:2px;text-align:left;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      min-height:36px;
      transition:background .18s ease,color .18s ease;
    }
    .nav-sub-item:hover{background:rgba(255,255,255,.05);color:${C.muted}}
    .nav-sub-item.active{color:${C.primary};font-weight:600}
    .nav-group-btn{
      display:flex;align-items:center;gap:9px;width:100%;
      padding:10px 14px;border:none;border-radius:12px;
      background:transparent;color:${C.muted};
      font-size:13px;font-weight:500;cursor:pointer;
      font-family:inherit;text-align:left;
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      min-height:38px;
      transition:background .18s ease,color .18s ease;
    }
    .nav-group-btn:hover{background:rgba(255,255,255,.06);color:${C.text}}
    .nav-group-btn.active-group{color:${C.primary};font-weight:700}
    .clickable-glass{transition:background .18s ease,border-color .18s ease,transform .18s ease,box-shadow .18s ease}
    .clickable-glass:hover{
      transform:translateY(-2px);
      border-color:rgba(255,255,255,.16);
      background:linear-gradient(180deg, rgba(255,255,255,.11), rgba(255,255,255,.045));
    }
    .glass-card{
      background:linear-gradient(180deg, rgba(255,255,255,.085), rgba(255,255,255,.035));
      backdrop-filter:blur(22px) saturate(125%);
      border:1px solid rgba(255,255,255,.095);
      border-radius:18px;
      box-shadow:0 18px 50px rgba(0,0,0,.24), inset 0 1px 0 rgba(255,255,255,.075);
    }
    .glass-heavy{background:rgba(18,16,13,.78);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.10)}
    .status-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0}
    .soft-scroll{scrollbar-width:thin}
    .clickable-card{cursor:pointer;transition:transform .18s ease,box-shadow .18s ease}
    .clickable-card:hover{transform:translateY(-2px)}
    .urgent-pulse{animation:pulseBorder 2s infinite}
    .mobile-card-list{display:grid;gap:12px}
    .data-table tbody tr{transition:background .15s ease;height:44px}
    .data-table tbody tr:hover{background:rgba(255,255,255,.045)}
    .data-table td{padding:11px 14px;font-size:13px}
    .dashboard-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(360px,400px);gap:20px;align-items:start}
    .dashboard-main{min-width:0;display:grid;gap:20px}
    .dashboard-rail{display:grid;gap:20px;position:sticky;top:0;min-width:0}
    .chart-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
    .kpi-row{display:flex;flex-wrap:wrap;gap:12px}
    .hero-mini-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-top:16px}
    .period-tabs{display:flex;gap:6px}
    .period-tab{
      padding:5px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.10);
      background:rgba(255,255,255,.04);color:${C.muted};
      font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;
      transition:all .18s ease;
    }
    .period-tab.active{background:rgba(211,166,70,.14);color:${C.primary};border-color:rgba(211,166,70,.25)}
    .period-tab:hover:not(.active){background:rgba(255,255,255,.07);color:${C.text}}
    .hero-number{font-size:32px;font-weight:800;color:${C.text};line-height:1.1}
    .hero-sub{font-size:12px;color:${C.dim};margin-top:4px}
    .eyebrow{font-size:11px;font-weight:600;color:${C.primary};text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px}
    .risk-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06)}
    .quick-action-btn{
      display:flex;align-items:center;gap:12px;width:100%;min-height:46px;
      padding:10px 14px;border-radius:13px;border:1px solid rgba(255,255,255,.10);
      background:rgba(255,255,255,.05);color:${C.text};
      font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;text-align:left;
      transition:background .18s ease,border-color .18s ease,transform .18s ease;
    }
    .quick-action-icon{
      width:28px;height:28px;display:grid;place-items:center;flex:0 0 auto;
      border-radius:9px;background:rgba(255,255,255,.06);color:${C.primary};
    }
    .quick-action-label{min-width:0;flex:1;line-height:1.2}
    .quick-action-btn:hover{background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.16);transform:translateY(-1px)}
    .quick-actions-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .user-glass-card{
      padding:10px 12px;border-radius:14px;
      background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);
    }
    .sidebar-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:998;backdrop-filter:blur(2px)}
  @media(max-width:1180px){
    .dashboard-grid{grid-template-columns:1fr}
    .dashboard-rail{position:static}
    .dashboard-attendance-widget{min-width:0}
    .chart-grid{grid-template-columns:1fr}
  }
  @media(max-width:1100px){
  }
  @media(max-width:900px){
    .app-bg{padding:0}
    .app-shell{height:100vh;border-radius:0;max-width:none;grid-template-columns:1fr}
    .glass-sidebar{
      position:fixed;top:0;left:0;bottom:0;width:min(88vw, 310px);z-index:999;
      transform:translateX(-100%);transition:transform .3s ease;
      box-shadow:0 20px 60px rgba(0,0,0,.5);
    }
    .glass-sidebar.open{transform:translateX(0)}
    .page-canvas{padding:14px}
  }
  @media(max-width:520px){
    .page-canvas{padding:12px}
    .hero-number{font-size:26px}
  }
  @media(max-width:640px){
    table{font-size:12px}
    .hide-mobile{display:none !important}
  }
  @media (prefers-reduced-motion:reduce){
    .app-bg::after,.skeleton::after,.btn-primary-shine::after{animation:none !important}
    *,*::before,*::after{
      animation-duration:.001ms !important;
      animation-iteration-count:1 !important;
      scroll-behavior:auto !important;
      transition-duration:.001ms !important;
    }
  }
  `;

  // Board mode: no login required — kitchen display screen
  if(new URLSearchParams(window.location.search).get("board")==="1"){
    return <OrdersBoardStandalone/>;
  }

  // While checking server session — show intro loader
  if(!sessionChecked){
    return (
      <MotionProvider>
        <style>{globalStyles}</style>
        <AnimatePresence>
          <AppLoader message="Загружаем смену…" />
        </AnimatePresence>
      </MotionProvider>
    );
  }

  if(!currentUser) return(
    <MotionProvider>
      <AppContext.Provider value={ctx}>
        <style>{globalStyles}</style>
        <div className="app-bg login-viewport">
          <LoginPage onLogin={handleLogin}/>
        </div>
      </AppContext.Provider>
    </MotionProvider>
  );

  const role=ROLES.find(r=>r.id===currentUser.roleId);
  const jobProfile=getJobProfile(currentUser);
  const isAdmin=role?.name==="admin";
  const isManager=role?.name==="manager";
  const isWorker=role?.name==="worker";
  const isOwner=role?.name==="owner";
  const isSuperAdmin=isAdmin||isOwner;
  const isManagerLikeRole=isSuperAdmin||isManager;
  const isPacker=jobProfile==="packer";
  const isCourier=jobProfile==="courier";
  const isLepstitsa=jobProfile==="lepstitsa";

  const buildNavGroups=()=>{
    if(isPacker){
      return [
        { id:"main", label:"Главная", icon:I.home, items:[{id:"dashboard",label:"Главная",ok:true}]},
        { id:"sales", label:"Фасовка", icon:I.box, items:[{id:"packing",label:"Фасовка",ok:true}]},
        { id:"system", label:"Система", icon:I.gear, items:[
          {id:"marks",label:"Посещаемость",ok:true},
          {id:"notifications",label:"Уведомления",ok:true},
        ]},
      ];
    }
    if(isCourier){
      return [
        { id:"main", label:"Главная", icon:I.home, items:[{id:"dashboard",label:"Главная",ok:true}]},
        { id:"sales", label:"Доставка", icon:I.truck, items:[{id:"delivery",label:"Доставка",ok:true}]},
        { id:"system", label:"Система", icon:I.gear, items:[
          {id:"marks",label:"Посещаемость",ok:true},
          {id:"notifications",label:"Уведомления",ok:true},
        ]},
      ];
    }
    if(isLepstitsa){
      return [
        { id:"main", label:"Главная", icon:I.home, items:[{id:"dashboard",label:"Главная",ok:true}]},
        { id:"production", label:"Производство", icon:I.factory, items:[
          {id:"tasks",label:"Задания",ok:true},
          {id:"workerHistory",label:"История",ok:true},
        ]},
        { id:"system", label:"Система", icon:I.gear, items:[
          {id:"marks",label:"Посещаемость",ok:true},
          {id:"notifications",label:"Уведомления",ok:true},
        ]},
      ];
    }
    if(isWorker){
      return [
        { id:"main", label:"Главная", icon:I.home, items:[{id:"dashboard",label:"Главная",ok:true}]},
        { id:"production", label:"Производство", icon:I.factory, items:[
          {id:"tasks",label:"Задания",ok:true},
          {id:"workerHistory",label:"История",ok:true},
        ]},
        { id:"system", label:"Система", icon:I.gear, items:[
          {id:"marks",label:"Посещаемость",ok:true},
          {id:"notifications",label:"Уведомления",ok:true},
        ]},
      ];
    }
    return [
      { id:"main", label:"Главная", icon:I.home, items:[{id:"dashboard",label:"Главная",ok:true}]},
      { id:"production", label:"Производство", icon:I.factory, items:[
        {id:"tasks",label:"Задания",ok:true},
        {id:"products",label:"Товары",ok:true},
        {id:"prodOutput",label:"Выпуск",ok:true},
        {id:"planning",label:"Планирование",ok:isManagerLikeRole},
        {id:"batches",label:"Партии",ok:isManagerLikeRole},
        {id:"defects",label:"Брак",ok:isManagerLikeRole},
      ]},
      { id:"warehouse", label:"Склад", icon:I.warehouse, items:[
        {id:"raw",label:"Сырьё",ok:isManagerLikeRole},
        {id:"deliveries",label:"Поставки",ok:isManagerLikeRole},
        {id:"procurement",label:"Закупки",ok:isManagerLikeRole},
      ]},
      { id:"sales", label:"Торговля", icon:I.truck, items:[
        {id:"clients",label:"Магазины",ok:isManagerLikeRole},
        {id:"sales",label:"Продажи",ok:isManagerLikeRole},
        {id:"inventory",label:"Движение",ok:isManagerLikeRole},
        {id:"ordersBoard",label:"Доска заказов",ok:isManagerLikeRole},
        {id:"packing",label:"Фасовка",ok:isManagerLikeRole},
        {id:"delivery",label:"Доставка",ok:isManagerLikeRole},
        {id:"debts",label:"Долги магазинов",ok:isManagerLikeRole},
      ]},
      { id:"staff", label:"Персонал", icon:I.people, items:[
        {id:"empstats",label:"KPI",ok:isManagerLikeRole},
        {id:"salary",label:"Расчёт оплаты",ok:isManagerLikeRole},
        {id:"workerHistory",label:"История",ok:true},
        {id:"marks",label:"Посещаемость",ok:true},
        {id:"users",label:"Пользователи",ok:isSuperAdmin},
      ]},
      { id:"analytics", label:"Аналитика", icon:I.analytics, items:[
        {id:"reports",label:"Отчёты",ok:isManagerLikeRole},
        {id:"profitAnalytics",label:"Прибыль",ok:isManagerLikeRole},
        {id:"logs",label:"Журнал",ok:isSuperAdmin},
      ]},
      { id:"system", label:"Система", icon:I.gear, items:[
        {id:"notifications",label:"Уведомления",ok:true},
        {id:"cameras",label:"Камеры",ok:isManagerLikeRole},
        {id:"trash",label:"Корзина",ok:isSuperAdmin},
      ]},
    ];
  };

  const navGroups = buildNavGroups().map(g=>({...g,items:g.items.filter(i=>i.ok)})).filter(g=>g.items.length>0);

  // Find which group the current page belongs to
  let activeGroupId = "main";
  for(const g of navGroups){
    if(g.items.some(i=>i.id===page)){ activeGroupId=g.id; break; }
  }

  // A group is open if user toggled it open OR it contains the active page
  const isGroupOpen = (gid) => gid===activeGroupId || openGroups.has(gid);

  const toggleGroup=(gid)=>{
    setOpenGroups(prev=>{
      const next=new Set(prev);
      // If it's the active group, always keep it open
      if(gid===activeGroupId) return prev;
      if(next.has(gid)) next.delete(gid); else next.add(gid);
      return next;
    });
  };

  const unreadCount=notifications.filter(n=>(n.targetAll||n.targetUsers?.includes(currentUser.id))&&!n.readBy?.includes(currentUser.id)).length;

  const renderPage=()=>{
    switch(page){
      case "dashboard":return <DashboardPage/>;
      case "tasks":return <TasksPage/>;
      case "products":return isWorker&&!isLepstitsa?<DashboardPage/>:<ProductsPage/>;
      case "prodOutput":return isManagerLikeRole||isLepstitsa?<ProductionOutputPage/>:<DashboardPage/>;
      case "planning":return isManagerLikeRole?<ProductionPlanPage/>:<DashboardPage/>;
      case "batches":return isManagerLikeRole?<BatchesPage/>:<DashboardPage/>;
      case "defects":return isManagerLikeRole?<DefectsPage/>:<DashboardPage/>;
      case "raw":return isManagerLikeRole?<RawMaterialsPage/>:<DashboardPage/>;
      case "deliveries":return isManagerLikeRole?<DeliveriesPage/>:<DashboardPage/>;
      case "procurement":return isManagerLikeRole?<ProcurementPage/>:<DashboardPage/>;
      case "clients":return isManagerLikeRole?<ClientsPage/>:<DashboardPage/>;
      case "sales":return isManagerLikeRole?<SalesPage/>:<DashboardPage/>;
      case "inventory":return isManagerLikeRole?<InventoryJournalPage/>:<DashboardPage/>;
      case "ordersBoard":return isManagerLikeRole?<OrdersBoardPage/>:<DashboardPage/>;
      case "packing":return (isManagerLikeRole||isPacker)?<PackingPage/>:<DashboardPage/>;
      case "delivery":return (isManagerLikeRole||isCourier)?<DeliveryPage/>:<DashboardPage/>;
      case "empstats":return isManagerLikeRole?<EmployeeStatsPage/>:<DashboardPage/>;
      case "salary":return isManagerLikeRole?<PayrollPage/>:<DashboardPage/>;
      case "workerHistory":return <WorkerHistoryPage/>;
      case "notifications":return <NotificationsPage/>;
      case "debts":return isManagerLikeRole?<DebtsPage/>:<DashboardPage/>;
      case "marks":return <MarksPage/>;
      case "reports":return isManagerLikeRole?<ReportsPage/>:<DashboardPage/>;
      case "profitAnalytics":return isManagerLikeRole?<ProfitAnalyticsPage/>:<DashboardPage/>;
      case "users":return isSuperAdmin?<UsersPage/>:<DashboardPage/>;
      case "logs":return isSuperAdmin?<LogsPage/>:<DashboardPage/>;
      case "cameras":return isManagerLikeRole?<CameraPage/>:<DashboardPage/>;
      case "trash":return isSuperAdmin?<TrashPage/>:<DashboardPage/>;
      default:return <DashboardPage/>;
    }
  };

  const quickActions=()=>{
    if(isSuperAdmin||isAdmin||isOwner){
      return [
        {label:"+ Задание",pg:"tasks"},
        {label:"+ Заказ",pg:"clients"},
        {label:"+ Поставка",pg:"deliveries"},
        {label:"Закупки",pg:"procurement"},
        {label:"Принять оплату",pg:"debts"},
      ];
    }
    if(isManager){
      return [
        {label:"+ Задание",pg:"tasks"},
        {label:"+ Выпуск",pg:"prodOutput"},
        {label:"+ Заказ",pg:"clients"},
        {label:"+ Поставка",pg:"deliveries"},
        {label:"Склад",pg:"raw"},
      ];
    }
    if(isPacker) return [{label:"Фасовка",pg:"packing"},{label:"Готовые",pg:"packing"}];
    if(isCourier) return [{label:"Доставка",pg:"delivery"},{label:"Мои",pg:"delivery"}];
    if(isLepstitsa) return [{label:"Отметить приход",pg:"marks"},{label:"Мои задания",pg:"tasks"}];
    return [{label:"Мои задания",pg:"tasks"}];
  };

  return(
    <MotionProvider>
    <AppContext.Provider value={ctx}>
      <style>{globalStyles}</style>
      <AnimatePresence>
        {currentUser && !introDone && <AppLoader key="intro" message={`Загружаем ${APP_BRAND}…`} />}
      </AnimatePresence>
      <div className="app-bg">
        {!serverOnline&&<div style={{position:"fixed",top:0,left:0,right:0,zIndex:1001,background:C.danger,color:"#fff",padding:"5px 16px",fontSize:12,fontWeight:600,textAlign:"center",letterSpacing:.3}}>Нет соединения с сервером — изменения не сохраняются</div>}
        {saveError&&serverOnline&&<div style={{position:"fixed",top:serverOnline?0:26,left:0,right:0,zIndex:1001,background:C.danger,color:"#fff",padding:"5px 16px",fontSize:12,fontWeight:600,textAlign:"center",letterSpacing:.3}}>Изменение не сохранено{saveError.status?` (${saveError.status})`:""} — нет прав или ошибка сервера. Страница будет пересинхронизирована.</div>}

        {isMobile&&sideOpen&&<div className="sidebar-overlay" onClick={()=>setSideOpen(false)}/>}

        <div className="app-shell">
          <aside className={`glass-sidebar${isMobile?(sideOpen?" open":""):""}`}>
            <div style={{padding:"16px 14px",borderBottom:"1px solid rgba(255,255,255,.08)"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:38,height:38,borderRadius:12,background:`linear-gradient(135deg, rgba(211,166,70,.25), rgba(211,166,70,.08))`,display:"flex",alignItems:"center",justifyContent:"center",color:C.primary,border:"1px solid rgba(211,166,70,.28)",boxShadow:"0 4px 16px rgba(211,166,70,.12)"}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5"/>
                    <path d="M2 12l10 5 10-5"/>
                  </svg>
                </div>
                <div>
                  <div style={{fontSize:16,fontWeight:800,color:C.text,letterSpacing:.4}}>{APP_BRAND}</div>
                  <div style={{fontSize:10,color:C.dim}}>{APP_TAGLINE.split(",")[0]}</div>
                </div>
              </div>
            </div>
            <EthnicBorder color={C.primary} height={2}/>
            <nav style={{flex:1,padding:"12px 14px",overflowY:"auto",overflowX:"hidden"}}>
              <LayoutGroup id="sidebar-nav">
              <motion.div variants={stagger} initial="hidden" animate="show">
              {navGroups.map(group=>{
                const GIco=group.icon;
                const isOpen=isGroupOpen(group.id);
                const groupHasActive=group.items.some(i=>i.id===page);
                const isSingle=group.items.length===1;
                const showBadgeOnGroup=group.id==="system"&&unreadCount>0;

                if(isSingle){
                  const item=group.items[0];
                  const active=page===item.id;
                  return(
                    <motion.div key={group.id} variants={listItem}>
                    <button key={group.id} onClick={()=>{setPage(item.id);setSideOpen(false)}} className={`nav-item${active?" active":""}`}>
                      {active&&<motion.div layoutId="active-nav-pill" className="active-nav-pill" transition={spring.soft}/>}
                      <span className="nav-item-content">
                        <motion.span whileHover={{ scale: 1.06 }} transition={spring.snappy} style={{ display: "flex" }}><GIco size={16}/></motion.span>
                        {group.label}
                      </span>
                      {showBadgeOnGroup&&<span style={{marginLeft:"auto",minWidth:18,height:18,borderRadius:9,background:C.danger,color:"#fff",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 5px",position:"relative",zIndex:1}}>{unreadCount>9?"9+":unreadCount}</span>}
                    </button>
                    </motion.div>
                  );
                }

                return(
                  <motion.div key={group.id} style={{marginBottom:4}} variants={listItem}>
                    <button onClick={()=>toggleGroup(group.id)} className={`nav-group-btn${groupHasActive?" active-group":""}`}>
                      <motion.span whileHover={{ scale: 1.06 }} transition={spring.snappy} style={{ display: "flex" }}><GIco size={16}/></motion.span>
                      <span style={{flex:1}}>{group.label}</span>
                      {showBadgeOnGroup&&<span style={{minWidth:18,height:18,borderRadius:9,background:C.danger,color:"#fff",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 5px",marginRight:4}}>{unreadCount>9?"9+":unreadCount}</span>}
                      <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={spring.snappy} style={{opacity:.5,flexShrink:0,display:"flex",alignItems:"center"}}><I.chevDown size={14}/></motion.span>
                    </button>
                    <AnimatePresence initial={false}>
                    {isOpen&&(
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={spring.soft}
                      style={{ overflow: "hidden" }}
                    >
                      {group.items.map(item=>{
                        const active=page===item.id;
                        const showItemBadge=item.id==="notifications"&&unreadCount>0;
                        return(
                          <button key={item.id} onClick={()=>{setPage(item.id);setSideOpen(false)}} className={`nav-sub-item${active?" active":""}`}>
                            {active&&<motion.div layoutId="active-nav-pill" className="active-nav-pill" transition={spring.soft}/>}
                            <span className="nav-sub-content">{item.label}</span>
                            {showItemBadge&&<span style={{marginLeft:"auto",minWidth:16,height:16,borderRadius:8,background:C.danger,color:"#fff",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px"}}>{unreadCount>9?"9+":unreadCount}</span>}
                          </button>
                        );
                      })}
                    </motion.div>
                    )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
              </motion.div>
              </LayoutGroup>
            </nav>
            <div style={{padding:"12px 14px",borderTop:"1px solid rgba(255,255,255,.08)"}}>
              <div className="user-glass-card" style={{marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:9}}>
                  <div style={{width:32,height:32,borderRadius:10,background:`linear-gradient(135deg, rgba(211,166,70,.22), rgba(211,166,70,.08))`,display:"flex",alignItems:"center",justifyContent:"center",color:C.primary,fontWeight:800,fontSize:13,border:"1px solid rgba(211,166,70,.22)"}}>{currentUser.name.charAt(0)}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{currentUser.name.split(" ").slice(0,2).join(" ")}</div>
                    <div style={{fontSize:10,color:C.dim}}>{role?.label}</div>
                  </div>
                </div>
              </div>
              <Btn v="secondary" sz="sm" onClick={handleLogout} icon={<I.out size={13}/>} style={{width:"100%",justifyContent:"center"}}>Выйти</Btn>
            </div>
          </aside>

          <div className="app-workspace">
            <header className="glass-topbar">
              <button onClick={()=>setSideOpen(!sideOpen)} style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.10)",borderRadius:10,color:C.muted,cursor:"pointer",padding:7,display:isMobile?"flex":"none",alignItems:"center"}}><I.menu size={18}/></button>
              {isMobile&&(
                <span style={{fontSize:13,fontWeight:700,color:C.text,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {pageTitle(page, currentUser)}
                </span>
              )}
              {!isMobile && (
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>
                    {pageTitle(page, currentUser)}
                  </div>
                  <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>
                    {roleChipLabel(currentUser)}
                  </div>
                </div>
              )}
              {!isMobile && isManagerLikeRole && (() => {
                const activeDebtSum = debts.filter(d => d.status !== "погашен").reduce((s, d) => s + (d.remaining ?? d.amount ?? 0), 0);
                const stockValue = products.filter(p => !p.deleted).reduce((s, p) => s + p.stock * p.sellPrice, 0);
                const chip = activeDebtSum > 0
                  ? { label: "Долги", value: formatMoney(activeDebtSum), color: C.danger, page: "debts" }
                  : stockValue > 0
                    ? { label: "Склад", value: formatMoney(stockValue), color: C.primary, page: "products" }
                    : null;
                if (!chip) return null;
                return (
                  <div className="glass-chip hide-mobile" onClick={() => setPage(chip.page)} title={chip.label} style={{ cursor: "pointer" }}>
                    <span style={{ fontSize: 10, color: C.dim, textTransform: "uppercase", letterSpacing: "0.04em" }}>{chip.label}</span>
                    <div style={{ fontSize: 12, fontWeight: 700, color: chip.color, lineHeight: 1.2 }}>{chip.value}</div>
                  </div>
                );
              })()}
              <div style={{flex:1}}/>
              {!isMobile&&quickActions().slice(0, isManagerLikeRole?2:1).map(a=>(
                <span key={a.pg+a.label} className="hide-mobile"><Btn v="secondary" sz="sm" onClick={()=>setPage(a.pg)}>{a.label}</Btn></span>
              ))}
              <NotificationBell onGoToPage={setPage} isMobile={isMobile}/>
              <Badge color={isSuperAdmin?"danger":isManager?"info":"primary"} s={{maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {roleChipLabel(currentUser)}
              </Badge>
            </header>
            <main className="page-canvas">
              <AnimatePresence mode="wait">
                <motion.div
                  key={page}
                  className="page-motion"
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  variants={pageVariants}
                >
                  {renderPage()}
                </motion.div>
              </AnimatePresence>
            </main>
          </div>
        </div>
      </div>
    </AppContext.Provider>
    </MotionProvider>
  );
}
