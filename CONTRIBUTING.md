# Contributing to PaintPort

Thanks for your interest! A few things are unusual about this repo:

## This repository is a one-way mirror

PaintPort is developed in a private monorepo (together with the test fixtures, which are
MakerWorld models we may not redistribute). This public repository receives releases via an
automated sync script — there is no direct-to-`main` merging here.

**Pull requests are still welcome!** The maintainer reviews them, applies accepted changes
to the upstream tree (crediting you with `Co-authored-by`), and the next release sync brings
them back here. Your GitHub profile stays linked in the commit.

## Testing your changes

The whole tool is one HTML file (`index.html`). The 3MF engine is DOM-free between the
`/*CORE-START*/ … /*CORE-END*/` markers and testable headless (Node ≥ 18):

```
node test/test_paintport.mjs index.html <painted.3mf> <out.3mf> [identity|swap12|virtual]
```

Use any multicolor-painted 3MF exported from Bambu Studio / OrcaSlicer as a fixture.
For a full check, round-trip the output through PrusaSlicer:

```
prusa-slicer --export-3mf --output roundtrip.3mf out.3mf
unzip -p roundtrip.3mf 3D/3dmodel.model | grep -o 'mmu_segmentation="[^"]*"' | sort | uniq -c
```

The histogram must match the "expected leaf statistics" the test script prints.

## UI strings

Every user-facing string lives in the `I18N` dictionary (`de` + `en`). If you add one,
add it to **both** languages — the release gate checks key parity.

## License

By contributing you agree that your contribution is licensed under the AGPL-3.0.
