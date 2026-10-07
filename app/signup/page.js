"use client";
import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-client";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    const supabase = getSupabaseBrowser();
    const { data, error: err } = await supabase.auth.signUp({ email, password });
    if (err) {
      setError(err.message);
      setLoading(false);
    } else {
      if (data.session) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setDone(true);
      }
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    const supabase = getSupabaseBrowser();
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
    if (err) setError(err.message);
  };

  return (
    <div className="auth-page">
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 48 }} className="lg">🥗</div>
        <h1 style={{ fontSize: 36, fontWeight: 800, margin: "6px 0", letterSpacing: "-.02em" }}>
          <span className="gt">Kalo</span>
        </h1>
      </div>
      <div className="auth-card">
        <h2>Create account</h2>
        <p className="subtitle">Start tracking your nutrition journey</p>
        
        {done ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <p>Account created. Check your inbox to confirm your email, then sign in.</p>
          </div>
        ) : (
          <>
            <button type="button" className="btn2" onClick={handleGoogleLogin} style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign up with Google
            </button>

            <div style={{ display: 'flex', alignItems: 'center', margin: '16px 0', color: 'var(--mu)', fontSize: 12 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--ln)' }} />
              <span style={{ padding: '0 10px' }}>or email</span>
              <div style={{ flex: 1, height: 1, background: 'var(--ln)' }} />
            </div>

            <form onSubmit={handleSubmit}>
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="field">
                <label>Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                />
              </div>
              {error && <div className="err">{error}</div>}
              <button type="submit" className="btn" disabled={loading}>
                {loading ? "Creating account…" : "Sign up"}
              </button>
            </form>
          </>
        )}
        <div className="auth-link">
          Already have an account? <Link href="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
