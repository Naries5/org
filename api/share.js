// Page d'aperçu pour les liens partagés : /s/<saison>, /o/<org>, /j/<joueur>.
// Discord & co lisent les balises og:*, les visiteurs sont redirigés vers la vraie page.
const { q, enc, seasonName, dates, esc, pLabel } = require("./_lib");
const STATUS = { annoncee: "Annoncée", inscriptions: "Inscriptions ouvertes", encours: "En cours", en_cours: "En cours", terminee: "Terminée" };

async function players(ids) {
  ids = [...new Set(ids.filter(Boolean))];
  if (!ids.length) return {};
  const rows = await q("players?select=id,pseudo:data->>pseudo,precision:data->>precision&id=in.(" + ids.map(i => '"' + i + '"').join(",") + ")");
  const m = {}; rows.forEach(r => (m[r.id] = r)); return m;
}
const SEL = "id,external:data->>external,orgId:data->>orgId,number:data->>number,title:data->>title,customName:data->>customName,status:data->>status,start:data->>start,end:data->>end,period:data->>period,cast:data->cast";
const OSEL = "id,name:data->>name,tag:data->>tag,seasonWord:data->>seasonWord,numbering:data->>numbering,hosts:data->>hosts,description:data->>description";

async function season(id) {
  const [s] = await q("seasons?select=" + SEL + ",logo:data->>logo&id=eq." + enc(id));
  if (!s) return null;
  const [o] = await q("orgs?select=" + OSEL + ",logo:data->>logo&id=eq." + enc(s.orgId || ""));
  const cast = Array.isArray(s.cast) ? s.cast : [];
  const done = s.status === "terminee" && !s.external;
  const pod = done ? [1, 2, 3].map(n => cast.filter(c => Number(c.place) === n).map(c => c.playerId)) : [[], [], []];
  const ps = await players(pod.flat());
  const names = l => l.map(i => pLabel(ps[i])).join(" & ");
  const lines = [];
  if (pod[0].length) lines.push("🏆 Vainqueur : " + names(pod[0]));
  const sub = [pod[1].length ? "🥈 " + names(pod[1]) : "", pod[2].length ? "🥉 " + names(pod[2]) : ""].filter(Boolean).join("   ");
  if (sub) lines.push(sub);
  lines.push([cast.length ? cast.length + " joueurs" : "", dates(s), !done && !s.external && STATUS[s.status] ? STATUS[s.status] : ""].filter(Boolean).join(" · "));
  if (s.external) lines.push("Classement et votes sur " + String(s.external).replace(/^https?:\/\/(www\.)?/, "").split("/")[0]);
  return {
    title: ((o && o.name) ? o.name + " — " : "") + seasonName(s, o || {}),
    desc: lines.filter(Boolean).join("\n"),
    img: s.logo || (o && o.logo) ? "/api/img?t=s&id=" + enc(id) : "",
    hash: "#saison-" + id,
  };
}

async function orgPage(id) {
  const [o] = await q("orgs?select=" + OSEL + ",logo:data->>logo&id=eq." + enc(id));
  if (!o) return null;
  const ss = await q("seasons?select=id,external:data->>external,cast:data->cast,status:data->>status&data->>orgId=eq." + enc(id));
  const wins = {}, all = new Set();
  ss.forEach(s => (Array.isArray(s.cast) ? s.cast : []).forEach(c => { all.add(c.playerId); if (!s.external && Number(c.place) === 1) wins[c.playerId] = (wins[c.playerId] || 0) + 1; }));
  const best = Object.entries(wins).sort((a, b) => b[1] - a[1])[0];
  const ps = await players(best ? [best[0]] : []);
  const lines = [[ss.length + " saison" + (ss.length > 1 ? "s" : ""), all.size ? all.size + " joueurs" : "", o.hosts ? "Host : " + o.hosts : ""].filter(Boolean).join(" · ")];
  if (best) lines.push("👑 Plus titré : " + pLabel(ps[best[0]]) + " (" + best[1] + " victoire" + (best[1] > 1 ? "s" : "") + ")");
  if (o.description) lines.push(String(o.description).replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*\*/g, "").slice(0, 180));
  return { title: o.name, desc: lines.join("\n"), img: "/api/img?t=o&id=" + enc(id), hash: "#org-" + id };
}

async function playerPage(id) {
  const [p] = await q("players?select=id,pseudo:data->>pseudo,precision:data->>precision,tagline:data->>tagline,hasAv:data->>avatar&id=eq." + enc(id));
  if (!p) return null;
  const ss = await q("seasons?select=id,orgId:data->>orgId,number:data->>number,title:data->>title,customName:data->>customName,status:data->>status,cast:data->cast&data->cast=cs." + enc(JSON.stringify([{ playerId: id }])));
  let w = 0, top = 0;
  ss.forEach(s => { const c = (s.cast || []).find(c => c.playerId === id); const pl = c && Number(c.place); if (s.status === "terminee" && pl) { if (pl === 1) w++; if (pl <= 3) top++; } });
  const orgIds = [...new Set(ss.map(s => s.orgId).filter(Boolean))];
  const os = orgIds.length ? await q("orgs?select=id,name:data->>name&id=in.(" + orgIds.map(i => '"' + i + '"').join(",") + ")") : [];
  const lines = [[ss.length + " saison" + (ss.length > 1 ? "s" : ""), w ? "🏆 " + w + " victoire" + (w > 1 ? "s" : "") : "", top ? top + " podium" + (top > 1 ? "s" : "") : ""].filter(Boolean).join(" · ")];
  if (os.length) lines.push("ORGs : " + os.map(o => o.name).slice(0, 6).join(", ") + (os.length > 6 ? "…" : ""));
  if (p.tagline) lines.push("« " + p.tagline + " »");
  return { title: pLabel(p), desc: lines.join("\n"), img: p.hasAv ? "/api/img?t=j&id=" + enc(id) : "", hash: "#joueur-" + id };
}

module.exports = async (req, res) => {
  const t = String(req.query.t || ""), id = String(req.query.id || "").slice(0, 80);
  let d = null;
  try { d = t === "s" ? await season(id) : t === "o" ? await orgPage(id) : t === "j" ? await playerPage(id) : null; } catch (e) { d = null; }
  const host = "https://" + (req.headers["x-forwarded-host"] || req.headers.host || "www.orgcentral.fr");
  const hash = d ? d.hash : "";
  const title = d ? d.title : "ORG-Central";
  const desc = d ? d.desc : "Le wiki communautaire des ORGs et speeds françaises : saisons, classements, votes, awards et palmarès.";
  const img = d && d.img ? host + d.img : host + "/og.png";
  const big = !(d && d.img);
  const url = host + "/" + hash;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=600, stale-while-revalidate=86400");
  res.end(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>${esc(title)} · ORG-Central</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:site_name" content="ORG-Central">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:url" content="${esc(url)}">
<meta name="twitter:card" content="${big ? "summary_large_image" : "summary"}">
<meta name="theme-color" content="#FFC23D">
<meta http-equiv="refresh" content="0;url=/${esc(hash)}">
<script>location.replace("/"+${JSON.stringify(hash)});</script>
</head><body style="background:#160C13;color:#FFF3E4;font-family:sans-serif"><p><a style="color:#FFC23D" href="/${esc(hash)}">Ouvrir sur ORG-Central</a></p></body></html>`);
};
