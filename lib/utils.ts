import { Macros, Goals } from './types';

export const emptyMacros = (): Macros => ({ kcal: 0, fat: 0, carbs: 0, protein: 0, fiber: 0 });

export function round(value: number, digits = 2) {
  const p = 10 ** digits;
  return Math.round((value + Number.EPSILON) * p) / p;
}

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    kcal: a.kcal + b.kcal,
    fat: a.fat + b.fat,
    carbs: a.carbs + b.carbs,
    protein: a.protein + b.protein,
    fiber: a.fiber + b.fiber,
  };
}

export function scaleMacros(m: Macros, factor: number): Macros {
  return {
    kcal: m.kcal * factor,
    fat: m.fat * factor,
    carbs: m.carbs * factor,
    protein: m.protein * factor,
    fiber: m.fiber * factor,
  };
}

export function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
}

export function formatDateLong(date: string) {
  return new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${date}T12:00:00`));
}

export function localISODate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function uid(prefix = 'id') {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function progressState(key: keyof Goals, value: number, goal: number) {
  if (goal <= 0) return 'neutral';
  const pct = (value / goal) * 100;

  if (key === 'protein' || key === 'fiber') {
    if (pct < 70) return 'neutral';
    if (pct < 90) return 'warm';
    if (pct <= 120) return 'good';
    return 'over';
  }

  if (pct < 70) return 'neutral';
  if (pct < 90) return 'warm';
  if (pct <= 105) return 'good';
  if (pct <= 115) return 'over';
  return 'high';
}
