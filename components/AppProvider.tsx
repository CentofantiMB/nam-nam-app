'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, DailyLog, Food, Goals, Macros, MealEntry, MealType, Recipe, ShoppingItem, UserRole } from '@/lib/types';
import { addMacros, emptyMacros, localISODate, scaleMacros, uid } from '@/lib/utils';
import { loadLocalState, loadRemoteState, saveLocalState, saveRemoteState, getSessionUser, loadCurrentProfile } from '@/lib/persistence';
import { hasSupabase, supabase } from '@/lib/supabase';
import { seedState } from '@/lib/seed';

export type AuthMode = 'local' | 'remote' | 'signed-out';

type AddEntryInput = { date:string; mealType:MealType; itemType:'food'|'recipe'; itemId:string; amount:number };

type AppContextValue = {
  state: AppState;
  ready: boolean;
  authMode: AuthMode;
  userId: string | null;
  userEmail: string | null;
  userRole: UserRole | null;
  isAuthenticated: boolean;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  getRecipeMacrosPer100: (recipe: Recipe) => Macros;
  getDay: (date:string) => DailyLog;
  getDayTotals: (date:string) => Macros;
  addMealEntry: (input:AddEntryInput) => { crossedProteinGoal:boolean };
  updateMealEntry: (date:string, entryId:string, amount:number) => void;
  deleteMealEntry: (date:string, entryId:string) => void;
  markProteinNotified: (date:string) => void;
  saveFood: (food:Partial<Food> & {name:string}) => void;
  deleteFood: (id:string) => void;
  saveRecipe: (recipe:Recipe) => void;
  deleteRecipe: (id:string) => void;
  saveGoals: (goals:Goals) => void;
  saveShoppingItem: (item:ShoppingItem) => void;
  deleteShoppingItem: (id:string) => void;
  toggleShoppingItem: (id:string) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

function seedFallback(): AppState {
  return JSON.parse(JSON.stringify(seedState)) as AppState;
}

export function AppProvider({ children }: { children:React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => hasSupabase ? seedFallback() : loadLocalState());
  const [ready, setReady] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>(hasSupabase ? 'signed-out' : 'local');
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;

    const activateUser = async (user: { id:string; email?:string | null }) => {
      if (!mounted) return;
      setUserId(user.id);
      setUserEmail(user.email ?? null);
      setAuthMode('remote');

      try {
        const [remote, profile] = await Promise.all([
          loadRemoteState(user.id),
          loadCurrentProfile().catch(() => null),
        ]);
        if (!mounted) return;
        setUserRole(profile?.role ?? 'user');
        if (remote) {
          setState(remote);
          saveLocalState(remote, user.id);
        } else {
          const cached = loadLocalState(user.id);
          setState(cached);
          await saveRemoteState(user.id, cached);
        }
      } catch (err) {
        console.error('Supabase load failed; using isolated local cache.', err);
        if (mounted) setState(loadLocalState(user.id));
      }
    };

    (async () => {
      if (hasSupabase) {
        try {
          const user = await getSessionUser();
          if (user) await activateUser(user);
          else if (mounted) {
            setAuthMode('signed-out');
            setState(seedFallback());
          }
        } catch (err) {
          console.error('Supabase auth load failed.', err);
          if (mounted) setAuthMode('signed-out');
        }
      }
      if (mounted) setReady(true);
    })();

    const sub = supabase?.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      const user = session?.user ?? null;
      if (user) {
        await activateUser(user);
      } else {
        setUserId(null);
        setUserEmail(null);
        setUserRole(null);
        setAuthMode(hasSupabase ? 'signed-out' : 'local');
        setState(hasSupabase ? seedFallback() : loadLocalState());
      }
    });

    return () => { mounted = false; sub?.data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!ready) return;

    if (authMode === 'remote' && userId) {
      saveLocalState(state, userId);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveRemoteState(userId, state).catch(err => console.error('Remote save failed', err));
      }, 600);
    } else if (authMode === 'local' && !hasSupabase) {
      saveLocalState(state);
    }

    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [state, ready, authMode, userId]);

  const getRecipeMacrosPer100 = useCallback((recipe:Recipe):Macros => {
    if (!recipe.finalWeight || recipe.finalWeight <= 0) return emptyMacros();
    let total = emptyMacros();
    for (const ing of recipe.ingredients) {
      const food = state.foods.find(f => f.id === ing.foodId);
      if (!food) continue;
      total = addMacros(total, scaleMacros(food, ing.amount / 100));
    }
    return scaleMacros(total, 100 / recipe.finalWeight);
  }, [state.foods]);

  const getDay = useCallback((date:string):DailyLog => {
    return state.logs[date] ?? { date, goals:{...state.goals}, entries:[], proteinGoalNotified:false };
  }, [state.logs, state.goals]);

  const getDayTotals = useCallback((date:string):Macros => {
    return getDay(date).entries.reduce((acc,e)=>addMacros(acc,e.macros), emptyMacros());
  }, [getDay]);

  const addMealEntry = useCallback((input:AddEntryInput) => {
    let crossedProteinGoal = false;
    setState(prev => {
      const day = prev.logs[input.date] ?? { date:input.date, goals:{...prev.goals}, entries:[], proteinGoalNotified:false };
      const beforeProtein = day.entries.reduce((sum,e)=>sum+e.macros.protein,0);
      let itemName = '';
      let unit:'g'|'ml' = 'g';
      let macros = emptyMacros();
      if (input.itemType === 'food') {
        const food = prev.foods.find(f=>f.id===input.itemId);
        if (!food) return prev;
        itemName = food.name; unit = food.unit; macros = scaleMacros(food,input.amount/100);
      } else {
        const recipe = prev.recipes.find(r=>r.id===input.itemId);
        if (!recipe || recipe.finalWeight<=0) return prev;
        itemName = recipe.name;
        let recipeTotal = emptyMacros();
        for (const ing of recipe.ingredients) {
          const food = prev.foods.find(f=>f.id===ing.foodId);
          if (food) recipeTotal = addMacros(recipeTotal, scaleMacros(food, ing.amount/100));
        }
        const per100 = scaleMacros(recipeTotal,100/recipe.finalWeight);
        macros = scaleMacros(per100,input.amount/100);
      }
      const entry:MealEntry = { id:uid('entry'), date:input.date, mealType:input.mealType, itemType:input.itemType, itemId:input.itemId, itemName, amount:input.amount, unit, macros, createdAt:new Date().toISOString() };
      const afterProtein = beforeProtein + macros.protein;
      crossedProteinGoal = beforeProtein < day.goals.protein && afterProtein >= day.goals.protein && !day.proteinGoalNotified;
      return { ...prev, logs:{...prev.logs,[input.date]:{...day,entries:[...day.entries,entry]}} };
    });
    return { crossedProteinGoal };
  }, []);

  const updateMealEntry = useCallback((date:string, entryId:string, amount:number) => {
    setState(prev => {
      const day = prev.logs[date]; if (!day) return prev;
      const entries = day.entries.map(e => {
        if (e.id !== entryId) return e;
        let macros = e.macros;
        if (e.itemType==='food') {
          const food=prev.foods.find(f=>f.id===e.itemId); if (food) macros=scaleMacros(food,amount/100);
        } else {
          const recipe=prev.recipes.find(r=>r.id===e.itemId);
          if (recipe && recipe.finalWeight>0) {
            let total=emptyMacros();
            for (const ing of recipe.ingredients){ const food=prev.foods.find(f=>f.id===ing.foodId); if(food) total=addMacros(total,scaleMacros(food,ing.amount/100)); }
            macros=scaleMacros(scaleMacros(total,100/recipe.finalWeight),amount/100);
          }
        }
        return {...e, amount, macros};
      });
      return {...prev,logs:{...prev.logs,[date]:{...day,entries}}};
    });
  },[]);

  const deleteMealEntry = useCallback((date:string,entryId:string)=>setState(prev=>{
    const day=prev.logs[date]; if(!day)return prev;
    return {...prev,logs:{...prev.logs,[date]:{...day,entries:day.entries.filter(e=>e.id!==entryId)}}};
  }),[]);

  const markProteinNotified = useCallback((date:string)=>setState(prev=>{
    const day=prev.logs[date] ?? {date,goals:{...prev.goals},entries:[],proteinGoalNotified:false};
    return {...prev,logs:{...prev.logs,[date]:{...day,proteinGoalNotified:true}}};
  }),[]);

  const saveFood = useCallback((partial:Partial<Food>&{name:string})=>setState(prev=>{
    const now=new Date().toISOString();
    if(partial.id){ return {...prev,foods:prev.foods.map(f=>f.id===partial.id?{...f,...partial,updatedAt:now}:f)}; }
    const food:Food={id:uid('food'),name:partial.name,unit:partial.unit??'g',kcal:partial.kcal??0,fat:partial.fat??0,carbs:partial.carbs??0,protein:partial.protein??0,fiber:partial.fiber??0,active:true,createdAt:now,updatedAt:now};
    return {...prev,foods:[...prev.foods,food]};
  }),[]);

  const deleteFood = useCallback((id:string)=>setState(prev=>({...prev,foods:prev.foods.map(f=>f.id===id?{...f,active:false}:f)})),[]);
  const saveRecipe = useCallback((recipe:Recipe)=>setState(prev=>({...prev,recipes:prev.recipes.some(r=>r.id===recipe.id)?prev.recipes.map(r=>r.id===recipe.id?{...recipe,updatedAt:new Date().toISOString()}:r):[...prev.recipes,recipe]})),[]);
  const deleteRecipe = useCallback((id:string)=>setState(prev=>({...prev,recipes:prev.recipes.map(r=>r.id===id?{...r,active:false}:r)})),[]);
  const saveGoals = useCallback((goals:Goals)=>setState(prev=>({...prev,goals})),[]);
  const saveShoppingItem = useCallback((item:ShoppingItem)=>setState(prev=>({...prev,shopping:prev.shopping.some(s=>s.id===item.id)?prev.shopping.map(s=>s.id===item.id?item:s):[...prev.shopping,item]})),[]);
  const deleteShoppingItem = useCallback((id:string)=>setState(prev=>({...prev,shopping:prev.shopping.filter(s=>s.id!==id)})),[]);
  const toggleShoppingItem = useCallback((id:string)=>setState(prev=>({...prev,shopping:prev.shopping.map(s=>s.id===id?{...s,checked:!s.checked,updatedAt:new Date().toISOString()}:s)})),[]);

  const value = useMemo<AppContextValue>(()=>({state,ready,authMode,userId,userEmail,userRole,isAuthenticated:!hasSupabase||Boolean(userId),setState,getRecipeMacrosPer100,getDay,getDayTotals,addMealEntry,updateMealEntry,deleteMealEntry,markProteinNotified,saveFood,deleteFood,saveRecipe,deleteRecipe,saveGoals,saveShoppingItem,deleteShoppingItem,toggleShoppingItem}),[state,ready,authMode,userId,userEmail,userRole,getRecipeMacrosPer100,getDay,getDayTotals,addMealEntry,updateMealEntry,deleteMealEntry,markProteinNotified,saveFood,deleteFood,saveRecipe,deleteRecipe,saveGoals,saveShoppingItem,deleteShoppingItem,toggleShoppingItem]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(){ const ctx=useContext(AppContext); if(!ctx) throw new Error('useApp must be used inside AppProvider'); return ctx; }
