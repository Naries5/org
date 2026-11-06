// Données publiques du wiki, servies par le cache de Vercel pour ne pas solliciter Supabase à chaque visite.
// GET /api/data?t=orgs|seasons|players|news&from=0
const SB = "https://czfgpgvkpxhmxyepvgzs.supabase.co";
const KEY = "sb_publishable_3ubRuFBO_tVucgZYsHqG2w_AE11ccRW";
const LIMIT = { orgs: 1000, seasons: 100, players: 1000, news: 500 };
const ST = SB + "/storage/v1/object/public/images/";

async function get(path) {
  const r = await fetch(SB + "/rest/v1/" + path, { headers: { apikey: KEY, Authorization: "Bearer " + KEY } });
  return r;
}
// Même traitement que la fonction SQL oc_strip, si la vue n'existe pas encore.
function strip(j, t, id, p) {
  if (Array.isArray(j)) return j.map((v, i) => strip(v, t, id, p === "" ? String(i) : p + "." + i));
  if (j && typeof j === "object") { const o = {}; for (const k of Object.keys(j)) o[k] = strip(j[k], t, id, p === "" ? k : p + "." + k); return o; }
  if (typeof j === "string") {
    if (j.startsWith("data:image/") && j.length > 400) return "/api/blob?t=" + t + "&id=" + encodeURIComponent(id) + "&p=" + p + "&v=" + hash(j);
    if (j.startsWith(ST)) return "/api/st?p=" + j.slice(ST.length);
  }
  return j;
}
// Les liens vers le stockage passent par /api/st (mis en cache longtemps par Vercel).
function storage(j) {
  if (Array.isArray(j)) return j.map(storage);
  if (j && typeof j === "object") { const o = {}; for (const k of Object.keys(j)) o[k] = storage(j[k]); return o; }
  if (typeof j === "string" && j.startsWith(ST)) return "/api/st?p=" + j.slice(ST.length);
  return j;
}
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i += 7) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + s.length.toString(36); }

module.exports = async (req, res) => {
  const t = String(req.query.t || "");
  if (!LIMIT[t]) { res.statusCode = 400; res.end("{}"); return; }
  const lim = LIMIT[t];
  const from = Math.max(0, parseInt(req.query.from, 10) || 0);
  const qs = "select=id,data&order=id&offset=" + from + "&limit=" + lim;
  let rows, viaView = true;
  try {
    let r = await get("oc_" + t + "?" + qs);
    if (!r.ok) { viaView = false; r = await get(t + "?" + qs); }
    if (!r.ok) { res.statusCode = r.status === 402 ? 503 : 502; res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify({ error: "supabase " + r.status })); return; }
    rows = await r.json();
  } catch (e) { res.statusCode = 502; res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify({ error: String(e) })); return; }
  rows = rows.map(x => ({ id: x.id, data: viaView ? storage(x.data || {}) : strip(x.data || {}, t, x.id, "") }));
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=60, s-maxage=600, stale-while-revalidate=86400");
  res.end(JSON.stringify({ rows, next: rows.length === lim ? from + lim : null }));
};
module.exports.strip = strip;
module.exports.hash = hash;
