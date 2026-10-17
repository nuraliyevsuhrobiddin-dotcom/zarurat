# Hero center evaluation

## Overall Verdict: PASS

The narrow hero update meets the brief. The supplied square center branding image replaces the old purple hero completely, with a restrained white/gold contact card underneath. Existing typography and colors remain consistent.

| Criterion | Score | Status | Notes |
|-----------|-------|--------|-------|
| Design Quality | 2/3 | PASS | Desktop composition balances the large message with the 480px center card; clean caption and gold separator fit the branding. |
| Originality | 2/3 | PASS | User-supplied center branding gives the hero a specific identity. |
| Craft | 2/3 | PASS | Full square image, rounded edges, consistent spacing, readable phone/address, responsive single-column layout. |
| Functionality | 2/3 | PASS | Correct telephone link, explicit city address, eager image loading and mobile visibility. |

## Evidence reviewed

- Read docs/work/hero-center-update.md and relevant app.js, site-content.js and responsive CSS.
- Inspected artifacts/center-hero-desktop.png and artifacts/center-hero-mobile.png. The complete image lettering is retained; the old purple hero and floating overlays are absent. Desktop title, telephone and city address appear clearly under the photograph. Mobile screenshot retains the full image and card; its fixed bottom navigation is captured at viewport position in the full-page screenshot, so apparent overlap there is a screenshot artifact assessed alongside root's viewport checks.
- Image markup uses intrinsic 1254×1254 dimensions, eager loading and high fetch priority. CSS uses height:auto, aspect-ratio:1 and object-fit:contain.
- Telephone normalizes to tel:+998554067755. Addresses are exactly Qashqadaryo, Qarshi and Қашқадарё, Қарши, with no invented street.
- Root browser evidence confirms center visibility and no horizontal overflow at 320, 390, 820 and 821px, plus 1280px desktop inspection. Root reported Cyrillic axe scan with zero violations; existing gradient contrast was incomplete and unchanged.
- Root live verification confirms one loaded center image, old AI hero/floaters/caption absent, correct under-image contact information and no overflow. All five changed public assets match the published hashes and health returned 200.

## Issues and next step

No blocking issue found in this narrow change. REFINE only if genuine coordinator content or a verified street address is later supplied; the requested center hero is complete.
