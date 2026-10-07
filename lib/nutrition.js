// Nutrition calculation utilities — extracted from original Kalo

export const PLANS = [
  { id: "cut", n: "🔥 Lose fat", d: "20% deficit · high protein to keep muscle", adj: -0.2, pr: 2.2 },
  { id: "bulk", n: "💪 Bulk", d: "10% surplus · lean muscle gain", adj: 0.1, pr: 1.8 },
  { id: "recomp", n: "⚖️ Body recomp", d: "Near maintenance (−5%) · lose fat, build muscle", adj: -0.05, pr: 2.4 }
];

export function calcTDEE(sex, age, heightCm, weightKg, activityFactor) {
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "m" ? 5 : -161);
  return Math.round(bmr * activityFactor);
}

export function planCalc(plan, tdee, weightKg) {
  const kcal = Math.max(1200, Math.round(tdee * (1 + plan.adj)));
  const P = Math.round(plan.pr * weightKg);
  const F = Math.round(kcal * 0.25 / 9);
  const C = Math.max(0, Math.round((kcal - P * 4 - F * 9) / 4));
  return { kcal, P, C, F };
}

export function calcBMI(heightCm, weightKg) {
  if (!(heightCm > 0 && weightKg > 0)) return null;
  const h = heightCm / 100;
  const bmi = weightKg / (h * h);
  const category = bmi < 18.5 ? ["Underweight", "#4f9ad9"]
    : bmi < 25 ? ["Healthy", "#3fb27f"]
    : bmi < 30 ? ["Overweight", "#f0a63a"]
    : ["Obese", "#d2473c"];
  const lo = 18.5 * h * h;
  const hi = 24.9 * h * h;
  return { bmi, category, lo, hi };
}

export function waterGoal(weightKg) {
  return Math.max(1500, Math.round(weightKg * 35 / 250) * 250);
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function today() {
  return localDateKey(new Date());
}

export function dkey(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateKey(d);
}
