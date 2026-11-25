/* Éditeur du site (admins).
   - Textes : n'importe quel texte affiché peut être réécrit (ligne « texts » de la table site).
   - Éléments : n'importe quel élément peut être stylé, masqué ou déplacé (ligne « layout »).
   - Apparence générale : couleurs, polices, arrondis, CSS libre (ligne « theme »).
   Les modifications restent en brouillon (visible seulement par l'admin) jusqu'à « Publier ».
   Les visiteurs reçoivent la version publiée par /api/data?t=site (cache Vercel, 10 minutes). */
(function () {
  "use strict";
  const NUM = /\d[\d  .,]*\d|\d/g;
  const SKIP = "script,style,textarea,input,select,option,code,pre,.ed-ui";
  const FONTS = ["Bowlby One", "Barlow", "Barlow Condensed", "Lilita One", "Bebas Neue", "Anton", "Archivo Black", "Russo One", "Righteous", "Chakra Petch", "Bungee",
    "Fredoka", "Rubik", "Nunito", "Poppins", "Work Sans", "DM Sans", "Manrope", "Outfit", "Space Grotesk", "Bricolage Grotesque", "Atkinson Hyperlegible", "Merriweather", "Playfair Display", "Permanent Marker", "Caveat"];
  const VARS = [["--bg", "Fond de page"], ["--surface", "Fond des blocs"], ["--surface-2", "Fond des blocs (2)"], ["--line", "Bordures"], ["--ink", "Texte"], ["--muted", "Texte discret"],
    ["--t1", "Couleur principale"], ["--t2", "Couleur secondaire"], ["--gold", "Or (victoires)"], ["--live", "En direct"], ["--ok", "Validé"]];
  const SHADOWS = { none: "none", soft: "0 2px 8px rgba(0,0,0,.35)", strong: "0 10px 28px rgba(0,0,0,.55)" };
  const LS = { pub: "oc-site-pub", draft: "oc-site-draft" };

  const H = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clone = o => JSON.parse(JSON.stringify(o || {}));
  const read = k => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };
  const write = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const toast = (m, e) => { if (window.OC) OC.toast(m, e); };
  const keyOf = t => String(t).replace(NUM, "#").replace(/\s+/g, " ").trim();
  const isAdmin = () => !!(window.OC && OC.isAdmin());

  /* État : PUB = version publiée, DRAFT = brouillon de l'admin (null si aucun) */
  const empty = () => ({ texts: {}, layout: { el: {} }, theme: { vars: {} } });
  function norm(s) { s = s || empty(); s.texts = s.texts || {}; s.layout = s.layout || {}; s.layout.el = s.layout.el || {}; s.theme = s.theme || {}; s.theme.vars = s.theme.vars || {}; return s; }
  let PUB = norm(read(LS.pub));
  let DRAFT = read(LS.draft); if (DRAFT) DRAFT = norm(DRAFT);
  const cur = () => (DRAFT && isAdmin()) ? DRAFT : PUB;

  /* ---------- Identité des éléments ---------- */
  const BAD_CLS = /^(ed-|fresh|rev|pending|on$|active|open|hidden|is-|has-|lettering|shine|dragging)/;
  function pageScope(el) {
    if (el && el.closest && el.closest("header.top,footer.site")) return "*";
    const h = (location.hash.slice(1) || location.pathname.replace(/^\//, "") || "accueil");
    return h.split(/[-/?]/)[0] || "accueil";
  }
  function cls(el) { return [...el.classList].filter(c => !BAD_CLS.test(c)).slice(0, 2); }
  function headingKey(el) {
    const h = el.querySelector(":scope > h1, :scope > h2, :scope > h3, :scope > .block-head h1, :scope > .block-head h2, :scope > div > h1");
    return h ? keyOf(h.textContent).slice(0, 40) : "";
  }
  function sig(el) {
    if (!el || el.nodeType !== 1) return "";
    const c = cls(el); const hk = headingKey(el);
    return el.tagName.toLowerCase() + (c.length ? "." + c.join(".") : "") + (hk ? "[" + hk + "]" : "");
  }
  function idxOf(el) { const s = sig(el); let i = 0, n = el; while ((n = n.previousElementSibling)) if (sig(n) === s) i++; return i; }
  function elKey(el, scope) {
    // scope : "type" (tous les semblables sur ce type de page), "one" (seulement celui-ci), "all" (partout sur le site)
    const pg = scope === "all" ? "*" : pageScope(el);
    return pg + "|" + sig(el.parentElement) + ">" + sig(el) + (scope === "one" ? "#" + idxOf(el) : "");
  }
  const selOf = el => el.tagName.toLowerCase() + (cls(el)[0] ? "." + CSS.escape(cls(el)[0]) : "");

  /* ---------- Application ---------- */
  const ORIG = new WeakMap();
  const STYLED = new WeakMap();
  let applying = false;
  function applyTextNode(n, T) {
    const rec = ORIG.get(n);
    if (rec && n.nodeValue === rec.s) return;
    const original = n.nodeValue, k = keyOf(original);
    const ov = k.length > 1 && T[k];
    if (!ov) return;
    const nums = original.match(NUM) || [];
    const out = String(ov.t).replace(/\{(\d+)\}/g, (m, i) => nums[i] != null ? nums[i] : m);
    n.nodeValue = original.match(/^\s*/)[0] + out + original.match(/\s*$/)[0];
    ORIG.set(n, { o: original, s: n.nodeValue });
  }
  function applyTexts(T) {
    if (!Object.keys(T).length) return;
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: n => (!n.nodeValue.trim() || (n.parentElement && n.parentElement.closest(SKIP))) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    let n; while ((n = w.nextNode())) applyTextNode(n, T);
  }
  function cssOf(p, editing) {
    const c = {};
    if (p.font) c["font-family"] = "'" + p.font + "', sans-serif";
    if (p.size) c["font-size"] = p.size + "px";
    if (p.weight) c["font-weight"] = p.weight;
    if (p.italic) c["font-style"] = "italic";
    if (p.upper) c["text-transform"] = "uppercase";
    if (p.color) c.color = p.color;
    if (p.align) c["text-align"] = p.align;
    if (p.ls != null && p.ls !== "") c["letter-spacing"] = p.ls + "px";
    if (p.lh) c["line-height"] = p.lh;
    if (p.bg) c.background = p.bg === "none" ? "none" : p.bg;
    if (p.bw != null && p.bw !== "") c.border = Number(p.bw) ? p.bw + "px solid " + (p.bc || "currentColor") : "none";
    else if (p.bc) c["border-color"] = p.bc;
    if (p.radius != null && p.radius !== "") c["border-radius"] = p.radius + "px";
    if (p.pad != null && p.pad !== "") c.padding = p.pad + "px";
    if (p.mt != null && p.mt !== "") c["margin-top"] = p.mt + "px";
    if (p.mb != null && p.mb !== "") c["margin-bottom"] = p.mb + "px";
    if (p.shadow) c["box-shadow"] = SHADOWS[p.shadow] || "none";
    if (p.hide) { if (editing) { c.opacity = ".35"; c.outline = "2px dashed #e4572e"; } else c.display = "none"; }
    return c;
  }
  function applyEls(L, editing) {
    const want = new Map();
    for (const [k, e] of Object.entries(L.el || {})) {
      let list; try { list = document.querySelectorAll(e.sel); } catch (x) { continue; }
      list.forEach(el => {
        if (el.closest(".ed-ui")) return;
        const kk = [elKey(el, "one"), elKey(el, "type"), elKey(el, "all")];
        const rank = k === kk[0] ? 3 : k === kk[1] ? 2 : k === kk[2] ? 1 : 0;
        if (!rank) return;
        const w = want.get(el) || { css: {}, r: {}, move: 0, mr: 0 };
        // l'entrée la plus précise gagne : « tout le site » < « ce type de page » < « seulement celui-ci »
        Object.entries(cssOf(e.p || {}, editing)).forEach(([prop, v]) => { if (!w.r[prop] || w.r[prop] <= rank) { w.css[prop] = v; w.r[prop] = rank; } });
        if (e.p && e.p.move && rank >= w.mr) { w.move = e.p.move; w.mr = rank; }
        want.set(el, w);
      });
    }
    document.querySelectorAll("[data-ed-st]").forEach(el => { if (!want.has(el)) { (STYLED.get(el) || []).forEach(pr => el.style.removeProperty(pr)); el.removeAttribute("data-ed-st"); STYLED.delete(el); } });
    want.forEach((w, el) => {
      (STYLED.get(el) || []).forEach(pr => { if (!(pr in w.css)) el.style.removeProperty(pr); });
      Object.entries(w.css).forEach(([pr, v]) => el.style.setProperty(pr, v, "important"));
      STYLED.set(el, Object.keys(w.css)); el.setAttribute("data-ed-st", "");
      if (w.move && !el.dataset.edMv && el.parentElement) {
        el.dataset.edMv = "1";
        const sib = [...el.parentElement.children].filter(x => !x.classList.contains("ed-ui"));
        const i = sib.indexOf(el), j = Math.max(0, Math.min(sib.length - 1, i + w.move));
        if (j !== i) el.parentElement.insertBefore(el, w.move > 0 ? sib[j].nextSibling : sib[j]);
      }
    });
  }
  let fontsLoaded = "";
  function loadFonts(list) {
    const fam = [...new Set(list.filter(f => f && FONTS.includes(f)))].sort();
    const href = fam.length ? "https://fonts.googleapis.com/css2?" + fam.map(f => "family=" + f.replace(/ /g, "+")).join("&") + "&display=swap" : "";
    if (href === fontsLoaded) return; fontsLoaded = href;
    let l = document.getElementById("oc-theme-fonts");
    if (!href) { if (l) l.remove(); return; }
    if (!l) { l = document.createElement("link"); l.id = "oc-theme-fonts"; l.rel = "stylesheet"; document.head.appendChild(l); }
    l.href = href;
  }
  function applyTheme(t) {
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
    st.textContent = css + "\n" + String(t.css || "");
  }
  function applyAll() {
    if (applying) return; applying = true;
    try {
      const s = cur();
      applyTheme(s.theme);
      loadFonts([s.theme.display, s.theme.body, ...Object.values(s.layout.el).map(e => e.p && e.p.font), ...(ED.fontsAll ? FONTS : [])]);
      applyTexts(s.texts);
      applyEls(s.layout, ED.on);
    } finally { applying = false; }
  }
  let pend = false;
  const mo = new MutationObserver(() => { if (pend || applying) return; pend = true; requestAnimationFrame(() => { pend = false; applyAll(); if (ED.on) drawOverlay(); }); });

  /* ---------- Chargement de la version publiée ---------- */
  function take(rows) {
    const s = norm(clone(PUB));
    (rows || []).forEach(r => {
      const d = r.data || {};
      if (r.id === "texts") { const t = clone(d); delete t._at; s.texts = t; }
      if (r.id === "layout") s.layout = { el: (d.el || {}) };
      if (r.id === "theme") { const t = clone(d); delete t._at; s.theme = t; }
    });
    PUB = norm(s); write(LS.pub, PUB); applyAll(); if (ED.on) drawPanel();
  }

  /* ---------- Éditeur ---------- */
  const ED = { on: false, mode: "select", tab: "el", sel: null, selKey: null, scope: "type", hist: [], panel: null, ov: null, hovBox: null, hov: null, fontsOpen: false, fontsAll: false };
  try { ED.on = sessionStorage.getItem("oc-edit") === "1"; } catch (e) {}

  function boot() { mo.observe(document.body, { childList: true, subtree: true, characterData: true }); applyAll(); }
  if (document.body) boot(); else document.addEventListener("DOMContentLoaded", boot);
  fetch("/api/data?t=site").then(r => r.ok ? r.json() : null).then(j => j && take(j.rows)).catch(() => {});

  const changed = () => !!DRAFT && JSON.stringify(norm(clone(DRAFT))) !== JSON.stringify(norm(clone(PUB)));
  function draft() { if (!DRAFT) DRAFT = norm(clone(PUB)); return DRAFT; }
  function commit() { write(LS.draft, DRAFT); applyAll(); drawPanel(); drawOverlay(); }
  function snapshot() { ED.hist.push(JSON.stringify(DRAFT || PUB)); if (ED.hist.length > 60) ED.hist.shift(); }
  function undo() {
    if (!ED.hist.length) { toast("Rien à annuler."); return; }
    DRAFT = norm(JSON.parse(ED.hist.pop())); resetDom(); commit(); toast("Dernière modification annulée.");
  }
  function resetDom() {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) { const r = ORIG.get(n); if (r && n.nodeValue === r.s) { n.nodeValue = r.o; ORIG.delete(n); } }
    document.querySelectorAll("[data-ed-mv]").forEach(el => delete el.dataset.edMv);
  }
  async function publish() {
    const d = norm(clone(DRAFT || PUB)); const at = new Date().toISOString();
    try {
      for (const [id, data] of [["texts", Object.assign({}, d.texts, { _at: at })], ["layout", { el: d.layout.el, _at: at }], ["theme", Object.assign({}, d.theme, { _at: at })]]) {
        const { error } = await OC.sb.from("site").upsert({ id, data, updated_at: at });
        if (error) throw error;
      }
      PUB = d; write(LS.pub, PUB); DRAFT = null; write(LS.draft, null); ED.hist = [];
      drawPanel(); toast("Publié. Les visiteurs verront les changements d'ici 10 minutes.");
    } catch (e) { toast("Publication impossible : " + ((e && e.message) || e), true); }
  }
  function discard() {
    if (!window.confirm("Abandonner toutes les modifications non publiées ?")) return;
    DRAFT = null; write(LS.draft, null); ED.hist = []; location.reload();
  }

  function css() {
    if (document.getElementById("ed-css")) return;
    const s = document.createElement("style"); s.id = "ed-css";
    s.textContent = `
body.ed-open{padding-right:400px!important}
@media (max-width:820px){body.ed-open{padding-right:0!important;padding-bottom:62vh!important}}
.ed-ui,.ed-ui *{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:normal!important;text-transform:none!important}
.ed-panel{position:fixed;top:0;right:0;bottom:0;width:400px;z-index:3000;background:#f7f5f0;color:#1f1d1a;border-left:1px solid #d8d2c4;display:flex;flex-direction:column;font-size:14px;line-height:1.4;box-shadow:-6px 0 24px rgba(0,0,0,.25)}
@media (max-width:820px){.ed-panel{top:auto;left:0;width:auto;height:62vh;border-left:0;border-top:1px solid #d8d2c4}}
.ed-head{padding:12px 14px 10px;border-bottom:1px solid #e3ddd0;background:#fff;display:flex;flex-direction:column;gap:10px}
.ed-title{display:flex;align-items:center;justify-content:space-between;gap:8px}.ed-title b{font-size:15px}
.ed-ui button{font:inherit;font-size:13px;cursor:pointer;border:1px solid #cfc8b8;background:#fff;color:#1f1d1a;border-radius:7px;padding:6px 10px;min-height:32px}
.ed-ui button:hover{border-color:#8f8775}.ed-ui button:disabled{opacity:.45;cursor:default}
.ed-ui button.pri{background:#1f1d1a;color:#fff;border-color:#1f1d1a}.ed-ui button.pub{background:#2f7d4f;color:#fff;border-color:#2f7d4f}
.ed-seg{display:inline-flex;flex-wrap:wrap;border:1px solid #cfc8b8;border-radius:8px;overflow:hidden;background:#fff}.ed-seg button{border:0;border-radius:0;border-right:1px solid #e3ddd0;padding:5px 8px;font-size:12px}
.ed-seg.full{display:grid;grid-template-columns:repeat(3,1fr);width:100%}.ed-seg.full button{font-size:12px;padding:7px 4px}.ed-seg button:last-child{border-right:0}.ed-seg button.on{background:#1f1d1a;color:#fff}
.ed-tabs{display:flex;gap:4px}.ed-tabs button{flex:1;border-radius:7px}.ed-tabs button.on{background:#1f1d1a;color:#fff;border-color:#1f1d1a}
.ed-body{flex:1;overflow:auto;padding:12px 14px 30px}
.ed-sec{background:#fff;border:1px solid #e3ddd0;border-radius:10px;padding:12px;margin-bottom:10px}
.ed-sec h4{margin:0 0 10px;font-size:12px;font-weight:700;color:#6b6457}
.ed-row{display:grid;grid-template-columns:92px 1fr 22px;align-items:center;gap:8px;margin:7px 0}
.ed-row>span{color:#3c372f}.ed-row input[type=range]{width:100%}.ed-rng{display:flex;align-items:center;gap:6px}.ed-rng .val{font-variant-numeric:tabular-nums;color:#6b6457;min-width:44px;text-align:right;font-size:12px}
.ed-ui input[type=color]{width:40px;height:30px;border:1px solid #cfc8b8;border-radius:6px;padding:2px;background:#fff}
.ed-ui textarea,.ed-ui select{font:inherit;font-size:14px;width:100%;border:1px solid #cfc8b8;border-radius:7px;padding:7px 8px;background:#fff;color:#1f1d1a}
.ed-x{border:0!important;background:none!important;color:#8f8775!important;padding:2px 4px!important;min-height:0!important;font-size:15px!important}
.ed-crumbs{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px}.ed-crumbs button{font-size:12px;padding:3px 8px;min-height:0}.ed-crumbs button.on{background:#1f1d1a;color:#fff}
.ed-fonts{max-height:260px;overflow:auto;border:1px solid #e3ddd0;border-radius:8px;margin:6px 0 4px}
.ed-ui .ed-fonts button{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid #eee;border-radius:0;font-size:19px;padding:8px 10px}.ed-ui .ed-fonts button.on{background:#efe9dc}
.ed-ui .ed-fonts button small{display:block;font-size:11px;color:#8f8775;font-family:system-ui,sans-serif}
.ed-help{color:#6b6457;margin:0 0 8px}.ed-it{border-top:1px solid #eee;padding:8px 0}.ed-it small{display:block;color:#6b6457}
.ed-ov{position:fixed;pointer-events:none;z-index:2999;border:2px solid #2f6fd6;border-radius:3px}
.ed-ov.hov{border:1px dashed #2f6fd6;background:rgba(47,111,214,.06)}
.ed-ov span{position:absolute;left:-2px;top:-22px;background:#2f6fd6;color:#fff;font:12px system-ui,sans-serif;padding:2px 6px;border-radius:4px 4px 0 0;white-space:nowrap}
body.ed-select #app *,body.ed-select header.top *,body.ed-select footer.site *{cursor:pointer!important}`;
    document.head.appendChild(s);
  }

  /* noms lisibles */
  function describe(el) {
    if (!el) return "";
    const t = el.tagName.toLowerCase(), txt = keyOf(el.textContent).slice(0, 26);
    if (/^h[1-6]$/.test(t)) return "Titre « " + txt + " »";
    if (t === "section" || el.classList.contains("block")) { const h = headingKey(el); return h ? "Bloc « " + h.slice(0, 26) + " »" : "Bloc"; }
    if (t === "p") return "Paragraphe";
    if (t === "a") return "Lien « " + txt + " »";
    if (t === "button") return "Bouton « " + txt + " »";
    if (t === "img") return "Image";
    if (t === "nav") return "Menu";
    if (t === "header") return "En-tête du site";
    if (t === "footer") return "Pied de page";
    if (t === "main") return "Page";
    if (t === "li") return "Élément de liste";
    if (t === "table") return "Tableau";
    if (t === "tr") return "Ligne de tableau";
    if (t === "td" || t === "th") return "Case de tableau";
    if (["span", "b", "small", "strong", "i", "em", "label"].includes(t)) return "Texte « " + txt + " »";
    return "Zone" + (cls(el)[0] ? " (" + cls(el)[0] + ")" : "");
  }

  /* superposition : survol et sélection */
  function box(c) { const d = document.createElement("div"); d.className = "ed-ui ed-ov " + c; d.innerHTML = "<span></span>"; document.body.appendChild(d); return d; }
  function place(d, el, label) {
    if (!el || !document.body.contains(el)) { d.style.display = "none"; return; }
    const r = el.getBoundingClientRect(); d.style.display = "block";
    Object.assign(d.style, { left: r.left - 2 + "px", top: r.top - 2 + "px", width: r.width + 4 + "px", height: r.height + 4 + "px" });
    d.firstChild.textContent = label || ""; d.firstChild.style.display = label ? "block" : "none";
  }
  function refind(k) { if (!k) return null; let list; try { list = document.querySelectorAll(k.sel); } catch (e) { return null; } for (const el of list) if (elKey(el, "one") === k.one) return el; return null; }
  function drawOverlay() {
    if (!ED.on) return;
    if (!ED.ov) ED.ov = box("sel"); if (!ED.hovBox) ED.hovBox = box("hov");
    if (ED.sel && !document.body.contains(ED.sel)) ED.sel = refind(ED.selKey);
    place(ED.ov, ED.sel, ED.sel ? describe(ED.sel) : "");
    place(ED.hovBox, ED.mode === "select" && ED.hov !== ED.sel ? ED.hov : null, "");
  }
  window.addEventListener("scroll", () => ED.on && drawOverlay(), true);
  window.addEventListener("resize", () => ED.on && drawOverlay());

  function pickable(el) { return !!(el && el.nodeType === 1 && !el.closest(".ed-ui") && el.closest("#app,header.top,footer.site")); }
  document.addEventListener("mousemove", ev => { if (!ED.on || ED.mode !== "select") return; const el = pickable(ev.target) ? ev.target : null; if (el !== ED.hov) { ED.hov = el; drawOverlay(); } }, true);
  document.addEventListener("click", ev => {
    if (!ED.on || ED.mode !== "select" || !pickable(ev.target)) return;
    ev.preventDefault(); ev.stopPropagation(); select(ev.target);
  }, true);
  document.addEventListener("keydown", ev => {
    if (!ED.on) return;
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z" && !ev.target.closest("textarea,input")) { ev.preventDefault(); undo(); }
    if (ev.key === "Escape" && ED.sel) { ED.sel = null; ED.selKey = null; drawOverlay(); drawPanel(); }
  });
  function select(el) {
    ED.sel = el; ED.selKey = { sel: selOf(el), one: elKey(el, "one") }; ED.tab = "el"; ED.fontsOpen = false;
    const L = cur().layout.el;
    ED.scope = L[elKey(el, "one")] ? "one" : L[elKey(el, "type")] ? "type" : L[elKey(el, "all")] ? "all" : "type";
    drawOverlay(); drawPanel();
  }

  /* ---------- Panneau ---------- */
  function mainText(el) {
    let best = null;
    el.childNodes.forEach(n => { if (n.nodeType === 3 && n.nodeValue.trim() && (!best || n.nodeValue.trim().length > best.nodeValue.trim().length)) best = n; });
    return best;
  }
  function chainOf(el) { const c = []; let x = el; while (x && pickable(x) && c.length < 6) { c.unshift(x); x = x.parentElement; } return c; }
  function getP(el) { const e = cur().layout.el[elKey(el, ED.scope)]; return (e && e.p) || {}; }
  function setP(el, patch) {
    if (!el) return;
    snapshot();
    const d = draft(); const k = elKey(el, ED.scope);
    const e = d.layout.el[k] || (d.layout.el[k] = { sel: selOf(el), p: {}, name: describe(el) });
    Object.entries(patch).forEach(([a, v]) => { if (v === null || v === "" || v === false || v === 0 && a === "move") delete e.p[a]; else e.p[a] = v; });
    if (!Object.keys(e.p).length) delete d.layout.el[k];
    if ("move" in patch) document.querySelectorAll("[data-ed-mv]").forEach(x => delete x.dataset.edMv);
    commit();
  }
  const rst = (on, keys) => on ? `<button type="button" class="ed-x" data-reset="${keys}" title="Revenir à l'origine" aria-label="Revenir à l'origine">↺</button>` : "<i></i>";
  const row = (label, ctl, reset) => `<div class="ed-row"><span>${label}</span>${ctl}${reset}</div>`;
  const has = v => v != null && v !== "";
  function range(id, v, min, max, step, unit, dflt) { return `<span class="ed-rng"><input type="range" data-p="${id}" data-u="${unit}" min="${min}" max="${max}" step="${step}" value="${has(v) ? H(v) : dflt}" aria-label="${id}"><span class="val" data-val="${id}">${has(v) ? H(v) + unit : "origine"}</span></span>`; }
  function seg(id, opts, v, full) { return `<span class="ed-seg${full ? " full" : ""}">${opts.map(([val, l]) => `<button type="button" data-seg="${id}" data-v="${val}" class="${String(v) === String(val) ? "on" : ""}">${l}</button>`).join("")}</span>`; }
  const toHex = v => { v = String(v || "").trim(); if (/^#[0-9a-f]{6}$/i.test(v)) return v; const m = v.match(/rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/); return m ? "#" + [m[1], m[2], m[3]].map(x => Number(x).toString(16).padStart(2, "0")).join("") : "#000000"; };

  function drawPanel() {
    if (!ED.on) return;
    if (!ED.panel) { ED.panel = document.createElement("aside"); ED.panel.className = "ed-ui ed-panel"; ED.panel.setAttribute("aria-label", "Éditeur du site"); document.body.appendChild(ED.panel); }
    const scroll = ED.panel.querySelector(".ed-body") ? ED.panel.querySelector(".ed-body").scrollTop : 0;
    const n = changed();
    ED.panel.innerHTML = `<div class="ed-head">
      <div class="ed-title"><b>Éditeur du site</b><span style="display:flex;gap:6px"><button type="button" data-a="undo" title="Ctrl + Z"${ED.hist.length ? "" : " disabled"}>Annuler</button><button type="button" data-a="quit">Quitter</button></span></div>
      <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap">${seg("mode", [["select", "Sélectionner"], ["nav", "Naviguer"]], ED.mode)}
        <span style="display:flex;gap:6px">${n ? `<button type="button" data-a="discard">Abandonner</button>` : ""}<button type="button" class="pub" data-a="publish"${n ? "" : " disabled"}>${n ? "Publier" : "Tout est publié"}</button></span></div>
      ${n ? `<div style="font-size:12px;color:#8a5a00">Brouillon : visible seulement par toi tant que tu n'as pas publié.</div>` : ""}
      <div class="ed-tabs">${[["el", "Élément"], ["theme", "Apparence générale"], ["list", "Modifications"]].map(([v, l]) => `<button type="button" data-tab="${v}" class="${ED.tab === v ? "on" : ""}">${l}</button>`).join("")}</div>
    </div><div class="ed-body">${ED.tab === "el" ? elTab() : ED.tab === "theme" ? themeTab() : listTab()}</div>`;
    ED.panel.querySelector(".ed-body").scrollTop = scroll;
    bindPanel();
  }

  function elTab() {
    const el = ED.sel;
    if (!el || !document.body.contains(el)) return `<div class="ed-sec"><h4>Comment ça marche</h4><p class="ed-help">Clique sur n'importe quel élément de la page : un titre, un texte, un bouton, un bloc entier. Ses réglages s'affichent ici.</p><p class="ed-help">Pour changer de page, passe en mode « Naviguer », puis reviens sur « Sélectionner ».</p><p class="ed-help" style="margin:0">Tes changements restent en brouillon : personne d'autre ne les voit tant que tu n'as pas cliqué sur « Publier ».</p></div>`;
    const p = getP(el), cs = getComputedStyle(el), tn = mainText(el);
    const T = tn ? cur().texts[keyOf((ORIG.get(tn) || {}).o || tn.nodeValue)] : null;
    const font = p.font || "", sample = tn ? keyOf(tn.nodeValue).slice(0, 24) : "";
    return `<div class="ed-crumbs" aria-label="Élément et ses parents">${chainOf(el).map((c, i) => `<button type="button" data-crumb="${i}" class="${c === el ? "on" : ""}">${H(describe(c))}</button>`).join("")}</div>
    <div class="ed-sec"><h4>À quoi s'appliquent les réglages</h4>${seg("scope", [["type", "Les semblables"], ["one", "Celui-ci"], ["all", "Tout le site"]], ED.scope, true)}
      <p class="ed-help" style="margin:8px 0 0">${ED.scope === "type" ? "Tous les éléments de ce genre, sur toutes les pages de ce type." : ED.scope === "one" ? "Uniquement cet élément, à cette place." : "Ce genre d'élément, sur toutes les pages du site."}</p></div>
    ${tn ? `<div class="ed-sec"><h4>Contenu</h4><textarea rows="3" data-text="1" aria-label="Texte">${H(tn.nodeValue.trim())}</textarea>
      <div style="display:flex;gap:6px;margin-top:8px"><button type="button" class="pri" data-a="savetext">Appliquer le texte</button>${T ? `<button type="button" data-a="resettext">Texte d'origine</button>` : ""}</div>
      <p class="ed-help" style="margin:8px 0 0">Le nouveau texte remplace celui-ci partout où il apparaît. Pour une fiche, une saison ou une ORG, utilise le bouton « Modifier » de la page.</p></div>` : ""}
    <div class="ed-sec"><h4>Texte</h4>
      ${row("Police", `<button type="button" data-a="fonts" style="text-align:left;font-family:${font ? `'${H(font)}',sans-serif` : "inherit"};font-size:16px">${H(font || "Police d'origine")} ▾</button>`, rst(font, "font"))}
      ${ED.fontsOpen ? `<div class="ed-fonts">${FONTS.map(f => `<button type="button" data-font="${H(f)}" class="${f === font ? "on" : ""}" style="font-family:'${H(f)}',sans-serif">${H(sample || f)}<small>${H(f)}</small></button>`).join("")}</div>` : ""}
      ${row("Taille", range("size", p.size, 10, 96, 1, " px", Math.round(parseFloat(cs.fontSize)) || 16), rst(has(p.size), "size"))}
      ${row("Graisse", seg("weight", [["400", "Normale"], ["600", "Semi"], ["700", "Grasse"], ["900", "Très"]], p.weight || ""), rst(has(p.weight), "weight"))}
      ${row("Style", `<span style="display:flex;gap:4px;flex-wrap:wrap">${seg("italic", [["1", "Italique"]], p.italic ? "1" : "")}${seg("upper", [["1", "Majuscules"]], p.upper ? "1" : "")}</span>`, rst(p.italic || p.upper, "italic,upper"))}
      ${row("Couleur", `<input type="color" data-c="color" value="${toHex(p.color || cs.color)}" aria-label="Couleur du texte">`, rst(has(p.color), "color"))}
      ${row("Alignement", seg("align", [["left", "Gauche"], ["center", "Centre"], ["right", "Droite"]], p.align || ""), rst(has(p.align), "align"))}
      ${row("Espacement", range("ls", p.ls, -2, 12, 0.5, " px", 0), rst(has(p.ls), "ls"))}
      ${row("Interligne", range("lh", p.lh, 0.9, 2.2, 0.05, "", 1.5), rst(has(p.lh), "lh"))}
    </div>
    <div class="ed-sec"><h4>Bloc</h4>
      ${row("Fond", `<span style="display:flex;gap:6px;align-items:center"><input type="color" data-c="bg" value="${toHex(p.bg && p.bg !== "none" ? p.bg : cs.backgroundColor)}" aria-label="Couleur de fond"><button type="button" data-a="bgnone"${p.bg === "none" ? ' class="pri"' : ""}>Transparent</button></span>`, rst(has(p.bg), "bg"))}
      ${row("Bordure", `<span style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><input type="color" data-c="bc" value="${toHex(p.bc || cs.borderTopColor)}" aria-label="Couleur de bordure">${seg("bw", [["0", "0"], ["1", "1"], ["2", "2"], ["3", "3"], ["5", "5"]], has(p.bw) ? p.bw : "")}</span>`, rst(has(p.bw) || has(p.bc), "bw,bc"))}
      ${row("Arrondi", range("radius", p.radius, 0, 48, 1, " px", parseInt(cs.borderTopLeftRadius) || 0), rst(has(p.radius), "radius"))}
      ${row("Intérieur", range("pad", p.pad, 0, 80, 2, " px", parseInt(cs.paddingTop) || 0), rst(has(p.pad), "pad"))}
      ${row("Espace dessus", range("mt", p.mt, 0, 120, 2, " px", parseInt(cs.marginTop) || 0), rst(has(p.mt), "mt"))}
      ${row("Espace dessous", range("mb", p.mb, 0, 120, 2, " px", parseInt(cs.marginBottom) || 0), rst(has(p.mb), "mb"))}
      ${row("Ombre", seg("shadow", [["none", "Aucune"], ["soft", "Légère"], ["strong", "Forte"]], p.shadow || ""), rst(has(p.shadow), "shadow"))}
    </div>
    <div class="ed-sec"><h4>Disposition</h4>
      <div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" data-a="up">Monter</button><button type="button" data-a="down">Descendre</button><button type="button" data-a="hide">${p.hide ? "Réafficher" : "Masquer"}</button></div>
      ${p.move ? `<p class="ed-help" style="margin:8px 0 0">Déplacé de ${Math.abs(p.move)} place${Math.abs(p.move) > 1 ? "s" : ""} vers le ${p.move < 0 ? "haut" : "bas"}.</p>` : ""}
      ${p.hide ? `<p class="ed-help" style="margin:8px 0 0">Masqué pour les visiteurs. Dans l'éditeur, il reste visible en transparence.</p>` : ""}
    </div>
    <button type="button" data-a="resetel" style="width:100%">Remettre cet élément comme à l'origine</button>`;
  }

  function themeTab() {
    const t = cur().theme; const probe = document.createElement("span"); document.body.appendChild(probe);
    const hex = k => { if (t.vars[k]) return t.vars[k]; probe.style.color = "var(" + k + ")"; return toHex(getComputedStyle(probe).color); };
    const html = `<div class="ed-sec"><h4>Couleurs du site</h4>${VARS.map(([k, l]) => row(l, `<input type="color" data-tv="${k}" value="${hex(k)}" aria-label="${l}">`, rst(t.vars[k], "tv:" + k))).join("")}</div>
    <div class="ed-sec"><h4>Polices</h4>
      <label style="display:block;margin-bottom:8px">Titres<select data-tf="display"><option value="">Police d'origine</option>${FONTS.map(f => `<option${f === t.display ? " selected" : ""}>${f}</option>`).join("")}</select></label>
      <label style="display:block">Texte<select data-tf="body"><option value="">Police d'origine</option>${FONTS.map(f => `<option${f === t.body ? " selected" : ""}>${f}</option>`).join("")}</select></label></div>
    <div class="ed-sec"><h4>Formes et tailles</h4>
      ${row("Arrondi général", `<span class="ed-rng"><input type="range" data-tn="radius" min="0" max="30" value="${H(has(t.radius) ? t.radius : 8)}"><span class="val">${H(has(t.radius) ? t.radius + " px" : "origine")}</span></span>`, rst(has(t.radius), "tn:radius"))}
      ${row("Taille du texte", `<span class="ed-rng"><input type="range" data-tn="size" min="13" max="20" value="${H(t.size || 16)}"><span class="val">${H(t.size ? t.size + " px" : "origine")}</span></span>`, rst(has(t.size), "tn:size"))}</div>
    <div class="ed-sec"><h4>CSS libre (pour aller plus loin)</h4><textarea rows="8" spellcheck="false" data-tcss="1" placeholder="h1 { letter-spacing: 1px; }">${H(t.css || "")}</textarea>
      <div style="margin-top:8px"><button type="button" data-a="applycss">Appliquer le CSS</button></div></div>
    <button type="button" data-a="resettheme" style="width:100%">Revenir à l'apparence d'origine</button>`;
    probe.remove(); return html;
  }

  function listTab() {
    const s = cur(); const ts = Object.keys(s.texts); const es = Object.entries(s.layout.el);
    const pg = { "*": "tout le site", accueil: "accueil", org: "pages ORG", saison: "pages saison", joueur: "pages joueur", orgs: "liste des ORGs", saisons: "liste des saisons", joueurs: "liste des joueurs" };
    return `<div class="ed-sec"><h4>Textes modifiés (${ts.length})</h4>${ts.length ? ts.map((k, i) => `<div class="ed-it"><small>Avant : « ${H(s.texts[k].o || k)} »</small>« ${H(String(s.texts[k].t).replace(/\{\d+\}/g, "…"))} »<div style="margin-top:6px"><button type="button" data-untext="${i}">Texte d'origine</button></div></div>`).join("") : `<p class="ed-help" style="margin:0">Aucun.</p>`}</div>
    <div class="ed-sec"><h4>Éléments modifiés (${es.length})</h4>${es.length ? es.map(([k, e], i) => `<div class="ed-it">${H(e.name || k.split(">").pop())}<small>${H(pg[k.split("|")[0]] || "pages « " + k.split("|")[0] + " »")}${k.includes("#") ? " · seulement celui-ci" : ""} · ${Object.keys(e.p || {}).length} réglage${Object.keys(e.p || {}).length > 1 ? "s" : ""}</small><div style="margin-top:6px"><button type="button" data-unel="${i}">Remettre à l'origine</button></div></div>`).join("") : `<p class="ed-help" style="margin:0">Aucun.</p>`}</div>`;
  }

  function bindPanel() {
    const P = ED.panel, el = ED.sel;
    P.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { ED.tab = b.dataset.tab; drawPanel(); });
    P.querySelectorAll("[data-crumb]").forEach(b => b.onclick = () => select(chainOf(el)[Number(b.dataset.crumb)]));
    P.querySelectorAll("[data-seg]").forEach(b => b.onclick = () => {
      const id = b.dataset.seg, v = b.dataset.v, on = b.classList.contains("on");
      if (id === "mode") { ED.mode = v; document.body.classList.toggle("ed-select", v === "select"); ED.hov = null; drawOverlay(); drawPanel(); return; }
      if (id === "scope") { ED.scope = v; drawPanel(); return; }
      if (id === "italic" || id === "upper") setP(el, { [id]: on ? null : true });
      else setP(el, { [id]: on ? null : v });
    });
    P.querySelectorAll("input[type=range][data-p]").forEach(i => {
      i.oninput = () => { const v = P.querySelector(`[data-val="${i.dataset.p}"]`); if (v) v.textContent = i.value + i.dataset.u; el.style.setProperty({ size: "font-size", ls: "letter-spacing", lh: "line-height", radius: "border-radius", pad: "padding", mt: "margin-top", mb: "margin-bottom" }[i.dataset.p], i.value + (i.dataset.p === "lh" ? "" : "px"), "important"); };
      i.onchange = () => setP(el, { [i.dataset.p]: Number(i.value) });
    });
    P.querySelectorAll("input[type=color][data-c]").forEach(i => {
      i.oninput = () => { const pr = { color: "color", bg: "background", bc: "border-color" }[i.dataset.c]; el.style.setProperty(pr, i.value, "important"); };
      i.onchange = () => setP(el, Object.assign({ [i.dataset.c]: i.value }, i.dataset.c === "bc" && !has(getP(el).bw) ? { bw: "1" } : {}));
    });
    P.querySelectorAll("[data-reset]").forEach(b => b.onclick = () => {
      const r = b.dataset.reset;
      if (r.startsWith("tv:")) { snapshot(); delete draft().theme.vars[r.slice(3)]; commit(); return; }
      if (r.startsWith("tn:")) { snapshot(); delete draft().theme[r.slice(3)]; commit(); return; }
      const patch = {}; r.split(",").forEach(k => patch[k] = null); setP(el, patch);
    });
    P.querySelectorAll("[data-font]").forEach(b => b.onclick = () => { ED.fontsOpen = false; ED.fontsAll = false; setP(el, { font: b.dataset.font }); });
    P.querySelectorAll("[data-a]").forEach(b => b.onclick = () => {
      const a = b.dataset.a;
      if (a === "quit") return stop();
      if (a === "undo") return undo();
      if (a === "publish") return publish();
      if (a === "discard") return discard();
      if (a === "fonts") { ED.fontsOpen = !ED.fontsOpen; ED.fontsAll = ED.fontsOpen; applyAll(); drawPanel(); return; }
      if (a === "bgnone") return setP(el, { bg: getP(el).bg === "none" ? null : "none" });
      if (a === "up" || a === "down") return setP(el, { move: (getP(el).move || 0) + (a === "up" ? -1 : 1) });
      if (a === "hide") return setP(el, { hide: getP(el).hide ? null : true });
      if (a === "resetel") { snapshot(); delete draft().layout.el[elKey(el, ED.scope)]; document.querySelectorAll("[data-ed-mv]").forEach(x => delete x.dataset.edMv); commit(); return; }
      if (a === "savetext" || a === "resettext") {
        const tn = mainText(el); if (!tn) return;
        const original = (ORIG.get(tn) || {}).o || tn.nodeValue; const k = keyOf(original);
        if (a === "savetext") {
          const val = P.querySelector("[data-text]").value.replace(/\s+/g, " ").trim();
          if (!val) { toast("Le texte ne peut pas être vide.", true); return; }
          const nums = original.match(NUM) || []; let tpl = val;
          nums.forEach((m, i) => { const j = tpl.indexOf(m); if (j >= 0) tpl = tpl.slice(0, j) + "{" + i + "}" + tpl.slice(j + m.length); });
          snapshot(); draft().texts[k] = { t: tpl, o: original.trim() };
        } else { snapshot(); delete draft().texts[k]; }
        resetDom(); commit(); return;
      }
      if (a === "applycss") { snapshot(); draft().theme.css = P.querySelector("[data-tcss]").value; commit(); return; }
      if (a === "resettheme") { if (!window.confirm("Revenir à l'apparence d'origine (couleurs, polices, CSS) ?")) return; snapshot(); draft().theme = { vars: {} }; commit(); return; }
    });
    P.querySelectorAll("[data-tv]").forEach(i => { i.oninput = () => { const t = clone(cur().theme); t.vars[i.dataset.tv] = i.value; applyTheme(t); }; i.onchange = () => { snapshot(); draft().theme.vars[i.dataset.tv] = i.value; commit(); }; });
    P.querySelectorAll("[data-tf]").forEach(s => s.onchange = () => { snapshot(); if (s.value) draft().theme[s.dataset.tf] = s.value; else delete draft().theme[s.dataset.tf]; commit(); });
    P.querySelectorAll("[data-tn]").forEach(i => { i.oninput = () => { i.nextElementSibling.textContent = i.value + " px"; const t = clone(cur().theme); t[i.dataset.tn] = i.value; applyTheme(t); }; i.onchange = () => { snapshot(); draft().theme[i.dataset.tn] = i.value; commit(); }; });
    P.querySelectorAll("[data-untext]").forEach(b => b.onclick = () => { snapshot(); delete draft().texts[Object.keys(cur().texts)[Number(b.dataset.untext)]]; resetDom(); commit(); });
    P.querySelectorAll("[data-unel]").forEach(b => b.onclick = () => { snapshot(); delete draft().layout.el[Object.keys(cur().layout.el)[Number(b.dataset.unel)]]; document.querySelectorAll("[data-ed-mv]").forEach(x => delete x.dataset.edMv); commit(); });
  }

  function start() {
    if (!isAdmin()) { toast("Réservé aux admins.", true); return; }
    ED.on = true; try { sessionStorage.setItem("oc-edit", "1"); } catch (e) {}
    css(); document.body.classList.add("ed-open"); document.body.classList.toggle("ed-select", ED.mode === "select");
    applyAll(); drawPanel(); drawOverlay();
  }
  function stop() {
    ED.on = false; try { sessionStorage.removeItem("oc-edit"); } catch (e) {}
    document.body.classList.remove("ed-open", "ed-select");
    [ED.panel, ED.ov, ED.hovBox].forEach(x => x && x.remove()); ED.panel = ED.ov = ED.hovBox = null; ED.sel = null;
    applyAll();
    if (changed()) toast("Tes modifications restent en brouillon. Reviens dans l'éditeur pour les publier.");
  }
  window.OCEdit = { start, stop, resume: () => { applyAll(); if (ED.on && isAdmin() && !ED.panel) start(); } };
})();
