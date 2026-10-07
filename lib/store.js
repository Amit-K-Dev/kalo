// Data access belongs to the Python API. Supabase is used in the browser for
// authentication only; the API validates that access token and applies RLS.
import { backendRequest } from "@/lib/backend";

export function getDashboardState(day) {
  return backendRequest(`state?day=${encodeURIComponent(day)}`);
}

export function getBmi(heightCm, weightKg) {
  return backendRequest(`bmi?height_cm=${encodeURIComponent(heightCm)}&weight_kg=${encodeURIComponent(weightKg)}`);
}

export function addMeals(items, day) {
  return backendRequest("meals", { method: "POST", body: { items, day } });
}

export function deleteMeal(id) {
  return backendRequest(`meals/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function changeWater(delta, day) {
  return backendRequest("water", { method: "POST", body: { delta, day } });
}

export function updateProfile(updates) {
  return backendRequest("profile", { method: "POST", body: { updates } });
}

export function calculateTdee(values) {
  return backendRequest("tdee", { method: "POST", body: values });
}

export function selectPlan(plan) {
  return backendRequest("plan", { method: "POST", body: { plan } });
}

export function markWorkoutDone(day) {
  return backendRequest(`workout/done?day=${encodeURIComponent(day)}`, { method: "POST" });
}

export function saveRoutine(name, items) {
  return backendRequest("routines", { method: "POST", body: { name, items } });
}

export function deleteRoutine(id) {
  return backendRequest(`routines/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function saveCurrentRoutine(name, items) {
  return backendRequest("routines/current", { method: "POST", body: { name, items } });
}
