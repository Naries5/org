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
// ── Interrupteur de maintenance ── true = TCG fermé aux joueurs (le propriétaire et les admins gardent un bouton d'accès).
const CLOSED = true;
const CLOSED_MSG = ["Bonjour, et merci pour l’intérêt porté au jeu !", "L’engouement était beaucoup plus grand que ce que nous avions imaginé et, de ce fait, pour éviter tout problème, nous avons pris la décision de fermer le TCG, peut-être définitivement, peut-être pas.", "Le problème étant qu’à l’origine, cela partait d’une blague et, avec tout ça, des personnes ne souhaitant pas que leur image soit utilisée comme ça ont montré leur mécontentement, et les critiques sont parfaitement justifiées. Nous allons réfléchir à des mesures afin de pouvoir arranger tout le monde. Mais n’oubliez pas que le premier objectif d’ORG Central est de rassembler une communauté de passionnés dans un même endroit et en aucun cas de diviser.", "Nous nous excusons personnellement pour tout ça, c’était maladroit, nous assumons nos responsabilités."];
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
    if(${CLOSED}&&!(staff&&adm)){ // maintenance : on n'ouvre pas le jeu
      document.title="TCG fermé · ORG-Central";
      m.style.maxWidth="640px";m.style.textAlign="left";m.innerHTML='<b style="display:block;text-align:center;font-size:1.5rem;margin-bottom:14px">Le TCG est fermé</b>'+${JSON.stringify(CLOSED_MSG.map(t=>"<p style=\"opacity:.88;margin:0 0 12px\">"+t.replace(/&/g,"&amp;").replace(/</g,"&lt;")+"</p>").join(""))}+'<p style="text-align:center;margin-top:22px"><a href="/">Retour au site</a></p>'+(staff?'<br><br><button id="adm" style="font:inherit;padding:10px 18px;border-radius:999px;border:1px solid #EC6A3D;background:none;color:#EC6A3D;cursor:pointer">Accéder au TCG (admin)</button>':'');
      const b=document.getElementById("adm");if(b)b.onclick=()=>{try{sessionStorage.setItem("tcg-admin","1");}catch(e){}location.reload();};
      // Autorisation d'apparaître en carte : enregistrée sur la fiche joueur reliée au compte (data.tcgConsent), pour une éventuelle réouverture.
      const box=document.createElement("div");box.style.cssText="margin:26px auto 0;padding:16px 18px;border:1px solid rgba(241,236,228,.18);border-radius:14px;text-align:center";
      m.insertBefore(box,m.querySelector("p[style*='margin-top:22px']"));
      const btn=(t,id,main)=>'<button id="'+id+'" style="font:inherit;padding:10px 18px;border-radius:999px;cursor:pointer;border:1px solid #EC6A3D;'+(main?'background:#EC6A3D;color:#0e0d12;font-weight:600':'background:none;color:#EC6A3D')+'">'+t+'</button>';
      const intro='<p style="opacity:.88;margin:0 0 14px">Si le TCG rouvre, seuls les joueurs qui l’ont accepté y apparaîtront. Tu peux retirer ton autorisation à tout moment.</p>';
      const fdate=d=>{try{return new Date(d).toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"});}catch(e){return "";}};
      const draw=async()=>{
        if(!s){box.innerHTML=intro+btn("Se connecter avec Discord pour donner mon autorisation","c-login",true);
          document.getElementById("c-login").onclick=()=>sb.auth.signInWithOAuth({provider:"discord",options:{redirectTo:location.origin+"/tcg"}});return;}
        box.innerHTML='<p style="opacity:.7;margin:0">Chargement…</p>';
        const {data:pl,error}=await sb.from("players").select("id,data").eq("data->>ownerUid",s.user.id).limit(1);
        if(error){box.innerHTML='<p style="margin:0">Impossible de charger ta fiche pour le moment. <a href="/tcg">Réessayer</a></p>';return;}
        const p=pl&&pl[0];
        if(!p){box.innerHTML=intro+'<p style="margin:0">Pour donner ton autorisation, relie d’abord ta fiche joueur à ton compte : ouvre ta fiche sur le site et clique sur « C’est moi ».</p>';return;}
        const c=p.data&&p.data.tcgConsent;
        box.innerHTML=intro+(c&&c.at?'<p style="margin:0 0 12px"><b>Tu as donné ton autorisation</b> le '+fdate(c.at)+'.</p>'+btn("Retirer mon autorisation","c-go",false):btn("Je donne mon autorisation pour apparaître en tant que carte TCG","c-go",true))+'<p id="c-err" style="color:#ff8a7a;margin:10px 0 0"></p>';
        document.getElementById("c-go").onclick=async ev=>{ev.target.disabled=true;
          const {data:cur,error:e1}=await sb.from("players").select("data").eq("id",p.id).maybeSingle();
          if(e1||!cur){document.getElementById("c-err").textContent="L’enregistrement a échoué, réessaie dans un instant.";ev.target.disabled=false;return;}
          const d=Object.assign({},cur.data);if(c&&c.at)delete d.tcgConsent;else d.tcgConsent={at:new Date().toISOString()};
          const {error:e2}=await sb.from("players").update({data:d,updated_at:new Date().toISOString()}).eq("id",p.id);
          if(e2){document.getElementById("c-err").textContent="L’enregistrement a échoué, réessaie dans un instant.";ev.target.disabled=false;return;}
          draw();};
      };
      draw();
      return;}
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
