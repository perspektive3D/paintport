# Changelog

All notable changes to PaintPort. Format follows [Keep a Changelog](https://keepachangelog.com/); versions follow [SemVer](https://semver.org/).

## [0.7.2] — 2026-07-22

### Fixed
- **Bambu Studio export died with any ColorMix blend** ("Bambu Studio unterstützt maximal
  16 Filamente", no download): the exported filament list now ends at the highest *active*
  slot instead of always covering all 16 printer slots, leaving room for blends within
  Bambu's 16-filament cap. Filaments that are neither painted nor used as a base no longer
  occupy slots (all targets). The same list-shrink applies to Snapmaker Orca exports
  (shared bbs flavor); blend filament IDs now start right after the highest active slot.
- **Switching the target slicer scrambled the mapping**: assignments pointing at a slot
  that no longer exists (e.g. slot 5 after switching to the 4-toolhead Snapmaker U1) now
  fall back to the ΔE-closest active slot or blend — previously they silently collapsed
  onto the first option. A status note lists the re-assigned filaments.
- Slot colors/state above the new extruder count survive target switches (memo instead of
  DOM-only), and a manually unchecked "allow ColorMix" is no longer re-enabled on switch.

### Added
- Early warning in the mapping step when active slots + blends would exceed Bambu Studio's
  16-filament limit — before the export button fails.

## [0.7.1] — 2026-07-21

### Added
- **Color-mode filename suffix** (#1): exports now append the active spool setup to the
  filename — the preset id when the slots exactly match a preset (`pika_INDX_WKCMY.3mf`),
  otherwise the number of active slots (`pika_snapmaker_5T.3mf`). Detection is dynamic,
  so editing a preset afterwards falls back to the slot-count suffix automatically.
- **Reset button** (#2): a button at the bottom of the page clears the whole session
  (loaded model, slot configuration, mapping, preview) after a confirmation prompt and
  returns the tool to its initial state. Language and theme are kept.

## [0.7.0] — 2026-07-20

### Added
- **Multi-slicer export**: a new target selector in the export step. Besides the existing
  PrusaSlicer (Core One INDX) project, PaintPort now writes native project files for
  **Bambu Studio** and **Snapmaker Orca / OrcaSlicer** — including painting, your mapped
  slot colors and **ColorMix blends** in each slicer's own format:
  - *Snapmaker Orca* ("Full Spectrum"): blends are written as `mixed_filament_definitions`
    entries — all PaintPort ratios work (1:1, 1:3, 3:1 and three-component 1:1:1). Blend
    filaments appear after the physical slots, exactly where the painting points.
    Tested against Snapmaker Orca **2.3.5**; the format is unversioned upstream, so future
    Orca releases may need a re-test.
  - *Bambu Studio* ("Mixed Filament"): blends become additional filament slots with
    predicted color, components and sublayer ratios (`filament_is_mixed` & co.).
    Physical + blended filaments are capped at Bambu's 16-filament limit. Note that
    MakerWorld does not accept mixed-filament 3MFs for upload. Tested against
    Bambu Studio **2.7.1**.
- Target-aware defaults: printer extruder count (INDX 8, Bambu AMS 16, Snapmaker U1 4),
  file suffix (`_INDX` / `_bambu` / `_snapmaker`) and per-target usage hints.
- The bbs-flavor exports carry a **minimal** `project_settings.config` (slot colors, blend
  definitions, version — nothing else), so opening as a project does not clobber your
  printer/process presets beyond a placeholder preset name. Objects with negative/modifier
  volumes are exported in the component structure the bbs importers actually read, so
  alignment-pin cutouts survive.
- Re-importing a PaintPort bbs export back into PaintPort now reconstructs part volumes
  correctly (component parts).
- The format details — including what we believe is the first public documentation of both
  bbs ColorMix on-disk schemas — are in [docs/FORMAT.md](docs/FORMAT.md).

### Changed
- UI wording is now target-neutral ("filament slots" instead of INDX-specific labels);
  the export hint explains the project-vs-geometry trade-off per slicer.

## [0.6.0] — 2026-07-07

### Added
- **3D print preview** (step 4): renders the model with a toggle between the file's original
  colors and the mapped INDX result — updates live while you change the mapping. Hand-written
  WebGL2, no external libraries, stays fully offline. Color impression uses the dominant paint
  state per triangle; negative/modifier volumes are hidden.
- **Selectable ColorMix alternatives**: the target dropdown now lists the ranked blend
  candidates ("ColorMix alternative 1…n", predicted color + ΔE) instead of only an automatic
  pick — e.g. shift a blue that would auto-map to a purple blend toward a bluer mix. Pinned
  blends export exactly as chosen. Dropdown entries are color-coded (option rows show the
  actual slot/blend color where the browser supports it; the closed select always does).
- **Collision warning**: if two clearly different model colors would map to nearly the same
  result color (ΔE < 10 while the sources differ by ΔE > 15), both rows get a warning badge —
  found by a user whose purple and blue mapped to the identical blend.
- **Free-slot tip**: when a blend stays poor (ΔE > 40) and printer slots are unused, PaintPort
  suggests loading a real matching spool instead.

## [0.5.0] — 2026-07-07

### Fixed
- **Per-part filament assignments are now respected** (part-level `extruder` in Bambu's
  `model_settings.config`): multi-part objects — e.g. MakerWorld models whose mouth/eye
  parts use a different base filament than the object — no longer export with the object's
  base filament everywhere. The export writes one volume range per base-filament change.
- **Negative modifiers survive the conversion**: Bambu `negative_part` volumes (e.g.
  alignment-pin cutouts) are exported as PrusaSlicer `NegativeVolume`s with their original
  names instead of being merged as solid geometry — thanks to community tester feedback on
  the 8-color Majora's Mask. `modifier_part`, `support_blocker` and `support_enforcer`
  map to their PrusaSlicer volume types as well. Verified via PrusaSlicer CLI round-trip.
- Negative/modifier volumes no longer distort the painting statistics (they are not a
  printable surface).

### Added
- Analysis table shows a **"Base (unpainted)" column** per filament — base-colored areas
  (e.g. a black body that is never "painted") no longer read as a misleading 0 %.
- Analysis hint shows how many negative/modifier volumes were preserved.

## [0.4.1] — 2026-07-06

### Added
- Language switcher (Deutsch/English) directly in the welcome overlay — language is auto-detected
  from the browser (German → DE, everything else → EN) and can now be changed without leaving
  the first-run dialog. Header and overlay switchers stay in sync.

## [0.4.0] — 2026-07-06

First public release.

### Added
- **New name: PaintPort** (developed internally as "Farbwandler").
- Spool presets: CMY, WCMY, KCMY, WKCMY, WKCMYRGB.
- Full **German/English UI** with language toggle (persisted, auto-detected).
- Welcome/help dialog with quickstart, channel links, and a first-visit "Get started" flow.
- Terms & privacy dialog (everything runs locally — no uploads, no tracking).
- Post-export reminder dialog ("open as project").
- Open Graph / Twitter cards for link sharing.
- **perspektive3D brand design** (light default + dark mode toggle), embedded brand fonts (Poppins, Roboto Mono — latin subset, works offline).
- AGPL-3.0 license, public repository, hosted version via GitHub Pages.

### Changed
- Core errors now carry stable `err.code` values with English messages (UI translates them).
- Version lives in a single core constant (`PAINTPORT_VERSION`).

## [0.3.0] — 2026-07-06 (internal)

### Fixed
- **Exports were silently loaded as geometry-only** on drag & drop / double-click, discarding
  virtual extruders and slot colors: PrusaSlicer's `is_project_3mf` only accepts files with a
  `Slic3r_PE.config` or a `PrusaSlicer-<version>` Application metadata. PaintPort now writes
  that marker so the project dialog appears. (The export data itself was verified correct.)

## [0.2.0] — 2026-07-05 (internal)

### Fixed
- Virtual extruder IDs now start **above the printer's physical extruder count** (INDX 8T → 9+)
  instead of above the active slot count — colliding IDs put the object body on the wrong
  physical toolhead, because PrusaSlicer's import remap shifts painting states only.
- Slot n now always maps to extruder n (no compacting of active slots).
- Auto-map assigns object base filaments to physical slots only, never to ColorMix.

## [0.1.0] — 2026-07-05 (internal)

### Added
- Initial version: load painted Bambu/MakerWorld/Orca 3MF, remap painting states (including
  split trees) to INDX slots, optional ColorMix virtual extruders
  (`Prusa_Slicer_full_spectrum.json`), export as PrusaSlicer project 3MF.
- Bit-exact headless verification via Node test harness + PrusaSlicer CLI round-trip
  (576,291 paint strings, 0 deviations).
