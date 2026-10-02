import { NextResponse } from "next/server";

export async function POST(request) {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY is not set");
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  let b;
  try {
    b = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const prompt = String(b.prompt || "").slice(0, 4000);
  if (!prompt) return NextResponse.json({ error: "Missing prompt" }, { status: 400 });

  // Build messages in OpenAI-compatible format
  const content = [];
  if (b.image && b.image.data) {
    if (b.image.data.length > 4_500_000) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }
    content.push({
      type: "image_url",
      image_url: {
        url: `data:image/jpeg;base64,${b.image.data}`,
      },
    });
  }
  content.push({
    type: "text",
    text: prompt + "\n\nReply with a single JSON object only, no other text.",
  });

  const model = process.env.OPENROUTER_MODEL || "dots-studio/dots-3-note-preview:free";
  const apiKey = (process.env.OPENROUTER_API_KEY || "").trim();

  let res;
  try {
    res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://kalo.pages.dev",
        "X-Title": "Kalo",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1000,
        messages: [{ role: "user", content }],
      }),
    });
  } catch (e) {
    console.error("OpenRouter unreachable:", e.message);
    return NextResponse.json({ error: `Upstream unreachable: ${e.message}` }, { status: 502 });
  }

  if (res.status === 429) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`OpenRouter error ${res.status}:`, detail.slice(0, 500));
    return NextResponse.json({ error: `Upstream error: ${res.status} ${detail.slice(0, 100)}` }, { status: 502 });
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "";
  const m = text.replace(/```json|```/g, "").match(/\{[\s\S]*\}|\[[\s\S]*\]/);

  try {
    let parsed = JSON.parse(m ? m[0] : text);
    // If it returned an array directly, wrap it in { items: [...] }
    if (Array.isArray(parsed)) {
      parsed = { items: parsed };
    }
    return NextResponse.json(parsed);
  } catch {
    console.error("Unparseable AI reply:", text.slice(0, 300));
    return NextResponse.json({ error: "Could not parse AI reply" }, { status: 502 });
  }
}
