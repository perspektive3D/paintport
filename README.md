# PaintPort

**Print painted Bambu / MakerWorld models with the right colors — on the Prusa Core One INDX, in Bambu Studio or on the Snapmaker U1.**

PaintPort is a free, open-source, single-file web tool by [perspektive3D](https://www.youtube.com/@perspektive3d). It re-homes multicolor-painted 3MF files (Bambu Studio, MakerWorld, OrcaSlicer) into clean project files for **PrusaSlicer (Core One INDX)**, **Bambu Studio** or **Snapmaker Orca / OrcaSlicer** — mapping the model's filaments to *your* spools and optionally recreating missing colors as **ColorMix blends**, written in each slicer's native format (Prusa FullSpectrum, Snapmaker "Full Spectrum", Bambu "Mixed Filament").

**→ Use it here: https://perspektive3d.github.io/paintport/** — or download `index.html` and double-click it. Everything runs locally in your browser: no uploads, no server, no tracking.

*Deutsche Version: [README.de.md](README.de.md)*

## Why does this exist?

Slicers can read each other's triangle *painting* — but not its *meaning*: the painting indices point blindly at filament 1…n of whatever profile is active, colors you don't have loaded are lost, and every slicer stores ColorMix blends in its own incompatible format. PaintPort fixes that: it remaps every painting state (deep into the split trees) to your actual spool slots and writes the blend definitions in the target slicer's native schema. The format details — including what we believe is the first public documentation of both bbs ColorMix on-disk formats — are in [docs/FORMAT.md](docs/FORMAT.md).

## How to use

1. Open PaintPort and drop in a painted 3MF (Bambu Studio / MakerWorld / OrcaSlicer export).
2. Enter which spool color sits in which printer slot — or pick a preset (CMY, WCMY, KCMY, WKCMY, WKCMYRGB).
3. Click **Auto-map** and review the result. Colors without a close spool match can be blended as ColorMix.
4. Pick the target slicer (PrusaSlicer / Bambu Studio / Snapmaker Orca) and export.
5. **Open the file in the target slicer *as a project*** (File → Open, or choose "project" when drag & dropping).

> ⚠️ **The "as a project" part matters.** Imported as geometry only, the painting survives but ColorMix blends and slot colors are discarded. Project mode may swap your active presets for project placeholders — switching back keeps the colors.

## Requirements

- **PrusaSlicer 2.9.6+** (Core One INDX profile), **Bambu Studio 2.7+** or **Snapmaker Orca 2.3.5** — the bbs blend format is unversioned upstream, so newer Orca releases may need a re-test.
- A browser with Compression Streams support: Chrome/Edge 80+, Safari 16.4+, Firefox 113+.
- Works fully offline — the single HTML file is the entire tool.

## Privacy

Everything happens in your browser. No uploads, no server, no cookies, no analytics. The only stored data are three localStorage keys (language, theme, "welcome seen").

## Development

The whole tool is one HTML file. The 3MF/painting engine is DOM-free between the `/*CORE-START*/ … /*CORE-END*/` markers and can be tested headless with Node ≥ 18:

```
node test/test_paintport.mjs index.html <painted.3mf> <out.3mf> [identity|swap12|virtual]
```

Bring your own painted 3MF as a fixture (MakerWorld downloads are not redistributable, so this repo ships none).

This repository is a one-way mirror of the primary development tree — see [CONTRIBUTING.md](CONTRIBUTING.md) for how pull requests are handled.

## License & credits

PaintPort is free software under the **AGPL-3.0** ([LICENSE](LICENSE)). © 2026 Nils Stackler / perspektive3D.

- Inspired by [Primed3D](https://github.com/3DRev/Primed3D) by Josh / 3D Revolution (Apache-2.0) — pioneering work on browser-based 3MF painting.
- Format reference: [PrusaSlicer](https://github.com/prusa3d/PrusaSlicer) (AGPL-3.0) — `slic3rpe:mmu_segmentation` and the full-spectrum JSON.
- No code from these projects ships in PaintPort; the formats were re-implemented for interoperability.
- Embedded fonts: [Poppins](https://fonts.google.com/specimen/Poppins) (SIL OFL 1.1) and [Roboto Mono](https://fonts.google.com/specimen/Roboto+Mono) (Apache-2.0), subset and base64-embedded for offline use.

## More from perspektive3D

- 🇩🇪 YouTube: [@perspektive3d](https://www.youtube.com/@perspektive3d)
- 🇬🇧 YouTube: [@p3d-intl](https://www.youtube.com/@p3d-intl)
- 🌐 Website: [perspektive3d.com](https://perspektive3d.com)
