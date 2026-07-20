# 3MF painting & ColorMix format notes

Everything PaintPort knows about moving painted multicolor models between the slicer
ecosystems. Sections 1–5 cover the Bambu→PrusaSlicer direction (verified against
PrusaSlicer `version_2.9.6` sources: `TriangleSelector.cpp`, `Format/3mf.cpp`,
`Feature/FullSpectrum/VirtualExtruder.cpp`, plus CLI round-trips). Sections 6–8 cover
exporting *into* the bbs world — Bambu Studio and Snapmaker Orca — including both
ColorMix on-disk schemas (verified against `bambulab/BambuStudio` and
`Snapmaker/OrcaSlicer` sources and real project files, 07/2026). Collected here because
these details are documented nowhere else in one place.

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

## 6. Exporting into the bbs world (Bambu Studio / Snapmaker Orca)

Both slicers share the `bbs_3mf.cpp` importer lineage. What PaintPort writes for them:

- **Header** (`3D/3dmodel.model`): `xmlns:BambuStudio="http://schemas.bambulab.com/package/2021"`,
  `<metadata name="Application">BambuStudio-<version></metadata>` and
  `<metadata name="BambuStudio:3mfVersion">1</metadata>`. Any `Application` starting with
  `BambuStudio-` marks the file as a bbs project (`m_is_bbl_3mf`) and suppresses the
  "standard 3MF color" conversion dialog. The semver after the dash becomes `file_version`
  and is compared against the app's version — PaintPort pins it per target
  (`02.07.01.62` for Bambu Studio, `2.3.5` for Snapmaker Orca).
- **Never write `BambuStudio:MmPaintingVersion`** — any value > 0 makes the import throw a
  "newer version" error (both slicers support only version 0 and write no such metadata).
- **Painting**: the `paint_color` triangle attribute (same bitstream as §2) is read
  unconditionally, even on geometry-only import. PaintPort paints *every* printable
  triangle (Paint-All) so base-colored areas keep their filament without relying on
  config defaults.
- **Parts must be components.** The importers still *parse* PrusaSlicer-style triangle-range
  volumes (`firstid`/`lastid`) in `model_settings.config`, but the function that would
  split a mesh by ranges has no callers left — ranges are silently ignored and a negative
  volume would come out solid. Objects with negative/modifier/support parts therefore have
  to be emitted as a parent `<object>` with `<components>`, one child mesh object per part
  (same-file components without `p:path` work). In `Metadata/model_settings.config`,
  `<part id>` **must equal the component's object id**; `subtype` must use the bbs strings
  (`normal_part`, `negative_part`, `modifier_part`, `support_blocker`, `support_enforcer`
  — Prusa names like `NegativeVolume` silently degrade to `normal_part`).
- Opening as **project** with an *empty/missing* `project_settings.config` triggers a
  misleading "generated by old Bambu Studio, load geometry data only" info dialog. A
  minimal config (next section) avoids it.

## 7. Minimal `Metadata/project_settings.config`

A full bbs project config carries ~570 keys and overwrites the user's presets on import.
PaintPort writes a minimal JSON instead:

```json
{
  "version": "2.3.5",
  "from": "project",
  "filament_colour": [ "#61C680", "#F7D959", "#000000", "#BB3D43" ],
  "mixed_filament_definitions": "…only when blends are mapped…"
}
```

Effects: the "old version" dialog disappears, the mapped slot colors arrive, and the
printer/filament presets survive as project placeholders named after the file — switching
back to real presets keeps the colors. `filament_colour` length defines the physical
filament count `n` used to validate blend definitions.

## 8. The two ColorMix on-disk schemas

Nobody in the bbs world reads Prusa's `Prusa_Slicer_full_spectrum.json`. Each fork has its
own storage, both inside `project_settings.config`:

### 8a. Snapmaker Orca ("Full Spectrum", also ratdoux's OrcaSlicer-FullSpectrum)

Single string key **`mixed_filament_definitions`**; rows separated by `;`, fields by `,`:

```
a,b,enabled,custom,mix_b_percent,pointillism,g<ids>,w<weights>,m<mode>,z<n>,xa<off>,xb<off>,d<del>,o<auto>,u<stable_id>[,cm<ui_mode>][,r1/<start>/<end>][,<manual_pattern>]
```

- `a`,`b`: 1-based physical filament indices (validated against `1…n`, `a ≠ b`).
- Two-component blend: mode `m2` (Simple) + `mix_b_percent` = share of component b
  (1:1 → 50, 1:3 → 75, 3:1 → 25); `g`/`w` stay empty.
- **Three-component blend**: `g` = `/`-separated ids (e.g. `g1/2/3`), `w` = `/`-separated
  weights (e.g. `w1/1/1`), mode `m0` (LayerCycle) — the multi-component path only runs
  when mode ≠ Simple *and* `g` lists ≥ 3 ids.
- **Blend filament ids**: the k-th enabled, non-deleted row (in order) becomes filament
  id `n + k`. Painting states may point at these ids directly. Keep rows sorted by the id
  you painted with, all `enabled=1`, `d0`.
- The format carries **no version field**; Snapmaker's own migration notes warn old files
  "may not open cleanly". PaintPort pins what 2.3.5 writes (including the trailing
  `cm0` = ui_mode token).

### 8b. Bambu Studio ("Mixed Filament")

Blends are **regular filament slots** of the same list — there is no extended id space.
Per-slot string arrays, empty/`"0"` for physical slots:

```json
{
  "filament_colour":               [ "…physical…", "#A8D06C" ],
  "filament_is_mixed":             [ "0", "0", "0", "0", "1" ],
  "filament_mixed_components":     [ "",  "",  "",  "",  "1,2" ],
  "filament_mixed_sublayer_ratios":[ "",  "",  "",  "",  "0.5000,0.5000" ],
  "filament_mixed_gradient":       [ "0", "0", "0", "0", "0" ],
  "filament_mixed_gradient_curve": [ "",  "",  "",  "",  "" ],
  "filament_mixed_gradient_per_part": [ "0", "0", "0", "0", "0" ],
  "filament_mixed_gradient_range": [ "",  "",  "",  "",  "" ]
}
```

- `filament_colour` for a blend slot holds the *predicted* blend color.
- Components are 1-based physical indices ("1,2" or "1,2,3"); ratios are 4-decimal values
  summing to exactly 1.0 (put the rounding remainder on the last component).
- 2 or 3 components, same filament type; **physical + blends ≤ 16 filaments** total.
- `enable_mixed_color_sublayer` is a process/quality key — PaintPort deliberately leaves
  it to the user's preset instead of forcing it from the project.
- MakerWorld rejects mixed-filament 3MFs for upload.
