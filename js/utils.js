// VTC Rentable — Dates et formats
"use strict";

// ================= DATES =================
const pad = n => String(n).padStart(2, "0");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const monday = d => addDays(d, -((d.getDay() + 6) % 7));
const todayIso = () => iso(new Date());
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const SHORT = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
// Numéro de semaine (lundi → dimanche) dans le mois.
// Jusqu'au 25/10/2026 : la semaine appartient au mois de son dimanche (historique gardé tel quel).
// Depuis la semaine du 26/10/2026 : elle appartient au mois où tombent la majorité de ses jours (celui de son jeudi),
// ex. 26/10 → 01/11 = dernière semaine d'octobre (S5), et la semaine suivante = novembre S1.
const WEEK_RULE_CHANGE = "2026-11-01"; // premier dimanche concerné par la nouvelle règle
function weekKeyOf(d) {
  const mon = monday(d), sun = addDays(mon, 6);
  if (iso(sun) < WEEK_RULE_CHANGE) return { y: sun.getFullYear(), m: sun.getMonth() + 1, s: Math.ceil(sun.getDate() / 7), mon, sun };
  const thu = addDays(mon, 3);
  return { y: thu.getFullYear(), m: thu.getMonth() + 1, s: Math.ceil(thu.getDate() / 7), mon, sun };
}
const weekId = k => `${k.y}-${pad(k.m)}-S${k.s}`;

// ================= FORMAT =================
const eur = n => (Math.round(n * 100) / 100).toLocaleString("fr-FR", { minimumFractionDigits: Math.round(n * 100) % 100 ? 2 : 0, maximumFractionDigits: 2 }) + " €";
const eur0 = n => Math.round(n).toLocaleString("fr-FR") + " €";
const parse = s => Number(String(s).replace(/[\s  €]/g, "").replace(",", "."));
const r2 = n => Math.round(n * 100) / 100;
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const $ = id => document.getElementById(id);
