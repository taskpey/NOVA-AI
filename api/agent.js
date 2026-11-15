// NOVA Phone Agent backend  ->  GitHub repo mein "api/agent.js" ke naam se rakhein (chat.js ke saath).

// chat.js wale hi env variable (koi naya variable banane ki zaroorat nahi).
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const APP_SECRET = process.env.NOVA_APP_SECRET;
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

const SYSTEM = `Tum NOVA ho, ek Android phone chalane wala agent. Tumhe user ka maqsad (goal), maujooda screen ki list,
ab tak ke qadam (history) aur notes milte hain. Sirf EK agla qadam JSON mein do.

Screen list ka format: [index] flags "text" (description)
flags: c=click ho sakta hai, s=scroll, e=text likhne wala, k/K=checkbox (K = on), f=focused.

JSON (sirf ye, koi aur text nahi):
{"type": "click|type|enter|swipe|back|home|open_app|wait|ask|done|fail",
 "index": number (click/type ke liye screen list ka index),
 "text": "type ke liye likhne wala text",
 "enter": true/false (type ke baad Enter/search dabana ho to true),
 "direction": "up|down|left|right" (swipe: ungli ki harkat. Neeche ka content dekhne ke liye "up". TikTok/Reels mein agli video ke liye "up"),
 "app": "app ka naam (open_app ke liye)",
 "message": "done/fail/ask ke liye Roman Urdu jawab",
 "reason": "is qadam ki wajah, Roman Urdu mein, 1 chhoti line",
 "risky": true/false,
 "note": "agar kuch yaad rakhna ho (jaise padhe hue comments) to chhota note"}

Qaidey:
- Sab jawab Roman Urdu mein (message, reason, note).
- Kaam poora hote hi type "done" do aur message mein user ko nateeja batao (jaise comments ka khulasa, mosam, khabar). Zaroorat ho to scroll kar ke 2-3 baar parho, notes mein jama karo, phir done.
- Pehle dekho ke sahi app khuli hai; nahi to open_app.
- risky=true tab do jab qadam kuch bhejta / post karta / delete karta / khareedta / paise bhejta / follow ya unfollow karta ho / koi sharing ya account badalta ho. Sirf parhne wale qadam risky nahi hote.
- Password, OTP, card number kabhi type mat karo. "(password khana)" par kuch type mat karo; user se ask karo.
- Agar screen par captcha, login ya payment aaye to type "ask" ya "fail" do.
- Aik hi qadam baar baar nakaam ho to kuch aur try karo (scroll, back) ya "fail" do.
- Kam se kam qadam lo. Bekar ke qadam mat lo.`;

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST chahiye" });
  if (APP_SECRET && req.headers["x-nova-key"] !== APP_SECRET) {
    return res.status(401).json({ error: "unauthorized" });
  }
  if (!GEMINI_KEY) return res.status(500).json({ error: "GEMINI_API_KEY set nahi hai" });

  try {
    const { goal, pkg, screen, history, notes, step } = req.body || {};
    const prompt =
      `MAQSAD: ${goal}\n` +
      `QADAM NUMBER: ${step}\n` +
      `MAUJOODA APP: ${pkg}\n` +
      `AB TAK KE QADAM:\n${(history || []).join("\n") || "(koi nahi)"}\n` +
      `NOTES:\n${(notes || []).join("\n") || "(koi nahi)"}\n` +
      `SCREEN:\n${String(screen || "").slice(0, 9000)}`;

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
        }),
      }
    );
    const data = await r.json();
    if (!r.ok) return res.status(502).json({ error: (data.error && data.error.message) || "Gemini error" });

    let text = (((data.candidates || [])[0] || {}).content || {}).parts;
    text = text && text[0] && text[0].text ? text[0].text : "";
    text = text.replace(/```json|```/g, "").trim();
    let action;
    try {
      action = JSON.parse(text);
    } catch (e) {
      return res.status(502).json({ error: "AI ka jawab JSON nahi tha" });
    }
    if (Array.isArray(action)) action = action[0];
    if (!action || !action.type) return res.status(502).json({ error: "action nahi mila" });
    return res.status(200).json({ action });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e).slice(0, 200) });
  }
};
