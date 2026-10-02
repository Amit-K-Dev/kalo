import { NextResponse } from "next/server";
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
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

  let resStatus = 0;
  let resText = "";

  try {
    const postData = JSON.stringify({
      model,
      max_tokens: 1000,
      messages: [{ role: "user", content }],
    });

    const apiKey = (process.env.OPENROUTER_API_KEY || "").trim();

    const https = require("https");
    resText = await new Promise((resolve, reject) => {
      const req = https.request(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://kalo.vercel.app",
            "X-Title": "Kalo",
            "Content-Length": Buffer.byteLength(postData),
          },
        },
        (res) => {
          resStatus = res.statusCode;
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => resolve(body));
        }
      );
      req.on("error", reject);
      req.write(postData);
      req.end();
    });
  } catch (e) {
    console.error("OpenRouter unreachable:", e.message);
    return NextResponse.json({ error: `Upstream unreachable: ${e.message}` }, { status: 502 });
  }

  if (resStatus === 429) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  if (resStatus < 200 || resStatus >= 300) {
    console.error(`OpenRouter error ${resStatus}:`, resText.slice(0, 500));
    return NextResponse.json({ error: `Upstream error: ${resStatus} ${resText.slice(0, 100)}` }, { status: 502 });
  }

  let data;
  try {
    data = JSON.parse(resText);
  } catch {
    console.error("OpenRouter returned invalid JSON", resText);
    return NextResponse.json({ error: "Invalid JSON from upstream" }, { status: 502 });
  }
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
