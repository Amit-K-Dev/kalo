import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

const MAX_REQUEST_BYTES = 5_000_000;
const MAX_PROMPT_LENGTH = 4_000;
const MAX_ITEMS = 20;

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length > MAX_ITEMS) return null;

  const normalized = [];
  for (const item of items) {
    if (!item || typeof item !== "object" || typeof item.name !== "string") return null;
    const name = item.name.trim();
    if (!name || name.length > 120) return null;

    if ("kcal" in item || "p" in item || "c" in item || "f" in item) {
      const values = {};
      for (const key of ["kcal", "p", "c", "f"]) {
        const value = Number(item[key]);
        if (!Number.isFinite(value) || value < 0 || value > (key === "kcal" ? 20_000 : 5_000)) return null;
        values[key] = value;
      }
      normalized.push({ name, ...values });
      continue;
    }

    const values = {};
    for (const key of ["grams", "kcal100", "p100", "c100", "f100"]) {
      const value = Number(item[key]);
      const max = key === "grams" ? 5_000 : key === "kcal100" ? 1_000 : 100;
      if (!Number.isFinite(value) || value < 0 || value > max) return null;
      values[key] = value;
    }
    normalized.push({ name, ...values });
  }
  return normalized;
}

export async function POST(request) {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }

  const supabase = await getSupabaseServer();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Sign in to use meal estimation" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json({ error: "Prompt too long" }, { status: 413 });
  }

  const imageData = body.image?.data;
  if (imageData !== undefined && typeof imageData !== "string") {
    return NextResponse.json({ error: "Invalid image" }, { status: 400 });
  }
  if (imageData && imageData.length > 4_500_000) {
    return NextResponse.json({ error: "Image too large" }, { status: 413 });
  }

  if (!process.env.OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY is not set");
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const { data: allowed, error: rateLimitError } = await supabase.rpc("consume_ai_request");
  if (rateLimitError) {
    console.error("AI rate limit is unavailable:", rateLimitError.message);
    return NextResponse.json({ error: "Meal estimation is temporarily unavailable" }, { status: 503 });
  }
  if (!allowed) return NextResponse.json({ error: "Hourly AI request limit reached" }, { status: 429 });

  const content = [];
  if (imageData) {
    content.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${imageData}` },
    });
  }
  content.push({
    type: "text",
    text: prompt + "\n\nReply with a single JSON object only, no other text.",
  });

  const model = process.env.OPENROUTER_MODEL || "dots-studio/dots-3-note-preview:free";
  const apiKey = process.env.OPENROUTER_API_KEY.trim();

  let response;
  try {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://kalo.pages.dev",
        "X-Title": "Kalo",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1_000,
        messages: [{ role: "user", content }],
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    console.error("OpenRouter request failed:", error.message);
    return NextResponse.json({ error: "Meal estimation service could not be reached" }, { status: 502 });
  }

  if (response.status === 429) {
    return NextResponse.json({ error: "Rate limited by the meal estimation service" }, { status: 429 });
  }
  if (!response.ok) {
    console.error(`OpenRouter error ${response.status}`);
    return NextResponse.json({ error: "Meal estimation service returned an error" }, { status: 502 });
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return NextResponse.json({ error: "Invalid response from meal estimation service" }, { status: 502 });
  }

  const text = data.choices?.[0]?.message?.content || "";
  const match = text.replace(/```json|```/g, "").match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  try {
    let parsed = JSON.parse(match ? match[0] : text);
    if (Array.isArray(parsed)) parsed = { items: parsed };
    const items = normalizeItems(parsed?.items);
    if (!items) throw new Error("Invalid item schema");
    return NextResponse.json({ items });
  } catch {
    console.error("Unparseable or invalid AI reply:", text.slice(0, 300));
    return NextResponse.json({ error: "Could not validate meal estimate" }, { status: 502 });
  }
}
