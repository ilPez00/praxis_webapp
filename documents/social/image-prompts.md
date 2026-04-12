# Image Generation Prompts

For Midjourney, DALL·E 3, Stable Diffusion XL, or Leonardo.ai. All prompts use the Praxis brand palette from `README.md`.

**Brand tokens:**

- Primary orange: `#F97316`
- Secondary purple: `#8B5CF6` / `#A78BFA`
- Accent amber: `#F59E0B`
- Background dark: `#0A0B14`
- Font: Inter / Geist / JetBrains Mono

**Universal suffix to append to most prompts:**

> `cinematic lighting, dark background #0A0B14, minimalist, high contrast, 1:1 aspect ratio, ultra-detailed, no text unless specified, flat UI aesthetic`

---

## Category 1 — Hero / Launch imagery

### P1. "Goal tree as a living organism"

**Use for:** Instagram hero, Twitter card, LinkedIn launch
**Platforms:** MJ / DALL·E / SDXL

> A glowing bonsai tree rendered in abstract geometric shapes, branches in gradient orange `#F97316` to deep purple `#8B5CF6`, with small pulsing nodes representing goals, floating against a matte dark navy background `#0A0B14`, subtle particles in the background, cinematic volumetric lighting from the top-left, shallow depth of field, flat minimal UI aesthetic blended with organic growth, style of Apple keynote product shots, 1:1 square composition, no text, ultra-detailed, 4K

### P2. "Single flame on dark"

**Use for:** streak/fire content, tweet cards
**Platforms:** MJ / SDXL

> A single minimalist flame icon in vivid orange `#F97316` with glowing embers, suspended in the center of a completely dark void `#0A0B14`, hyper-clean, flat design with subtle volumetric glow, no background detail, inspired by SF Symbols aesthetic, 1:1, centered, poster-worthy, 4K

### P3. "Morning ritual" (lifestyle shot)

**Use for:** Instagram product caption, TikTok cover
**Platforms:** MJ / DALL·E

> Hands holding a phone in vertical orientation showing a minimalist habit tracker app interface, morning light through a window, steaming coffee cup softly out of focus in the foreground, the phone screen shows an orange flame streak number and a single green checkmark, warm cinematic color grading, shot on Sony A7IV, 50mm f1.8, shallow depth of field, editorial lifestyle photography, 1:1

### P4. "Accountability duo" (two-person silhouette)

**Use for:** accountability buddy posts
**Platforms:** MJ / DALL·E

> Two silhouettes running side by side at sunrise on an empty road, one slightly ahead encouraging the other, silhouettes rendered in deep orange gradient against a deep purple-to-navy dawn sky, cinematic wide composition, motion blur on the feet, inspired by Nike commercial aesthetic but minimalist, no text, 1:1 square crop

---

## Category 2 — Technical / flex imagery

### P5. "Code constellation"

**Use for:** LinkedIn technical post, Twitter dev-audience posts
**Platforms:** MJ / SDXL

> An abstract constellation of code brackets, semicolons, and TypeScript keywords floating in 3D space against a dark background `#0A0B14`, connected by thin glowing orange `#F97316` lines forming a dependency graph, some nodes highlighted in purple `#8B5CF6`, style of network topology visualization, cinematic depth of field, ultra-detailed, 1:1

### P6. "Goal tree schematic"

**Use for:** Technical deep-dive posts
**Platforms:** MJ / SDXL / DALL·E

> A technical blueprint-style diagram of a branching goal tree structure, nodes as circles in alternating orange and purple, branches as thin glowing lines, rendered as a minimalist infographic on a near-black background, schematic aesthetic, reminiscent of NASA technical diagrams but modern flat UI, 1:1 composition, no text labels, just structure

### P7. "Before/after build time" (conceptual)

**Use for:** Vite 8 technical post
**Platforms:** DALL·E / MJ

> Split composition: left half shows a large weathered hourglass filling slowly in warm amber light, right half shows a tiny crystal hourglass with almost no sand left in cool orange light, both against a matte black background, subtle dust particles, hyper-minimalist, cinematic lighting, 1:1, no text

---

## Category 3 — Instagram carousel / multi-slide

### P8. Carousel slide set — "Why Praxis" (5 slides)

Generate 5 images with matching aesthetic. Use the same prompt suffix for all:

> `Flat minimalist illustration, dark navy background #0A0B14, orange #F97316 and purple #8B5CF6 accents, Inter sans-serif headline space reserved at top, 1:1 square`

Slide 1 — **A goal tree, not a checklist**

> An abstract illustration contrasting a boring to-do checklist on the left with a vibrant branching organic tree on the right, arrow transition, minimalist flat, dark background, orange and purple, 1:1

Slide 2 — **One goal a day, not forty**

> A single bold circular target in vivid orange centered on a dark background, with 39 faded gray smaller targets scattered around but out of focus, minimalist flat design, 1:1

Slide 3 — **A real buddy, not a chatbot**

> Two abstract simplified human silhouettes facing each other, connected by a bright orange line, in contrast with a third faded robotic silhouette on the margin, minimalist flat illustration, dark background, 1:1

Slide 4 — **Streaks that matter**

> A large single flame icon in orange with the number "42" glowing softly underneath, no other UI elements, dark background, cinematic minimal, 1:1

Slide 5 — **Free forever. Pro optional.**

> Two minimalist price cards side by side, one labeled FREE in purple gradient and one labeled PRO in orange gradient, flat design, dark background, 1:1

---

## Category 4 — Meme / shareable formats

### P9. "The feature sprawl meme"

**Use for:** Twitter, IndieHackers
**Platforms:** DALL·E

> A cartoon developer drowning in a sea of sticky notes labeled with feature names (blank stickies), flailing arms above a whirlpool, orange sticky notes contrasting dark ocean, style of New Yorker cartoon but with a tech twist, 1:1

### P10. "The Rolldown shock"

**Use for:** Vite 8 technical tweet
**Platforms:** MJ / DALL·E

> A turtle labeled "Vite 6" being overtaken by a sleek orange rocket labeled "Vite 8 + Rolldown", cartoon style, dark background with motion lines, minimalist, 1:1

---

## Category 5 — Video thumbnails (TikTok / YouTube)

### P11. TikTok script #1 cover

> A smartphone held vertically in dim morning light with only the screen illuminated, showing a large orange flame icon and "42" in big numerals, moody cinematic, 9:16 aspect ratio

### P12. TikTok script #2 cover

> A young developer with a slightly frustrated expression sitting in a dark room with a single orange desk lamp, laptop screen reflecting blue light on their face, moody cinematic mid-shot, 9:16

### P13. YouTube build-in-public thumbnail

> A dramatic close-up of a git log output filling the frame with "820 commits" highlighted in vivid orange, rest of the text faded, matte dark background, cinematic shallow depth of field, 16:9

---

## How to use these

1. **Midjourney:** prepend `/imagine prompt:` and append `--ar 1:1 --style raw --v 6`. For 9:16 replace with `--ar 9:16`.
2. **DALL·E 3 (ChatGPT):** paste the prompt verbatim, then ask "make it more minimalist" or "match Apple keynote aesthetic" to refine.
3. **SDXL (Leonardo / Fooocus / local):** use prompts as-is, add negative prompts: `text, watermark, logo, low quality, blurry, busy background, cluttered`.
4. **After generation:** open in Figma or Canva, add the actual text overlays (dates, handles, taglines) using the brand tokens in `README.md`. Generators are unreliable at rendering text — always overlay manually.

## Quick quality checklist before posting any image

- [ ] No real user data, emails, or IDs visible
- [ ] Brand colors are within the palette (don't let the generator drift to red-orange or magenta-purple)
- [ ] 1:1 for IG/Twitter, 9:16 for TikTok/Reels, 1.91:1 for LinkedIn link preview
- [ ] Alt text written (accessibility + SEO)
- [ ] Compressed to <500KB before upload (TinyPNG / Squoosh)
