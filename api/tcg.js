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
      // Refus d'apparaître dans le TCG : n'importe qui (connecté ou non) choisit sa fiche du wiki et indique son Discord ; la demande arrive aux admins (ticket).
      const box=document.createElement("div");box.style.cssText="margin:26px auto 0;padding:16px 18px;border:1px solid rgba(241,236,228,.18);border-radius:14px;text-align:center";
      m.insertBefore(box,m.querySelector("p[style*='margin-top:22px']"));
      const B='font:inherit;padding:10px 18px;border-radius:999px;cursor:pointer;border:1px solid #EC6A3D;';
      const I='font:inherit;width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid rgba(241,236,228,.25);background:#17151d;color:#F1ECE4';
      const H=t=>String(t==null?"":t).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
      const N=t=>String(t||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]/g,"");
      let PL=null;
      const loadPl=async()=>{if(PL)return PL;let out=[],from=0;for(let i=0;i<20;i++){const r=await fetch("/api/data?t=players&from="+from);if(!r.ok)throw 0;const j=await r.json();(j.rows||[]).forEach(x=>{if(x.data&&x.data.pseudo)out.push({id:x.id,n:x.data.pseudo,k:N(x.data.pseudo)});});if(j.next==null)break;from=j.next;}return PL=out;};
      const start=()=>{box.innerHTML='<p style="opacity:.88;margin:0 0 14px">Si le TCG rouvre, tu peux demander dès maintenant à ne pas y apparaître.</p><button id="o-open" style="'+B+'background:none;color:#EC6A3D">Je ne veux pas apparaître dans le TCG</button>';
        document.getElementById("o-open").onclick=form;};
      const form=async()=>{let sel=null;
        box.style.textAlign="left";
        box.innerHTML='<b style="display:block;margin-bottom:10px">Ne pas apparaître dans le TCG</b>'
          +'<label style="display:block;margin-bottom:12px"><span style="display:block;margin-bottom:4px">Ta fiche sur le wiki</span><input id="o-q" style="'+I+'" placeholder="Tape ton pseudo" autocomplete="off"><div id="o-sug" style="margin-top:6px"></div></label>'
          +'<label style="display:block;margin-bottom:12px"><span style="display:block;margin-bottom:4px">Ton pseudo Discord</span><input id="o-dc" style="'+I+'" maxlength="60" autocomplete="off" placeholder="Pour que les admins puissent vérifier que c’est bien toi"></label>'
          +'<p id="o-err" style="color:#ff8a7a;margin:0 0 10px"></p><p style="margin:0;display:flex;gap:10px;flex-wrap:wrap"><button id="o-send" style="'+B+'background:#EC6A3D;color:#0e0d12;font-weight:600">Envoyer la demande</button><button id="o-cancel" style="'+B+'background:none;color:#EC6A3D">Annuler</button></p>';
        const q=document.getElementById("o-q"),sug=document.getElementById("o-sug"),err=document.getElementById("o-err");
        document.getElementById("o-cancel").onclick=()=>{box.style.textAlign="center";start();};
        try{await loadPl();}catch(e){err.textContent="La liste des joueurs n’a pas pu être chargée. Réessaie dans un instant.";}
        const show=()=>{const k=N(q.value);sel=null;if(!k||!PL){sug.innerHTML="";return;}
          const l=PL.filter(p=>p.k.includes(k)).sort((a,b)=>(a.k.startsWith(k)?0:1)-(b.k.startsWith(k)?0:1)||a.n.localeCompare(b.n,"fr")).slice(0,8);
          sug.innerHTML=l.length?l.map(p=>'<button type="button" data-id="'+H(p.id)+'" style="font:inherit;display:block;width:100%;text-align:left;padding:8px 12px;margin-top:4px;border-radius:8px;border:1px solid rgba(241,236,228,.15);background:#1d1a24;color:#F1ECE4;cursor:pointer">'+H(p.n)+'</button>').join(""):'<p style="opacity:.7;margin:4px 0 0">Aucune fiche trouvée.</p>';
          sug.querySelectorAll("button").forEach(b=>b.onclick=()=>{sel=PL.find(p=>p.id===b.dataset.id);q.value=sel.n;sug.innerHTML='<p style="opacity:.8;margin:4px 0 0">Fiche choisie : <b>'+H(sel.n)+'</b></p>';});};
        q.oninput=show;
        document.getElementById("o-send").onclick=async ev=>{err.textContent="";const dc=document.getElementById("o-dc").value.trim();
          if(!sel){err.textContent="Choisis ta fiche dans la liste.";return;}
          if(!dc){err.textContent="Indique ton pseudo Discord.";return;}
          ev.target.disabled=true;
          const text="Ne pas apparaître dans le TCG — fiche « "+sel.n+" » (id "+sel.id+").\\nDiscord : "+dc;
          let ok=false;try{const {error}=await sb.from("tickets").insert({kind:"autre",status:"open",data:{message:text,playerId:sel.id,removal:true,tcgOptOut:true,discord:dc,anonymous:!s}});ok=!error;}catch(e){}
          box.style.textAlign="center";
          if(ok){box.innerHTML='<p style="margin:0"><b>Demande envoyée.</b> Ta fiche « '+H(sel.n)+' » n’apparaîtra pas dans le TCG. Les admins pourront te contacter sur Discord pour vérifier que c’est bien toi.</p>';return;}
          box.innerHTML='<p style="margin:0 0 10px">La demande n’a pas pu être envoyée automatiquement. Copie ce message et envoie-le à <b>Naries</b> ou <b>Layte</b> sur Discord :</p><textarea readonly rows="3" style="'+I+'">'+H(text)+'</textarea>';};
      };
      start();
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
