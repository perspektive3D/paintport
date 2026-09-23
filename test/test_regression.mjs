// Portable Core-Regressionen mit synthetischen Mini-3MFs (keine MakerWorld-Fixture nötig).
// Aufruf: node test_regression.mjs [paintport.html]   — Exit 1 bei Fehlschlag.
// Entstanden aus dem Audit 21.09.2026 (v0.8.4): Prusa-Import-Crash, Einheiten, printable,
// Prozent-Statistik, Namens-/Farb-Härtung.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const htmlPath = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), "paintport.html");
const html = readFileSync(htmlPath, "utf8");
(0, eval)(html.split("/*CORE-START*/")[1].split("/*CORE-END*/")[0]);
const C = globalThis.PaintPortCore;
const enc = new TextEncoder(), dec = new TextDecoder();

let failed = 0;
const check = (ok, label) => { console.log((ok ? "  ok   " : "  FAIL ") + label); if (!ok) failed++; };

// tris: Array von Paint-Attribut-Strings (eins je Dreieck, alle auf denselben 3 Vertices)
const xml = ({ tris = ['paint_color="4"'], unit = 'unit="millimeter"', printable = "1", name = "reg" } = {}) =>
  `<?xml version="1.0"?><model ${unit} xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:slic3rpe="http://schemas.slic3r.org/3mf/2017/06"><resources><object id="1" type="model" name="${name}"><mesh><vertices><vertex x="0" y="0" z="0"/><vertex x="1" y="0" z="0"/><vertex x="0" y="1" z="0"/></vertices><triangles>${tris.map((p) => `<triangle v1="0" v2="1" v3="2" ${p}/>`).join("")}</triangles></mesh></object></resources><build><item objectid="1" printable="${printable}"/></build></model>`;
const COLORS = { name: "Metadata/project_settings.config", data: enc.encode(JSON.stringify({ filament_colour: ["#FF0000", "#00FF00"] })) };
const load = async (opts, extra = [COLORS]) =>
  C.load3MF(await C.zipAll([{ name: "3D/3dmodel.model", data: enc.encode(xml(opts)) }, ...extra]));
const modelXml = (built) => dec.decode(built.entries.find((e) => e.name === "3D/3dmodel.model").data);
const plan = (target, stateMap, virtuals = []) => ({
  target, stateMap: new Map(stateMap), virtuals,
  physical: [{ slot: 1, color: "#FF0000" }, { slot: 2, color: "#00FF00" }],
  title: "reg", date: "2026-01-01",
  ...(target === "bambu" ? { bbsApp: "BambuStudio-02.07.01.62", mixFormat: "bambu" } : {}),
});

console.log("1) Prusa-Import (mmu_segmentation) — v0.8.3: ReferenceError sawMmuSeg");
{
  let m = null, err = null;
  try { m = await load({ tris: ['slic3rpe:mmu_segmentation="4"', 'slic3rpe:mmu_segmentation="8"'] }); } catch (e) { err = e; }
  check(!err, "lädt ohne Fehler" + (err ? ` (${err})` : ""));
  check(m && m.paintDialect === "prusa", "Dialekt = prusa");
  check(m && m.usedExtruders.join() === "1,2", "States 1,2 erkannt");
  const b = await load();
  check(b.paintDialect === "bbs", "paint_color-Quelle bleibt Dialekt bbs");
}

console.log("2) Export → Re-Import (Prusa-Ziel, inkl. State ≥ 17)");
{
  const src = await load({ tris: ['paint_color="4"', 'paint_color="8"'] });
  // Filament 2 → virtueller Extruder 20: oberhalb der 16er-Grenze, dort trennen sich die Dialekte
  const built = C.build3MF(src, plan("prusa", [[1, 1], [2, 20]],
    [{ id: 20, color: "#808000", components: [{ extruder: 1, ratio: 1 }, { extruder: 2, ratio: 1 }] }]));
  check(modelXml(built).includes("mmu_segmentation"), "Export trägt mmu_segmentation");
  let re = null, err = null;
  try { re = await C.load3MF(await C.zipAll(built.entries)); } catch (e) { err = e; }
  check(!err, "Re-Import lädt" + (err ? ` (${err})` : ""));
  check(re && re.paintDialect === "prusa" && re.usedExtruders.join() === "1,20", "States 1 + 20 kommen zurück");
}

console.log("3) Einheiten");
{
  let err = null;
  try { await load({ unit: 'unit="inch"' }); } catch (e) { err = e; }
  check(err && err.code === "ERR_UNIT", "inch wird mit ERR_UNIT abgelehnt (keine stille Umskalierung)");
  let ok = true;
  try { await load({ unit: "" }); } catch (e) { ok = false; }
  check(ok, "fehlendes unit-Attribut = millimeter (3MF-Default)");
}

console.log("4) printable bleibt erhalten");
for (const target of ["prusa", "bambu"]) {
  const off = await load({ printable: "0" });
  check(/<item\b[^>]*printable="0"/.test(modelXml(C.build3MF(off, plan(target, [[1, 1]])))), `${target}: printable="0" durchgereicht`);
  const on = await load();
  check(/<item\b[^>]*printable="1"/.test(modelXml(C.build3MF(on, plan(target, [[1, 1]])))), `${target}: Normalfall printable="1"`);
}

console.log("5) Statistik-Anteile (Audit: 200 %)");
{
  const split = C.emitPaintTree({ splitSides: 1, special: 0, children: [{ state: 1 }, { state: 2 }] }, "bbs");
  const m = await load({ tris: [`paint_color="${split}"`, "", 'paint_color="4"'] });
  const f1 = m.filaments[0], f2 = m.filaments[1];
  check(m.totalTris === 3, "3 Mesh-Dreiecke");
  check(Math.abs(f1.paintedShare - 1.5) < 1e-9 && Math.abs(f2.paintedShare - 0.5) < 1e-9, "Anteile 1,5 / 0,5 Dreiecks-Äquivalente");
  const sum = m.filaments.reduce((a, f) => a + f.paintedShare + f.baseShare, 0);
  check(Math.abs(sum - m.totalTris) < 1e-9, "Summe aller Anteile = Gesamt-Dreiecke (nie > 100 %)");
  check(f1.paintedTris === 2, "paintedTris bleibt Leaf-Zählung (Slicer-Histogramm-Abgleich)");
}

console.log("6) Härtung Dateiinhalte");
{
  const inj = '<img src=x onerror=alert(1)>';
  const ms = { name: "Metadata/model_settings.config", data: enc.encode(`<config><object id="1"><metadata key="name" value="${inj}"/></object></config>`) };
  const ps = { name: "Metadata/project_settings.config", data: enc.encode(JSON.stringify({ filament_colour: ['"><b>x', "#12ab34"] })) };
  const m = await load({}, [ms, ps]);
  check(/^#[0-9A-F]{6}$/.test(m.filaments[0].color), "Nicht-Hex-Farbe wird neutralisiert");
  check(m.filaments[1].color === "#12AB34", "gültige Farbe unverändert");
  // Der Core reicht Namen roh durch (Export escaped per xmlEscape) — die UI MUSS esc() nutzen:
  check(/\$\{esc\(o\.name\)\}/.test(html) && !/\$\{o\.name\}/.test(html), "UI gibt Objektnamen nur über esc() aus");
  check(!modelXml(C.build3MF(m, plan("prusa", [[1, 1]]))).includes("<img"), "Export escaped den Namen");
}

console.log("7) UI-Verdrahtung (statisch)");
check(/\$\("allowMix"\)\.addEventListener\("change"/.test(html), "allowMix hat Change-Handler");
check(/allowMix"\)\.checked\) throw/.test(html), "Export-Invariante: ColorMix aus ⇒ kein Mix");

console.log(failed ? `\n${failed} FEHLGESCHLAGEN` : "\nRegression OK");
process.exit(failed ? 1 : 0);
