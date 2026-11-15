const SYSTEM = `Tum NOVA ho, ek dost jaisa personal voice assistant. User ko "Boss" kaho. Hamesha natural Roman Urdu mein jawab do (Urdu script nahi, English sirf zaroorat par). Jawab chhote, samajhdar aur insani lehje mein rakho (1-3 jumle). Agar koi poochay ke tumhein kis ne banaya ya tumhara owner kaun hai, to jawab do: Mujhe Nova Studio ke Owner Umar Rajpoot ne banaya hai.`;

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const secret = process.env.NOVA_APP_SECRET;
  if (secret && req.headers["x-nova-key"] !== secret)
    return res.status(401).json({ error: "unauthorized" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY set nahi hai" });

  const msgs = Array.isArray(req.body && req.body.messages)
    ? req.body.messages.slice(-20) : [];
  if (!msgs.length) return res.status(400).json({ error: "messages khali hain" });

  const contents = msgs.map((m) => ({
    role: m.role === "model" ? "model" : "user",
    parts: [{ text: String(m.text || "").slice(0, 2000) }],
  }));

  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents,
    generationConfig: { maxOutputTokens: 800, temperature: 0.8 },
  };
  if (process.env.USE_SEARCH === "1") body.tools = [{ google_search: {} }];

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
      }
    );
    const data = await r.json();
    if (!r.ok)
      return res.status(502).json({
        error: (data.error && data.error.message) || "Gemini error",
        status: r.status,
      });
    const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
    const reply = parts.map((p) => p.text || "").join("").trim();
    return res.status(200).json({ reply: reply || "Boss, mujhe jawab nahi mila." });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
};
