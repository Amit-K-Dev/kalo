"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";
import { today } from "@/lib/nutrition";
import { getDashboardState, addMeals, deleteMeal, changeWater, updateProfile, calculateTdee, selectPlan, markWorkoutDone, saveRoutine, deleteRoutine, saveCurrentRoutine } from "@/lib/store";
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
  const [plans, setPlans] = useState([]);
  const [planDetails, setPlanDetails] = useState(null);
  const [bmi, setBmi] = useState(null);
  const [days, setDays] = useState([]);
  const [dateLabel, setDateLabel] = useState("");
  const [targets, setTargets] = useState(null);
  const [planOptions, setPlanOptions] = useState({});
  const [wg, setWg] = useState(2000);
  const [savedRoutines, setSavedRoutines] = useState([]);
  const [curRoutine, setCurRoutine] = useState({ name: "", items: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const prevWaterHit = useRef(null);

  const loadData = useCallback(async ({ blocking = true } = {}) => {
    if (blocking) setLoading(true);
    setLoadError("");
    try {
      const state = await getDashboardState(today());
      setProfile(state.profile || null);
      setPlans(state.plans || []);
      setPlanDetails(state.plan || null);
      setBmi(state.bmi || null);
      setMeals(state.meals || []);
      setWater(state.water || 0);
      setDays(state.days || []);
      setDateLabel(state.date_label || "");
      setTargets(state.targets || null);
      setPlanOptions(state.plan_options || {});
      setWg(state.wg || 2000);
      setSavedRoutines(state.saved_routines || []);
      setCurRoutine(state.cur_routine || { name: "", items: [] });
    } catch (e) {
      console.error("Load error:", e);
      setLoadError(e.message || "Could not load your Kalo data");
    }
    if (blocking) setLoading(false);
  }, []);

  // Load user and data after the data loader has been initialized.
  useEffect(() => {
    let active = true;
    const supabase = getSupabaseBrowser();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!active) return;
      if (!u) { router.push("/login"); return; }
      setUser(u);
      loadData();
    });
    return () => { active = false; };
  }, [loadData, router]);

  // Derived values
  const goal = profile?.goal || 2000;
  const plan = profile?.plan || null;
  const tdee = profile?.tdee || 0;
  const weightKg = profile?.weight_kg || 70;
  const heightCm = profile?.height_cm || 172;

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

  // Handlers
  const handleAddMeals = async (items) => {
    await addMeals(items, today());
    await loadData({ blocking: false });
  };

  const handleDeleteMeal = async (id) => {
    await deleteMeal(id);
    await loadData({ blocking: false });
  };

  const handleWaterChange = async (delta) => {
    const result = await changeWater(delta, today());
    setWater(result.water_ml || 0);
    await loadData({ blocking: false });
  };

  const handleProfileUpdate = async (updates) => {
    await updateProfile(updates);
    await loadData({ blocking: false });
  };

  const handleWorkoutDone = async () => {
    await markWorkoutDone(today());
    await loadData({ blocking: false });
    fireConfetti();
  };

  const handleSaveRoutine = async (name, items) => {
    await saveRoutine(name, items);
    await loadData({ blocking: false });
  };

  const handleDeleteRoutine = async (id) => {
    await deleteRoutine(id);
    await loadData({ blocking: false });
  };

  const handleCurRoutineChange = async (name, items) => {
    setCurRoutine({ name, items });
    await saveCurrentRoutine(name, items);
  };

  const handleLogout = async () => {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
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

  const handlePlanSelect = async (planId) => {
    await selectPlan(planId);
    await loadData({ blocking: false });
    if (!tdee) switchTab(2);
  };

  return (
    <>
      {user && <UserMenu user={user} profile={profile} onLogout={handleLogout} />}
      <main>
        <header className="hd">
          <h1><span className="lg">🥗</span> <span className="gt">Kalo</span></h1>
          <p className="tag">Eat smart · Drink more · Move better</p>
        </header>

        {loadError && <div className="err" role="alert">
          {loadError} <button type="button" className="btn2" onClick={() => loadData()}>Retry</button>
        </div>}

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
            meals={meals} goal={goal} water={water} wg={wg} plan={planDetails}
            bmi={bmi} days={days} dateLabel={dateLabel} targets={targets} curRoutine={curRoutine}
            sumMeals={sumMeals} switchTab={switchTab}
            onWaterAdd={() => handleWaterChange(250)}
          />
        )}

        {tab === 1 && (
          <MealsTab
            meals={meals} goal={goal} plan={plan} plans={plans}
            water={water} wg={wg} targets={targets}
            sumMeals={sumMeals} onAddMeals={handleAddMeals}
            onDeleteMeal={handleDeleteMeal}
            onWaterChange={handleWaterChange}
            onPlanSelect={handlePlanSelect}
            switchTab={switchTab}
          />
        )}

        {tab === 3 && (
          <ScanTab onAddMeals={async (items) => {
            await handleAddMeals(items);
            switchTab(1);
          }} />
        )}

        {tab === 2 && (
          <GoalTab
            profile={profile}
            plan={plan} plans={plans} tdee={tdee}
            onCalculate={async (sex, age, ht, wt, act) => {
              await calculateTdee({ sex, age, height_cm: ht, weight_kg: wt, activity_factor: act });
              await loadData({ blocking: false });
            }}
            onPlanSelect={handlePlanSelect}
            planOptions={planOptions}
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
