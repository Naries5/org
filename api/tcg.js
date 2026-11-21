// TCG d'ORG-Central. Avant la sortie : décompte et liste des cartes pour tous ; le propriétaire et les admins ont un bouton pour ouvrir le jeu.
// Sans paramètre : petite page de chargement (publique, ne contient pas le jeu).
// Les fichiers du jeu sont dans /tcg-files (statique, CDN). ?f=… reste en secours pour les anciens onglets.
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
    // Accès : le propriétaire et les admins du site.
    for (const fn of ["is_owner", "is_admin"]) {
      const r = await fetch(SB + "/rest/v1/rpc/" + fn, { method: "POST", headers: { apikey: KEY, Authorization: "Bearer " + tok, "Content-Type": "application/json" }, body: "{}" });
      if (r.ok && (await r.json()) === true) { v = true; break; }
    }
  } catch (e) { v = false; }
  if (seen.size > 200) seen.clear();
  seen.set(tok, { v, t: Date.now() + 5 * 60 * 1000 });
  return v;
}

function readFile(f) {
  for (const base of [path.join(__dirname, "..", "tcg-files"), path.join(process.cwd(), "tcg-files")]) {
    try { return fs.readFileSync(path.join(base, f)); } catch (e) {}
  }
  return null;
}

// Sortie publique : samedi 21 novembre 2026 à 14 h (heure de Paris).
const LAUNCH = Date.parse("2026-11-21T14:00:00+01:00");
const loader = (now) => `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>ORG-Central TCG</title><meta name="description" content="Le TCG d'ORG-Central : toutes les ORG, les saisons et les joueurs du wiki en cartes à collectionner."><link rel="icon" href="/favicon.svg">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0e0d12;color:#F1ECE4;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:20px}a{color:#EC6A3D}</style></head>
<body><p id="m">Chargement…</p>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.js"></script>
<script src="/config.js"></script>
<script>
(async()=>{const m=document.getElementById("m");
  try{const C=window.ORG_CENTRAL_CONFIG;
    // Toute requête vers Supabase abandonne au bout de 8 s : si la base rame, le jeu se charge quand même.
    const tfetch=(u,o={})=>{if(o.signal)return fetch(u,o);const c=new AbortController(),t=setTimeout(()=>c.abort(),8000);return fetch(u,{...o,signal:c.signal}).finally(()=>clearTimeout(t));};
    const sb=supabase.createClient(C.supabaseUrl,C.supabaseAnonKey,{global:{fetch:tfetch},auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"pkce",storageKey:"org-central-auth"}});
    const within=(p,ms,v)=>Promise.race([p,new Promise(r=>setTimeout(()=>r(v),ms))]);
    const sess=async()=>{try{const {data}=await within(sb.auth.getSession(),6000,{data:null});return data&&data.session||null;}catch(e){return null;}};
    const s=await sess();
    window.TCG_HOSTED=true;window.TCG_SB=sb;window.TCG_UID=s?s.user.id:null;
    window.TCG_LAUNCH=${LAUNCH};window.TCG_OFFSET=${now}-Date.now();
    let staff=false;if(s){try{const [o,a]=await within(Promise.all([sb.rpc("is_owner"),sb.rpc("is_admin")]),4000,[{},{}]);staff=o.data===true||a.data===true;}catch(e){}}
    const live=Date.now()+window.TCG_OFFSET>=window.TCG_LAUNCH;
    // Avant la sortie, le propriétaire et les admins voient le décompte comme tout le monde ; un bouton leur ouvre le jeu (mémorisé pour l'onglet).
    let adm=false;try{adm=sessionStorage.getItem("tcg-admin")==="1";}catch(e){}
    window.TCG_STAFF=staff;window.TCG_MODE=live?(s?"full":"login"):(staff&&adm?"full":"preview");
    // Fichiers du jeu servis en statique par le CDN de Vercel (pas de fonction, pas de transfert depuis l'origine à chaque visite).
    window.TCG_GET=p=>fetch("/tcg-files/"+p);
    const r=await window.TCG_GET("index.html");
    if(!r.ok){m.innerHTML='Le TCG n’a pas pu être chargé. <a href="/tcg">Réessayer</a>';return;}
    const html=await r.text();document.open();document.write(html);document.close();
  }catch(e){m.innerHTML='Le chargement a échoué. <a href="/tcg">Réessayer</a>';}})();
</script></body></html>`;


module.exports = async (req, res) => {
  const f = String((req.query && req.query.f) || "");
  if (!f) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(loader(Date.now()));
  }
  if (!OK_FILES.test(f)) return res.status(404).send("Introuvable");
  // Les fichiers du jeu sont publics depuis l'annonce : la page de décompte affiche la liste des cartes.
  const body = readFile(f);
  if (!body) return res.status(404).send("Introuvable");
  res.setHeader("Content-Type", f.endsWith(".html") ? "text/html; charset=utf-8" : "application/json; charset=utf-8");
  res.setHeader("Cache-Control", f.startsWith("img/") ? "public, max-age=86400, s-maxage=31536000" : "public, max-age=0, s-maxage=300");
  res.setHeader("X-Robots-Tag", "noindex");
  return res.status(200).send(body);
};
