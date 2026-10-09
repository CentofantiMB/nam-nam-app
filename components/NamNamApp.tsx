'use client';

import React, { useMemo, useState } from 'react';
import { useApp } from './AppProvider';
import { Food, Goals, Macros, MealEntry, MealType, Recipe, ShoppingItem, UserProfile } from '@/lib/types';
import { addMacros, emptyMacros, formatDateLong, formatNumber, localISODate, progressState, round, uid } from '@/lib/utils';
import { hasSupabase } from '@/lib/supabase';
import { loadProfiles, signInWithPassword, signOut, signUpWithPassword } from '@/lib/persistence';

type View = 'today'|'history'|'stats'|'recipes'|'foods'|'shopping'|'users'|'settings';
const meals:MealType[] = ['Desayuno','Colación 1','Almuerzo','Colación 2','Merienda','Cena'];
const macroLabels:{key:keyof Macros;label:string;unit:string}[] = [
  {key:'protein',label:'Proteína',unit:'g'},
  {key:'carbs',label:'Carbohidratos',unit:'g'},
  {key:'fat',label:'Grasas',unit:'g'},
  {key:'fiber',label:'Fibra',unit:'g'},
];

function clamp(n:number,min:number,max:number){ return Math.min(max,Math.max(min,n)); }
function parseNum(v:string){ const n=Number(v.replace(',','.')); return Number.isFinite(n)?n:0; }
function currency(v:number){ return new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(v); }

function Icon({name}:{name:string}){
  const common={viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.9,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,'aria-hidden':true};
  const paths:Record<string,React.ReactNode>={
    today:<><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/></>,
    history:<><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></>,
    stats:<><path d="M5 20V11"/><path d="M12 20V5"/><path d="M19 20V8"/><path d="M3 20h18"/></>,
    recipes:<><path d="M5 4.5h10a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3Z"/><path d="M8 20V7.5a3 3 0 0 0-3-3"/><path d="M9 9h5M9 13h5"/></>,
    foods:<><path d="M12 7c-4.8-3.8-8.5.2-7.2 5.6C6 17.5 9 21 12 21s6-3.5 7.2-8.4C20.5 7.2 16.8 3.2 12 7Z"/><path d="M12 7c.3-2.2 1.5-3.6 3.6-4"/><path d="M11.8 6.8c-1.5-1.8-3.1-2.2-4.8-1.5"/></>,
    shopping:<><path d="M5 8h14l-1 12H6Z"/><path d="M9 8a3 3 0 0 1 6 0"/></>,
    users:<><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.5-3.5 2.4-5.3 5.5-5.3s5 1.8 5.5 5.3"/><circle cx="17" cy="9" r="2.2"/><path d="M15.7 14.8c2.7-.5 4.4.8 4.8 3.6"/></>,
    settings:<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
    more:<><path d="M4 7h16"/><path d="M7 12h10"/><path d="M10 17h4"/></>,
    plus:<path d="M12 5v14M5 12h14"/>,
    search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></>,
    close:<path d="m6 6 12 12M18 6 6 18"/>,
    back:<path d="m15 18-6-6 6-6"/>,
    next:<path d="m9 18 6-6-6-6"/>,
    check:<path d="m5 12 4 4L19 6"/>,
    edit:<><path d="M4 20h4l11-11-4-4L4 16Z"/><path d="m13.5 6.5 4 4"/></>,
    trash:<><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/><path d="M10 11v5M14 11v5"/></>,
    repeat:<><path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M18.2 9A7 7 0 0 0 6 6.8L4 9"/><path d="M5.8 15A7 7 0 0 0 18 17.2L20 15"/></>,
  };
  return <span aria-hidden className="icon"><svg {...common}>{paths[name]??<circle cx="12" cy="12" r="2"/>}</svg></span>;
}

function ProgressBar({value,goal,macro='kcal'}:{value:number;goal:number;macro:keyof Goals}){
  const state=progressState(macro,value,goal);
  const pct=goal>0?clamp((value/goal)*100,0,125):0;
  return <div className={`progress ${state}`}><div style={{width:`${Math.min(pct,100)}%`}}/></div>;
}

function MacroCard({label,keyName,value,goal,unit}:{label:string;keyName:keyof Goals;value:number;goal:number;unit:string}){
  const state=progressState(keyName,value,goal);
  return <div className={`macro-card ${state}`}>
    <div className="macro-head"><span>{label}</span><span className="state-dot"/></div>
    <div className="macro-value"><strong>{formatNumber(value, keyName==='kcal'?0:1)}</strong><span>/ {formatNumber(goal,0)} {unit}</span></div>
    <ProgressBar value={value} goal={goal} macro={keyName}/>
  </div>;
}

function Modal({title,children,onClose,wide=false}:{title:string;children:React.ReactNode;onClose:()=>void;wide?:boolean}){
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <div className={`modal ${wide?'wide':''}`} onMouseDown={e=>e.stopPropagation()}>
      <div className="modal-header"><h3>{title}</h3><button className="icon-btn" onClick={onClose}><Icon name="close"/></button></div>
      <div className="modal-body">{children}</div>
    </div>
  </div>;
}

function Toast({children,onClose}:{children:React.ReactNode;onClose:()=>void}){
  return <div className="toast success"><div className="toast-icon">✓</div><div>{children}</div><button onClick={onClose}>×</button></div>;
}

function Empty({text}:{text:string}){ return <div className="empty">{text}</div>; }

function MoreMenu({items,active,onSelect,onClose}:{items:(readonly [View,string,string])[];active:View;onSelect:(v:View)=>void;onClose:()=>void}){
  return <Modal title="Más opciones" onClose={onClose}>
    <div className="mobile-more-grid">
      {items.map(([id,label,icon])=><button key={id} className={active===id?'active':''} onClick={()=>{onSelect(id);onClose()}}><Icon name={icon}/><span>{label}</span><Icon name="next"/></button>)}
    </div>
  </Modal>;
}

function AuthScreen(){
  const [mode,setMode]=useState<'login'|'register'>('login');
  const [login,setLogin]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [repeat,setRepeat]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');

  const submitLogin=async()=>{
    if(!login.trim()||!password){setMessage('Completá usuario/email y contraseña.');return;}
    setBusy(true); setMessage('');
    const res=await signInWithPassword(login,password);
    setBusy(false);
    if(res.error) setMessage(res.error.message==='Invalid login credentials'?'Usuario o contraseña incorrectos.':res.error.message);
  };

  const submitRegister=async()=>{
    if(!email.trim()||!password){setMessage('Completá email y contraseña.');return;}
    if(password.length<6){setMessage('La contraseña debe tener al menos 6 caracteres.');return;}
    if(password!==repeat){setMessage('Las contraseñas no coinciden.');return;}
    setBusy(true); setMessage('');
    const res=await signUpWithPassword(email,password);
    setBusy(false);
    if(res.error){setMessage(res.error.message);return;}
    if(!res.data?.session){
      setMessage('La cuenta fue creada, pero Supabase todavía exige confirmación por email. Desactivá Confirm email en Authentication > Providers > Email.');
    }
  };

  return <div className="auth-shell">
    <div className="auth-glow one"/><div className="auth-glow two"/>
    <section className="auth-card">
      <div className="auth-brand"><div className="brand-icon auth-logo">Ñ</div><div><strong>Ñam Ñam</strong><small>tu nutrición, tus datos</small></div></div>
      <div className="auth-copy"><p className="eyebrow">Bienvenido</p><h1>{mode==='login'?'Ingresá a tu cuenta':'Crear cuenta'}</h1><p>{mode==='login'?'Cada usuario ve únicamente su propia información, historial y objetivos.':'Solo necesitás un email y una contraseña. No usamos confirmación por correo.'}</p></div>
      <div className="auth-tabs"><button className={mode==='login'?'active':''} onClick={()=>{setMode('login');setMessage('')}}>Ingresar</button><button className={mode==='register'?'active':''} onClick={()=>{setMode('register');setMessage('')}}>Registrarme</button></div>
      {mode==='login'?<div className="auth-form">
        <label className="field"><span>Email o usuario</span><input autoComplete="username" value={login} onChange={e=>setLogin(e.target.value)} placeholder="administrador o tu@email.com" onKeyDown={e=>e.key==='Enter'&&submitLogin()}/></label>
        <label className="field"><span>Contraseña</span><input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==='Enter'&&submitLogin()}/></label>
        <button className="primary full auth-submit" disabled={busy} onClick={submitLogin}>{busy?'Ingresando…':'Ingresar'}</button>
      </div>:<div className="auth-form">
        <label className="field"><span>Email</span><input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="persona@email.com"/></label>
        <label className="field"><span>Contraseña</span><input type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 6 caracteres"/></label>
        <label className="field"><span>Repetir contraseña</span><input type="password" autoComplete="new-password" value={repeat} onChange={e=>setRepeat(e.target.value)} placeholder="Repetí la contraseña" onKeyDown={e=>e.key==='Enter'&&submitRegister()}/></label>
        <button className="primary full auth-submit" disabled={busy} onClick={submitRegister}>{busy?'Creando…':'Crear cuenta e ingresar'}</button>
      </div>}
      {message&&<p className="auth-message">{message}</p>}
      <p className="auth-footnote">Tus registros quedan separados por cuenta y protegidos mediante Supabase.</p>
    </section>
  </div>;
}

export default function NamNamApp(){
  const app=useApp();
  const [view,setView]=useState<View>('today');
  const [date,setDate]=useState(localISODate());
  const [addMeal,setAddMeal]=useState<MealType|null>(null);
  const [editingEntry,setEditingEntry]=useState<MealEntry|null>(null);
  const [toast,setToast]=useState<{title:string;body:string}|null>(null);
  const [moreOpen,setMoreOpen]=useState(false);

  if(!app.ready) return <div className="boot"><div className="logo-mark">Ñ</div><p>Cargando Ñam Ñam…</p></div>;
  if(hasSupabase && !app.isAuthenticated) return <AuthScreen/>;

  const nav:(readonly [View,string,string])[]=[
    ['today','Hoy','today'],['history','Historial','history'],['stats','Evolución','stats'],['recipes','Recetas','recipes'],['foods','Alimentos','foods'],['shopping','Súper','shopping'],
    ...(app.userRole==='admin' ? [['users','Usuarios','users'] as const] : []),
    ['settings','Ajustes','settings']
  ];

  const mobilePrimary:(readonly [View,string,string])[]=[
    ['today','Hoy','today'],
    ['history','Historial','history'],
    ['stats','Progreso','stats'],
    ['recipes','Recetas','recipes'],
  ];
  const mobileExtra=nav.filter(([id])=>!mobilePrimary.some(([mainId])=>mainId===id));
  const showToast=(title:string,body:string)=>{setToast({title,body});setTimeout(()=>setToast(null),4200)};

  const handleAdd=(meal:MealType,itemType:'food'|'recipe',itemId:string,amount:number)=>{
    const result=app.addMealEntry({date,mealType:meal,itemType,itemId,amount});
    setAddMeal(null);
    if(result.crossedProteinGoal){ app.markProteinNotified(date); showToast('¡Objetivo de proteína logrado!','Llegaste a tu meta diaria. Excelente trabajo.'); }
  };

  const handleRepeat=(meal:MealType)=>{
    const result=app.repeatMealFromPreviousDay(date,meal);
    if(!result.copied){ showToast('Nada para repetir',`Ayer no registraste alimentos en ${meal.toLowerCase()}.`); return; }
    if(result.crossedProteinGoal) app.markProteinNotified(date);
    showToast(`${meal} repetido`,`${result.copied} ${result.copied===1?'registro copiado':'registros copiados'} desde ayer.`);
  };

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-icon">Ñ</div><div><strong>Ñam Ñam</strong><small>nutrición simple</small></div></div>
      <nav>{nav.map(([id,label,icon])=><button key={id} className={view===id?'active':''} onClick={()=>setView(id)}><Icon name={icon}/><span>{label}</span></button>)}</nav>
      <div className="side-foot"><span className={`sync-dot ${app.authMode}`}/><div><b>{app.userRole==='admin'?'Administrador':app.userEmail??'Modo local'}</b><small>{app.authMode==='remote'?'Sincronizado':'Modo local'}</small></div></div>
    </aside>

    <main className="main">
      <div className="mobile-top"><div className="brand-icon small">Ñ</div><div><strong>Ñam Ñam</strong><small>{nav.find(n=>n[0]===view)?.[1]}</small></div></div>
      {view==='today' && <TodayView date={date} setDate={setDate} onAdd={setAddMeal} onEdit={setEditingEntry} onRepeat={handleRepeat}/>} 
      {view==='history' && <HistoryView onOpenDate={d=>{setDate(d);setView('today')}}/>}
      {view==='stats' && <StatsView/>}
      {view==='recipes' && <RecipesView/>}
      {view==='foods' && <FoodsView/>}
      {view==='shopping' && <ShoppingView/>}
      {view==='users' && app.userRole==='admin' && <UsersView/>}
      {view==='settings' && <SettingsView/>}
    </main>

    <div className="mobile-nav">
      {mobilePrimary.map(([id,label,icon])=><button key={id} className={view===id?'active':''} onClick={()=>setView(id)}><Icon name={icon}/><span>{label}</span></button>)}
      <button className={!mobilePrimary.some(([id])=>id===view)?'active':''} onClick={()=>setMoreOpen(true)}><Icon name="more"/><span>Más</span></button>
    </div>

    {addMeal && <AddFoodModal meal={addMeal} onClose={()=>setAddMeal(null)} onAdd={handleAdd}/>} 
    {editingEntry && <EditEntryModal entry={editingEntry} onClose={()=>setEditingEntry(null)} onSave={amount=>{app.updateMealEntry(date,editingEntry.id,amount);setEditingEntry(null)}} onDelete={()=>{app.deleteMealEntry(date,editingEntry.id);setEditingEntry(null)}}/>}
    {moreOpen && <MoreMenu items={mobileExtra} active={view} onSelect={setView} onClose={()=>setMoreOpen(false)}/>}
    {toast && <Toast onClose={()=>setToast(null)}><strong>{toast.title}</strong><span> {toast.body}</span></Toast>}
  </div>;
}

function TodayView({date,setDate,onAdd,onEdit,onRepeat}:{date:string;setDate:(d:string)=>void;onAdd:(m:MealType)=>void;onEdit:(e:MealEntry)=>void;onRepeat:(m:MealType)=>void}){
  const app=useApp();
  const day=app.getDay(date);
  const totals=app.getDayTotals(date);
  const kcalRemaining=day.goals.kcal-totals.kcal;
  const yesterdayDateObj=new Date(`${date}T12:00:00`); yesterdayDateObj.setDate(yesterdayDateObj.getDate()-1);
  const yesterdayDate=localISODate(yesterdayDateObj);
  const yesterday=app.getDay(yesterdayDate);
  const shift=(days:number)=>{const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+days);setDate(localISODate(d));};
  return <div className="page fade-in">
    <header className="page-head today-head">
      <div><p className="eyebrow">Tu día</p><h1>{formatDateLong(date)}</h1></div>
      <div className="date-switch"><button onClick={()=>shift(-1)}><Icon name="back"/></button><button onClick={()=>setDate(localISODate())}>Hoy</button><button onClick={()=>shift(1)}><Icon name="next"/></button></div>
    </header>

    <section className="hero-card">
      <div className="hero-top"><div><span className="hero-label">Calorías</span><div className="hero-number"><strong>{formatNumber(totals.kcal,0)}</strong><span>/ {formatNumber(day.goals.kcal,0)} kcal</span></div></div><div className={`goal-badge ${progressState('kcal',totals.kcal,day.goals.kcal)}`}>{Math.round((totals.kcal/day.goals.kcal)*100)||0}%</div></div>
      <ProgressBar value={totals.kcal} goal={day.goals.kcal} macro="kcal"/>
      <p className="hero-note">{kcalRemaining>=0?<>Te quedan <b>{formatNumber(kcalRemaining,0)} kcal</b> para tu objetivo.</>:<>Estás <b>{formatNumber(Math.abs(kcalRemaining),0)} kcal</b> por encima del objetivo.</>}</p>
    </section>

    <section className="macro-grid">{macroLabels.map(m=><MacroCard key={m.key} label={m.label} keyName={m.key} value={totals[m.key]} goal={day.goals[m.key]} unit={m.unit}/>)}</section>

    <section className="meals-wrap">
      <div className="section-title"><div><p className="eyebrow">Registro</p><h2>Comidas del día</h2></div><span className="muted">{day.entries.length} registros</span></div>
      <div className="meal-grid">{meals.map(meal=>{
        const entries=day.entries.filter(e=>e.mealType===meal);
        const yesterdayEntries=yesterday.entries.filter(e=>e.mealType===meal);
        const mealMacros=entries.reduce((a,e)=>addMacros(a,e.macros),emptyMacros());
        return <article className="meal-card" key={meal}>
          <div className="meal-head">
            <div><h3>{meal}</h3><span>{entries.length?`${formatNumber(mealMacros.kcal,0)} kcal`:'Sin registros'}</span></div>
            <div className="meal-head-actions">
              <button className="repeat-meal" disabled={!yesterdayEntries.length} onClick={()=>onRepeat(meal)} title={yesterdayEntries.length?`Repetir ${meal.toLowerCase()} de ayer`:`Ayer no hubo registros en ${meal.toLowerCase()}`}><Icon name="repeat"/><span>Repetir ayer</span></button>
              <button className="round-add" onClick={()=>onAdd(meal)} title={`Agregar a ${meal}`}><Icon name="plus"/></button>
            </div>
          </div>
          <div className="meal-list">{entries.length===0?
            <div className="empty-meal-actions">
              <button className="add-empty" onClick={()=>onAdd(meal)}>+ Agregar alimento o receta</button>
              {yesterdayEntries.length>0&&<button className="repeat-empty" onClick={()=>onRepeat(meal)}><Icon name="repeat"/><span>Repetir {meal.toLowerCase()} de ayer</span><small>{yesterdayEntries.length} {yesterdayEntries.length===1?'registro':'registros'}</small></button>}
            </div>
            :entries.map(e=><button className="entry-row" key={e.id} onClick={()=>onEdit(e)}><div><strong>{e.itemName}</strong><span>{formatNumber(e.amount,e.amount%1?1:0)} {e.unit}</span></div><div><b>{formatNumber(e.macros.kcal,0)}</b><span>kcal</span></div></button>)}</div>
        </article>;
      })}</div>
    </section>
  </div>;
}

function AddFoodModal({meal,onClose,onAdd}:{meal:MealType;onClose:()=>void;onAdd:(meal:MealType,type:'food'|'recipe',id:string,amount:number)=>void}){
  const app=useApp();
  const [q,setQ]=useState(''); const [selected,setSelected]=useState<{type:'food'|'recipe';id:string;name:string;unit:'g'|'ml'}|null>(null); const [amount,setAmount]=useState('');
  const foods=app.state.foods.filter(f=>f.active&&f.name.toLowerCase().includes(q.toLowerCase())).slice(0,12);
  const recipes=app.state.recipes.filter(r=>r.active&&r.name.toLowerCase().includes(q.toLowerCase())).slice(0,12);
  return <Modal title={`Agregar · ${meal}`} onClose={onClose}>
    {!selected?<>
      <label className="search"><Icon name="search"/><input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar alimento o receta…"/></label>
      <div className="picker-group"><h4>Recetas</h4>{recipes.map(r=><button className="picker-row" key={r.id} onClick={()=>setSelected({type:'recipe',id:r.id,name:r.name,unit:'g'})}><span className="picker-icon recipe">◇</span><div><strong>{r.name}</strong><span>{formatNumber(app.getRecipeMacrosPer100(r).kcal,0)} kcal / 100 g</span></div><Icon name="next"/></button>)}{recipes.length===0&&<Empty text="No hay recetas que coincidan."/>}</div>
      <div className="picker-group"><h4>Alimentos</h4>{foods.map(f=><button className="picker-row" key={f.id} onClick={()=>setSelected({type:'food',id:f.id,name:f.name,unit:f.unit})}><span className="picker-icon food">◉</span><div><strong>{f.name}</strong><span>{formatNumber(f.kcal,0)} kcal / 100 {f.unit}</span></div><Icon name="next"/></button>)}{foods.length===0&&<Empty text="No hay alimentos que coincidan."/>}</div>
    </>:<div className="amount-step">
      <button className="back-link" onClick={()=>setSelected(null)}><Icon name="back"/> cambiar</button>
      <div className="selected-item"><span className={`picker-icon ${selected.type}`}>{selected.type==='recipe'?'◇':'◉'}</span><div><small>{selected.type==='recipe'?'RECETA':'ALIMENTO'}</small><h3>{selected.name}</h3></div></div>
      <label className="field"><span>Cantidad consumida</span><div className="input-unit"><input autoFocus inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0"/><b>{selected.unit}</b></div></label>
      <button className="primary full" disabled={parseNum(amount)<=0} onClick={()=>onAdd(meal,selected.type,selected.id,parseNum(amount))}>Agregar a {meal}</button>
    </div>}
  </Modal>;
}

function EditEntryModal({entry,onClose,onSave,onDelete}:{entry:MealEntry;onClose:()=>void;onSave:(a:number)=>void;onDelete:()=>void}){
  const [amount,setAmount]=useState(String(entry.amount).replace('.',','));
  return <Modal title={entry.itemName} onClose={onClose}>
    <div className="detail-kcal"><strong>{formatNumber(entry.macros.kcal,0)}</strong><span>kcal actuales</span></div>
    <label className="field"><span>Cantidad</span><div className="input-unit"><input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/><b>{entry.unit}</b></div></label>
    <div className="mini-macros"><span>P {formatNumber(entry.macros.protein,1)} g</span><span>C {formatNumber(entry.macros.carbs,1)} g</span><span>G {formatNumber(entry.macros.fat,1)} g</span><span>F {formatNumber(entry.macros.fiber,1)} g</span></div>
    <button className="primary full" onClick={()=>onSave(parseNum(amount))}>Guardar cambios</button>
    <button className="danger-link full" onClick={onDelete}>Eliminar del día</button>
  </Modal>;
}

function HistoryView({onOpenDate}:{onOpenDate:(d:string)=>void}){
  const app=useApp(); const [monthOffset,setMonthOffset]=useState(0);
  const now=new Date(); const first=new Date(now.getFullYear(),now.getMonth()+monthOffset,1); const year=first.getFullYear(); const month=first.getMonth();
  const daysInMonth=new Date(year,month+1,0).getDate(); const start=(new Date(year,month,1).getDay()+6)%7;
  const cells:(number|null)[]=[...Array(start).fill(null),...Array.from({length:daysInMonth},(_,i)=>i+1)];
  const logsSorted=Object.values(app.state.logs).sort((a,b)=>b.date.localeCompare(a.date));
  const dayDate=(d:number)=>`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  return <div className="page fade-in"><header className="page-head"><div><p className="eyebrow">Historial</p><h1>Tu recorrido</h1></div></header>
    <div className="history-layout"><section className="calendar-card"><div className="calendar-head"><button onClick={()=>setMonthOffset(x=>x-1)}><Icon name="back"/></button><h3>{new Intl.DateTimeFormat('es-AR',{month:'long',year:'numeric'}).format(first)}</h3><button onClick={()=>setMonthOffset(x=>x+1)}><Icon name="next"/></button></div><div className="weekdays">{['L','M','X','J','V','S','D'].map(x=><span key={x}>{x}</span>)}</div><div className="calendar-grid">{cells.map((d,i)=>{if(!d)return <span key={i}/>; const ds=dayDate(d); const log=app.state.logs[ds]; const totals=log?log.entries.reduce((a,e)=>addMacros(a,e.macros),emptyMacros()):null; const state=totals&&log?progressState('kcal',totals.kcal,log.goals.kcal):'none'; return <button key={ds} className={`${ds===localISODate()?'today':''} ${log?state:''}`} onClick={()=>log&&onOpenDate(ds)}><span>{d}</span>{log&&<i/>}</button>})}</div></section>
      <section className="history-list"><div className="section-title"><h2>Días registrados</h2></div>{logsSorted.length===0?<Empty text="Todavía no hay días registrados."/>:logsSorted.map(log=>{const t=log.entries.reduce((a,e)=>addMacros(a,e.macros),emptyMacros());return <button key={log.date} className="history-row" onClick={()=>onOpenDate(log.date)}><div><strong>{new Intl.DateTimeFormat('es-AR',{day:'numeric',month:'short',year:'numeric'}).format(new Date(`${log.date}T12:00:00`))}</strong><span>{log.entries.length} registros</span></div><div className="history-numbers"><b>{formatNumber(t.kcal,0)} kcal</b><span>{formatNumber(t.protein,0)} g prot.</span></div><Icon name="next"/></button>})}</section></div>
  </div>;
}

function StatsView(){
  const app=useApp(); const [period,setPeriod]=useState<7|30|90>(7);
  const dates=Array.from({length:period},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(period-1-i));return localISODate(d)});
  const series=dates.map(date=>{const log=app.state.logs[date];const totals=log?log.entries.reduce((a,e)=>addMacros(a,e.macros),emptyMacros()):emptyMacros();return {date,...totals,goal:log?.goals??app.state.goals,has:Boolean(log)}});
  const withData=series.filter(s=>s.has); const avg=(k:keyof Macros)=>withData.length?withData.reduce((a,s)=>a+s[k],0)/withData.length:0;
  const goodDays=withData.filter(s=>{const pct=s.kcal/s.goal.kcal*100;return pct>=90&&pct<=105}).length;
  return <div className="page fade-in"><header className="page-head"><div><p className="eyebrow">Evolución</p><h1>Cómo venís</h1></div><div className="segmented">{([7,30,90] as const).map(p=><button key={p} className={period===p?'active':''} onClick={()=>setPeriod(p)}>{p} días</button>)}</div></header>
    <section className="stat-grid"><div className="stat-card"><span>Promedio kcal</span><strong>{formatNumber(avg('kcal'),0)}</strong><small>por día registrado</small></div><div className="stat-card"><span>Proteína promedio</span><strong>{formatNumber(avg('protein'),1)} g</strong><small>por día registrado</small></div><div className="stat-card"><span>Fibra promedio</span><strong>{formatNumber(avg('fiber'),1)} g</strong><small>por día registrado</small></div><div className="stat-card"><span>Días en objetivo</span><strong>{goodDays} / {withData.length}</strong><small>90–105% kcal</small></div></section>
    <section className="chart-card"><div className="section-title"><div><p className="eyebrow">Calorías</p><h2>Consumo diario</h2></div></div><LineChart data={series.map(s=>s.kcal)} goal={app.state.goals.kcal}/></section>
    <section className="chart-card"><div className="section-title"><div><p className="eyebrow">Proteína</p><h2>Proteína diaria</h2></div></div><LineChart data={series.map(s=>s.protein)} goal={app.state.goals.protein}/></section>
  </div>;
}

function LineChart({data,goal}:{data:number[];goal:number}){
  const width=800,height=220,pad=28; const max=Math.max(goal*1.25,...data,1); const min=0;
  const x=(i:number)=>pad+(data.length===1?0:i/(data.length-1))*(width-pad*2); const y=(v:number)=>height-pad-((v-min)/(max-min))*(height-pad*2);
  const points=data.map((v,i)=>`${x(i)},${y(v)}`).join(' '); const goalY=y(goal);
  return <div className="chart-wrap"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gráfico de evolución"><line x1={pad} y1={goalY} x2={width-pad} y2={goalY} className="goal-line"/><polyline points={points} className="chart-line" fill="none"/>{data.map((v,i)=><circle key={i} cx={x(i)} cy={y(v)} r="3.2" className="chart-dot"/>)}</svg><div className="chart-legend"><span><i className="legend-dot"/>Consumo</span><span><i className="legend-line"/>Objetivo {formatNumber(goal,0)}</span></div></div>;
}

function FoodsView(){
  const app=useApp(); const [q,setQ]=useState(''); const [editing,setEditing]=useState<Food|null|undefined>(undefined);
  const list=app.state.foods.filter(f=>f.active&&f.name.toLowerCase().includes(q.toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name));
  return <div className="page fade-in"><header className="page-head"><div><p className="eyebrow">Base nutricional</p><h1>Alimentos</h1></div><button className="primary" onClick={()=>setEditing(null)}><Icon name="plus"/> Nuevo alimento</button></header>
    <div className="toolbar"><label className="search"><Icon name="search"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar alimento…"/></label><span>{list.length} alimentos activos</span></div>
    <div className="data-list">{list.map(f=><button key={f.id} className="data-row" onClick={()=>setEditing(f)}><div><strong>{f.name}</strong><span>cada 100 {f.unit}</span></div><div className="data-macros"><b>{formatNumber(f.kcal,0)} kcal</b><span>P {formatNumber(f.protein,1)}</span><span>C {formatNumber(f.carbs,1)}</span><span>G {formatNumber(f.fat,1)}</span></div><Icon name="next"/></button>)}</div>
    {editing!==undefined && <FoodEditor food={editing} onClose={()=>setEditing(undefined)}/>} 
  </div>;
}

function FoodEditor({food,onClose}:{food:Food|null;onClose:()=>void}){
  const app=useApp(); const [name,setName]=useState(food?.name??''); const [unit,setUnit]=useState<'g'|'ml'>(food?.unit??'g');
  const [vals,setVals]=useState({kcal:String(food?.kcal??''),fat:String(food?.fat??''),carbs:String(food?.carbs??''),protein:String(food?.protein??''),fiber:String(food?.fiber??'')});
  const save=()=>{if(!name.trim())return;app.saveFood({...(food??{}),name:name.trim(),unit,kcal:parseNum(vals.kcal),fat:parseNum(vals.fat),carbs:parseNum(vals.carbs),protein:parseNum(vals.protein),fiber:parseNum(vals.fiber)});onClose();};
  return <Modal title={food?'Editar alimento':'Nuevo alimento'} onClose={onClose}>
    <label className="field"><span>Nombre</span><input value={name} onChange={e=>setName(e.target.value)} placeholder="Ej. Yogurt natural"/></label>
    <label className="field"><span>Unidad base</span><select value={unit} onChange={e=>setUnit(e.target.value as 'g'|'ml')}><option value="g">100 g</option><option value="ml">100 ml</option></select></label>
    <div className="form-grid"><NumField label="Kcal" value={vals.kcal} set={v=>setVals(x=>({...x,kcal:v}))}/><NumField label="Grasas (g)" value={vals.fat} set={v=>setVals(x=>({...x,fat:v}))}/><NumField label="Carbos (g)" value={vals.carbs} set={v=>setVals(x=>({...x,carbs:v}))}/><NumField label="Proteínas (g)" value={vals.protein} set={v=>setVals(x=>({...x,protein:v}))}/><NumField label="Fibra (g)" value={vals.fiber} set={v=>setVals(x=>({...x,fiber:v}))}/></div>
    <button className="primary full" onClick={save}>Guardar alimento</button>{food&&<button className="danger-link full" onClick={()=>{app.deleteFood(food.id);onClose()}}>Desactivar alimento</button>}
  </Modal>;
}

function NumField({label,value,set}:{label:string;value:string;set:(v:string)=>void}){return <label className="field"><span>{label}</span><input inputMode="decimal" value={value} onChange={e=>set(e.target.value)}/></label>}

function RecipesView(){
  const app=useApp(); const [q,setQ]=useState(''); const [editing,setEditing]=useState<Recipe|null|undefined>(undefined);
  const list=app.state.recipes.filter(r=>r.active&&r.name.toLowerCase().includes(q.toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name));
  return <div className="page fade-in"><header className="page-head"><div><p className="eyebrow">Preparaciones</p><h1>Recetas</h1></div><button className="primary" onClick={()=>setEditing(null)}><Icon name="plus"/> Nueva receta</button></header>
    <div className="toolbar"><label className="search"><Icon name="search"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar receta…"/></label><span>{list.length} recetas activas</span></div>
    <div className="recipe-grid">{list.map(r=>{const m=app.getRecipeMacrosPer100(r);return <button className="recipe-card" key={r.id} onClick={()=>setEditing(r)}><div className="recipe-symbol">◇</div><div><h3>{r.name}</h3><p>{r.ingredients.length} ingredientes · {formatNumber(r.finalWeight,0)} g finales</p></div><div className="recipe-kcal"><strong>{formatNumber(m.kcal,0)}</strong><span>kcal / 100 g</span></div></button>})}</div>
    {editing!==undefined&&<RecipeEditor recipe={editing} onClose={()=>setEditing(undefined)}/>} 
  </div>;
}

function RecipeEditor({recipe,onClose}:{recipe:Recipe|null;onClose:()=>void}){
  const app=useApp(); const now=new Date().toISOString();
  const [draft,setDraft]=useState<Recipe>(recipe??{id:uid('recipe'),name:'',rawWeight:0,finalWeight:0,notes:'',active:true,ingredients:[],createdAt:now,updatedAt:now});
  const [foodToAdd,setFoodToAdd]=useState(app.state.foods.find(f=>f.active)?.id??''); const [amount,setAmount]=useState('');
  const calc=()=>{if(draft.finalWeight<=0)return emptyMacros();let total=emptyMacros();for(const i of draft.ingredients){const f=app.state.foods.find(x=>x.id===i.foodId);if(f)total=addMacros(total,{kcal:f.kcal*i.amount/100,fat:f.fat*i.amount/100,carbs:f.carbs*i.amount/100,protein:f.protein*i.amount/100,fiber:f.fiber*i.amount/100});}return {kcal:total.kcal*100/draft.finalWeight,fat:total.fat*100/draft.finalWeight,carbs:total.carbs*100/draft.finalWeight,protein:total.protein*100/draft.finalWeight,fiber:total.fiber*100/draft.finalWeight};};
  const macros=calc();
  const addIng=()=>{const a=parseNum(amount);if(!foodToAdd||a<=0)return;setDraft(d=>({...d,ingredients:[...d.ingredients,{id:uid('ri'),foodId:foodToAdd,amount:a}]}));setAmount('')};
  return <Modal title={recipe?'Editar receta':'Nueva receta'} onClose={onClose} wide>
    <div className="recipe-editor"><div className="recipe-form"><label className="field"><span>Nombre</span><input value={draft.name} onChange={e=>setDraft(d=>({...d,name:e.target.value}))} placeholder="Ej. Pan integral"/></label><div className="form-grid"><NumField label="Peso masa cruda (g)" value={String(draft.rawWeight||'')} set={v=>setDraft(d=>({...d,rawWeight:parseNum(v)}))}/><NumField label="Peso final cocinado (g)" value={String(draft.finalWeight||'')} set={v=>setDraft(d=>({...d,finalWeight:parseNum(v)}))}/></div><label className="field"><span>Notas</span><textarea value={draft.notes} onChange={e=>setDraft(d=>({...d,notes:e.target.value}))} placeholder="Opcional"/></label>
      <div className="ingredient-box"><h4>Ingredientes</h4>{draft.ingredients.length===0?<Empty text="Agregá el primer ingrediente."/>:draft.ingredients.map(i=>{const f=app.state.foods.find(x=>x.id===i.foodId);return <div className="ingredient-row" key={i.id}><div><strong>{f?.name??'Alimento eliminado'}</strong><span>{formatNumber(i.amount,1)} g</span></div><button className="icon-btn" onClick={()=>setDraft(d=>({...d,ingredients:d.ingredients.filter(x=>x.id!==i.id)}))}><Icon name="trash"/></button></div>})}<div className="ingredient-add"><select value={foodToAdd} onChange={e=>setFoodToAdd(e.target.value)}>{app.state.foods.filter(f=>f.active).sort((a,b)=>a.name.localeCompare(b.name)).map(f=><option value={f.id} key={f.id}>{f.name}</option>)}</select><input inputMode="decimal" placeholder="gramos" value={amount} onChange={e=>setAmount(e.target.value)}/><button onClick={addIng}>Agregar</button></div></div>
      </div><aside className="recipe-preview"><p className="eyebrow">Por 100 g finales</p><div className="big-kcal">{formatNumber(macros.kcal,0)}<span>kcal</span></div><div className="preview-grid"><span><b>{formatNumber(macros.protein,1)}</b> proteína</span><span><b>{formatNumber(macros.carbs,1)}</b> carbos</span><span><b>{formatNumber(macros.fat,1)}</b> grasas</span><span><b>{formatNumber(macros.fiber,1)}</b> fibra</span></div><div className="weight-note">Crudo: {formatNumber(draft.rawWeight,0)} g<br/>Final: {formatNumber(draft.finalWeight,0)} g</div></aside></div>
    <button className="primary full" disabled={!draft.name.trim()||draft.finalWeight<=0} onClick={()=>{app.saveRecipe(draft);onClose()}}>Guardar receta</button>{recipe&&<button className="danger-link full" onClick={()=>{app.deleteRecipe(recipe.id);onClose()}}>Desactivar receta</button>}
  </Modal>;
}

function ShoppingView(){
  const app=useApp(); const [q,setQ]=useState(''); const [editing,setEditing]=useState<ShoppingItem|null|undefined>(undefined);
  const list=app.state.shopping.filter(s=>s.name.toLowerCase().includes(q.toLowerCase())).sort((a,b)=>Number(a.checked)-Number(b.checked)||a.name.localeCompare(b.name));
  return <div className="page fade-in"><header className="page-head"><div><p className="eyebrow">Lista independiente</p><h1>Súper</h1></div><button className="primary" onClick={()=>setEditing(null)}><Icon name="plus"/> Producto</button></header><div className="toolbar"><label className="search"><Icon name="search"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar producto…"/></label><span>{list.filter(x=>!x.checked).length} pendientes</span></div>
    <div className="shopping-list">{list.map(s=><div className={`shopping-row ${s.checked?'done':''}`} key={s.id}><button className="check-btn" onClick={()=>app.toggleShoppingItem(s.id)}>{s.checked?'✓':''}</button><button className="shopping-main" onClick={()=>setEditing(s)}><div><strong>{s.name}</strong><span>{s.quantity} · {s.unit} · {s.frequency}</span></div><b>{currency(s.referencePrice)}</b></button></div>)}</div>
    {editing!==undefined&&<ShoppingEditor item={editing} onClose={()=>setEditing(undefined)}/>} 
  </div>;
}

function ShoppingEditor({item,onClose}:{item:ShoppingItem|null;onClose:()=>void}){
  const app=useApp(); const [draft,setDraft]=useState<ShoppingItem>(item??{id:uid('shop'),category:'Almacén',name:'',quantity:1,unit:'unidad',referencePrice:0,frequency:'Semanal',checked:false,updatedAt:new Date().toISOString()});
  return <Modal title={item?'Editar producto':'Nuevo producto'} onClose={onClose}><label className="field"><span>Producto</span><input value={draft.name} onChange={e=>setDraft(d=>({...d,name:e.target.value}))}/></label><div className="form-grid"><label className="field"><span>Categoría</span><input value={draft.category} onChange={e=>setDraft(d=>({...d,category:e.target.value}))}/></label><NumField label="Cantidad" value={String(draft.quantity)} set={v=>setDraft(d=>({...d,quantity:parseNum(v)}))}/><label className="field"><span>Unidad</span><input value={draft.unit} onChange={e=>setDraft(d=>({...d,unit:e.target.value}))}/></label><NumField label="Precio referencia ($)" value={String(draft.referencePrice)} set={v=>setDraft(d=>({...d,referencePrice:parseNum(v)}))}/><label className="field"><span>Frecuencia</span><select value={draft.frequency} onChange={e=>setDraft(d=>({...d,frequency:e.target.value as ShoppingItem['frequency']}))}><option>Semanal</option><option>Mensual</option><option>Ocasional</option></select></label></div><button className="primary full" disabled={!draft.name.trim()} onClick={()=>{app.saveShoppingItem({...draft,updatedAt:new Date().toISOString()});onClose()}}>Guardar producto</button>{item&&<button className="danger-link full" onClick={()=>{app.deleteShoppingItem(item.id);onClose()}}>Eliminar producto</button>}</Modal>;
}

function UsersView(){
  const [users,setUsers]=useState<UserProfile[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  React.useEffect(()=>{
    let mounted=true;
    loadProfiles().then(rows=>{if(mounted)setUsers(rows)}).catch(err=>{if(mounted)setError(err instanceof Error?err.message:'No se pudieron cargar los usuarios.')}).finally(()=>{if(mounted)setLoading(false)});
    return()=>{mounted=false};
  },[]);

  return <div className="page fade-in"><header className="page-head"><div><p className="eyebrow">Administración</p><h1>Usuarios</h1></div></header>
    <section className="settings-card users-card"><div className="section-title"><div><p className="eyebrow">Cuentas</p><h2>Usuarios registrados</h2></div><span className="muted">{users.length} cuentas</span></div>
      <p className="muted paragraph">Cada cuenta tiene su propio historial, objetivos, alimentos, recetas y lista del súper. Desde esta vista solo se muestran las cuentas; las contraseñas nunca son visibles.</p>
      {loading?<Empty text="Cargando usuarios…"/>:error?<p className="form-msg">{error}</p>:<div className="users-list">{users.map(u=><div className="user-row" key={u.id}><div className={`user-avatar ${u.role}`}>{u.role==='admin'?'A':'U'}</div><div className="user-main"><strong>{u.email}</strong><span>Creado {new Intl.DateTimeFormat('es-AR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(u.createdAt))}</span></div><span className={`role-pill ${u.role}`}>{u.role==='admin'?'Administrador':'Usuario'}</span></div>)}</div>}
    </section>
  </div>;
}

function SettingsView(){
  const app=useApp(); const [goals,setGoals]=useState(app.state.goals); const [saved,setSaved]=useState(false);
  const set=(k:keyof Goals,v:string)=>setGoals(g=>({...g,[k]:parseNum(v)}));
  return <div className="page fade-in"><header className="page-head"><div><p className="eyebrow">Preferencias</p><h1>Ajustes</h1></div></header><div className="settings-grid"><section className="settings-card"><div className="section-title"><div><p className="eyebrow">Objetivos</p><h2>Metas diarias</h2></div></div><p className="muted paragraph">Los objetivos se copian al registro de cada nuevo día para que el historial conserve la meta que estaba vigente.</p><div className="form-grid goals"><NumField label="Calorías (kcal)" value={String(goals.kcal)} set={v=>set('kcal',v)}/><NumField label="Proteína (g)" value={String(goals.protein)} set={v=>set('protein',v)}/><NumField label="Carbohidratos (g)" value={String(goals.carbs)} set={v=>set('carbs',v)}/><NumField label="Grasas (g)" value={String(goals.fat)} set={v=>set('fat',v)}/><NumField label="Fibra (g)" value={String(goals.fiber)} set={v=>set('fiber',v)}/></div><button className="primary" onClick={()=>{app.saveGoals(goals);setSaved(true);setTimeout(()=>setSaved(false),1800)}}>{saved?'✓ Guardado':'Guardar objetivos'}</button></section>
      <section className="settings-card"><div className="section-title"><div><p className="eyebrow">Cuenta</p><h2>{app.authMode==='remote'?'Sesión activa':'Tus datos'}</h2></div></div>{!hasSupabase?<><p className="muted paragraph">La aplicación funciona en modo local. Configurá Supabase para habilitar cuentas y sincronización.</p><div className="status-pill">● Modo local activo</div></>:<><div className="account-summary"><div className={`user-avatar ${app.userRole??'user'}`}>{app.userRole==='admin'?'A':'U'}</div><div><strong>{app.userEmail}</strong><span>{app.userRole==='admin'?'Administrador':'Usuario'} · sincronización activa</span></div></div><p className="muted paragraph">Tus datos están aislados de las demás cuentas y se sincronizan automáticamente con Supabase.</p><button className="secondary" onClick={()=>signOut()}>Cerrar sesión</button></>}</section>
      <section className="settings-card future"><div className="section-title"><div><p className="eyebrow">Próximamente</p><h2>Entrenamiento</h2></div></div><p className="muted paragraph">La estructura del proyecto deja reservado el módulo de sesiones, ejercicios, series, repeticiones, duración y gasto calórico estimado. No se mezcla todavía con el objetivo alimentario.</p><div className="future-icon">⌁</div></section></div>
  </div>;
}

