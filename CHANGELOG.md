# Changelog

All notable changes to PaintPort. Format follows [Keep a Changelog](https://keepachangelog.com/); versions follow [SemVer](https://semver.org/).

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
