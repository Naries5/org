/* Essai de palettes : uniquement sur les sites de test (aperçus Vercel), jamais sur orgcentral.fr */
(function () {
  if (/(^|\.)orgcentral\.fr$/.test(location.hostname)) return;
  const P = {
    origine: null,
    graphite: { "--bg": "#1E1F22", "--surface": "#2B2D31", "--surface-2": "#313338", "--line": "#41434A", "--line-soft": "#35373C", "--ink": "#F2F3F5", "--muted": "#B5BAC1", "--t1": "#F0B232", "--t2": "#E8704A", "--accent-ink": "#1E1F22", "--out": "#111214", "--live": "#F2545B", "--done": "#B5BAC1", "--gold": "#F0B232" },
    nuit: { "--bg": "#0F1720", "--surface": "#16212C", "--surface-2": "#1D2A37", "--line": "#2E4053", "--line-soft": "#243444", "--ink": "#EEF2F6", "--muted": "#A9B6C3", "--t1": "#FFB547", "--t2": "#5AB0FF", "--accent-ink": "#0F1720", "--out": "#090E14", "--live": "#FF6B6B", "--done": "#A9B6C3", "--gold": "#FFB547" },
    charbon: { "--bg": "#181614", "--surface": "#221F1C", "--surface-2": "#2B2723", "--line": "#3D3732", "--line-soft": "#312C28", "--ink": "#F4EFE8", "--muted": "#BDB3A7", "--t1": "#E9A23B", "--t2": "#D9603B", "--accent-ink": "#181614", "--out": "#0F0E0D", "--live": "#E85D4A", "--done": "#BDB3A7", "--gold": "#E9A23B" },
    vert: { "--bg": "#121A17", "--surface": "#19231F", "--surface-2": "#202C27", "--line": "#33433B", "--line-soft": "#28362F", "--ink": "#EEF3EF", "--muted": "#A8B8AE", "--t1": "#E8C547", "--t2": "#4FB286", "--accent-ink": "#121A17", "--out": "#0A100D", "--live": "#E8604C", "--done": "#A8B8AE", "--gold": "#E8C547" }
  };
  const NAMES = { origine: "Actuelle (violet)", graphite: "Graphite (façon Discord)", nuit: "Nuit bleue", charbon: "Charbon chaud", vert: "Vert forêt" };
  let cur = "origine"; try { cur = localStorage.getItem("oc-pal-test") || "graphite"; } catch (e) {}
  const st = document.createElement("style"); st.id = "oc-pal-test"; document.head.appendChild(st);
  function apply(k) {
    cur = k; try { localStorage.setItem("oc-pal-test", k); } catch (e) {}
    const v = P[k];
    st.textContent = v ? ":root{" + Object.entries(v).map(([a, b]) => a + ":" + b + "!important").join(";") + ";--accent:var(--t1)!important}" : "";
    if (box) box.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.k === k ? "true" : "false"));
  }
  let box = null;
  function ui() {
    box = document.createElement("div"); box.className = "ed-ui";
    box.style.cssText = "position:fixed;left:12px;bottom:12px;z-index:4000;background:#fff;color:#1f1d1a;border:1px solid #cfc8b8;border-radius:10px;padding:10px;font:13px system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.3);max-width:230px";
    box.innerHTML = '<b style="display:block;margin-bottom:6px">Palette (site de test)</b>' + Object.keys(P).map(k => `<button type="button" data-k="${k}" style="display:flex;align-items:center;gap:8px;width:100%;text-align:left;margin:3px 0;padding:6px 8px;border:1px solid #ddd;border-radius:7px;background:#fff;color:#1f1d1a;cursor:pointer;font:inherit">${P[k] ? `<i style="width:14px;height:14px;border-radius:3px;background:${P[k]["--bg"]};box-shadow:inset 0 0 0 4px ${P[k]["--t1"]}"></i>` : '<i style="width:14px;height:14px;border-radius:3px;background:#160C13;box-shadow:inset 0 0 0 4px #FF4D6D"></i>'}${NAMES[k]}</button>`).join("");
    box.querySelectorAll("button").forEach(b => b.onclick = () => apply(b.dataset.k));
    document.body.appendChild(box);
    const s = document.createElement("style"); s.textContent = '#oc-pal-test~x{}[aria-pressed="true"]{border-color:#1f1d1a!important;font-weight:700}'; document.head.appendChild(s);
  }
  apply(cur);
  if (document.body) ui(); else document.addEventListener("DOMContentLoaded", () => { ui(); apply(cur); });
})();
