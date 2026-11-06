// Relais vers le stockage d'images Supabase, mis en cache longtemps par Vercel.
// Les fichiers envoyés ont un nom unique et ne sont jamais remplacés.
const ST = "https://czfgpgvkpxhmxyepvgzs.supabase.co/storage/v1/object/public/images/";
module.exports = async (req, res) => {
  const p = String(req.query.p || "");
  if (!/^[A-Za-z0-9_\-\/.%]{1,300}$/.test(p) || p.includes("..")) { res.statusCode = 400; res.end(); return; }
  const url = ST + p;
  try {
    const r = await fetch(url);
    const len = Number(r.headers.get("content-length") || 0);
    if (!r.ok || len > 4000000) { res.statusCode = 302; res.setHeader("Location", url); res.setHeader("Cache-Control", "public, max-age=3600"); res.end(); return; }
    const b = Buffer.from(await r.arrayBuffer());
    if (b.length > 4000000) { res.statusCode = 302; res.setHeader("Location", url); res.end(); return; }
    res.setHeader("Content-Type", r.headers.get("content-type") || "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.end(b);
  } catch (e) { res.statusCode = 302; res.setHeader("Location", url); res.end(); }
};
