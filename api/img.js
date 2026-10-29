// Sert le logo d'une saison / ORG ou l'avatar d'un joueur pour les aperçus de liens.
const { q, enc } = require("./_lib");
async function value(t, id) {
  if (t === "s") {
    const [s] = await q("seasons?select=logo:data->>logo,orgId:data->>orgId&id=eq." + enc(id));
    if (!s) return "";
    if (s.logo) return s.logo;
    return value("o", s.orgId);
  }
  if (t === "o") {
    const [s] = await q("seasons?select=logo:data->>logo&data->>orgId=eq." + enc(id) + "&data->>logo=neq.&order=updated_at.desc&limit=1");
    if (s && s.logo) return s.logo;
    const [o] = await q("orgs?select=logo:data->>logo&id=eq." + enc(id));
    return (o && o.logo) || "";
  }
  if (t === "j") {
    const [p] = await q("players?select=avatar:data->>avatar&id=eq." + enc(id));
    return (p && p.avatar) || "";
  }
  return "";
}
module.exports = async (req, res) => {
  let v = "";
  try { v = await value(String(req.query.t || ""), String(req.query.id || "").slice(0, 80)); } catch (e) { v = ""; }
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
  const m = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(v);
  if (m) { res.setHeader("Content-Type", m[1]); res.end(Buffer.from(m[2], "base64")); return; }
  res.statusCode = 302;
  res.setHeader("Location", /^https:\/\//.test(v) ? v : "/og.png");
  res.end();
};
