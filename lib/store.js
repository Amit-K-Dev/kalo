// Supabase data operations — CRUD for all user data
import { getSupabaseBrowser } from "./supabase-client";
import { today, dkey } from "./nutrition";

function throwOnError(error) {
  if (error) throw error;
}

function supabase() {
  return getSupabaseBrowser();
}

async function requireUser() {
  const { data: { user }, error } = await supabase().auth.getUser();
  throwOnError(error);
  if (!user) throw new Error("You must be signed in to save changes.");
  return user;
}

// ─── Profile ───
export async function getProfile() {
  const { data: { user } } = await supabase().auth.getUser();
  if (!user) return null;
  const { data } = await supabase()
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  return data;
}

export async function updateProfile(updates) {
  const user = await requireUser();
  const { error } = await supabase()
    .from("profiles")
    .upsert({ id: user.id, ...updates, updated_at: new Date().toISOString() }, { onConflict: "id" });
  throwOnError(error);
}

// ─── Daily Logs ───
export async function getDailyLog(date) {
  const { data: { user } } = await supabase().auth.getUser();
  if (!user) return null;
  const { data } = await supabase()
    .from("daily_logs")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", date)
    .single();
  return data;
}

export async function upsertDailyLog(date, updates) {
  const user = await requireUser();
  const { error } = await supabase()
    .from("daily_logs")
    .upsert({
      user_id: user.id,
      date,
      ...updates,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id,date" });
  throwOnError(error);
}

// ─── Meals ───
export async function getMeals(date) {
  const { data: { user } } = await supabase().auth.getUser();
  if (!user) return [];
  const { data } = await supabase()
    .from("meals")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", date)
    .order("created_at", { ascending: true });
  return data || [];
}

export async function addMeals(meals) {
  const { data: { user } } = await supabase().auth.getUser();
  if (!user) throw new Error("You must be signed in to add meals.");
  if (!Array.isArray(meals) || meals.length === 0) return [];

  const rows = meals.map(meal => ({
    user_id: user.id,
    date: today(),
    name: meal.name,
    kcal: meal.kcal,
    protein_g: meal.p,
    carbs_g: meal.c,
    fat_g: meal.f,
  }));
  const { data, error } = await supabase().from("meals").insert(rows).select();
  throwOnError(error);
  return data || [];
}

export async function addMeal(meal) {
  const [savedMeal] = await addMeals([meal]);
  return savedMeal || null;
}

export async function deleteMeal(id) {
  await requireUser();
  const { error } = await supabase().from("meals").delete().eq("id", id);
  throwOnError(error);
}

// ─── History (last N days of meals aggregated) ───
export async function getHistory(days = 7) {
  const { data: { user } } = await supabase().auth.getUser();
  if (!user) return {};
  const since = dkey(days);

  const { data: logs } = await supabase()
    .from("daily_logs")
    .select("*")
    .eq("user_id", user.id)
    .gte("date", since);

  const { data: mealData } = await supabase()
    .from("meals")
    .select("date, kcal, protein_g, carbs_g, fat_g")
    .eq("user_id", user.id)
    .gte("date", since);

  const hist = {};

  // Aggregate meals by date
  (mealData || []).forEach(m => {
    if (!hist[m.date]) hist[m.date] = { k: 0, p: 0, c: 0, f: 0, w: 0, g: 2000, wk: 0, b: 0 };
    hist[m.date].k += m.kcal || 0;
    hist[m.date].p += m.protein_g || 0;
    hist[m.date].c += m.carbs_g || 0;
    hist[m.date].f += m.fat_g || 0;
  });

  // Merge daily logs
  (logs || []).forEach(l => {
    if (!hist[l.date]) hist[l.date] = { k: 0, p: 0, c: 0, f: 0, w: 0, g: 2000, wk: 0, b: 0 };
    hist[l.date].w = l.water_ml || 0;
    hist[l.date].wk = l.workout_sessions || 0;
    hist[l.date].b = l.workout_kcal || 0;
  });

  return hist;
}

// ─── Routines ───
export async function getSavedRoutines() {
  const { data: { user } } = await supabase().auth.getUser();
  if (!user) return [];
  const { data } = await supabase()
    .from("routines")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  return data || [];
}

export async function saveRoutine(name, items) {
  const user = await requireUser();
  // Upsert by name
  const { data: existing, error: lookupError } = await supabase()
    .from("routines")
    .select("id")
    .eq("user_id", user.id)
    .eq("name", name)
    .maybeSingle();
  throwOnError(lookupError);

  if (existing) {
    const { error } = await supabase()
      .from("routines")
      .update({ items, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    throwOnError(error);
  } else {
    const { error } = await supabase()
      .from("routines")
      .insert({ user_id: user.id, name, items });
    throwOnError(error);
  }
}

export async function deleteRoutine(id) {
  await requireUser();
  const { error } = await supabase().from("routines").delete().eq("id", id);
  throwOnError(error);
}

// ─── Current Routine ───
export async function getCurrentRoutine() {
  const { data: { user } } = await supabase().auth.getUser();
  if (!user) return { name: "", items: [] };
  const { data } = await supabase()
    .from("current_routine")
    .select("*")
    .eq("user_id", user.id)
    .single();
  return data || { name: "", items: [] };
}

export async function saveCurrentRoutine(name, items) {
  const user = await requireUser();
  const { error } = await supabase()
    .from("current_routine")
    .upsert({
      user_id: user.id,
      name,
      items,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });
  throwOnError(error);
}
