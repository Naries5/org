// TCG : réservé au propriétaire du site pour l'instant.
// Sans paramètre : petite page de chargement (publique, ne contient pas le jeu).
// Avec ?f=… : fichier du jeu, envoyé seulement si le jeton Supabase est celui du propriétaire (rpc is_owner).
const fs = require("fs");
const path = require("path");
const SB = "https://czfgpgvkpxhmxyepvgzs.supabase.co";
const KEY = "sb_publishable_3ubRuFBO_tVucgZYsHqG2w_AE11ccRW";
const OK_FILES = /^(index\.html|cards\.json|img\/(1[0-5]|[0-9])\.json)$/;
const seen = new Map();

async function isOwner(tok) {
  if (!tok) return false;
  const c = seen.get(tok);
  if (c && c.t > Date.now()) return c.v;
  let v = false;
  try {
    const r = await fetch(SB + "/rest/v1/rpc/is_owner", { method: "POST", headers: { apikey: KEY, Authorization: "Bearer " + tok, "Content-Type": "application/json" }, body: "{}" });
    v = r.ok && (await r.json()) === true;
  } catch (e) { v = false; }
  if (seen.size > 200) seen.clear();
  seen.set(tok, { v, t: Date.now() + 5 * 60 * 1000 });
  return v;
}

function readFile(f) {
  for (const base of [path.join(__dirname, "..", "tcg-private"), path.join(process.cwd(), "tcg-private")]) {
    try { return fs.readFileSync(path.join(base, f)); } catch (e) {}
  }
  return null;
}

const LOADER = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>ORG-Central TCG</title><meta name="robots" content="noindex"><link rel="icon" href="/favicon.svg">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0e0d12;color:#F1ECE4;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:20px}a{color:#EC6A3D}</style></head>
<body><p id="m">Chargement…</p>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.js"></script>
<script src="/config.js"></script>
<script>
(async()=>{const m=document.getElementById("m");
  try{const C=window.ORG_CENTRAL_CONFIG;
    const sb=supabase.createClient(C.supabaseUrl,C.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,flowType:"pkce",storageKey:"org-central-auth"}});
    const tok=async()=>{const {data}=await sb.auth.getSession();return data&&data.session?data.session.access_token:"";};
    if(!(await tok())){m.innerHTML='Connecte-toi sur <a href="/">orgcentral.fr</a> pour ouvrir cette page.';return;}
    window.TCG_HOSTED=true;
    window.TCG_GET=async p=>fetch("/api/tcg?f="+encodeURIComponent(p),{headers:{Authorization:"Bearer "+(await tok())}});
    const r=await window.TCG_GET("index.html");
    if(!r.ok){m.innerHTML='Cette page est privée. <a href="/">Retour au site</a>';return;}
    const html=await r.text();document.open();document.write(html);document.close();
  }catch(e){m.innerHTML='Le chargement a échoué. <a href="/tcg">Réessayer</a>';}})();
</script></body></html>`;

module.exports = async (req, res) => {
  const f = String((req.query && req.query.f) || "");
  if (!f) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Robots-Tag", "noindex");
    return res.status(200).send(LOADER);
  }
  if (!OK_FILES.test(f)) return res.status(404).send("Introuvable");
  const tok = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!(await isOwner(tok))) return res.status(403).send("Page privée");
  const body = readFile(f);
  if (!body) return res.status(404).send("Introuvable");
  res.setHeader("Content-Type", f.endsWith(".html") ? "text/html; charset=utf-8" : "application/json; charset=utf-8");
  res.setHeader("Cache-Control", f.startsWith("img/") ? "private, max-age=86400" : "private, no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  return res.status(200).send(body);
};
