---
name: "No EXIF Pro"
description: "A clean, fast, private ComfyUI image workbench for local metadata cleanup and export."
colors:
  ink-black: "#0B0D10"
  graphite: "#101317"
  panel: "#15191E"
  panel-raised: "#1B2027"
  divider: "#2A3038"
  text-primary: "#F3F0E8"
  text-secondary: "#B4AFA5"
  text-muted: "#777D76"
  amber: "#E4B85E"
  amber-soft: "#F2CF7A"
  success: "#78B66F"
  danger: "#D8665A"
typography:
  display:
    fontFamily: "Pretendard Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "0"
  headline:
    fontFamily: "Pretendard Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0"
  title:
    fontFamily: "Pretendard Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "0"
  body:
    fontFamily: "Pretendard Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.45
    letterSpacing: "0"
  label:
    fontFamily: "Pretendard Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "0"
  mono:
    fontFamily: "Geist Mono, JetBrains Mono, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "34px"
  panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "16px"
  command-row-selected:
    backgroundColor: "{colors.panel-raised}"
    textColor: "{colors.amber-soft}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
---

# Design System: No EXIF Pro

## 1. Overview

**Creative North Star: "Private Command Workbench"**

No EXIF Pro should feel like a local command center for generated images: immediate like Raycast, structured like Linear, and canvas-aware like Figma. The interface is a product UI, not a brand page. It should be quiet enough for long sessions, fast enough for repeated batch work, and private enough to make local metadata handling feel trustworthy.

The visual system uses a restrained graphite base, a single amber accent, compact typography, and thin structural dividers. The command palette is the signature interaction layer: the user should be able to search, act, inspect, export, and switch modes without hunting through menus.

**Key Characteristics:**
- Dense product UI with strong hierarchy.
- Dark graphite workspace with one amber accent.
- Command-first navigation and fast keyboard workflows.
- Clear local/privacy signals.
- Polished motion for state change, not decoration.

## 2. Colors

The palette is a graphite workbench with amber as the only expressive accent.

### Primary
- **Workbench Amber** (#E4B85E): Primary action, active selection, command highlight, export confirmation, and focused controls. Use sparingly.
- **Soft Amber** (#F2CF7A): Small icon accents, selected outlines, and hover details on active surfaces.

### Neutral
- **Ink Black** (#0B0D10): App background and deepest canvas.
- **Graphite** (#101317): Main workspace background.
- **Panel Graphite** (#15191E): Standard panels, sidebars, inspectors, and command palette.
- **Raised Graphite** (#1B2027): Selected rows, active command results, hover states, and subtle lifted layers.
- **Divider Steel** (#2A3038): Hairline borders, panel separators, and low-emphasis rules.
- **Primary Text** (#F3F0E8): Main labels and content text.
- **Secondary Text** (#B4AFA5): Supporting descriptions and metadata labels.
- **Muted Text** (#777D76): Disabled states, shortcuts, and tertiary status.

### Tertiary
- **Local Success** (#78B66F): Small success dots and local-safe status only.
- **Privacy Danger** (#D8665A): Error, unsafe metadata, failed export, and destructive action warnings only.

### Named Rules

**The No AI Gradient Rule.** Purple/blue AI-gradient SaaS aesthetics are banned. Do not use violet neon, aurora blobs, lila glows, or blue-purple hero gradients.

**The One Accent Rule.** Amber is the single accent. Green and red are semantic state colors, not visual themes.

## 3. Typography

**Display Font:** Pretendard Variable with Segoe UI and system-ui fallback  
**Body Font:** Pretendard Variable with Segoe UI and system-ui fallback  
**Label/Mono Font:** Geist Mono, JetBrains Mono, Consolas, monospace

**Character:** Typography should be compact, Korean-safe, and product-native. The app should not use decorative display fonts, serif headings, or oversized marketing type.

### Hierarchy
- **Display** (700, 24px, 1.15): App title and rare high-level section titles.
- **Headline** (700, 18px, 1.2): Mode headers and primary panel titles.
- **Title** (650, 15px, 1.3): Group titles, inspector section names, command groups.
- **Body** (500, 13px, 1.45): Labels, descriptions, metadata rows, list content.
- **Label** (650, 12px, 1.25): Buttons, chips, shortcuts, compact controls.
- **Mono** (500, 12px, 1.35): Dimensions, paths, seed values, model names, file sizes, timestamps.

### Named Rules

**The Tool Type Rule.** Product labels stay small and readable. No clamp-based hero typography inside the app shell.

**The Metadata Mono Rule.** Numbers, dimensions, seeds, file sizes, and paths use mono typography or tabular figures.

## 4. Elevation

The system is flat by default and uses tonal layering before shadow. Depth comes from background steps, 1px dividers, active row fills, and subtle selected outlines. Shadows are reserved for overlays such as command palette, toast, modal, and popover layers.

### Shadow Vocabulary
- **Overlay Shadow** (`0 18px 60px rgba(0, 0, 0, 0.42)`): Command palette, modal, and floating confirmation surfaces.
- **Panel Lift** (`0 10px 30px rgba(0, 0, 0, 0.22)`): Rarely used for floating inspector sections or preview overlays.
- **Focus Glow** (`0 0 0 3px rgba(228, 184, 94, 0.22)`): Keyboard focus and selected command state.

### Named Rules

**The Flat Workbench Rule.** Standard panels do not float. If everything casts a shadow, nothing has hierarchy.

## 5. Components

### Buttons
- **Shape:** Rectangular with restrained corners (8px).
- **Primary:** Amber fill, ink text, 36px height, medium weight. Use for one primary action per panel.
- **Hover / Focus:** Slight tonal lift, amber focus ring, no neon glow.
- **Secondary / Ghost:** Transparent or raised graphite background with thin divider border. Use for utilities and mode-local actions.
- **Active:** Use `transform: translateY(1px) scale(0.99)` for tactile feedback.

### Chips
- **Style:** Compact rectangular chips with 6px radius, raised graphite fill, subtle divider border.
- **State:** Selected chips use amber text and a muted amber border. Semantic chips use green/red only for status.

### Cards / Containers
- **Corner Style:** 8px by default, 12px for major preview containers.
- **Background:** Panel Graphite for standard panels, Raised Graphite for selection and hover.
- **Shadow Strategy:** No standard card shadow. Use dividers and tonal steps.
- **Border:** 1px Divider Steel or transparent at rest.
- **Internal Padding:** 12px for dense lists, 16px for inspectors, 24px only for large empty states.

### Inputs / Fields
- **Style:** Raised graphite fill, 1px divider border, 8px radius, 34px to 38px height.
- **Focus:** Amber focus ring and clearer border. No full-surface glow.
- **Error / Disabled:** Error uses red text plus border. Disabled uses muted text and reduced opacity.

### Navigation
- **Mode Rail:** Slim, icon-first, graphite background, active state shown with amber text and selected surface.
- **Top Bar:** Compact command-aware toolbar with app identity, current mode, and local processing status.
- **Command Palette:** Floating overlay with search input, action rows, keyboard shortcut hints, recent actions, and selected-row amber treatment.

### Motion System

Motion should feel fast, precise, and expensive without calling attention to itself. Treat it like the weight and click of a good camera control: the user notices trust and responsiveness, not choreography.

**Motion Personality:** quiet mechanical confidence. No bounce, no elastic, no looping decorative movement, no page-load performance.

**Durations:**
- **Press feedback:** 80-120ms.
- **Hover and focus:** 120-160ms.
- **Selection movement:** 140-180ms.
- **Panel and tab transitions:** 180-220ms.
- **Command palette overlay:** 220-260ms.
- **Export completion toast:** 220-320ms.

**Easing:**
- **Standard:** `power3.out` or `cubic-bezier(0.22, 1, 0.36, 1)`.
- **Overlay enter:** `expo.out` or `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Exit:** `power2.in` at roughly 75% of the enter duration.

**GSAP-worthy moments:**
- **Command palette open/close:** fade + 8px vertical travel + subtle scale from `0.985` to `1`; focus input immediately.
- **Selected command row movement:** FLIP-style transform so the highlight feels attached to the user's arrow-key movement.
- **Inspector panel switch:** old panel fades and slides 8-12px out while the new panel enters, capped under 220ms.
- **Export completion:** a small amber trace or check state, then a compact toast. No confetti, no celebratory burst.
- **Drag and drop:** lift selected thumbnails with scale `1.015`, shadow increase, and a precise drop-settle.

**Implementation rules:**
- Use GSAP when a sequence needs a timeline, interruption, or shared element movement.
- Use CSS transitions for simple hover, focus, active, and color changes.
- Prefer `transform`, `opacity`, bounded blur, and small shadow changes.
- Do not animate `width`, `height`, `top`, `left`, or margins for routine motion.
- Every animation needs a `prefers-reduced-motion` alternative: instant state, short crossfade, or no movement.

### Signature Component: Command Palette

The command palette is the fastest path through the app. It should support actions such as "이미지 추가", "EXIF 제거", "그리드 내보내기", "메타데이터 확인", "Pixiv 가져오기", and "프롬프트 카드 만들기". Results appear as dense rows with icon, title, short helper text, and shortcut or scope hint.

## 6. Do's and Don'ts

### Do:
- **Do** keep the app shell graphite, quiet, and task-first.
- **Do** use amber only for primary action, active selection, focus, and command highlight.
- **Do** prioritize command palette, keyboard access, and fast action discovery.
- **Do** use mono typography for dimensions, file paths, seeds, and model names.
- **Do** use GSAP-level motion for command palette open/close, selected-row movement, toast, modal, and panel transitions.
- **Do** respect `prefers-reduced-motion` with shorter motion or crossfade alternatives.
- **Do** make local/privacy state visible in top bar, footer, or inspector status areas.

### Don't:
- **Don't** use purple/blue AI-gradient SaaS visuals, neon glows, aurora blobs, or generic AI hero styling.
- **Don't** make the app cute, playful, emoji-heavy, or toy-like.
- **Don't** mimic heavy Photoshop chrome with too many competing toolbars.
- **Don't** use decorative glassmorphism, oversized rounded cards, or gradients as filler.
- **Don't** animate layout properties like width, height, top, or left for routine motion.
- **Don't** make users wait through choreographed page-load sequences.
- **Don't** hide critical privacy or export state behind decorative copy.
