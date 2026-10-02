# 🥗 Kalo — Smart Nutrition & Fitness Tracker

**Eat smart · Drink more · Move better**

Kalo is a modern, AI-powered health companion that tracks your calories, water intake, workouts, and body composition — all in one beautiful dashboard.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🍽 **AI Meal Estimation** | Describe what you ate in plain text and get instant calorie + macro breakdowns powered by AI |
| 📸 **Photo Scanning** | Snap a photo of your meal and let AI identify & estimate nutrition |
| 💧 **Water Tracker** | Track daily water intake with a visual tube gauge and smart goals based on body weight |
| 🎯 **Goal Planner** | Calculate your TDEE and pick a plan — Cut, Lean Bulk, Maintain, or High Protein |
| ⚖️ **BMI Calculator** | Real-time BMI with visual category indicator |
| 🏋️ **Workout Builder** | Build custom routines from 60+ exercises, track sets/reps, and log calories burned |
| 📊 **Weekly History** | At-a-glance 7-day chart showing calories, water, and workout trends |
| 🔐 **Google Auth** | One-click Google sign-in with Supabase authentication |
| 👤 **Profile Sync** | Avatar, name, and all data synced across devices via Supabase |

---

## 🛠 Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org) (App Router)
- **Frontend:** React 19, Vanilla CSS (custom design system)
- **Backend:** Supabase (Auth + PostgreSQL + RLS)
- **AI:** OpenRouter API (nutrition estimation from text & images)
- **Deployment:** Vercel

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- An [OpenRouter](https://openrouter.ai) API key

### 1. Clone & Install

```bash
git clone https://github.com/Amit-K-Dev/kalo.git
cd kalo
npm install
```

### 2. Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

OPENROUTER_API_KEY=sk-or-v1-your-key-here
OPENROUTER_MODEL=dots-studio/dots-3-note-preview:free
```

### 3. Database Setup

Run the SQL migration in your Supabase SQL Editor:

```bash
# Copy contents of supabase-migration.sql into Supabase → SQL Editor → Run
```

This creates the following tables with Row Level Security:
- `profiles` — user settings (goal, TDEE, plan, weight, height)
- `daily_logs` — daily water & workout tracking
- `meals` — individual meal entries with macros
- `routines` — saved workout routines
- `current_routine` — active workout session

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Project Structure

```
kalo/
├── app/
│   ├── api/
│   │   ├── ai/route.js          # AI nutrition estimation endpoint
│   │   └── auth/callback/route.js # OAuth callback handler
│   ├── dashboard/page.js        # Main app dashboard
│   ├── login/page.js            # Login page
│   ├── signup/page.js           # Signup page
│   ├── globals.css              # Full design system
│   ├── layout.js                # Root layout + metadata
│   └── page.js                  # Landing redirect
├── components/
│   ├── HomeTab.js               # Dashboard overview + weekly chart
│   ├── MealsTab.js              # Meal logging + AI estimation
│   ├── ScanTab.js               # Photo-based meal scanning
│   ├── GoalTab.js               # TDEE calculator + plan selector
│   ├── BmiTab.js                # BMI calculator
│   ├── WorkoutTab.js            # Workout routine builder
│   ├── UserMenu.js              # Profile avatar + settings modal
│   └── Confetti.js              # Celebration animations
├── lib/
│   ├── supabase-client.js       # Supabase browser client
│   ├── supabase-server.js       # Supabase server client
│   ├── store.js                 # All Supabase CRUD operations
│   ├── nutrition.js             # TDEE, macros, water calculations
│   └── exercises.js             # Exercise database (60+ exercises)
├── supabase-migration.sql       # Database schema + RLS policies
└── .env.local                   # Environment variables (not committed)
```

---

## 🔒 Security

- All database tables use **Row Level Security (RLS)** — users can only access their own data
- API keys are server-side only (never exposed to the browser)
- Google OAuth handled securely through Supabase Auth
- Meal photos are processed by AI and **not stored** by Kalo

---

## 📄 License

This project is for personal/educational use.

---

<p align="center">
  Built with 💚 by <strong>Amit Kumar</strong>
</p>
