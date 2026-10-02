"use client";
import { useState } from "react";

export default function UserMenu({ user, profile, onLogout }) {
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const metadata = user.user_metadata || {};
  // Supabase sometimes puts it in avatar_url, sometimes in picture
  const avatarUrl = metadata.avatar_url || metadata.picture;
  const name = metadata.full_name || metadata.name || "";
  const letter = name ? name.charAt(0).toUpperCase() : (user.email ? user.email.charAt(0).toUpperCase() : "U");

  console.log("User Metadata:", metadata); // Debugging ke liye log

  return (
    <>
      <button className="user-avatar" onClick={() => setOpen(true)} title="Profile">
        {avatarUrl ? (
          <img src={avatarUrl} alt="Avatar" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          letter
        )}
      </button>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Profile</h3>
              <button className="close-btn" onClick={() => setOpen(false)}>✕</button>
            </div>
            
            <div className="profile-hero">
              <div className="big-avatar">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  letter
                )}
              </div>
              {name && <div className="name" style={{ fontSize: 20, fontWeight: 700, color: 'var(--tx)', marginBottom: 2 }}>{name}</div>}
              <div className="email" style={{ fontSize: name ? 14 : 16 }}>{user.email}</div>
            </div>

            <div className="profile-stats">
              <div className="stat-box">
                <div className="stat-val">{profile?.weight_kg || "--"}</div>
                <div className="stat-lbl">Weight (kg)</div>
              </div>
              <div className="stat-box">
                <div className="stat-val">{profile?.height_cm || "--"}</div>
                <div className="stat-lbl">Height (cm)</div>
              </div>
              <div className="stat-box">
                <div className="stat-val">{profile?.age || "--"}</div>
                <div className="stat-lbl">Age</div>
              </div>
            </div>

            {profile?.tdee > 0 && (
              <div className="card" style={{ marginTop: 16, marginBottom: 16, padding: 12 }}>
                <div className="mu">Maintenance Calories</div>
                <div className="v" style={{ fontSize: 20, fontWeight: 700 }}>{profile.tdee} kcal</div>
                <div className="mu" style={{ marginTop: 4 }}>
                  Current Goal: <span style={{ color: "var(--ac)", fontWeight: 600 }}>{profile.goal} kcal</span>
                </div>
              </div>
            )}

            <button className="btn2" onClick={onLogout} style={{ color: "#ff5d5d", borderColor: "rgba(255, 93, 93, 0.3)", marginTop: 'auto' }}>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </>
  );
}
