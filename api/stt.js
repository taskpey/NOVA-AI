// NOVA awaaz -> text backend  ->  GitHub repo mein "api/stt.js" ke naam se rakhein (chat.js / agent.js ke saath).

// chat.js wale hi env variable (koi naya variable banane ki zaroorat nahi).
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const APP_SECRET = process.env.NOVA_APP_SECRET;
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST chahiye" });
  if (APP_SECRET && req.headers["x-nova-key"] !== APP_SECRET) {
    return res.status(401).json({ error: "unauthorized" });
  }
  if (!GEMINI_KEY) return res.status(500).json({ error: "GEMINI_API_KEY set nahi hai" });

  try {
    const { audio, mime, lang } = req.body || {};
    if (!audio) return res.status(400).json({ error: "audio nahi mili" });

    const prompt =
      lang === "en"
        ? "Transcribe this audio exactly. Output only the transcript text."
        : "Ye audio Urdu / Hindi / English mix mein ho sakti hai. Isay bilkul waisa hi likho jaisa bola gaya, " +
          "lekin Roman Urdu mein (Urdu alfaaz English huroof mein, jaise 'torch on karo', 'Ahmed ko call karo'). " +
          "English alfaaz English mein hi rehne do. Naam aur app ke naam (WhatsApp, TikTok, YouTube) sahi spelling mein likho. " +
          "Sirf transcript do, koi wazahat nahi. Agar saaf awaaz nahi hai ya sirf shor hai to khali jawab do.";

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }, { inlineData: { mimeType: mime || "audio/wav", data: audio } }],
            },
          ],
          generationConfig: { temperature: 0 },
        }),
      }
    );
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: (data.error && data.error.message) || "Gemini error" });

    let text = (((data.candidates || [])[0] || {}).content || {}).parts;
    text = text && text[0] && text[0].text ? text[0].text : "";
    text = text.replace(/^["'\s]+|["'\s]+$/g, "").trim();
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e).slice(0, 200) });
  }
};
