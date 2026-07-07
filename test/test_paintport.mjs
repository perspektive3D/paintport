// Headless-Test des PaintPort-Cores gegen echte Dateien
import { readFileSync, writeFileSync } from "node:fs";

const html = readFileSync(process.argv[2], "utf8");
const core = html.split("/*CORE-START*/")[1].split("/*CORE-END*/")[0];
(0, eval)(core); // definiert globalThis.PaintPortCore
const FW = globalThis.PaintPortCore;

const input = process.argv[3];
const output = process.argv[4];
const mode = process.argv[5] || "identity"; // identity | swap12 | virtual

const bytes = new Uint8Array(readFileSync(input));
const model = await FW.load3MF(bytes);

console.log("Objekte:", model.objects.map(o => `${o.name} (Basis-Ext ${o.defaultExtruder}, ${o.tris.length / 3} Tris)`).join(" | "));
console.log("Filamente:", model.filaments.map(f => `${f.index}:${f.color} painted=${f.paintedTris} base=${f.baseTris}`).join("  "));
console.log("Part-Ranges:", model.objects.map(o => o.parts.map(p => `${p.firstTri}+${p.triCount}→Ext${p.extruder}${p.type !== "ModelPart" ? "(" + p.type + ")" : ""}`).join(" ")).join(" | "));
if (model.specialVolumes) console.log("Spezial-Volumes (negativ/modifier/support):", model.specialVolumes);
console.log("Unbemalt:", model.unpainted, "/ Gesamt:", model.totalTris, "· benutzte Extruder-States:", model.usedExtruders.join(","));

// Selbsttest: Painting-Strings roundtrippen (parse→emit muss Original ergeben)
let checked = 0, mismatches = 0;
for (const o of model.objects) {
  for (const p of o.paints) {
    if (!p) continue;
    const rt = FW.emitPaintTree(FW.parsePaintTree(p));
    if (rt !== p) { mismatches++; if (mismatches < 5) console.log("MISMATCH:", p, "→", rt); }
    checked++;
  }
}
console.log(`Paint-String-Roundtrip: ${checked} geprüft, ${mismatches} Abweichungen`);

// topMixes-Sanity (Kandidatenliste für die Mapping-UI)
{
  const slots5 = [{ slot: 1, color: "#FFFFFF" }, { slot: 2, color: "#000000" }, { slot: 3, color: "#00FFFF" }, { slot: 4, color: "#FF00FF" }, { slot: 5, color: "#FFFF00" }];
  const tm = FW.topMixes("#0000FF", slots5, 6);
  const sorted = tm.every((m, i, a) => !i || a[i - 1].deltaE <= m.deltaE);
  const dedup = new Set(tm.map((m) => m.predicted)).size === tm.length;
  const bm = JSON.stringify(FW.bestMix("#0000FF", slots5)) === JSON.stringify(tm[0]);
  console.log(`topMixes: n=${tm.length} sortiert=${sorted} dedupe=${dedup} best==top0=${bm}`);
  if (!(tm.length === 6 && sorted && dedup && bm)) { console.error("topMixes-Check FEHLGESCHLAGEN"); process.exit(1); }
}

// Mapping-Plan je nach Modus
const n = model.filaments.length;
const stateMap = new Map();
let virtuals = [];
if (mode === "identity") {
  for (let i = 1; i <= n; i++) stateMap.set(i, i);
} else if (mode === "swap12") {
  stateMap.set(1, 2); stateMap.set(2, 1);
  for (let i = 3; i <= n; i++) stateMap.set(i, i);
} else if (mode === "virtual") {
  // Wie Drucker mit 8 physischen Extrudern (INDX 8T): Filament n → virtueller Extruder id 9
  const PRINTER = 8;
  for (let i = 1; i < n; i++) stateMap.set(i, i);
  stateMap.set(n, PRINTER + 1);
  virtuals = [{ id: PRINTER + 1, color: "#888888", components: [{ extruder: 1, ratio: 1 }, { extruder: 2, ratio: 1 }] }];
}

const PHYS_N = mode === "virtual" ? 8 : n;
const plan = {
  stateMap,
  physical: Array.from({ length: PHYS_N }, (_, i) => ({ slot: i + 1, color: model.filaments[i] ? model.filaments[i].color : "#808080" })),
  virtuals,
  title: "PaintPort Test",
  date: "2026-07-05",
};
const t0 = Date.now();
const { entries, mmVersion, maxState } = FW.buildPrusa3MF(model, plan);
const zip = await FW.zipAll(entries);
writeFileSync(output, zip);
console.log(`Export (${mode}): ${output} · ${(zip.length / 1e6).toFixed(1)} MB · MmPaintingVersion=${mmVersion} · maxState=${maxState} · ${Date.now() - t0} ms`);

// Erwartete Statistik nach Remap ausgeben (für Vergleich mit PrusaSlicer-Roundtrip)
const counter = new Map();
for (const o of model.objects) for (const p of o.paints) if (p) FW.collectStates(p, counter);
counter.delete(0);
const remapped = new Map();
for (const [s, c] of counter) {
  const d = stateMap.get(s) ?? s;
  remapped.set(d, (remapped.get(d) || 0) + c);
}
console.log("Erwartete Leaf-Statistik nach Remap:", [...remapped.entries()].sort((a, b) => a[0] - b[0]).map(([s, c]) => `Ext${s}=${c}`).join("  "));
