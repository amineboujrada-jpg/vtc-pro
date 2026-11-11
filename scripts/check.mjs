// Vérifications automatiques avant publication : node scripts/check.mjs
// - chaque fichier js est valide ;
// - index.html, sw.js et les dossiers css/ et js/ citent les mêmes fichiers ;
// - le numéro technique est le même dans sw.js et js/db.js.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

const errors = [];
const read = f => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const html = read("index.html"), sw = read("sw.js"), db = read("js/db.js");

const scripts = [...html.matchAll(/<script src="(js\/[^"]+)"/g)].map(m => m[1]);
const styles = [...html.matchAll(/<link rel="stylesheet" href="(css\/[^"]+)"/g)].map(m => m[1]);
const onDisk = [...readdirSync(new URL("../js", import.meta.url)).map(f => "js/" + f), ...readdirSync(new URL("../css", import.meta.url)).map(f => "css/" + f)];
const cached = [...sw.matchAll(/"\.\/((?:js|css)\/[^"]+)"/g)].map(m => m[1]);

for (const f of [...scripts, ...styles]) {
  if (!existsSync(new URL("../" + f, import.meta.url))) errors.push(`index.html cite ${f}, fichier introuvable`);
  if (!cached.includes(f)) errors.push(`${f} manque dans la liste FILES de sw.js (l'appli ne marcherait plus hors ligne)`);
}
for (const f of onDisk) if (![...scripts, ...styles].includes(f)) errors.push(`${f} existe mais n'est pas chargé par index.html`);
for (const f of cached) if (!onDisk.includes(f)) errors.push(`sw.js cite ${f}, fichier introuvable`);
if (scripts.at(-1) !== "js/main.js") errors.push("js/main.js doit être le dernier script chargé");

for (const f of ["sw.js", ...scripts]) {
  try { execFileSync(process.execPath, ["--check", new URL("../" + f, import.meta.url).pathname], { stdio: "pipe" }); }
  catch (e) { errors.push(`erreur de syntaxe dans ${f} : ${String(e.stderr).split("\n").slice(0, 4).join(" ")}`); }
}

const vSw = (sw.match(/const VERSION = "([^"]+)"/) || [])[1];
const vApp = (db.match(/const APP_VERSION = "([^"]+)"/) || [])[1];
const label = (db.match(/const APP_LABEL = "([^"]+)"/) || [])[1];
if (!vSw || vSw !== vApp) errors.push(`VERSION de sw.js (${vSw}) différent de APP_VERSION de js/db.js (${vApp})`);
if (!/^1\.\d{2,}$/.test(label || "")) errors.push(`APP_LABEL inattendu : ${label}`);

if (errors.length) { console.error("Vérifications en échec :\n- " + errors.join("\n- ")); process.exit(1); }
console.log(`OK : ${scripts.length} scripts, version ${label} (${vSw})`);
