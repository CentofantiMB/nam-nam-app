export type MacroKey = 'kcal' | 'fat' | 'carbs' | 'protein' | 'fiber';

export type Macros = {
  kcal: number;
  fat: number;
  carbs: number;
  protein: number;
  fiber: number;
};

export type Food = Macros & {
  id: string;
  name: string;
  unit: 'g' | 'ml';
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RecipeIngredient = {
  id: string;
  foodId: string;
  amount: number;
};

export type Recipe = {
  id: string;
  name: string;
  rawWeight: number;
  finalWeight: number;
  notes: string;
  active: boolean;
  ingredients: RecipeIngredient[];
  createdAt: string;
  updatedAt: string;
};

export type Goals = Macros;

export type MealType = 'Desayuno' | 'Colación 1' | 'Almuerzo' | 'Colación 2' | 'Merienda' | 'Cena';
export type ItemType = 'food' | 'recipe';

export type MealEntry = {
  id: string;
  date: string;
  mealType: MealType;
  itemType: ItemType;
  itemId: string;
  itemName: string;
  amount: number;
  unit: 'g' | 'ml';
  macros: Macros;
  createdAt: string;
};

export type DailyLog = {
  date: string;
  goals: Goals;
  entries: MealEntry[];
  proteinGoalNotified: boolean;
};

export type ShoppingItem = {
  id: string;
  category: string;
  name: string;
  quantity: number;
  unit: string;
  referencePrice: number;
  frequency: 'Semanal' | 'Mensual' | 'Ocasional';
  checked: boolean;
  updatedAt: string;
};

export type AppState = {
  foods: Food[];
  recipes: Recipe[];
  goals: Goals;
  logs: Record<string, DailyLog>;
  shopping: ShoppingItem[];
};

export type UserRole = 'admin' | 'user';

export type UserProfile = {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
};
