// Headless-Test des PaintPort-Cores gegen echte Dateien
import { readFileSync, writeFileSync } from "node:fs";

const html = readFileSync(process.argv[2], "utf8");
const core = html.split("/*CORE-START*/")[1].split("/*CORE-END*/")[0];
(0, eval)(core); // definiert globalThis.PaintPortCore
const FW = globalThis.PaintPortCore;

const input = process.argv[3];
const output = process.argv[4];
const mode = process.argv[5] || "identity"; // identity | swap12 | virtual
const target = process.argv[6] || "prusa"; // prusa | bambu | snapmaker (bbs-Flavor, je eigenes Mix-Format)
const bbsApp = process.argv[7]; // optional: Application-String, z.B. BambuStudio-02.07.01.62

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
  // bbs-Ziele: zusätzlich ein 3-Komponenten-Mix (1:1:1) für g/w- bzw. Ratio-Kodierung
  if (target !== "prusa") virtuals.push({ id: PRINTER + 2, color: "#777777", components: [{ extruder: 1, ratio: 1 }, { extruder: 2, ratio: 1 }, { extruder: 3, ratio: 1 }] });
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
const { entries, mmVersion, maxState } = target === "prusa"
  ? FW.buildPrusa3MF(model, plan) // Legacy-Alias muss weiter funktionieren (Release-Gate nutzt ihn)
  : FW.build3MF(model, { ...plan, target: "bambu", mixFormat: target === "snapmaker" ? "snapmaker" : "bambu", ...(bbsApp ? { bbsApp } : {}) });
const zip = await FW.zipAll(entries);
writeFileSync(output, zip);
console.log(`Export (${mode}/${target}): ${output} · ${(zip.length / 1e6).toFixed(1)} MB · MmPaintingVersion=${mmVersion} · maxState=${maxState} · ${Date.now() - t0} ms`);

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

// ============================================================
// bbs-Flavor-Assertions (Stufe 1, PLAN.md + RESEARCH_bbs-colormix.md §10)
// ============================================================
if (target !== "prusa") {
  let fails = 0;
  const check = (ok, label) => { console.log(`  ${ok ? "OK " : "FAIL"} ${label}`); if (!ok) fails++; };
  const td = new TextDecoder();
  const byName = new Map(entries.map((e) => [e.name, td.decode(e.data)]));
  const names = [...byName.keys()];
  console.log("bbs-Assertions:");

  // Dateiliste: model_settings statt Slic3r_PE_model, Minimal-project_settings statt full_spectrum
  check(names.includes("Metadata/model_settings.config"), "model_settings.config vorhanden");
  check(!names.includes("Metadata/Slic3r_PE_model.config"), "kein Slic3r_PE_model.config");
  check(!names.some((n) => n.includes("full_spectrum")), "kein full_spectrum.json");
  check(names.includes("Metadata/project_settings.config"), "Minimal-project_settings.config vorhanden");
  {
    const ps = JSON.parse(byName.get("Metadata/project_settings.config"));
    // Bambu-Mixe sind zusätzliche Slots derselben Liste → filament_colour enthält dann
    // auch die Vorhersagefarben; Snapmaker-Mixe leben nur im Definitions-String.
    const wantColors = plan.physical.map((p) => p.color)
      .concat(target === "bambu" && virtuals.length ? virtuals.map((v) => v.color) : []);
    check(Array.isArray(ps.filament_colour) && ps.filament_colour.length === wantColors.length &&
      ps.filament_colour.every((c, i) => c === wantColors[i]), `filament_colour == Slot-(+Mix-)Farben (${ps.filament_colour.length})`);
    check(typeof ps.version === "string" && ps.version.length > 0 && !ps.version.startsWith("BambuStudio"), `version-Key gesetzt (${ps.version})`);
    check(Object.keys(ps).length <= (target === "bambu" && virtuals.length ? 11 : 4), `Config minimal (${Object.keys(ps).length} Keys)`);
    if (target === "snapmaker" && virtuals.length) {
      // Serialisierung nach MixedFilament.cpp v2.3.5 (2er: m2+percent, 3er: g/w+m0, cm0)
      const expect = "1,2,1,1,50,0,g,w,m2,z0,xa0,xb0,d0,o0,u1,cm0;1,2,1,1,50,0,g1/2/3,w1/1/1,m0,z0,xa0,xb0,d0,o0,u2,cm0";
      check(ps.mixed_filament_definitions === expect, `mixed_filament_definitions korrekt (${ps.mixed_filament_definitions || "FEHLT"})`);
    } else if (target === "bambu" && virtuals.length) {
      const P = plan.physical.length;
      const pad0 = Array(P).fill("0"), padE = Array(P).fill("");
      const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      check(eq(ps.filament_is_mixed, [...pad0, "1", "1"]), `filament_is_mixed (${JSON.stringify(ps.filament_is_mixed)})`);
      check(eq(ps.filament_mixed_components, [...padE, "1,2", "1,2,3"]), `filament_mixed_components (${JSON.stringify(ps.filament_mixed_components)})`);
      check(eq(ps.filament_mixed_sublayer_ratios, [...padE, "0.5000,0.5000", "0.3333,0.3333,0.3334"]), `filament_mixed_sublayer_ratios (${JSON.stringify(ps.filament_mixed_sublayer_ratios)})`);
      check(eq(ps.filament_mixed_gradient, [...pad0, "0", "0"]) && eq(ps.filament_mixed_gradient_per_part, [...pad0, "0", "0"]) &&
        eq(ps.filament_mixed_gradient_curve, [...padE, "", ""]) && eq(ps.filament_mixed_gradient_range, [...padE, "", ""]), "Gradient-Arrays leer/aus");
      check(!("enable_mixed_color_sublayer" in ps), "enable_mixed_color_sublayer nicht gesetzt (Prozess-Key)");
    } else {
      check(!Object.keys(ps).some((k) => k.includes("mixed")), "keine mixed_*-Keys ohne ColorMix-Zuordnung");
    }
  }
  // bbsApp-Override: Application-String + version-Key folgen dem Ziel
  {
    const o = FW.build3MF(model, { ...plan, virtuals: [], target: "bambu", bbsApp: "BambuStudio-02.07.01.62" });
    const oXml = td.decode(o.entries.find((e) => e.name === "3D/3dmodel.model").data);
    const oPs = JSON.parse(td.decode(o.entries.find((e) => e.name === "Metadata/project_settings.config").data));
    check(oXml.includes('<metadata name="Application">BambuStudio-02.07.01.62</metadata>') && oPs.version === "02.07.01.62",
      "bbsApp-Override wirkt (Application + version)");
  }

  // Header: BambuStudio-Marker, kein Prusa-Namespace, keine MmPaintingVersion (Import-Fehler ab >0!)
  const xml = byName.get("3D/3dmodel.model");
  check(xml.includes('xmlns:BambuStudio="http://schemas.bambulab.com/package/2021"'), "xmlns:BambuStudio");
  check(/<metadata name="Application">BambuStudio-/.test(xml), "Application=BambuStudio-*");
  check(xml.includes('<metadata name="BambuStudio:3mfVersion">1</metadata>'), "BambuStudio:3mfVersion=1");
  check(xml.includes("PaintPort"), "Generator=PaintPort");
  check(!xml.includes("xmlns:slic3rpe"), "kein xmlns:slic3rpe");
  check(!xml.includes("slic3rpe:Version3mf"), "kein slic3rpe:Version3mf");
  check(!xml.includes("MmPaintingVersion"), "keine MmPaintingVersion-Metadata");
  check(!xml.includes("mmu_segmentation"), "kein mmu_segmentation-Attribut");

  // Paint-All: jedes ModelPart-Dreieck trägt paint_color; Spezial-Volumes bleiben unbemalt.
  // Erwartete Leaf-Statistik: bemalte Dreiecke remappt + unbemalte ModelPart-Dreiecke auf
  // den gemappten Part-Extruder (State-0-Leafs in Split-Bäumen bleiben → Part-extruder-Key).
  let expModelPartTris = 0;
  const expLeaf = new Map();
  const bump = (s, c) => expLeaf.set(s, (expLeaf.get(s) || 0) + c);
  for (const o of model.objects) {
    const parts = (o.parts && o.parts.length) ? o.parts : [{ firstTri: 0, triCount: o.tris.length / 3, extruder: o.defaultExtruder, type: "ModelPart" }];
    for (const p of parts) {
      const type = p.type || "ModelPart";
      if (type !== "ModelPart") continue;
      expModelPartTris += p.triCount;
      for (let i = p.firstTri; i < p.firstTri + p.triCount; i++) {
        if (o.paints[i]) {
          const cnt = new Map();
          FW.collectStates(o.paints[i], cnt);
          for (const [s, c] of cnt) if (s !== 0) bump(stateMap.get(s) ?? s, c);
        } else {
          bump(stateMap.get(p.extruder) ?? p.extruder, 1);
        }
      }
    }
  }
  const gotLeaf = new Map();
  for (const m of xml.matchAll(/paint_color="([0-9A-F]+)"/g)) FW.collectStates(m[1], gotLeaf);
  gotLeaf.delete(0);
  const paintCount = (xml.match(/paint_color="/g) || []).length;
  check(paintCount === expModelPartTris, `Paint-All: ${paintCount}/${expModelPartTris} ModelPart-Dreiecke bemalt`);
  const leafOk = expLeaf.size === gotLeaf.size && [...expLeaf].every(([s, c]) => gotLeaf.get(s) === c);
  check(leafOk, `Leaf-Statistik: erwartet ${[...expLeaf].sort((a, b) => a[0] - b[0]).map(([s, c]) => `E${s}=${c}`).join(" ")} · bekommen ${[...gotLeaf].sort((a, b) => a[0] - b[0]).map(([s, c]) => `E${s}=${c}`).join(" ")}`);

  // Config: bbs-Subtypen (type_from_string kennt KEINE Prusa-Strings), Component-Parts
  // (KEINE firstid/lastid-Ranges — deren Lesepfad ist in bbs toter Code), mesh_stat
  const cfg = byName.get("Metadata/model_settings.config");
  check(cfg.includes('subtype="normal_part"'), "subtype normal_part");
  check(!/ModelPart|NegativeVolume|ParameterModifier|SupportBlocker|SupportEnforcer/.test(cfg), "keine Prusa-Subtype-Strings");
  check(!cfg.includes('firstid="'), "keine toten Range-Parts in der Config");
  check(cfg.includes("<mesh_stat "), "mesh_stat-Element");
  check(cfg.includes('key="extruder"'), "extruder-Key je Part");
  // Jede part id muss ein existierendes Objekt im Model referenzieren (Component-Matching!)
  const xmlObjIds = new Set([...xml.matchAll(/<object id="(\d+)"/g)].map((m) => m[1]));
  const partIds = [...cfg.matchAll(/<part id="(\d+)"/g)].map((m) => m[1]);
  check(partIds.length > 0 && partIds.every((id) => xmlObjIds.has(id)), `alle ${partIds.length} part ids referenzieren Model-Objekte`);
  const hasSpecial = model.objects.some((o) => (o.parts || []).some((p) => p.type && p.type !== "ModelPart"));
  if (hasSpecial) {
    const nSpecialSrc = model.objects.reduce((n, o) => n + (o.parts || []).filter((p) => p.type && p.type !== "ModelPart").length, 0);
    const nSpecialCfg = (cfg.match(/subtype="(negative_part|modifier_part|support_blocker|support_enforcer)"/g) || []).length;
    check(nSpecialCfg === nSpecialSrc, `Spezial-Volume-Subtypen übersetzt (${nSpecialCfg}/${nSpecialSrc})`);
    check(xml.includes("<components>") && xml.includes("<component objectid="), "Composite-Objekte nutzen Components");
  }

  // Roundtrip: PaintPort liest den eigenen bbs-Export (paint_color-Pfad, Z.558)
  const model2 = await FW.load3MF(zip);
  check(model2.totalTris === model.totalTris, `Roundtrip Dreiecke ${model2.totalTris}/${model.totalTris}`);
  check((model2.specialVolumes || 0) === (model.specialVolumes || 0), `Roundtrip Spezial-Volumes ${model2.specialVolumes || 0}/${model.specialVolumes || 0}`);
  const rtOk = [...expLeaf].every(([s]) => {
    const f = model2.filaments.find((x) => x.index === s);
    return f && f.paintedTris > 0;
  });
  check(rtOk, "Roundtrip: alle Ziel-Filamente mit Painting wiedergefunden");

  // Stufe-1-Guard: virtuelle Extruder + bbs-Ziel muss werfen
  let threw = false;
  try { FW.build3MF(model, { ...plan, target: "bambu", virtuals: [{ id: 9, color: "#888888", components: [{ extruder: 1, ratio: 1 }, { extruder: 2, ratio: 1 }] }] }); }
  catch (e) { threw = true; }
  check(threw, "Guard: ColorMix + bbs-Ziel wirft (Stufe 2/3)");

  if (fails) { console.error(`bbs-Assertions: ${fails} FEHLGESCHLAGEN`); process.exit(1); }
  console.log("bbs-Assertions: alle grün");
}
