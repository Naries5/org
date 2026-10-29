// Fonctions partagées pour les aperçus de liens (Discord, réseaux…). Lecture seule, clé publique.
const SB = "https://czfgpgvkpxhmxyepvgzs.supabase.co";
const KEY = "sb_publishable_3ubRuFBO_tVucgZYsHqG2w_AE11ccRW";
async function q(path) {
  try {
    const r = await fetch(SB + "/rest/v1/" + path, { headers: { apikey: KEY, Authorization: "Bearer " + KEY } });
    if (!r.ok) return [];
    return await r.json();
  } catch (e) { return []; }
}
const enc = encodeURIComponent;
function roman(n) { n = Math.floor(Number(n)); if (!n || n < 1 || n > 3999) return String(n || "?"); const m = [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]]; let r = ""; m.forEach(([v, l]) => { while (n >= v) { r += l; n -= v; } }); return r; }
function seasonName(s, o) {
  o = o || {};
  const word = (o.seasonWord == null ? "Saison" : String(o.seasonWord)).trim();
  const num = o.numbering === "roman" ? roman(s.number) : (s.number || "?");
  const short = (s.customName && String(s.customName).trim()) || ((word ? word + " " : "") + num);
  return short + (s.title ? " : " + s.title : "");
}
const MOIS = ["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
function fmtDate(d) { const m = String(d || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? Number(m[3]) + " " + MOIS[Number(m[2]) - 1] + " " + m[1] : ""; }
function dates(s) { if (s.start && s.end) return fmtDate(s.start) + " → " + fmtDate(s.end); if (s.start) return "Depuis le " + fmtDate(s.start); return s.period || ""; }
function esc(t) { return String(t == null ? "" : t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }
function pLabel(p) { return p ? p.pseudo + (p.precision ? " (" + p.precision + ")" : "") : "?"; }
module.exports = { q, enc, seasonName, dates, esc, pLabel };
