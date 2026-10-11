import { AppState, Food, Recipe, RecipeIngredient, UserProfile } from './types';
import { SEED_VERSION, seedFoods, seedRecipes, seedShopping, seedState } from './seed';
import { adminLoginEmail, hasSupabase, supabase } from './supabase';

const LOCAL_KEY = 'nam-nam-app-state-v1';
const VERSION_KEY = 'nam-nam-app-data-version';

export type SharedCatalog = { foods: Food[]; recipes: Recipe[] };
let sharedCatalogAvailable = false;

function normalizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function storageKey(userId?: string | null) {
  return userId ? `${LOCAL_KEY}:${userId}` : LOCAL_KEY;
}

function versionKey(userId?: string | null) {
  return userId ? `${VERSION_KEY}:${userId}` : VERSION_KEY;
}

function migrateBaseData(current: AppState): AppState {
  const seedFoodIds = new Set(seedFoods.map(x => x.id));
  const seedRecipeIds = new Set(seedRecipes.map(x => x.id));
  const seedShoppingNames = new Set(seedShopping.map(x => normalizeName(x.name)));

  const extraFoods = (current.foods ?? []).filter(x => !seedFoodIds.has(x.id));
  const extraRecipes = (current.recipes ?? []).filter(x => !seedRecipeIds.has(x.id));
  const extraShopping = (current.shopping ?? []).filter(x => !seedShoppingNames.has(normalizeName(x.name)));

  return {
    foods: [...seedFoods, ...extraFoods],
    recipes: [...seedRecipes, ...extraRecipes],
    goals: { ...seedState.goals, ...(current.goals ?? {}) },
    logs: current.logs ?? {},
    shopping: [...seedShopping, ...extraShopping],
  };
}

export function loadLocalState(userId?: string | null): AppState {
  if (typeof window === 'undefined') return seedState;
  const raw = window.localStorage.getItem(storageKey(userId));
  if (!raw) {
    window.localStorage.setItem(versionKey(userId), String(SEED_VERSION));
    return JSON.parse(JSON.stringify(seedState)) as AppState;
  }

  try {
    const parsed = { ...seedState, ...JSON.parse(raw) } as AppState;
    const currentVersion = Number(window.localStorage.getItem(versionKey(userId)) ?? '1');
    if (currentVersion < SEED_VERSION) {
      const migrated = migrateBaseData(parsed);
      window.localStorage.setItem(storageKey(userId), JSON.stringify(migrated));
      window.localStorage.setItem(versionKey(userId), String(SEED_VERSION));
      return migrated;
    }
    return parsed;
  } catch {
    window.localStorage.setItem(versionKey(userId), String(SEED_VERSION));
    return JSON.parse(JSON.stringify(seedState)) as AppState;
  }
}

export function saveLocalState(state: AppState, userId?: string | null) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey(userId), JSON.stringify(state));
  window.localStorage.setItem(versionKey(userId), String(SEED_VERSION));
}

function resolveLogin(login: string) {
  const normalized = login.trim();
  if (normalized.toLowerCase() === 'administrador') {
    if (!adminLoginEmail) throw new Error('Falta NEXT_PUBLIC_ADMIN_EMAIL en .env.local.');
    return adminLoginEmail;
  }
  return normalized;
}

export async function signInWithPassword(login: string, password: string) {
  if (!hasSupabase || !supabase) return { error: new Error('Supabase no está configurado.'), data: null };
  try {
    const email = resolveLogin(login);
    return await supabase.auth.signInWithPassword({ email, password });
  } catch (error) {
    return { error: error instanceof Error ? error : new Error('No se pudo iniciar sesión.'), data: null };
  }
}

export async function signUpWithPassword(email: string, password: string) {
  if (!hasSupabase || !supabase) return { error: new Error('Supabase no está configurado.'), data: null };
  return supabase.auth.signUp({ email: email.trim(), password });
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
}

export async function getSessionUser() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function loadCurrentProfile(): Promise<UserProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,role,created_at')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id:data.id, email:data.email, role:data.role, createdAt:data.created_at };
}

export async function loadProfiles(): Promise<UserProfile[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,role,created_at')
    .order('created_at', { ascending:false });
  if (error) throw error;
  return (data ?? []).map((row:any) => ({ id:row.id, email:row.email, role:row.role, createdAt:row.created_at }));
}

export async function loadRemoteState(userId: string): Promise<AppState | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('app_states').select('state').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return (data?.state as AppState) || null;
}

export async function saveRemoteState(userId: string, state: AppState) {
  if (!supabase) return;
  // El catálogo se guarda en tablas compartidas. En el estado privado conservamos
  // consumo, objetivos y Súper, pero no duplicamos alimentos ni recetas.
  const personalState: AppState = sharedCatalogAvailable ? { ...state, foods: [], recipes: [] } : state;
  const { error } = await supabase.from('app_states').upsert({ user_id: userId, state: personalState, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
}

function mapFoodRow(row:any):Food {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    kcal: Number(row.kcal ?? 0),
    fat: Number(row.fat ?? 0),
    carbs: Number(row.carbs ?? 0),
    protein: Number(row.protein ?? 0),
    fiber: Number(row.fiber ?? 0),
    active: Boolean(row.active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRecipeRow(row:any, ingredients:RecipeIngredient[]):Recipe {
  return {
    id: row.id,
    name: row.name,
    rawWeight: Number(row.raw_weight ?? 0),
    finalWeight: Number(row.final_weight ?? 0),
    notes: row.notes ?? '',
    active: Boolean(row.active),
    ingredients,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadSharedCatalog():Promise<SharedCatalog|null> {
  if (!supabase) return null;
  const [foodsRes, recipesRes, ingredientsRes] = await Promise.all([
    supabase.from('foods').select('*').order('name'),
    supabase.from('recipes').select('*').order('name'),
    supabase.from('recipe_ingredients').select('*'),
  ]);
  if (foodsRes.error) throw foodsRes.error;
  if (recipesRes.error) throw recipesRes.error;
  if (ingredientsRes.error) throw ingredientsRes.error;

  sharedCatalogAvailable = true;
  const foods = (foodsRes.data ?? []).map(mapFoodRow);
  if (!foods.length) return null;
  const ingredientRows = ingredientsRes.data ?? [];
  const recipes = (recipesRes.data ?? []).map((row:any) => mapRecipeRow(row, ingredientRows
    .filter((i:any) => i.recipe_id === row.id)
    .map((i:any) => ({ id:i.id, foodId:i.food_id, amount:Number(i.amount ?? 0) }))));
  return { foods, recipes };
}

export async function initializeSharedCatalog(foods:Food[], recipes:Recipe[], userId?:string|null) {
  if (!supabase) return;
  sharedCatalogAvailable = true;
  if (foods.length) {
    const { error } = await supabase.from('foods').upsert(foods.map(f => ({
      id:f.id,name:f.name,unit:f.unit,kcal:f.kcal,fat:f.fat,carbs:f.carbs,protein:f.protein,fiber:f.fiber,
      active:f.active,created_at:f.createdAt,updated_at:f.updatedAt,updated_by:userId??null,
    })), { onConflict:'id' });
    if (error) throw error;
  }
  for (const recipe of recipes) await saveSharedRecipe(recipe,userId);
}

export async function saveSharedFood(food:Food,userId?:string|null) {
  if (!supabase) return;
  sharedCatalogAvailable = true;
  const { error } = await supabase.from('foods').upsert({
    id:food.id,name:food.name,unit:food.unit,kcal:food.kcal,fat:food.fat,carbs:food.carbs,protein:food.protein,fiber:food.fiber,
    active:food.active,created_at:food.createdAt,updated_at:food.updatedAt,updated_by:userId??null,
  }, { onConflict:'id' });
  if (error) throw error;
}

export async function deactivateSharedFood(id:string,userId?:string|null) {
  if (!supabase) return;
  const { error } = await supabase.from('foods').update({active:false,updated_at:new Date().toISOString(),updated_by:userId??null}).eq('id',id);
  if (error) throw error;
}

export async function saveSharedRecipe(recipe:Recipe,userId?:string|null) {
  if (!supabase) return;
  sharedCatalogAvailable = true;
  const { error:recipeError } = await supabase.from('recipes').upsert({
    id:recipe.id,name:recipe.name,raw_weight:recipe.rawWeight||null,final_weight:recipe.finalWeight||null,notes:recipe.notes,
    active:recipe.active,created_at:recipe.createdAt,updated_at:recipe.updatedAt,updated_by:userId??null,
  }, { onConflict:'id' });
  if (recipeError) throw recipeError;

  const { error:deleteError } = await supabase.from('recipe_ingredients').delete().eq('recipe_id',recipe.id);
  if (deleteError) throw deleteError;
  if (recipe.ingredients.length) {
    const { error:ingredientError } = await supabase.from('recipe_ingredients').insert(recipe.ingredients.map(i => ({
      id:i.id,recipe_id:recipe.id,food_id:i.foodId,amount:i.amount,
    })));
    if (ingredientError) throw ingredientError;
  }
}

export async function deactivateSharedRecipe(id:string,userId?:string|null) {
  if (!supabase) return;
  const { error } = await supabase.from('recipes').update({active:false,updated_at:new Date().toISOString(),updated_by:userId??null}).eq('id',id);
  if (error) throw error;
}

export function subscribeSharedCatalog(onChange:()=>void) {
  if (!supabase) return () => {};
  const sb = supabase;
  const channel = sb
    .channel('nam-nam-shared-catalog')
    .on('postgres_changes',{event:'*',schema:'public',table:'foods'},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'recipes'},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'recipe_ingredients'},onChange)
    .subscribe();
  return () => { void sb.removeChannel(channel); };
}
