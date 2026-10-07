"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";
import { today, waterGoal, PLANS, planCalc, dkey } from "@/lib/nutrition";
import { getMeals, addMeals, deleteMeal, getDailyLog, upsertDailyLog, getProfile, updateProfile, getHistory, getSavedRoutines, saveRoutine, deleteRoutine, getCurrentRoutine, saveCurrentRoutine } from "@/lib/store";
import HomeTab from "@/components/HomeTab";
import MealsTab from "@/components/MealsTab";
import ScanTab from "@/components/ScanTab";
import GoalTab from "@/components/GoalTab";
import BmiTab from "@/components/BmiTab";
import WorkoutTab from "@/components/WorkoutTab";
import { fireConfetti } from "@/components/Confetti";
import UserMenu from "@/components/UserMenu";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState(6);
  const [meals, setMeals] = useState([]);
  const [water, setWater] = useState(0);
  const [profile, setProfile] = useState(null);
  const [hist, setHist] = useState({});
  const [savedRoutines, setSavedRoutines] = useState([]);
  const [curRoutine, setCurRoutine] = useState({ name: "", items: [] });
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState("");
  const prevWaterHit = useRef(null);

  // Load user and data
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) { router.push("/login"); return; }
      setUser(u);
      loadData();
    });
  }, [router]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [p, m, dl, h, sr, cr] = await Promise.all([
        getProfile(),
        getMeals(today()),
        getDailyLog(today()),
        getHistory(7),
        getSavedRoutines(),
        getCurrentRoutine(),
      ]);
      if (p) setProfile(p);
      setMeals(m || []);
      setWater(dl?.water_ml || 0);
      setHist(h || {});
      setSavedRoutines(sr || []);
      setCurRoutine(cr || { name: "", items: [] });
    } catch (e) {
      console.error("Load error:", e);
    }
    setLoading(false);
  }, []);

  // Derived values
  const goal = profile?.goal || 2000;
  const plan = profile?.plan || null;
  const tdee = profile?.tdee || 0;
  const weightKg = profile?.weight_kg || 70;
  const heightCm = profile?.height_cm || 172;
  const wg = waterGoal(weightKg);

  const sumMeals = useCallback((key) => {
    const keyMap = { kcal: "kcal", p: "protein_g", c: "carbs_g", f: "fat_g" };
    return Math.round(meals.reduce((a, m) => a + (+m[keyMap[key]] || 0), 0));
  }, [meals]);

  const eaten = sumMeals("kcal");
  const left = goal - eaten;

  // Water confetti check
  useEffect(() => {
    if (prevWaterHit.current === false && water >= wg) fireConfetti();
    prevWaterHit.current = water >= wg;
  }, [water, wg]);

  // Show save failures instead of silently treating them as successful.
  const runAction = async (action) => {
    setActionError("");
    try {
      await action();
      return true;
    } catch (error) {
      console.error("Dashboard action failed:", error);
      setActionError("Your change could not be saved. Please try again.");
      return false;
    }
  };

  // Handlers
  const handleAddMeals = async (mealData) => runAction(async () => {
    await addMeals(mealData);
    const [m, h] = await Promise.all([getMeals(today()), getHistory(7)]);
    setMeals(m);
    setHist(h);
  });

  const handleDeleteMeal = async (id) => runAction(async () => {
    await deleteMeal(id);
    const [m, h] = await Promise.all([getMeals(today()), getHistory(7)]);
    setMeals(m);
    setHist(h);
  });

  const handleWaterChange = async (delta) => runAction(async () => {
    const nw = Math.max(0, water + delta);
    await upsertDailyLog(today(), { water_ml: nw });
    setWater(nw);
    setHist(await getHistory(7));
  });

  const handleProfileUpdate = async (updates) => runAction(async () => {
    await updateProfile(updates);
    setProfile(await getProfile());
  });

  const handleWorkoutDone = async () => runAction(async () => {
    const dl = await getDailyLog(today()) || { water_ml: water, workout_sessions: 0, workout_kcal: 0 };
    const { estimateWorkout } = await import("@/lib/exercises");
    const est = estimateWorkout(curRoutine.items, weightKg);
    await upsertDailyLog(today(), {
      water_ml: dl.water_ml || water,
      workout_sessions: (dl.workout_sessions || 0) + 1,
      workout_kcal: (dl.workout_kcal || 0) + est.kc,
    });
    setHist(await getHistory(7));
    fireConfetti();
  });

  const handleSaveRoutine = async (name, items) => runAction(async () => {
    await saveRoutine(name, items);
    setSavedRoutines(await getSavedRoutines());
  });

  const handleDeleteRoutine = async (id) => runAction(async () => {
    await deleteRoutine(id);
    setSavedRoutines(await getSavedRoutines());
  });

  const handleCurRoutineChange = async (name, items) => runAction(async () => {
    await saveCurrentRoutine(name, items);
    setCurRoutine({ name, items });
  });

  const handleLogout = async () => {
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setActionError("Sign out failed. Please try again.");
      return;
    }
    router.push("/login");
    router.refresh();
  };

  if (loading) {
    return (
      <main>
        <header className="hd">
          <h1><span className="lg">🥗</span> <span className="gt">Kalo</span></h1>
          <p className="tag">Loading…</p>
        </header>
      </main>
    );
  }

  const switchTab = (n) => {
    setTab(n);
    window.scrollTo(0, 0);
  };

  const curPlan = PLANS.find(x => x.id === plan);
  const targets = curPlan && tdee ? planCalc(curPlan, tdee, weightKg) : null;

  return (
    <>
      {user && <UserMenu user={user} profile={profile} onLogout={handleLogout} />}
      <main>
        <header className="hd">
          <h1><span className="lg">🥗</span> <span className="gt">Kalo</span></h1>
          <p className="tag">Eat smart · Drink more · Move better</p>
        </header>
        {actionError && <div className="err" role="alert">{actionError}</div>}

        <div className="tabs">
          {[
            [6, "🏠", "Home"],
            [1, "🍽", "Meals"],
            [3, "📸", "Scan"],
            [2, "🎯", "Goal"],
            [4, "⚖️", "BMI"],
            [5, "🏋️", "Workout"],
          ].map(([n, icon, label]) => (
            <button key={n} className={tab === n ? "on" : ""} onClick={() => switchTab(n)}>
              <b>{icon}</b>{label}
            </button>
          ))}
        </div>

        {tab === 6 && (
          <HomeTab
            meals={meals} goal={goal} water={water} wg={wg} plan={curPlan}
            tdee={tdee} weightKg={weightKg} heightCm={heightCm}
            hist={hist} targets={targets} curRoutine={curRoutine}
            sumMeals={sumMeals} switchTab={switchTab}
            onWaterAdd={() => handleWaterChange(250)}
            profile={profile}
          />
        )}

        {tab === 1 && (
          <MealsTab
            onAddMeals={handleAddMeals}
            meals={meals} goal={goal} plan={curPlan} tdee={tdee}
            weightKg={weightKg} water={water} wg={wg} targets={targets}
            sumMeals={sumMeals} onAddMeal={handleAddMeal}
            onDeleteMeal={handleDeleteMeal}
            onWaterChange={handleWaterChange}
            onPlanSelect={(planId) => {
              if (tdee > 0) {
                const p = PLANS.find(x => x.id === planId);
                if (p) {
                  const c = planCalc(p, tdee, weightKg);
                  handleProfileUpdate({ plan: planId, goal: c.kcal });
                }
              } else {
                handleProfileUpdate({ plan: planId });
                switchTab(2);
              }
            }}
            switchTab={switchTab}
            profile={profile}
          />
        )}

        {tab === 3 && (
          <ScanTab onAddMeals={async (items) => {
            const saved = await handleAddMeals(items);
            if (saved) switchTab(1);
            return saved;
          }} />
        )}

        {tab === 2 && (
          <GoalTab
            profile={profile}
            plan={plan} tdee={tdee} weightKg={weightKg}
            onCalculate={async (sex, age, ht, wt, act) => {
              const { calcTDEE } = await import("@/lib/nutrition");
              const newTdee = calcTDEE(sex, age, ht, wt, act);
              const updates = { sex, age, height_cm: ht, weight_kg: wt, activity_factor: act, tdee: newTdee };
              if (plan) {
                const p = PLANS.find(x => x.id === plan);
                if (p) updates.goal = planCalc(p, newTdee, wt).kcal;
              }
              await handleProfileUpdate(updates);
            }}
            onPlanSelect={async (planId) => {
              const p = PLANS.find(x => x.id === planId);
              if (p && tdee) {
                const c = planCalc(p, tdee, weightKg);
                await handleProfileUpdate({ plan: planId, goal: c.kcal });
              } else {
                await handleProfileUpdate({ plan: planId });
              }
            }}
          />
        )}

        {tab === 4 && (
          <BmiTab
            heightCm={heightCm} weightKg={weightKg}
            onUpdate={(h, w) => handleProfileUpdate({ height_cm: h, weight_kg: w })}
          />
        )}

        {tab === 5 && (
          <WorkoutTab
            curRoutine={curRoutine}
            savedRoutines={savedRoutines}
            weightKg={weightKg}
            onRoutineChange={handleCurRoutineChange}
            onSaveRoutine={handleSaveRoutine}
            onDeleteRoutine={handleDeleteRoutine}
            onWorkoutDone={handleWorkoutDone}
          />
        )}

        <p className="mu" style={{ textAlign: "center", fontSize: 12, margin: "6px 0 28px" }}>
          Kalo gives estimates, not medical advice. Check with a doctor or dietitian before changing your diet or training.
          Meal text and photos are sent to an AI service for analysis and are not saved by Kalo. Your data stays in your account.
        </p>
      </main>
    </>
  );
}
