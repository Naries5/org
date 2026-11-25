/* Mode édition du site (admins) : remplacer n'importe quel texte affiché et régler l'apparence (couleurs, polices, CSS).
   Tout est enregistré dans la table « site » (update-33) : ligne « texts » pour les textes, ligne « theme » pour l'apparence.
   Les visiteurs reçoivent ces réglages par /api/data?t=site (cache Vercel) et ils sont appliqués à chaque page. */
(function () {
  "use strict";
  const LS = { texts: "oc-site-texts", theme: "oc-site-theme" };
  const NUM = /\d[\d  .,]*\d|\d/g;
  const SKIP = "script,style,textarea,input,select,option,code,pre,.ed-ui,[data-noedit]";
  const FONTS = ["Bowlby One", "Barlow", "Barlow Condensed", "Lilita One", "Bebas Neue", "Anton", "Archivo Black", "Russo One", "Righteous", "Chakra Petch",
    "Fredoka", "Rubik", "Nunito", "Poppins", "Work Sans", "DM Sans", "Manrope", "Outfit", "Space Grotesk", "Bricolage Grotesque", "Atkinson Hyperlegible", "Merriweather"];
  const VARS = [["--bg", "Fond de page"], ["--surface", "Fond des blocs"], ["--surface-2", "Fond des blocs (2)"], ["--line", "Bordures"], ["--ink", "Texte"], ["--muted", "Texte discret"],
    ["--t1", "Couleur principale"], ["--t2", "Couleur secondaire"], ["--gold", "Or (victoires)"], ["--live", "En direct"], ["--ok", "Validé"]];

  let TXT = {}, TH = {};
  const read = k => { try { return JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch (e) { return {}; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  TXT = read(LS.texts); TH = read(LS.theme);

  const keyOf = t => String(t).replace(NUM, "#").replace(/\s+/g, " ").trim();
  const ORIG = new WeakMap();

  /* ---------- Textes ---------- */
  function applyNode(n) {
    const rec = ORIG.get(n);
    if (rec && n.nodeValue === rec.s) return;
    const original = n.nodeValue;
    const k = keyOf(original);
    const ov = k.length > 1 && TXT[k];
    if (!ov) { if (rec) ORIG.delete(n); return; }
    const nums = original.match(NUM) || [];
    const out = String(ov.t).replace(/\{(\d+)\}/g, (m, i) => nums[i] != null ? nums[i] : m);
    const lead = original.match(/^\s*/)[0], trail = original.match(/\s*$/)[0];
    n.nodeValue = lead + out + trail;
    ORIG.set(n, { o: original, s: n.nodeValue });
  }
  function applyTexts(root) {
    if (!Object.keys(TXT).length || !root) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => (!n.nodeValue.trim() || (n.parentElement && n.parentElement.closest(SKIP))) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    let n; while ((n = w.nextNode())) applyNode(n);
  }
  let pend = false;
  const mo = new MutationObserver(() => { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; applyTexts(document.body); }); });

  /* ---------- Apparence ---------- */
  function fontLink(list) {
    const fam = [...new Set(list.filter(f => f && FONTS.includes(f)))];
    let l = document.getElementById("oc-theme-fonts");
    if (!fam.length) { if (l) l.remove(); return; }
    if (!l) { l = document.createElement("link"); l.id = "oc-theme-fonts"; l.rel = "stylesheet"; document.head.appendChild(l); }
    l.href = "https://fonts.googleapis.com/css2?" + fam.map(f => "family=" + f.replace(/ /g, "+") + ":wght@400;600;700").join("&") + "&display=swap";
  }
  function applyTheme(t) {
    t = t || {};
    let st = document.getElementById("oc-theme");
    if (!st) { st = document.createElement("style"); st.id = "oc-theme"; document.head.appendChild(st); }
    const v = t.vars || {};
    let css = ":root{" + VARS.filter(([k]) => /^#[0-9a-f]{6}$/i.test(v[k] || "")).map(([k]) => k + ":" + v[k]).join(";");
    if (v["--t1"]) css += ";--accent:" + v["--t1"];
    if (t.display) css += ";--font-display:'" + t.display + "',sans-serif";
    if (t.body) css += ";--font-body:'" + t.body + "',system-ui,sans-serif";
    if (t.radius != null && t.radius !== "") css += ";--radius:" + Number(t.radius) + "px";
    css += "}";
    if (t.size) css += "body{font-size:" + Number(t.size) + "px}";
    css += "\n" + String(t.css || "");
    st.textContent = css;
    fontLink([t.display, t.body]);
  }

  /* ---------- Chargement ---------- */
  function take(rows) {
    (rows || []).forEach(r => {
      const d = r.data || {};
      if (r.id === "texts" && (!TXT._at || (d._at || "") >= TXT._at)) { TXT = d; write(LS.texts, TXT); }
      if (r.id === "theme" && (!TH._at || (d._at || "") >= TH._at)) { TH = d; write(LS.theme, TH); }
    });
    applyTheme(TH); applyTexts(document.body);
  }
  applyTheme(TH);
  const startObs = () => { mo.observe(document.body, { childList: true, subtree: true, characterData: true }); applyTexts(document.body); };
  if (document.body) startObs(); else document.addEventListener("DOMContentLoaded", startObs);
  fetch("/api/data?t=site").then(r => r.ok ? r.json() : null).then(j => j && take(j.rows)).catch(() => {});

  async function save(id, data) {
    data._at = new Date().toISOString();
    write(id === "texts" ? LS.texts : LS.theme, data);
    try {
      const { error } = await OC.sb.from("site").upsert({ id, data, updated_at: data._at });
      if (error) throw error;
      toast("Enregistré. Les visiteurs le verront d'ici 10 minutes.");
      return true;
    } catch (e) {
      toast("Enregistrement impossible : " + ((e && e.message) || e) + ". Le fichier update-33 a-t-il été lancé ?", true);
      return false;
    }
  }

  /* ---------- Interface du mode édition ---------- */
  function toast(m, e) { if (window.OC) OC.toast(m, e); }
  const H = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let on = false, textMode = true, bar = null, panel = null;
  try { on = sessionStorage.getItem("oc-edit") === "1"; } catch (e) {}

  function css() {
    if (document.getElementById("ed-css")) return;
    const s = document.createElement("style"); s.id = "ed-css";
    s.textContent = `.ed-ui{font-family:system-ui,sans-serif;font-size:14px;color:#1b1612;line-height:1.4}
.ed-bar{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:2000;display:flex;flex-wrap:wrap;gap:6px;align-items:center;background:#fff8e6;border:2px solid #1b1612;border-radius:10px;padding:8px 10px;box-shadow:0 4px 0 #1b1612;max-width:calc(100vw - 24px)}
.ed-bar b{margin-right:4px}.ed-ui button{font:inherit;cursor:pointer;border:1.5px solid #1b1612;background:#fff;color:#1b1612;border-radius:7px;padding:6px 10px}
.ed-ui button.on{background:#1b1612;color:#fff8e6}.ed-ui button.pri{background:#e4572e;color:#fff;border-color:#1b1612}
.ed-panel{position:fixed;right:14px;top:14px;bottom:86px;width:min(380px,calc(100vw - 28px));z-index:2001;overflow:auto;background:#fff8e6;border:2px solid #1b1612;border-radius:10px;padding:14px 16px;box-shadow:0 4px 0 #1b1612}
.ed-panel h3{margin:0 0 10px;font-size:16px}.ed-panel label{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:6px 0}
.ed-panel textarea,.ed-panel select,.ed-panel input[type=number]{font:inherit;width:100%;box-sizing:border-box;border:1.5px solid #1b1612;border-radius:6px;padding:6px;background:#fff;color:#1b1612}
.ed-panel input[type=color]{width:46px;height:30px;border:1.5px solid #1b1612;border-radius:6px;padding:0;background:#fff}
.ed-panel .row{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}.ed-panel .it{border-top:1px dashed #b9a98a;padding:8px 0}.ed-panel .it small{color:#5b4e3f;display:block}
body.ed-text *:not(.ed-ui):not(.ed-ui *):hover{outline:1px dashed #e4572e;outline-offset:2px;cursor:text}`;
    document.head.appendChild(s);
  }
  function drawBar() {
    if (!bar) { bar = document.createElement("div"); bar.className = "ed-ui ed-bar"; document.body.appendChild(bar); }
    bar.innerHTML = `<b>Mode édition</b><button type="button" data-e="text" class="${textMode ? "on" : ""}">Modifier les textes</button><button type="button" data-e="nav" class="${textMode ? "" : "on"}">Naviguer</button><button type="button" data-e="list">Textes modifiés (${Object.keys(TXT).filter(k => k !== "_at").length})</button><button type="button" data-e="theme">Apparence</button><button type="button" data-e="quit">Quitter</button>`;
    bar.querySelectorAll("button").forEach(b => b.onclick = () => {
      const e = b.dataset.e;
      if (e === "text" || e === "nav") { textMode = e === "text"; document.body.classList.toggle("ed-text", textMode); drawBar(); }
      if (e === "list") listPanel();
      if (e === "theme") themePanel();
      if (e === "quit") stop();
    });
  }
  function closePanel() { if (panel) { panel.remove(); panel = null; } }
  function openPanel(html) { closePanel(); panel = document.createElement("div"); panel.className = "ed-ui ed-panel"; panel.innerHTML = html; document.body.appendChild(panel); return panel; }

  function textAt(x, y) {
    let node = null;
    if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(x, y); node = p && p.offsetNode; }
    else if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); node = r && r.startContainer; }
    if (node && node.nodeType === 3 && node.nodeValue.trim() && !(node.parentElement && node.parentElement.closest(SKIP))) return node;
    return null;
  }
  function onClick(ev) {
    if (!on || !textMode || ev.target.closest(".ed-ui")) return;
    const n = textAt(ev.clientX, ev.clientY);
    if (!n) return;
    ev.preventDefault(); ev.stopPropagation();
    editNode(n);
  }
  function editNode(n) {
    const rec = ORIG.get(n);
    const original = rec ? rec.o : n.nodeValue;
    const k = keyOf(original);
    const cur = n.nodeValue.trim();
    const p = openPanel(`<h3>Modifier ce texte</h3><p style="margin:0 0 6px;color:#5b4e3f">Texte d'origine : « ${H(original.trim())} »</p>
      <textarea rows="5" id="ed-t">${H(cur)}</textarea>
      <p style="margin:8px 0 0;color:#5b4e3f">Le changement s'applique partout où ce texte apparaît. Pour une fiche, une saison ou une ORG, utilise plutôt le bouton « Modifier » de la page.</p>
      <div class="row"><button type="button" class="pri" id="ed-s">Enregistrer</button>${TXT[k] ? `<button type="button" id="ed-r">Revenir au texte d'origine</button>` : ""}<button type="button" id="ed-c">Annuler</button></div>`);
    const ta = p.querySelector("#ed-t"); ta.focus(); ta.select();
    p.querySelector("#ed-c").onclick = closePanel;
    p.querySelector("#ed-s").onclick = async () => {
      const val = ta.value.replace(/\s+/g, " ").trim();
      if (!val) { toast("Le texte ne peut pas être vide.", true); return; }
      const nums = original.match(NUM) || [];
      let tpl = val; nums.forEach((m, i) => { const j = tpl.indexOf(m); if (j >= 0) tpl = tpl.slice(0, j) + "{" + i + "}" + tpl.slice(j + m.length); });
      TXT[k] = { t: tpl, o: original.trim() };
      n.nodeValue = original; ORIG.delete(n);
      closePanel(); await save("texts", TXT); applyTexts(document.body); drawBar();
    };
    const r = p.querySelector("#ed-r");
    if (r) r.onclick = async () => { delete TXT[k]; n.nodeValue = original; ORIG.delete(n); closePanel(); await save("texts", TXT); drawBar(); };
  }
  function listPanel() {
    const ks = Object.keys(TXT).filter(k => k !== "_at");
    const p = openPanel(`<h3>Textes modifiés (${ks.length})</h3>${ks.length ? ks.map((k, i) => `<div class="it"><small>Avant : « ${H(TXT[k].o || k)} »</small>« ${H(String(TXT[k].t).replace(/\{\d+\}/g, "…"))} »<div class="row" style="margin-top:6px"><button type="button" data-i="${i}">Revenir au texte d'origine</button></div></div>`).join("") : "<p>Aucun texte modifié pour le moment. Clique sur un texte du site pour le changer.</p>"}<div class="row"><button type="button" id="ed-x">Fermer</button></div>`);
    p.querySelector("#ed-x").onclick = closePanel;
    p.querySelectorAll("[data-i]").forEach(b => b.onclick = async () => { delete TXT[ks[Number(b.dataset.i)]]; await save("texts", TXT); location.reload(); });
  }
  function themePanel() {
    const t = JSON.parse(JSON.stringify(TH || {})); t.vars = t.vars || {};
    const cs = getComputedStyle(document.documentElement);
    const toHex = v => { v = String(v || "").trim(); if (/^#[0-9a-f]{6}$/i.test(v)) return v; if (/^#[0-9a-f]{3}$/i.test(v)) return "#" + v.slice(1).split("").map(c => c + c).join("");
      const m = v.match(/rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/); return m ? "#" + [m[1], m[2], m[3]].map(x => Number(x).toString(16).padStart(2, "0")).join("") : ""; };
    const probe = document.createElement("span"); document.body.appendChild(probe);
    const hex = k => { if (t.vars[k]) return t.vars[k]; probe.style.color = "var(" + k + ")"; const h = toHex(getComputedStyle(probe).color) || toHex(cs.getPropertyValue(k)); return h || "#000000"; };
    const fsel = (id, val) => `<select id="${id}"><option value="">Police actuelle du site</option>${FONTS.map(f => `<option${f === val ? " selected" : ""}>${f}</option>`).join("")}</select>`;
    const p = openPanel(`<h3>Apparence du site</h3><p style="margin:0 0 8px;color:#5b4e3f">Les changements s'affichent tout de suite pour toi. Ils ne sont visibles par les autres qu'après « Enregistrer ».</p>
      ${VARS.map(([k, l]) => `<label>${l}<input type="color" data-v="${k}" value="${hex(k)}"></label>`).join("")}
      <label style="display:block">Police des titres${fsel("ed-fd", t.display)}</label>
      <label style="display:block">Police du texte${fsel("ed-fb", t.body)}</label>
      <label>Arrondi des coins (px)<input type="number" id="ed-rad" min="0" max="30" value="${t.radius != null ? H(t.radius) : ""}" placeholder="8" style="width:90px"></label>
      <label>Taille du texte (px)<input type="number" id="ed-sz" min="13" max="20" value="${t.size ? H(t.size) : ""}" placeholder="16" style="width:90px"></label>
      <label style="display:block">CSS personnalisé (pour aller plus loin)<textarea id="ed-css" rows="7" spellcheck="false" placeholder="h1 { letter-spacing: 1px; }">${H(t.css || "")}</textarea></label>
      <div class="row"><button type="button" class="pri" id="ed-ts">Enregistrer pour tout le monde</button><button type="button" id="ed-tc">Annuler mes changements</button><button type="button" id="ed-t0">Revenir à l'apparence d'origine</button></div>`);
    const live = () => {
      p.querySelectorAll("[data-v]").forEach(i => { if (i.dataset.d === "1") t.vars[i.dataset.v] = i.value; });
      t.display = p.querySelector("#ed-fd").value; t.body = p.querySelector("#ed-fb").value;
      t.radius = p.querySelector("#ed-rad").value; t.size = p.querySelector("#ed-sz").value; t.css = p.querySelector("#ed-css").value;
      applyTheme(t);
    };
    probe.remove();
    p.querySelectorAll("[data-v]").forEach(i => i.addEventListener("input", () => { i.dataset.d = "1"; }));
    p.querySelectorAll("input,select,textarea").forEach(i => i.addEventListener("input", live));
    p.querySelector("#ed-tc").onclick = () => { applyTheme(TH); closePanel(); };
    p.querySelector("#ed-ts").onclick = async () => { live(); if (await save("theme", t)) { TH = t; closePanel(); } };
    p.querySelector("#ed-t0").onclick = async () => { if (!window.confirm("Revenir à l'apparence d'origine pour tout le monde ?")) return; TH = {}; applyTheme(TH); await save("theme", { vars: {} }); closePanel(); };
  }

  function start() {
    if (!(window.OC && OC.isAdmin())) { toast("Réservé aux admins.", true); return; }
    on = true; try { sessionStorage.setItem("oc-edit", "1"); } catch (e) {}
    css(); textMode = true; document.body.classList.add("ed-text"); drawBar();
  }
  function stop() {
    on = false; try { sessionStorage.removeItem("oc-edit"); } catch (e) {}
    document.body.classList.remove("ed-text"); closePanel(); if (bar) { bar.remove(); bar = null; }
  }
  document.addEventListener("click", onClick, true);
  window.OCEdit = { start, stop, resume: () => { if (on && window.OC && OC.isAdmin() && !bar) start(); } };
})();
