# PaintPort

**Bemalte Bambu-/MakerWorld-Modelle mit den richtigen Farben drucken — auf dem Prusa Core One INDX, in Bambu Studio oder auf der Snapmaker U1.**

PaintPort ist ein kostenloses, quelloffenes Single-File-Webtool von [perspektive3D](https://www.youtube.com/@perspektive3d). Es zieht multicolor-bemalte 3MF-Dateien (Bambu Studio, MakerWorld, OrcaSlicer) in saubere Projektdateien für **PrusaSlicer (Core One INDX)**, **Bambu Studio** oder **Snapmaker Orca / OrcaSlicer** um — die Modell-Filamente werden *deinen* Spulen zugeordnet, fehlende Farben optional als **ColorMix-Mischung** nachgebildet, jeweils im nativen Format des Ziel-Slicers (Prusa FullSpectrum, Snapmaker „Full Spectrum", Bambu „Mixed Filament").

**→ Direkt nutzen: https://perspektive3d.github.io/paintport/** — oder `index.html` herunterladen und doppelklicken. Alles läuft lokal im Browser: keine Uploads, kein Server, kein Tracking.

*English version: [README.md](README.md)*

## Warum gibt es das?

Slicer können die Dreiecks-*Bemalung* der jeweils anderen lesen — aber nicht ihre *Bedeutung*: Die Painting-Indizes zeigen stumpf auf Filament 1…n des aktiven Profils, nicht geladene Farben gehen verloren, und ColorMix-Mischungen speichert jeder Slicer in seinem eigenen, inkompatiblen Format. PaintPort löst das: Es remappt jeden Painting-State (bis in die Split-Bäume hinein) auf deine tatsächlichen Spulen-Slots und schreibt die Misch-Definitionen im nativen Schema des Ziel-Slicers. Die Format-Details — inklusive der unseres Wissens ersten öffentlichen Doku beider bbs-ColorMix-Formate — stehen in [docs/FORMAT.md](docs/FORMAT.md) (englisch).

## Bedienung

1. PaintPort öffnen und eine bemalte 3MF hineinziehen (Bambu Studio / MakerWorld / OrcaSlicer).
2. Eintragen, welche Spulenfarbe in welchem Drucker-Slot steckt — oder ein Preset wählen (CMY, WCMY, KCMY, WKCMY, WKCMYRGB).
3. **Auto-Zuordnung** klicken und das Ergebnis prüfen. Farben ohne passende Spule können als ColorMix gemischt werden.
4. Ziel-Slicer wählen (PrusaSlicer / Bambu Studio / Snapmaker Orca) und exportieren — der Dateiname trägt Ziel und Farbmodus (z.B. `modell_INDX_WKCMY.3mf`, bzw. `_5T` bei manuellem 5-Slot-Setup).
5. **Die Datei im Ziel-Slicer *als Projekt öffnen*** (Datei → Öffnen; beim Drag&Drop „Projekt" wählen).

> ⚠️ **Das „als Projekt" ist entscheidend.** Als reine Geometrie importiert bleibt das Painting erhalten, aber ColorMix-Mischfarben und Slot-Farben gehen verloren. Der Projekt-Modus kann deine aktiven Presets gegen Projekt-Platzhalter tauschen — zurückwechseln behält die Farben.

## Voraussetzungen

- **PrusaSlicer 2.9.6+** (Core-One-INDX-Profil), **Bambu Studio 2.7+** oder **Snapmaker Orca 2.3.5** — das bbs-Mischformat ist upstream versionslos, neuere Orca-Versionen brauchen ggf. einen Nachtest.
- Browser mit Compression-Streams-Support: Chrome/Edge 80+, Safari 16.4+, Firefox 113+.
- Funktioniert komplett offline — die eine HTML-Datei ist das ganze Tool.

## Datenschutz

Alles passiert in deinem Browser. Keine Uploads, kein Server, keine Cookies, keine Analytics. Gespeichert werden nur drei localStorage-Einstellungen (Sprache, Design-Modus, „Willkommen gesehen").

## Entwicklung

Das ganze Tool ist eine HTML-Datei. Die 3MF-/Painting-Engine ist DOM-frei zwischen den Markern `/*CORE-START*/ … /*CORE-END*/` und lässt sich mit Node ≥ 18 headless testen:

```
node test/test_paintport.mjs index.html <bemalt.3mf> <out.3mf> [identity|swap12|virtual]
```

Bring dafür eine eigene bemalte 3MF mit (MakerWorld-Downloads dürfen nicht weiterverteilt werden, das Repo enthält deshalb keine Fixtures).

Dieses Repository ist ein One-Way-Mirror des primären Entwicklungsbaums — wie Pull Requests behandelt werden, steht in [CONTRIBUTING.md](CONTRIBUTING.md).

## Lizenz & Credits

PaintPort ist freie Software unter der **AGPL-3.0** ([LICENSE](LICENSE)). © 2026 Nils Stackler / perspektive3D.

- Inspiriert von [Primed3D](https://github.com/3DRev/Primed3D) von Josh / 3D Revolution (Apache-2.0) — Pionierarbeit beim Browser-basierten 3MF-Painting.
- Formatreferenz: [PrusaSlicer](https://github.com/prusa3d/PrusaSlicer) (AGPL-3.0) — `slic3rpe:mmu_segmentation` und das Full-Spectrum-JSON.
- Es wird kein Code dieser Projekte ausgeliefert; die Formate wurden zur Interoperabilität nachimplementiert.
- Eingebettete Schriften: [Poppins](https://fonts.google.com/specimen/Poppins) (SIL OFL 1.1) und [Roboto Mono](https://fonts.google.com/specimen/Roboto+Mono) (Apache-2.0), als Subset base64-eingebettet für Offline-Nutzung.

## Mehr von perspektive3D

- 🇩🇪 YouTube: [@perspektive3d](https://www.youtube.com/@perspektive3d)
- 🇬🇧 YouTube: [@p3d-intl](https://www.youtube.com/@p3d-intl)
- 🌐 Website: [perspektive3d.com](https://perspektive3d.com)
