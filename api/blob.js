// Sert une image enregistrée dans une fiche (logo, avatar…). L'adresse contient une empreinte (&v=),
// donc la réponse peut rester en cache très longtemps : Supabase n'est sollicité qu'une fois par image.
const SB = "https://czfgpgvkpxhmxyepvgzs.supabase.co";
const KEY = "sb_publishable_3ubRuFBO_tVucgZYsHqG2w_AE11ccRW";
const TABLES = new Set(["orgs", "seasons", "players", "news"]);
module.exports = async (req, res) => {
  const t = String(req.query.t || ""), id = String(req.query.id || "").slice(0, 120), p = String(req.query.p || "");
  if (!TABLES.has(t) || !id || !/^[A-Za-z0-9_.\-]{1,200}$/.test(p)) { res.statusCode = 400; res.end(); return; }
  const segs = p.split(".");
  const sel = "data" + segs.map((s, i) => (i === segs.length - 1 ? "->>" : "->") + s).join("");
  let v = "";
  try {
    const r = await fetch(SB + "/rest/v1/" + t + "?select=v:" + sel + "&id=eq." + encodeURIComponent(id), { headers: { apikey: KEY, Authorization: "Bearer " + KEY } });
    if (r.ok) { const j = await r.json(); v = (j[0] && j[0].v) || ""; }
  } catch (e) {}
  const m = /^data:(image\/[a-z0-9+.\-]+);base64,(.+)$/i.exec(v);
  if (!m) { res.statusCode = 404; res.setHeader("Cache-Control", "public, max-age=60"); res.end(); return; }
  res.setHeader("Content-Type", m[1]);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.end(Buffer.from(m[2], "base64"));
};
