// Headless-Smoke für die 3D-Vorschau + Mapping-UI (Pattern: GrainPort pose_smoke).
// Baut paintport.html + Smoke-Script zu einer Testseite, rendert sie in headless Chrome
// und prüft per gl.readPixels, ob die Vorschau wirklich farbige Dreiecke gezeichnet hat.
//
// Usage: node test_preview_smoke.mjs paintport.html /tmp/preview_smoke.html
//        (führt Chrome selbst aus, wertet document.title RESULT:{json} aus)
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const html = readFileSync(process.argv[2], "utf8");
const out = process.argv[3] || "/tmp/paintport_preview_smoke.html";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const smoke = `
<script>
(async function () {
  const R = { ok: false };
  try {
    // Synthetisches Mini-Modell: 2 Dreiecke nebeneinander.
    // Dreieck 0 unbemalt (Basis Filament 1 = Rot), Dreieck 1 bemalt State 2 (Filament 2 = Grün).
    MODEL = {
      objects: [{
        name: "smoke", defaultExtruder: 1, transform: null,
        vertices: new Float64Array([0,0,0, 10,0,0, 0,10,0, 15,0,0, 25,0,0, 15,10,0]),
        tris: new Int32Array([0,1,2, 3,4,5]),
        paints: [null, "8"],
        triState: new Int16Array([0, 2]),
        parts: [{ firstTri: 0, triCount: 2, extruder: 1, type: "ModelPart" }],
      }],
      filaments: [
        { index: 1, color: "#FF0000", colorKnown: true, paintedTris: 0, baseTris: 1, isDefaultOf: 1 },
        { index: 2, color: "#00FF00", colorKnown: true, paintedTris: 1, baseTris: 0, isDefaultOf: 0 },
      ],
      unpainted: 1, totalTris: 2, usedExtruders: [2], specialVolumes: 0,
    };
    renderSlots();
    renderMapping();
    document.getElementById("cardPreview").classList.remove("hidden");

    // --- 1) Vorschau ORIGINAL: rot + grün müssen als Pixel ankommen ---
    PV_MODE = "original";
    buildPreview();
    if (!PV) throw new Error("PV null — kein WebGL2 im Testlauf");
    pvSetModeButtons(); pvDraw();
    const count = () => {
      const gl = PV.gl;
      const px = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const c = { red: 0, green: 0, white: 0 };
      for (let i = 0; i < px.length; i += 4) {
        const r = px[i], g = px[i + 1], b = px[i + 2];
        if (r > 60 && g < 40 && b < 40) c.red++;
        else if (g > 60 && r < 40 && b < 40) c.green++;
        else if (r > 200 && g > 200 && b > 200) c.white++;
      }
      return c;
    };
    const orig = count();
    R.origRed = orig.red; R.origGreen = orig.green;

    // --- 2) Mapping-UI: Mix-Kandidaten im Dropdown, Pinnen aktualisiert Ergebnis ---
    const sel2 = document.querySelector('#mapTable select[data-fil="2"]');
    const mixOpts = [...sel2.options].filter((o) => o.value.startsWith("mix:"));
    R.mixOptionCount = mixOpts.length;
    sel2.value = mixOpts[0].value;
    updateResults();
    R.pinnedResHasSwatch = document.getElementById("res2").innerHTML.includes("sw");

    // --- 3) Kollisionswarnung: beide Filamente auf Slot 1 → 2 Warn-Badges ---
    document.querySelector('#mapTable select[data-fil="1"]').value = "p1";
    sel2.value = "p1";
    updateResults();
    R.collisionBadges = document.querySelectorAll("#mapTable .badge.warn").length;

    // --- 4) Vorschau ERGEBNIS: beide auf Slot 1 (Weiß) → weiße Pixel statt rot/grün ---
    setPreviewMode("result");
    const res = count();
    R.resWhite = res.white; R.resRed = res.red; R.resGreen = res.green;

    // --- 5) Export mit gepinntem Mix: Komponenten müssen 1:1 im Full-Spectrum-JSON landen ---
    sel2.value = mixOpts[0].value;
    document.querySelector('#mapTable select[data-fil="1"]').value = "p2";
    updateResults();
    let blob = null;
    URL.createObjectURL = (b) => { blob = b; return "blob:smoke"; };
    URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = function () { R.lastDownload = this.download || R.lastDownload; };
    await doExport();
    if (!blob) throw new Error("Export hat keinen Blob erzeugt");
    const files = await PaintPortCore.unzipAll(new Uint8Array(await blob.arrayBuffer()));
    const fsJson = JSON.parse(new TextDecoder().decode(files.get("Metadata/Prusa_Slicer_full_spectrum.json")));
    const pinned = mixOpts[0].value.slice(4).split("+").map((p) => p.split("x").map(Number));
    const v = fsJson.virtual_extruders && fsJson.virtual_extruders[0];
    R.exportVirtualMatches = !!v && v.components.length === pinned.length &&
      pinned.every(([slot, ratio]) => v.components.some((c) => c.extruder === slot && c.ratio === ratio));

    // --- 6) Ziel-Select: beide bbs-Ziele mit ColorMix; Snapmaker → 4 Slots, bbs-Export ---
    // Entries VOR dem Zippen abgreifen (zipAll-Intercept) statt den Blob zu entpacken:
    // ein zweiter DecompressionStream-Lauf sprengt das virtual-time-budget (s. Kommentar oben).
    document.getElementById("exportTarget").value = "bambu";
    onTargetChange();
    R.bambuPrinterN = document.getElementById("printerN").value;
    R.bambuMixEnabled = !document.getElementById("allowMix").disabled && document.getElementById("allowMix").checked;
    document.getElementById("exportTarget").value = "snapmaker";
    onTargetChange();
    R.targetPrinterN = document.getElementById("printerN").value;
    R.targetMixEnabled = !document.getElementById("allowMix").disabled && document.getElementById("allowMix").checked;
    R.targetBtn = document.getElementById("btnExport").textContent;
    blob = null;
    let bbsEntries = null;
    const origZipAll = PaintPortCore.zipAll;
    PaintPortCore.zipAll = (entries) => { bbsEntries = entries; return origZipAll(entries); };
    await doExport();
    PaintPortCore.zipAll = origZipAll;
    if (!blob || !bbsEntries) throw new Error("bbs-Export hat keinen Blob/keine Entries erzeugt");
    const bbsNames = bbsEntries.map((e) => e.name);
    const bbsPs = bbsNames.includes("Metadata/project_settings.config")
      ? JSON.parse(new TextDecoder().decode(bbsEntries.find((e) => e.name === "Metadata/project_settings.config").data)) : null;
    R.bbsExportOk = bbsNames.includes("Metadata/model_settings.config") &&
      !bbsNames.includes("Metadata/Slic3r_PE_model.config") &&
      !bbsNames.includes("Metadata/Prusa_Slicer_full_spectrum.json") &&
      !!bbsPs && Array.isArray(bbsPs.filament_colour) && bbsPs.filament_colour.length === 4 &&
      new TextDecoder().decode(bbsEntries.find((e) => e.name === "3D/3dmodel.model").data).includes("BambuStudio-2.3.5");
    // --- 7) Farbmodus-Suffix (Issue #1) + Reset-Button (Issue #2) ---
    // Snapmaker-Export oben lief mit 4 Default-Slots (kein Preset) → _snapmaker_4T
    // (deckt die Dateinamens-Komposition in doExport ab). Preset-Erkennung danach
    // OHNE zweiten Export prüfen — jeder weitere zipAll-Lauf (echte Async-I/O)
    // reißt das virtual-time-budget (s. Kommentar oben).
    R.suffixManual = (R.lastDownload || "").endsWith("_snapmaker_4T.3mf");
    applyPreset(0); // CMY (3 Farben ≤ 4 Slots)
    R.suffixPreset = colorModeSuffix() === "_CMY";
    const resetBtn = document.querySelector('[data-i18n="reset.btn"]');
    let confirmAsked = false;
    window.confirm = () => { confirmAsked = true; return false; }; // false → KEIN Reload im Test
    if (resetBtn) resetBtn.click();
    R.resetOk = !!resetBtn && confirmAsked;

    document.getElementById("exportTarget").value = "prusa";
    onTargetChange();

    R.ok = orig.red > 100 && orig.green > 100 && R.mixOptionCount >= 3 &&
           R.pinnedResHasSwatch && R.collisionBadges === 2 &&
           res.white > 200 && res.red < 20 && res.green < 20 &&
           R.exportVirtualMatches === true &&
           R.targetPrinterN === "4" && R.bambuPrinterN === "16" &&
           R.bambuMixEnabled === true && R.targetMixEnabled === true &&
           R.targetBtn.includes("Snapmaker") && R.bbsExportOk === true &&
           R.suffixManual === true && R.suffixPreset === true && R.resetOk === true;
  } catch (e) { R.error = String(e && e.stack || e); }
  document.title = "RESULT:" + JSON.stringify(R);
})();
</scr` + `ipt>`;

writeFileSync(out, html.replace("</body>", smoke + "\n</body>"));

// --virtual-time-budget beschleunigt nur Timer, nicht echte async-I/O
// (DecompressionStream im Export-Check) → Chrome dumpt gelegentlich zu früh. Daher Retries.
let m = null;
for (let attempt = 1; attempt <= 3 && !m; attempt++) {
  let dom = "";
  try {
    dom = execFileSync(CHROME, [
      "--headless=new", "--disable-gpu-sandbox", "--use-angle=metal",
      "--virtual-time-budget=15000", "--dump-dom", "file://" + out,
    ], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch (e) {
    console.error(`Chrome-Aufruf fehlgeschlagen (Versuch ${attempt}):`, e.message);
    continue;
  }
  m = dom.match(/<title>RESULT:([\s\S]*?)<\/title>/);
  if (!m) console.error(`Kein RESULT im DOM (Versuch ${attempt}) — Smoke-Script nicht fertig, retry …`);
}
if (!m) { console.error("Kein RESULT nach 3 Versuchen."); process.exit(1); }
const R = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
console.log("Preview-Smoke:", JSON.stringify(R, null, 1));
process.exit(R.ok ? 0 : 1);
