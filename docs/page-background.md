# Page background (radial + grid plan)

## Step 1 — Radial base (completed)

**Goal:** Site-wide radial gradient slightly **darker** than the header (`from-cyan-100 via-teal-50 to-emerald-100/90`).

**Implementation**

- [`frontend/src/styles/global.css`](frontend/src/styles/global.css)
  - `:root`: `--page-radial-fallback`, `--page-radial-gradient` using OKLCH stops in the cyan / teal / emerald hue range with lightness below the header strip (~0.90 center vs ~0.95+ pastels).
  - `.dark`: matching darker cyan/teal radial for dark mode.
  - `html`: `min-height: 100%`, paints `background-color` + `background-image` with `background-attachment: fixed`, `cover`.
  - `body`: `background-color: transparent` so `html` shows through; removed `@apply bg-background` on `body` so the canvas is not painted solid white.

**Note:** `--background` remains white for `bg-background` utilities on components; only the default body canvas is transparent.

**Update — deeper blue edges:** Outer stops and `--page-radial-fallback` use a **deeper, more saturated blue** (OKLCH hue ~252 / 258) with an extra mid stop so the falloff from center cyan/teal to the rim reads clearly bluer and darker.

## Step 2 — Pale yellow grid overlay (completed)

**Implementation**

- [`frontend/src/styles/global.css`](frontend/src/styles/global.css)
  - `:root` / `.dark`: `--page-grid-step`, `--page-grid-yellow`, `--page-grid-yellow-soft` (OKLCH pale yellow, low alpha; softer lines on dark).
  - `body`: `position: relative`, `isolation: isolate` for predictable stacking.
  - `body::before`: `position: fixed`, `inset: 0`, `z-index: 0`, `pointer-events: none`.
  - Two **super-thin** `repeating-linear-gradient` layers (`0deg` + `90deg`), **misaligned** via `background-position` (`0 0` vs `13px 21px`), whole layer **slightly rotated** (`transform: rotate(0.35deg)`) so the mesh feels less mechanical.
- [`frontend/src/layouts/Layout.astro`](frontend/src/layouts/Layout.astro): main shell `div` gets `relative z-10` so page content paints above the grid.

## Next

- Optional: tweak `--page-grid-step` / opacity / rotation if you want stronger or subtler texture.
