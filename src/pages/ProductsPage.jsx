import { useState, useEffect, useCallback, useMemo, useContext, useRef } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area } from "recharts";
import { AppContext } from "../context/AppContext.js";
import { ROLES, JOB_TITLES, PAY_TYPES, STORE_STATUSES, STORE_STATUS_LABELS, ORDER_SOURCES, ATTENDANCE_TYPES, ATTENDANCE_TYPE_COLORS, BATCH_STATUSES, DEFECT_REASONS, PAYROLL_STATUSES, CATEGORIES, UNITS, STATUSES, TASK_STATUSES, RAW_CATEGORIES, RAW_UNITS, NOTIF_TYPES, MARK_TYPES, PLAN_STATUSES, ORDER_STATUSES, ORDER_PRIORITIES, BOARD_COLUMNS, MOVEMENT_TYPES, DEBT_STATUSES, CAMERA_SOURCE_TYPES, CAMERA_SOURCE_LABELS, CAMERA_ZONES } from "../constants/index.js";
import { fmtDate, fmtShort, fmtTime, daysBetween, relTime } from "../utils/dates.js";
import { formatMoney } from "../utils/formatters.js";
import { C, CC } from "../theme/colors.js";
import { I } from "../icons/Icons.jsx";
import { EthnicCorner, Badge, Btn, Inp, Sel, Txa, Modal, Confirm, Stat, Toast, TH, TD, Card, Title, PageH, SearchBox, RecipeButton, RecipeModal } from "../components/ui/index.jsx";
import { TechMapCard } from "../components/ui/TechMapCard.jsx";

// RECIPE EDITOR COMPONENT
const RecipeEditor = ({recipeItems, setRecipeItems, rawMaterials, showCostCalc=true}) => {
  const addItem = () => {
    setRecipeItems([...recipeItems, {rawId: rawMaterials[0]?.id || "", qty: "", unit: rawMaterials[0]?.unit || "кг"}]);
  };
  const removeItem = (idx) => {
    setRecipeItems(recipeItems.filter((_, i) => i !== idx));
  };
  const updateItem = (idx, field, value) => {
    const updated = recipeItems.map((item, i) => {
      if (i !== idx) return item;
      if (field === "rawId") {
        const raw = rawMaterials.find(r => r.id === +value);
        return { ...item, rawId: +value, unit: raw?.unit || "кг" };
      }
      return { ...item, [field]: value };
    });
    setRecipeItems(updated);
  };

  const calcCost = useMemo(() => {
    return recipeItems.reduce((sum, item) => {
      if (!item.rawId || !item.qty || +item.qty <= 0) return sum;
      const raw = rawMaterials.find(r => r.id === +item.rawId);
      return sum + (raw?.costPerUnit || 0) * +item.qty;
    }, 0);
  }, [recipeItems, rawMaterials]);

  return (
    <div style={{marginTop:8}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <I.recipe size={16}/>
          <span style={{fontSize:13,fontWeight:700,color:C.text}}>Рецептура</span>
        </div>
        <Btn v="secondary" sz="sm" onClick={addItem} icon={<I.plus size={13}/>}>Ингредиент</Btn>
      </div>

      {recipeItems.length === 0 && (
        <div style={{textAlign:"center",padding:"16px 0",color:C.dim,fontSize:12,border:`1px dashed ${C.border}`,borderRadius:8}}>
          Нажмите «Ингредиент» чтобы добавить состав
        </div>
      )}

      {recipeItems.map((item, idx) => {
        const raw = rawMaterials.find(r => r.id === +item.rawId);
        const itemCost = raw && item.qty ? (raw.costPerUnit * +item.qty) : 0;
        return (
          <div key={idx} style={{display:"flex",gap:8,alignItems:"flex-end",marginBottom:8,padding:10,background:C.bg,borderRadius:8,border:`1px solid ${C.border}`}}>
            <div style={{flex:"2 1 120px"}}>
              {idx===0&&<label style={{display:"block",fontSize:11,fontWeight:500,color:C.dim,marginBottom:3}}>Сырьё</label>}
              <select value={item.rawId} onChange={e=>updateItem(idx,"rawId",e.target.value)} style={{width:"100%",padding:"7px 8px",background:C.surface2,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:12,fontFamily:"inherit",appearance:"none"}}>
                <option value="">Выберите</option>
                {rawMaterials.map(r=><option key={r.id} value={r.id}>{r.name} ({formatMoney(r.costPerUnit)}/{r.unit})</option>)}
              </select>
            </div>
            <div style={{flex:"1 1 70px"}}>
              {idx===0&&<label style={{display:"block",fontSize:11,fontWeight:500,color:C.dim,marginBottom:3}}>Кол-во на ед.</label>}
              <input type="number" step="0.001" value={item.qty} onChange={e=>updateItem(idx,"qty",e.target.value)} placeholder="0.00" style={{width:"100%",padding:"7px 8px",background:C.surface2,border:`1px solid ${C.border}`,borderRadius:6,color:C.text,fontSize:12,fontFamily:"inherit",boxSizing:"border-box"}}/>
            </div>
            <div style={{flex:"0 0 40px",textAlign:"center"}}>
              {idx===0&&<label style={{display:"block",fontSize:11,fontWeight:500,color:C.dim,marginBottom:3}}>Ед.</label>}
              <span style={{fontSize:12,color:C.muted,lineHeight:"32px"}}>{item.unit}</span>
            </div>
            <div style={{flex:"0 0 70px",textAlign:"right"}}>
              {idx===0&&<label style={{display:"block",fontSize:11,fontWeight:500,color:C.dim,marginBottom:3}}>Стоимость</label>}
              <span style={{fontSize:12,fontWeight:600,color:C.primary,lineHeight:"32px"}}>{formatMoney(itemCost,{maximumFractionDigits:1})}</span>
            </div>
            <button onClick={()=>removeItem(idx)} style={{background:"none",border:"none",color:C.danger,cursor:"pointer",padding:4,marginBottom:2,flexShrink:0}}>
              <I.x size={14}/>
            </button>
          </div>
        );
      })}

      {showCostCalc && recipeItems.length > 0 && (
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",background:`${C.primary}10`,borderRadius:8,border:`1px solid ${C.primary}25`,marginTop:6}}>
          <span style={{fontSize:13,fontWeight:600,color:C.text}}>Себестоимость по рецепту:</span>
          <span style={{fontSize:16,fontWeight:800,color:C.primary}}>{formatMoney(calcCost,{maximumFractionDigits:2})}</span>
        </div>
      )}
    </div>
  );
};

// PRODUCTS
const ProductsPage = ()=>{
  const {products,setProducts,addLog,currentUser,recipes,setRecipes,rawMaterials}=useContext(AppContext);
  const [modal,setModal]=useState(false);
  const [recipeModal,setRecipeModal]=useState(null);
  const [edit,setEdit]=useState(null);
  const [confirm,setConfirm]=useState(null);
  const [search,setSearch]=useState("");
  const [fCat,setFCat]=useState("all");
  const [fStat,setFStat]=useState("all");
  const [toast,setToast]=useState(null);
  const [errs,setErrs]=useState({});
  const empty={name:"",category:CATEGORIES[0],description:"",costPrice:"",sellPrice:"",stock:"",unit:"кг",status:"в производстве"};
  const [form,setForm]=useState(empty);
  const [recipeItems,setRecipeItems]=useState([]);
  const role=ROLES.find(r=>r.id===currentUser.roleId);
  const canEdit=role?.name==="admin"||role?.name==="owner"||role?.name==="manager";
  const isAdmin=role?.name==="admin"||role?.name==="owner";
  const isWorker=role?.name==="worker";

  // Calculate cost from recipe
  const recipeCost = useMemo(() => {
    return recipeItems.reduce((sum, item) => {
      if (!item.rawId || !item.qty || +item.qty <= 0) return sum;
      const raw = rawMaterials.find(r => r.id === +item.rawId);
      return sum + (raw?.costPerUnit || 0) * +item.qty;
    }, 0);
  }, [recipeItems, rawMaterials]);

  // Auto-update costPrice when recipe changes
  useEffect(() => {
    if (recipeItems.length > 0 && recipeCost > 0) {
      setForm(f => ({...f, costPrice: recipeCost.toFixed(2)}));
    }
  }, [recipeCost, recipeItems.length]);

  const list=useMemo(()=>{
    let l=products.filter(p=>!p.deleted);
    if(search)l=l.filter(p=>p.name.toLowerCase().includes(search.toLowerCase()));
    if(fCat!=="all")l=l.filter(p=>p.category===fCat);
    if(fStat!=="all")l=l.filter(p=>p.status===fStat);
    return l.sort((a,b)=>a.name.localeCompare(b.name));
  },[products,search,fCat,fStat]);

  const openNew=()=>{setEdit(null);setForm(empty);setRecipeItems([]);setErrs({});setModal(true)};
  const openEdit=p=>{
    setEdit(p);
    setForm({name:p.name,category:p.category,description:p.description,costPrice:p.costPrice,sellPrice:p.sellPrice,stock:p.stock,unit:p.unit,status:p.status});
    const recipe = recipes.find(r=>r.productId===p.id);
    setRecipeItems(recipe ? recipe.items.map(it=>({rawId:it.rawId,qty:it.qty,unit:it.unit||rawMaterials.find(r=>r.id===it.rawId)?.unit||"кг"})) : []);
    setErrs({});
    setModal(true);
  };
  const validate=()=>{const e={};if(!form.name.trim())e.name="!";if(!form.costPrice||+form.costPrice<=0)e.costPrice="!";if(!form.sellPrice||+form.sellPrice<=0)e.sellPrice="!";if(form.stock===""||+form.stock<0)e.stock="!";setErrs(e);return!Object.keys(e).length};

  const save=()=>{
    if(!validate())return;
    const now=new Date().toISOString();
    if(edit){
      setProducts(p=>p.map(x=>x.id===edit.id?{...x,name:form.name,category:form.category,description:form.description,costPrice:+form.costPrice,sellPrice:+form.sellPrice,stock:+form.stock,unit:form.unit,status:form.status,updatedAt:now}:x));
      // Update or create recipe
      if(recipeItems.length > 0 && isAdmin) {
        const validItems = recipeItems.filter(it=>it.rawId && it.qty && +it.qty > 0).map(it=>({rawId:+it.rawId,qty:+it.qty,unit:it.unit}));
        const existingRecipe = recipes.find(r=>r.productId===edit.id);
        if(existingRecipe) {
          setRecipes(p=>p.map(r=>r.productId===edit.id?{...r,items:validItems,updatedAt:now}:r));
        } else {
          setRecipes(p=>[...p,{id:Date.now(),productId:edit.id,items:validItems,createdAt:now,updatedAt:now}]);
        }
      } else if(recipeItems.length === 0 && isAdmin) {
        setRecipes(p=>p.filter(r=>r.productId!==edit.id));
      }
      addLog(`Обновлён товар: ${form.name}`);
      setToast({message:"Обновлён",type:"success"});
    } else {
      const newId = Date.now();
      setProducts(p=>[...p,{id:newId,...form,costPrice:+form.costPrice,sellPrice:+form.sellPrice,stock:+form.stock,createdAt:now,updatedAt:now,deleted:false}]);
      // Create recipe if items added
      if(recipeItems.length > 0) {
        const validItems = recipeItems.filter(it=>it.rawId && it.qty && +it.qty > 0).map(it=>({rawId:+it.rawId,qty:+it.qty,unit:it.unit}));
        if(validItems.length > 0) {
          setRecipes(p=>[...p,{id:Date.now()+1,productId:newId,items:validItems,createdAt:now,updatedAt:now}]);
        }
      }
      addLog(`Добавлен товар: ${form.name}`);
      setToast({message:"Добавлен",type:"success"});
    }
    setModal(false);
  };

  const del=p=>{setConfirm({title:"Удалить?",message:`Удалить "${p.name}"?`,onConfirm:()=>{const now=new Date().toISOString();setProducts(prev=>prev.map(x=>x.id===p.id?{...x,deleted:true,deletedAt:now,deletedBy:currentUser.id,deletedByName:currentUser.name,deletedReason:""}:x));setRecipes(prev=>prev.filter(r=>r.productId!==p.id));addLog(`Удалён: ${p.name}`);setToast({message:"Удалён",type:"error"});setConfirm(null)}})};
  const updateStatus=(p,s)=>{setProducts(prev=>prev.map(x=>x.id===p.id?{...x,status:s,updatedAt:new Date().toISOString()}:x));addLog(`Статус "${p.name}": ${s}`);setToast({message:"Обновлён",type:"success"})};
  const sc=s=>s==="готов"?"success":s==="в производстве"?"primary":"danger";

  return(
    <div>
      <PageH title="Товары">
        <SearchBox value={search} onChange={e=>setSearch(e.target.value)}/>
        <select value={fCat} onChange={e=>setFCat(e.target.value)} style={{padding:"7px 9px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,fontSize:12,fontFamily:"inherit"}}><option value="all">Все категории</option>{CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select>
        <select value={fStat} onChange={e=>setFStat(e.target.value)} style={{padding:"7px 9px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,fontSize:12,fontFamily:"inherit"}}><option value="all">Все статусы</option>{STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</select>
        {canEdit&&<Btn onClick={openNew} icon={<I.plus size={15}/>}>Добавить</Btn>}
      </PageH>
      <div className="products-grid">
        {list.map(p=>{
          const recipe=recipes.find(r=>r.productId===p.id);
          return(
          <Card key={p.id} className="product-card" s={{overflow:"hidden",borderTop:`1px solid ${sc(p.status)==="success"?`${C.success}45`:sc(p.status)==="primary"?`${C.primary}45`:`${C.danger}45`}`}}>
            <div className="product-card-header">
              <h3 className="product-card-title product-name">{p.name}</h3>
              <Badge color={sc(p.status)}>{p.status}</Badge>
            </div>
            <div className="product-card-category">
              <Badge color="purple">{p.category}</Badge>
            </div>
            <p className="product-card-description">{p.description || "\u00A0"}</p>
            <div className="product-card-metrics product-metrics">
              {(isWorker
                ? [["Склад",`${p.stock} ${p.unit}`,p.stock<20?C.danger:C.text],["Статус",p.status,C.primary]]
                : [["Себестоимость",formatMoney(p.costPrice),C.text],["Цена",formatMoney(p.sellPrice),C.success],["Склад",`${p.stock} ${p.unit}`,p.stock<20?C.danger:C.text],["Маржа",p.costPrice>0?`${((p.sellPrice-p.costPrice)/p.costPrice*100).toFixed(0)}%`:"—",C.primary]]
              ).map(([l,v,c],i)=>(
                <div key={i} className="product-metric">
                  <div style={{fontSize:10,color:C.dim,marginBottom:4}}>{l}</div>
                  <div className="product-metric-value" style={{fontSize:14,fontWeight:700,color:c}}>{v}</div>
                </div>
              ))}
            </div>
            <div className="product-card-recipe">
              {recipe ? (
                <RecipeButton block productId={p.id} products={products} recipes={recipes} onOpen={setRecipeModal}/>
              ) : canEdit ? (
                <span className="product-card-recipe-empty">Рецептура не задана</span>
              ) : (
                <span className="product-card-recipe-empty product-card-recipe-empty--placeholder">&nbsp;</span>
              )}
            </div>
            <div className="product-card-actions">
              <div className="product-card-main-actions">
                {isWorker ? (
                  <select value={p.status} onChange={e=>updateStatus(p,e.target.value)} style={{flex:1,padding:"8px 10px",background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,color:C.text,fontSize:12,fontFamily:"inherit",minWidth:0}}>{STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</select>
                ) : canEdit ? (
                  <Btn v="secondary" sz="sm" onClick={()=>openEdit(p)} icon={<I.edit size={13}/>}>Редактировать</Btn>
                ) : null}
              </div>
              {canEdit && (
                <button type="button" className="product-delete-btn" title="Удалить" onClick={()=>del(p)} style={{background:"rgba(255,107,95,.08)",border:`1px solid rgba(255,107,95,.28)`,color:C.danger,cursor:"pointer",fontFamily:"inherit"}}>
                  <I.trash size={15}/>
                </button>
              )}
            </div>
          </Card>
        )})}
      </div>
      {list.length===0&&<div style={{textAlign:"center",padding:50,color:C.dim}}><I.box size={36}/><p style={{marginTop:10}}>Не найдено</p></div>}

      {/* Create/Edit Product Modal with Recipe */}
      <Modal open={modal} onClose={()=>setModal(false)} title={edit?"Редактировать товар":"Новый товар"} width={640}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
          <Inp label="Название" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} error={errs.name} cStyle={{gridColumn:"1/3"}}/>
          <Sel label="Категория" value={form.category} onChange={e=>setForm({...form,category:e.target.value})} options={CATEGORIES.map(c=>({value:c,label:c}))}/>
          <Sel label="Ед. изм." value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})} options={UNITS.map(u=>({value:u,label:u}))}/>
          <Inp label="Себестоимость" type="number" value={form.costPrice} onChange={e=>setForm({...form,costPrice:e.target.value})} error={errs.costPrice}/>
          <Inp label="Цена продажи" type="number" value={form.sellPrice} onChange={e=>setForm({...form,sellPrice:e.target.value})} error={errs.sellPrice}/>
          <Inp label="Склад" type="number" value={form.stock} onChange={e=>setForm({...form,stock:e.target.value})} error={errs.stock}/>
          <Sel label="Статус" value={form.status} onChange={e=>setForm({...form,status:e.target.value})} options={STATUSES.map(s=>({value:s,label:s}))}/>
          <Txa label="Описание" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} cStyle={{gridColumn:"1/3"}}/>
        </div>

        {/* Recipe section in product form (admin only) */}
        {isAdmin && (
          <div style={{borderTop:`1px solid ${C.border}`,paddingTop:14,marginTop:6}}>
            <RecipeEditor recipeItems={recipeItems} setRecipeItems={setRecipeItems} rawMaterials={rawMaterials}/>
          </div>
        )}

        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:12}}><Btn v="secondary" onClick={()=>setModal(false)}>Отмена</Btn><Btn onClick={save}>{edit?"Сохранить":"Добавить"}</Btn></div>
      </Modal>

      {/* View Recipe Modal */}
      <Modal open={!!recipeModal} onClose={()=>setRecipeModal(null)} title="Рецептура" width={450}>
        {recipeModal&&(()=>{
          const recipe=recipes.find(r=>r.productId===recipeModal);
          const prod=products.find(p=>p.id===recipeModal);
          if(!recipe) return <p style={{color:C.muted}}>Рецептура не задана</p>;
          const totalCost = recipe.items.reduce((s,it)=>{const raw=rawMaterials.find(r=>r.id===it.rawId);return s+(raw?.costPerUnit||0)*it.qty},0);
          return(<div>
            <p style={{color:C.muted,fontSize:13,marginBottom:12}}>Состав на 1 {prod?.unit} «{prod?.name}»:</p>
            {recipe.items.map((it,i)=>{const raw=rawMaterials.find(r=>r.id===it.rawId);const cost=(raw?.costPerUnit||0)*it.qty;return(
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${C.border}`}}>
                <span style={{color:C.text,fontSize:13}}>{raw?.name||"?"}</span>
                <div style={{display:"flex",gap:16,alignItems:"center"}}>
                  <span style={{color:C.muted,fontSize:12}}>{formatMoney(cost,{maximumFractionDigits:1})}</span>
                  <span style={{color:C.primary,fontWeight:600,fontSize:13}}>{it.qty} {it.unit||raw?.unit}</span>
                </div>
              </div>
            )})}
            <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0 0",marginTop:6}}>
              <span style={{fontSize:14,fontWeight:700,color:C.text}}>Итого себестоимость:</span>
              <span style={{fontSize:14,fontWeight:800,color:C.primary}}>{formatMoney(totalCost,{maximumFractionDigits:2})}</span>
            </div>
            {recipe.updatedAt&&<div style={{fontSize:11,color:C.dim,marginTop:8}}>Обновлено: {fmtDate(recipe.updatedAt)}</div>}
            {prod?.techCard?.length > 0 && (
              <div style={{marginTop:16}}>
                <TechMapCard steps={prod.techCard} compact defaultOpen />
              </div>
            )}
          </div>);
        })()}
      </Modal>

      {confirm&&<Confirm open onClose={()=>setConfirm(null)} {...confirm}/>}
      {toast&&<Toast {...toast} onClose={()=>setToast(null)}/>}
    </div>
  );
};


export { ProductsPage };
