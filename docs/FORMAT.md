# 3MF painting & FullSpectrum format notes

Everything PaintPort knows about moving painted multicolor models from the Bambu ecosystem
to PrusaSlicer. Verified against PrusaSlicer `version_2.9.6` sources
(`TriangleSelector.cpp`, `Format/3mf.cpp`, `Feature/FullSpectrum/VirtualExtruder.cpp`) and
CLI round-trips. Collected here because these details are documented nowhere else in one place.

## 1. PrusaSlicer reads Bambu painting natively (≥ 2.9.0)

`Format/3mf.cpp` falls back to the `paint_color` triangle attribute (Bambu/Orca) when
`slic3rpe:mmu_segmentation` is absent (fix for issue #12502). Opening a MakerWorld 3MF in
PrusaSlicer 2.9.6 preserves the painting completely — what's lost is only the *meaning*:

- Bambu's filament colors (`Metadata/project_settings.config`) are not imported.
- Painting indices point blindly at filament 1…n of the active Prusa profile.

So the model arrives painted, but in whatever colors your profile happens to have. That
mapping gap is what a converter has to fill.

## 2. The painting encoding is identical in both ecosystems

Bambu's `paint_color` and Prusa's `slic3rpe:mmu_segmentation` use the same
TriangleSelector bitstream, serialized as a hex string **read right-to-left**, one nibble
(4 bits) at a time:

- **Leaf:** `code & 3 == 0`, state = `code >> 2`.
  - state ≤ 2: encoded directly (`"4"` = extruder 1, `"8"` = extruder 2).
  - state marker 3: one extra nibble `z` follows; `z ≤ 13` → state = 3 + z
    (`"0C"` = ext 3, `"1C"` = ext 4, `"2C"` = ext 5 …).
  - `z == 14`: two more nibbles (low, high) → state = 17 + value. States ≥ 17 require
    `<metadata name="slic3rpe:MmPaintingVersion">2</metadata>`.
- **Split node:** `code & 3` = number of split sides (1–3), `code >> 2` = special side;
  followed by (splitSides + 1) child nodes recursively.

A converter must remap **leaf states inside split trees too**, not just top-level
single-state strings.

## 3. Virtual extruders: `Metadata/Prusa_Slicer_full_spectrum.json`

PrusaSlicer 2.9.6 stores ColorMix (FullSpectrum) virtual extruders in this archive member.
Minimal schema:

```json
{
  "version": 1,
  "physical_extruders": [ { "id": 1, "color": "#FFFFFF" }, … ],
  "virtual_extruders": [
    {
      "id": 9,
      "kind": "fullspectrum",
      "color": "#5EB25E",
      "components": [ { "extruder": 2, "ratio": 1 }, { "extruder": 3, "ratio": 1 } ]
    }
  ]
}
```

- Painting states may point directly at virtual IDs.
- **Virtual IDs must start above the printer's physical extruder count** (INDX 8T → 9+).
  On collision, PrusaSlicer's `remap_full_spectrum_on_import` shifts *painting states
  only* — not the volume's base extruder — so a colliding ID puts the whole body on the
  wrong physical toolhead.
- `physical_extruders` should list **all** printer extruders (source count == target
  count → no remap runs at all).
- The CLI (`--export-3mf`) does **not** write this JSON back (GUI-only, needs an active
  config). That's expected, not a corruption.

## 4. The project-vs-geometry trap (the big one)

Whether any of the FullSpectrum data survives loading depends entirely on *how* the file
is opened:

- `Plater::load_files(wxArrayString)` — used by **drag & drop and file-manager
  double-click** — first calls `is_project_3mf()`. A 3MF with neither
  `Metadata/Slic3r_PE.config` nor an `Application` metadata matching
  `PrusaSlicer-<semver>` (within the first 1024 bytes of `3D/3dmodel.model`) is loaded
  **silently as geometry only** (`load_config=false`).
- The entire FullSpectrum import — `model.virtual_extruders` adoption and
  `apply_full_spectrum_physical_colors()` (which sets the printer's `extruder_colour`
  from the JSON) — runs **only in the `load_config` path**.
- **File → Open Project always works**: `load_project()` hard-codes `load_config=true`.

PaintPort therefore writes `<metadata name="Application">PrusaSlicer-2.9.6</metadata>`
(plus its own `Generator` metadata) so the project dialog appears on drag & drop. Users
must still choose *Open as project*.

Bonus: a 3MF **without** `Slic3r_PE.config` keeps the user's presets untouched on project
load — only extruder colors and virtual extruders are applied. That's why PaintPort
deliberately ships no `Slic3r_PE.config` (no preset-override risk).

## 5. Misc

- `paint_color` and per-object default extruders live in `Metadata/model_settings.config`
  (`<metadata key="extruder" value="…">` at object level, 1-based).
- Bambu filament colors: `filament_colour` array in `Metadata/project_settings.config`
  (may be `RRGGBBAA` — strip alpha).
- Bambu production-extension files keep geometry in `3D/Objects/*.model`, referenced via
  `<component p:path=…>`; components can nest one level deeper.
- 3MF transforms are 12-value row-major 4×3 (`[R | T]`), point × matrix.
- ColorMix ratios PrusaSlicer offers: 1:1, 1:3, 3:1, 1:1:1. PaintPort predicts blend
  colors with a Yule–Nielsen approximation (n = 2) — the calibrated model in PrusaSlicer
  is more accurate; treat predictions as a preview.
