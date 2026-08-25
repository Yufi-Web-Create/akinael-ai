# AKINAEL image refresh v2 — quality report

- Inspection date: 2026-08-25
- Scope: generated masters, production AVIF/WebP exports, responsive crop previews, and the derived avatar sizes
- Out of scope: page implementation, copy, layout, and synthetic reconstruction of product UI

## Inspection method

1. The seven generated masters were inspected at original resolution for faces, hairlines, ears, hands, fingers, tools, dishes, furniture, pseudo-text, logos, and obvious generation artifacts.
2. Production exports were decoded after writing. Representative WebP exports were compared with their uncompressed resized inputs: desktop hero PSNR 40.18 dB; restaurant PSNR 38.21 dB.
3. `cover` crops were rendered with the audited site geometry: hero height equals viewport height minus the current header; industry-card media is 560 px tall on desktop and 430 px tall on mobile. Manifest focal points were applied.
4. All seven requested viewport sizes were reviewed visually. These are asset-only crop simulations, not a page implementation or an approval of copy-overlay placement.

## Responsive crop results

| Viewport | Hero | Four industry images | Result / caveat |
|---|---|---|---|
| 1366×768 | Head, face, shoulders and working hands retained; left copy space stays quiet | Faces, working hands and identifying objects retained | Pass |
| 1440×900 | Same semantic scene retained | Salon mirror/chair, restaurant dish/counter, school relationship, and maintenance hinge/tools retained | Pass |
| 1920×1080 | Same semantic scene retained; no edge collision | All four remain identifiable and materially different in framing/temperature | Pass |
| 320×568 | Mobile-specific source keeps a complete face, head, shoulders, notebook and essential hand context | 4:5 sources keep each trade identifiable; no face-only crop | Pass; copy overlay still needs implementation QA |
| 375×667 | Complete face and work context retained | Core people, hands and objects retained | Pass |
| 390×844 | Face remains safe; the visible scene narrows and lower cards/second person's hand become peripheral | Core industry signals retained | Conditional: constrain/reposition large bottom overlay |
| 430×932 | Face remains safe; very tall hero box narrows side context | Core industry signals retained | Conditional: constrain/reposition large bottom overlay |

The individual previews are in `qa/crop-preview-<width>x<height>.webp`; the combined inspection image is `qa/crop-previews-contact-sheet.webp`.

## Asset-level visual QA

| Asset | Critical content retained | Generation/anatomy check | Constraint |
|---|---|---|---|
| Desktop hero | Owner's head, face, shoulders, both hands, cards and notebook; quiet left side | Pass; no generated text/logo/UI | Source master is 1672×941 and the 2400×1350 export is a high-quality upscale; prefer 1200w/1920w variants where sufficient |
| Mobile hero | Same owner identity, complete upper body, notebook and working hand; genuinely new 3:4 composition | Pass; not a crop of desktop | At 390×844 and 430×932, an oversized lower copy panel can compete with hand/card context |
| Beauty / salon | Owner, customer, mirror, chair, cape, hands, brushes and cart | Pass; no medical cues or pseudo-signage | Extreme 4:5 crop omits the far cart/mirror edges only |
| Restaurant | Owner/customer interaction, face, both hands, dish, counter and kitchen | Pass; fingers, dishware, food and tools are structurally plausible | Peripheral shelves are intentionally omitted on mobile |
| Classroom / school | Instructor, two learners, gesture, notebooks, desks and whiteboard | Pass; whiteboard has geometric shapes only, no pseudo-text | Learners become partial figures in the narrowest cover crop, while the teacher–learner relation remains clear |
| Local service | Customer visit, maintenance worker, working hands, screwdriver, hinge and cabinet | Pass; no massage/medical/care cues | This is specifically **residential maintenance**; lower tool pouch may sit below a large overlay |
| Create/review illustration | Two separate stages, left-to-right sequence and independent checking action | Pass; flat 2D, matte, no text/robot/brain/circuit/glow | HTML copy must name the stages because the illustration intentionally contains no words |
| Assistant avatar | Entire illustrated head and chin remain safe in circular use at 96/192 px | Pass | Fictional assistant character; never present it as a real customer/testimonial |

## Series and brand check

- Subject mix is deliberately varied: mature woman owner, salon owner/client, male restaurant owner, male instructor with adult learners, and male maintenance provider with an older customer.
- Gaze, action, camera distance, lighting temperature and work setting vary, while restrained coral/teal accents, natural materials, moderate contrast and fine grain keep the set cohesive.
- No generated asset contains readable words, logos, prices, fabricated service UI, branded devices, AI robots, blue holographic effects, or strong 3D gloss.
- No obvious extra/fused fingers, malformed tools, broken dishes, implausible furniture, or facial artifacts were found at original-resolution review.

## Deferred and implementation-dependent checks

- UI feature crops were not produced. The repository screenshot represents an older/synthetic state and is not a compliant source. Capture the current UI only in an isolated demo account with non-personal `example.com` data, then export consultation input, response/progress, and result/confirmation separately.
- No approved “symbol + AKINAEL” short lockup exists. The official SVGs were left unchanged.
- Final page QA must re-check actual heading/overlay geometry, not only `object-position`, after Claude wires the assets.
- AVIF delivery requires the server to emit `Content-Type: image/avif`; this must be verified together with the existing `nosniff` header.

