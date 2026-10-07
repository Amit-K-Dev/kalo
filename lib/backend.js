import { getSupabaseBrowser } from "@/lib/supabase-client";

const API_URL = (process.env.NEXT_PUBLIC_KALO_API_URL || "").replace(/\/+$/, "");

export async function backendRequest(path, { method = "GET", body } = {}) {
  if (!API_URL) throw new Error("Python API URL is not configured");

  const { data: { session }, error: sessionError } = await getSupabaseBrowser().auth.getSession();
  if (sessionError) throw new Error("Could not read your sign-in session");
  if (!session?.access_token) throw new Error("Please sign in again");

  let response;
  try {
    response = await fetch(`${API_URL}/api/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error("Could not reach the Kalo service");
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      await getSupabaseBrowser().auth.signOut();
      window.location.assign("/login");
    }
    const error = new Error(payload.error || payload.detail || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export function estimateMeal({ mode, text, image }) {
  return backendRequest("ai", { method: "POST", body: { mode, text, image } });
}
