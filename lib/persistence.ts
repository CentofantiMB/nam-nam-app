import { AppState, UserProfile } from './types';
import { SEED_VERSION, seedFoods, seedRecipes, seedShopping, seedState } from './seed';
import { adminLoginEmail, hasSupabase, supabase } from './supabase';

const LOCAL_KEY = 'nam-nam-app-state-v1';
const VERSION_KEY = 'nam-nam-app-data-version';

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
    return seedState;
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
    return seedState;
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
  return (data ?? []).map(row => ({ id:row.id, email:row.email, role:row.role, createdAt:row.created_at }));
}

export async function loadRemoteState(userId: string): Promise<AppState | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('app_states').select('state').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return (data?.state as AppState) || null;
}

export async function saveRemoteState(userId: string, state: AppState) {
  if (!supabase) return;
  const { error } = await supabase.from('app_states').upsert({ user_id: userId, state, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
}
