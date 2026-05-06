# Home post cards — spacing, radius, and shadow

## Step-by-step plan

1. **Confirm layout flow** — Home posts render inside [`frontend/src/pages/index.astro`](frontend/src/pages/index.astro) as a list of [`Card`](frontend/src/components/Card.astro) components below [`Layout`](frontend/src/layouts/Layout.astro)’s `<Header />` / `<main>`. Spacing between header and first card should live at the page/section level, not inside each card.

2. **Add header-to-content spacing on the home page** — Apply a modest top margin (and optional vertical gap between stacked cards) on the `<section>` wrapping the post list so the first card clears the sticky header visually without affecting other routes unless they reuse the same pattern.

3. **Increase corner radius on cards** — In `Card.astro`, replace segment rounding (`first:rounded-t` / `last:rounded-b`) with consistent rounding so each post reads as its own card (especially once gaps separate items).

4. **Deepen shadow** — Add Tailwind shadow utilities on the card container (`shadow-lg` / `sm:shadow-xl`) and a light border/ring so the elevation reads clearly on the page background.

5. **Preserve existing behavior** — Keep responsive row layout (`md:flex-row`), image sizing, typography, and visual-editing data attributes unchanged.

6. **Verify** — Run `pnpm exec astro check` and spot-check the home page at mobile and desktop widths.

## Change log

| Date       | File                         | Summary |
|------------|------------------------------|---------|
| 2026-05-05 | `frontend/src/pages/index.astro` | Added top margin and vertical gap on the posts `<section>`. |
| 2026-05-05 | `frontend/src/components/Card.astro` | Unified rounding, stronger shadow, `overflow-hidden`, `bg-white`, simplified borders for stacked cards. |
| 2026-05-05 | `frontend/src/components/Card.astro` | Image (and placeholder) corner radius aligned with card: top radius on mobile stack, left radius on `md` row; removed outer `p-2`, padding on text column only so media meets the card edge. |

## Related

Home cards sit on the site-wide **radial blue canvas** and **pale yellow grid** overlay (`frontend/src/styles/global.css`, shell `z-10` in `Layout.astro`). Details and tuning notes live in [`docs/page-background.md`](page-background.md); opaque white card surfaces keep titles and excerpts readable on that background.
