# PaintPort

**Bemalte Bambu-/MakerWorld-Modelle mit den richtigen Farben auf dem Prusa Core One INDX drucken.**

PaintPort ist ein kostenloses, quelloffenes Single-File-Webtool von [perspektive3D](https://www.youtube.com/@perspektive3d). Es wandelt multicolor-bemalte 3MF-Dateien (Bambu Studio, MakerWorld, OrcaSlicer) in saubere PrusaSlicer-Projektdateien um — die Modell-Filamente werden *deinen* INDX-Spulen zugeordnet, fehlende Farben optional als **ColorMix-Mischung** (virtuelle Extruder) nachgebildet.

**→ Direkt nutzen: https://perspektive3d.github.io/paintport/** — oder `index.html` herunterladen und doppelklicken. Alles läuft lokal im Browser: keine Uploads, kein Server, kein Tracking.

*English version: [README.md](README.md)*

## Warum gibt es das?

PrusaSlicer 2.9.0+ liest Bambus `paint_color`-Dreiecksbemalung bereits direkt. Was PrusaSlicer *nicht* wissen kann: welche Farbe in welchem deiner INDX-Slots steckt — die Painting-Indizes zeigen stumpf auf Filament 1…n des aktiven Profils, alles kommt in den falschen Farben heraus. Und Farben, die du nicht geladen hast, gehen ganz verloren.

PaintPort löst beides: Es remappt jeden Painting-State (bis in die Split-Bäume hinein) auf deine tatsächlichen Spulen-Slots und erzeugt `Prusa_Slicer_full_spectrum.json`-Einträge, damit fehlende Farben als Mischung gedruckt werden. Die Format-Details stehen in [docs/FORMAT.md](docs/FORMAT.md) (englisch).

## Bedienung

1. PaintPort öffnen und eine bemalte 3MF hineinziehen (Bambu Studio / MakerWorld / OrcaSlicer).
2. Eintragen, welche Spulenfarbe in welchem INDX-Slot steckt — oder ein Preset wählen (CMY, WCMY, KCMY, WKCMY, WKCMYRGB).
3. **Auto-Zuordnung** klicken und das Ergebnis prüfen. Farben ohne passende Spule können als ColorMix gemischt werden (experimentell).
4. Die `*_INDX.3mf` exportieren.
5. **In PrusaSlicer 2.9.6+ *als Projekt öffnen*** (Datei → Öffnen; beim Drag&Drop „Als Projekt öffnen" wählen).

> ⚠️ **Das „als Projekt" ist entscheidend.** Wird die Datei nur als Geometrie importiert, verwirft PrusaSlicer die virtuellen Extruder und Slot-Farben kommentarlos. PaintPort markiert seine Exporte so, dass PrusaSlicer den Projekt-Dialog zeigt — die Wahl liegt aber bei dir.

## Voraussetzungen

- **PrusaSlicer 2.9.6 oder neuer** mit dem Core-One-INDX-Profil.
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
