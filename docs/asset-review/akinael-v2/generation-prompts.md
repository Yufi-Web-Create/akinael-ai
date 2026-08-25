# AKINAEL v2 master generation prompts

This file records the production prompts and provenance for the seven selected master images generated on 2026-08-25. All masters were generated with the built-in `image_gen` tool. The PNG files are retained as generation masters; production AVIF/WebP derivatives have been exported under `public/assets/v2`, while responsive page markup remains separate downstream work for Claude.

| Master | Source dimensions | Reference image used |
| --- | ---: | --- |
| `masters/akinael-hero-desktop-v2-master.png` | 1672×941 | No |
| `masters/akinael-hero-mobile-v2-master.png` | 1086×1448 | Yes — desktop hero; first mobile draft also used for the selected targeted retry |
| `masters/industry-beauty-v2-master.png` | 1448×1086 | No |
| `masters/industry-restaurant-v2-master.png` | 1448×1086 | No |
| `masters/industry-school-v2-master.png` | 1448×1086 | No |
| `masters/industry-local-service-v2-master.png` | 1448×1086 | No |
| `masters/ai-create-review-process-v2-master.png` | 1586×992 | No |

## Desktop hero

- Master filename: `akinael-hero-desktop-v2-master.png`
- Generator: `built-in image_gen`
- Date: `2026-08-25`
- Source: 1672×941 RGB PNG, approximately 16:9
- Reference image used: no
- Iteration provenance: accepted from the first generation after full-scale visual inspection; no retry
- Limitations: the built-in output is smaller than the intended 2400×1350 master. The requested 2400×1350 production export is therefore a high-quality Lanczos upscale; use the supplied 1200w or 1920w derivatives whenever sufficient. This wide composition is not intended to be cropped into the mobile hero.

Final production prompt:

```text
Use case: photorealistic-natural
Asset type: AKINAEL AI landing-page hero, desktop master
Primary request: candid editorial advertising photo showing a Japanese small-business owner in her late 40s to early 50s feeling calmly supported while organizing and checking everyday work, in a believable compact neighborhood specialty shop/workroom in Japan.
Scene/backdrop: lived-in but clean small shop with a modest worktable, shelves and practical tools; natural Japanese proportions, not a luxury studio. The owner is reviewing a small set of unprinted color cards, a notebook, and a simple proof sheet with a colleague just outside the frame; a closed or side-placed unbranded laptop/phone may appear but is not the focus.
Subject: mature Japanese woman who plausibly runs the business, natural skin texture and ordinary clothing; head, complete face, shoulders, forearms and both working hands clearly visible; relaxed attentive expression, gaze slightly toward an off-frame conversation rather than down at a laptop.
Style/medium: high-end yet natural documentary editorial photography, subtle fine film grain, realistic material texture, no beauty retouching.
Composition/framing: true 16:9 wide composition intended for 2400×1350. Place the owner right of center around x=70%; preserve the left 42% as calm low-detail negative space for HTML copy. Keep face at least 10% from top/right edges, and keep head, shoulders and hands safely inside the central 80%. Eye-level medium-wide shot, 35–50mm lens look.
Lighting/mood: soft natural daylight, warm-neutral, reassuring, understated, not cinematic or glossy.
Color palette: mostly natural wood, ivory, charcoal; restrained teal accent in a shelf or notebook and small coral accent in a cloth or card, never full-frame brand coloring.
Constraints: no text, no letters, no numbers, no signage, no logo, no watermark, no legible UI, no price, no brand on devices; anatomically correct hands and fingers; tools and furniture structurally plausible.
Avoid: AI robot, blue glow, hologram, sci-fi, posed handshake, exaggerated smile, all-beige room, luxury showroom, 20s fashion model, heavy bokeh, excessive tidiness, staring at laptop, Apple-like device logo.
```

## Mobile hero

- Master filename: `akinael-hero-mobile-v2-master.png`
- Generator: `built-in image_gen`
- Date: `2026-08-25`
- Source: 1086×1448 RGB PNG, exact 3:4
- Reference image used: yes. Image 1 was `akinael-hero-desktop-v2-master.png`. The selected output is a single targeted retry that also used the first mobile draft as Image 2 to preserve identity and tone while correcting composition.
- Iteration provenance: the first mobile draft kept the identity but placed the face too centrally and allowed work objects into the lower overlay zone. One targeted retry shifted the subject right and increased upper-left copy space.
- Limitations: identity, head, shoulders and both hands are preserved, but some color cards and the pointing fingertip still approach or enter the lower 18% overlay zone. Keep lower-page controls compact and validate the final CSS crop at 320×568.

Final production prompt for the selected retry:

```text
Use case: identity-preserve / photorealistic-natural
Asset type: AKINAEL AI landing-page hero, mobile-specific master
Input images: Image 1 is the desktop hero identity, shop, styling and color-treatment reference only. Image 2 is the first mobile draft and is the identity, clothing, lighting, shop and overall action reference for this targeted composition correction.
Primary request: create a genuinely new vertical 3:4 photograph of the same mature Japanese woman owner in the same believable compact shop, not a crop or enlargement of the desktop frame. Preserve her identity, age, hair, ordinary clothing, shop character and editorial color treatment.
Scene/action: closer but still contextual upper-body view as she calmly discusses and checks a small set of unprinted color cards and a notebook with someone just outside frame; one hand points to the proof while the other steadies the notebook. Show enough shelves/worktable to identify a small real business and the sense that work is becoming organized.
Style/medium: high-end natural documentary editorial photography, realistic skin and hands, subtle fine film grain, no beauty retouching.
Composition/framing: true 3:4 portrait intended for 1080×1440 and legible down to 320×568. Complete head, face, shoulders, forearms and important hands all inside the central safe area. Face at least 12% below the top and 10% from both side edges; shift the woman and her face clearly toward the upper-middle/right, leaving a wider calm low-detail band above and upper-left so future HTML heading cannot collide. Move the notebook, pointing hand, steadying hand, proof and all color cards upward so every important work element is fully above the bottom 18% safe boundary. Keep the bottom 18% visually nonessential. Do not depend on object-position.
Lighting/mood: same warm-neutral soft daylight and reassuring candid mood as Image 1 and Image 2.
Color palette: same natural wood/ivory/charcoal with restrained teal and small coral accents.
Constraints: new camera composition, not a crop; no text, letters, numbers, signage, logos, watermark, readable UI, prices or branded devices; anatomically correct fingers; plausible cards/notebook/furniture.
Avoid: face close-up, cut head or shoulders, hands below frame, important cards or notebook in the bottom 18%, centered or left-positioned face, smartphone-only pose, laptop stare, glossy ad model, heavy bokeh, AI robot, blue glow, sci-fi, Apple-like logo.
Targeted correction: preserve the strong identity and natural action of Image 2, but correct only the mobile safe-area composition by shifting the subject right and lifting all important hand/work context above the bottom overlay zone.
```

## Beauty / salon

- Master filename: `industry-beauty-v2-master.png`
- Generator: `built-in image_gen`
- Date: `2026-08-25`
- Source: 1448×1086 RGB PNG, exact 4:3
- Reference image used: no
- Iteration provenance: accepted from the first generation; no retry
- Limitations: the built-in output is below the intended 1600×1200 size, so the requested production master is mildly upscaled. Prefer the 800w derivative when sufficient. A centered narrow mobile crop intentionally loses the far-left cart edge and far-right reflection, while the face, hands, mirror and defining tools remain prioritized.

Final production prompt:

```text
Use case: photorealistic-natural
Asset type: AKINAEL AI industry card — beauty/salon
Primary request: a candid, believable Japanese neighborhood hair salon owner preparing for a real client consultation and service, clearly identifiable as a hair salon.
Scene/backdrop: compact clean salon in Japan with a real mirror, one salon chair, small wheeled tool cart, folded towel, combs and brushes; mildly lived-in and not perfectly staged.
Subject: Japanese female salon owner in her early-to-mid 40s arranging a cape and tools while speaking naturally with one seated client shown from the side/back. Owner's complete face, natural hands, client, mirror, chair and essential hair tools all visible. No medical procedure.
Style/medium: photorealistic natural editorial photography, realistic skin and fabric, subtle consistent film grain, restrained contrast.
Composition/framing: true 4:3 master intended for 1600×1200; eye-level medium-wide. Keep face, both working hands, mirror and defining tools inside central 80%; generous margin above head; compose to tolerate a later centered 4:5 mobile crop and lower caption overlay.
Lighting/mood: clean soft daylight, neutral-to-slightly cool; genuine attentive service, no camera gaze.
Color palette: real salon neutrals with restrained teal chair or cart and a small coral towel/clip accent; avoid all-beige.
Constraints: no readable text, letters, numbers, signage, menu, packaging, logo, watermark or branded devices; anatomically correct hands/fingers, accurate mirror reflection, plausible combs/brushes/cart/chair.
Avoid: medical treatment, spa massage, apron-only generic portrait, fashion-model perfection, exaggerated smile, heavy bokeh, glossy luxury salon, sterile studio, extra/fused fingers or tools.
```

## Restaurant

- Master filename: `industry-restaurant-v2-master.png`
- Generator: `built-in image_gen`
- Date: `2026-08-25`
- Source: 1448×1086 RGB PNG, exact 4:3
- Reference image used: no
- Iteration provenance: accepted from the first generation after full-scale hand, food, dish and tool inspection; no retry
- Limitations: the built-in output is below the intended 1600×1200 size, so the requested production master is mildly upscaled. Prefer the 800w derivative when sufficient. The customer is intentionally shown only from the side/back at the right edge.

Final production prompt:

```text
Use case: photorealistic-natural
Asset type: AKINAEL AI industry card — restaurant
Primary request: candid scene in a small independent Japanese neighborhood cafe/restaurant where service and food preparation are immediately clear, not a person merely posing with a plate.
Scene/backdrop: compact working kitchen and wooden counter in Japan, modest real equipment, stacked clean dishes, one freshly prepared simple lunch and a few utensils; hygienic but naturally lived-in.
Subject: Japanese male owner in his late 40s to mid 50s placing the finished dish on the counter while speaking with one customer seen only from the side/back foreground. Complete face, head, both natural hands, dish, counter and key kitchen tools visible.
Style/medium: photorealistic documentary editorial photography, natural pores and fabric, subtle unified film grain, restrained contrast.
Composition/framing: true 4:3 master intended for 1600×1200; eye-level medium-wide. Keep face, hands, dish and key kitchen/counter context in central 80%; margin above head; safe for centered 4:5 mobile crop and lower caption overlay.
Lighting/mood: warm morning or midday window light, sincere and calm, no camera gaze.
Color palette: natural wood and dark charcoal with a restrained teal apron or ceramic and a small coral cloth accent.
Constraints: no readable text, menu, letters, numbers, signage, packaging, logo, watermark or branded appliance; anatomically correct fingers; accurate dishware, chopsticks/utensils and kitchen equipment; realistic food.
Avoid: posed plate-holding stock photo, luxury restaurant, industrial studio, exaggerated grin, all-beige room, strong bokeh, extra/fused fingers, malformed dishes/utensils, Apple-like logo.
```

## Classroom / school

- Master filename: `industry-school-v2-master.png`
- Generator: `built-in image_gen`
- Date: `2026-08-25`
- Source: 1448×1086 RGB PNG, exact 4:3
- Reference image used: no
- Prompt provenance: the exact tool-call serialization was unavailable; the generating agent supplied the following normalized final production prompt as the authoritative record.
- Limitations: whiteboard geometric shapes are decorative rather than substantive teaching content. Both learners are readable in the 4:3 master but become partial at the narrowest centered `cover` crops.

Normalized final production prompt:

```text
Use case: photorealistic-natural. Asset type: AKINAEL AI industry card — classroom/school. Primary request: candid adult-learning scene in a modest small Japanese neighborhood classroom, clearly showing the relationship between one instructor and two learners rather than a craft workshop. Scene: Japanese male instructor in his early 50s explaining material at a learning table to two adult learners, with notebooks, abstract proof sheets, learning desks, and a whiteboard containing colored geometric shapes only. Style: natural documentary editorial photography, realistic skin/materials, subtle film grain, restrained contrast. Composition: true 4:3 intended for 1600×1200, eye-level medium-wide; instructor face, gesturing hands, both learners and learning materials in central 80%, margin above head, safe for centered 4:5 crop. Lighting/mood: cool-neutral daylight, patient and conversational, nobody looking at camera. Palette: ivory/white/wood with restrained teal and coral learning materials. Constraints: no readable text, letters, numbers, logos, signage or UI; natural hands; plausible furniture; adult learners. Avoid: craft workshop, children, lecture hall, posed stock photo, all-beige room, pseudo-writing, extra/fused fingers, strong bokeh.
```

## Local service — residential maintenance

- Master filename: `industry-local-service-v2-master.png`
- Generator: `built-in image_gen`
- Date: `2026-08-25`
- Source: 1448×1086 RGB PNG, exact 4:3
- Reference image used: no
- Prompt provenance: the exact tool-call serialization was unavailable; the generating agent supplied the following normalized final production prompt as the authoritative record.
- Limitations: this image depicts residential maintenance specifically and must not be described as a generic or medical/care local service. A large lower caption can obscure the tool pouch, although the hinge and working hands remain visible.

Normalized final production prompt:

```text
Use case: photorealistic-natural. Asset type: AKINAEL AI industry card — local service, specifically residential maintenance. Primary request: candid home visit by a small independent Japanese residential-maintenance professional, with service context instantly clear and not resembling massage, medicine, or care work. Scene: modest lived-in Japanese home; Japanese male professional late 40s to 50s in restrained teal work jacket kneels beside a storage cabinet and inspects/adjusts its hinge with a normal screwdriver while a woman customer around 60 observes and discusses the issue; compact open tool pouch and structurally plausible hardware visible. Style: natural documentary editorial photography, realistic skin/tools/materials, subtle film grain, restrained contrast. Composition: true 4:3 intended for 1600×1200; faces, hands, screwdriver, cabinet hinge and customer interaction central 80%, headroom, safe for centered 4:5 crop. Lighting: calm natural home daylight. Palette: natural wood/ivory/charcoal, restrained teal jacket and small coral cloth accent. Constraints: no text, labels, logos, branded tools; anatomically correct hands; plausible tools and cabinet. Avoid: massage, medical/care uniforms, staged handshake, luxury home, generic consultation-only scene, malformed fingers/tools, exaggerated smile, heavy bokeh.
```

## Create / review process illustration

- Master filename: `ai-create-review-process-v2-master.png`
- Generator: `built-in image_gen`
- Date: `2026-08-25`
- Source: 1586×992 RGB PNG, approximately 8:5
- Reference image used: no
- Iteration provenance: accepted from the first generation; no retry
- Limitations: the source differs trivially from the nominal 1600×1000 size and was resized during export without material loss. The illustration deliberately contains no labels, so surrounding HTML copy must explicitly name and explain the two stages.

Final production prompt:

```text
Use case: productivity-visual / illustration
Asset type: AKINAEL AI website process explanation illustration
Primary request: a refined 2D editorial illustration that communicates two intentionally separate stages — making something, then independently checking it to reduce omissions — entirely without words.
Scene/backdrop: warm ivory paper-like background that blends into #F7F3EA, with ample clean margins.
Subject/concept: two distinct side-by-side work areas separated by a visible gutter. In the left area, a pair of human hands assembles several simple coral paper modules/cards into one organized page; in the right area, a different pair of hands uses a teal transparent frame/checking stencil to compare a finished page against a separate checklist represented only by aligned dots and empty geometric boxes. A restrained connecting path shows left-to-right sequence, but each station is structurally independent. Include one small deliberately missing module being caught at the checking station to suggest fewer omissions.
Style/medium: elegant flat 2D editorial illustration, matte paper cutout and ink, thin dark-teal outlines, subtle paper grain, restrained shadow only from paper layering; sophisticated, approachable, not childish.
Composition/framing: true 8:5 landscape master intended for about 1600×1000; balanced two-column structure, central gutter obvious, main objects safely inside central 85%, generous outer whitespace.
Color palette: coral #E87861 and teal #164E4A as primary, ivory #F7F3EA background, small mist #DDE9E5 and muted warm sand accents.
Constraints: absolutely no text, letters, numbers, logos, interface copy or watermark; hands stylized but anatomically coherent; two stages must be visually separate and sequence understandable from shape/composition alone.
Avoid: 3D render, gloss, bevels, toy-like plastic, photorealism, robot, brain, circuit, hologram, space, blue neon, magic sparkles, speech bubbles, readable checklist labels, tiny clutter.
```
