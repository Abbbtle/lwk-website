---
name: Living With Krishna
description: Learn devotional skills in the comfort of your home.
colors:
  marigold-saffron: 'oklch(70.5% 0.213 47.604)'
  saffron-deep: 'oklch(64.6% 0.222 41.116)'
  saffron-ink: 'oklch(55.3% 0.195 38.402)'
  saffron-wash: 'oklch(98% 0.016 73.684)'
  ink-black: '#000000'
  ink-black-hover: '#282828'
  charcoal: 'oklch(21% 0.034 264.665)'
  graphite: 'oklch(37.3% 0.034 259.733)'
  slate: 'oklch(44.6% 0.03 256.802)'
  pebble: 'oklch(55.1% 0.027 264.364)'
  divider-gray: 'oklch(87.2% 0.01 258.338)'
  hairline-gray: 'oklch(92.8% 0.006 264.531)'
  soft-gray: 'oklch(96.7% 0.003 264.542)'
  band-gray: 'oklch(98.5% 0.002 247.839)'
  morning-paper: '#f9f9f9'
  white: '#ffffff'
typography:
  display:
    fontFamily: 'Poppins, ui-sans-serif, system-ui, sans-serif'
    fontSize: '3.75rem'
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: '-0.025em'
  headline:
    fontFamily: 'Poppins, ui-sans-serif, system-ui, sans-serif'
    fontSize: '2.25rem'
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: '-0.025em'
  title:
    fontFamily: 'Poppins, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1.25rem'
    fontWeight: 600
    lineHeight: 1.2
  lead:
    fontFamily: 'Poppins, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1.125rem'
    fontWeight: 400
    lineHeight: 1.6
  body:
    fontFamily: 'Poppins, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: 1.5
  secondary:
    fontFamily: 'Poppins, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: 1.5
  meta:
    fontFamily: 'Poppins, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.75rem'
    fontWeight: 400
    lineHeight: 1.333
  label:
    fontFamily: 'Poppins, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1rem'
    fontWeight: 700
    lineHeight: 1.5
rounded:
  badge: '6px'
  control: '8px'
  card: '12px'
  feature: '24px'
  round: '9999px'
spacing:
  xs: '4px'
  sm: '8px'
  md: '16px'
  lg: '24px'
  xl: '32px'
  2xl: '48px'
  section: '64px'
  section-wide: '96px'
components:
  button-primary:
    backgroundColor: '{colors.ink-black}'
    textColor: '{colors.morning-paper}'
    typography: '{typography.label}'
    rounded: '{rounded.control}'
    padding: '10px 20px'
  button-primary-hover:
    backgroundColor: '{colors.ink-black-hover}'
  button-outline:
    backgroundColor: 'transparent'
    textColor: '{colors.ink-black}'
    typography: '{typography.label}'
    rounded: '{rounded.control}'
    padding: '10px 20px'
  button-outline-hover:
    backgroundColor: '{colors.ink-black}'
    textColor: '{colors.white}'
  button-brand:
    backgroundColor: '{colors.marigold-saffron}'
    textColor: '{colors.ink-black}'
    typography: '{typography.label}'
    rounded: '{rounded.control}'
    padding: '10px 20px'
  button-brand-hover:
    backgroundColor: '{colors.saffron-deep}'
  card:
    backgroundColor: '{colors.white}'
    rounded: '{rounded.card}'
    padding: '20px'
  input:
    backgroundColor: '{colors.morning-paper}'
    textColor: '{colors.charcoal}'
    rounded: '{rounded.control}'
    padding: '10px 16px'
  search-field:
    backgroundColor: '{colors.white}'
    textColor: '{colors.charcoal}'
    rounded: '{rounded.round}'
    padding: '10px 48px 10px 20px'
  filter-pill:
    textColor: '{colors.slate}'
    rounded: '{rounded.control}'
    padding: '8px 16px'
  filter-pill-active:
    textColor: '{colors.ink-black}'
  badge-free:
    backgroundColor: '{colors.marigold-saffron}'
    textColor: '{colors.ink-black}'
    typography: '{typography.meta}'
    rounded: '{rounded.badge}'
    padding: '2px 8px'
---

# Design System: Living With Krishna

## Overview

**Creative North Star: "The Saffron Classroom"**

A bright, orderly classroom that anyone recognises at a glance. The room is white and light gray, the writing is charcoal, the furniture is plain and well made, and one warm colour, Marigold Saffron, points to what to do next. Nothing in the room competes with the lesson. The mood is warm, clear and unhurried: friendly without being playful, easy to read, and calm in its pacing and motion.

The system follows the earlier Living With Krishna POC (https://livingwithkrishna.netlify.app) and takes Udemy as its reference for familiarity: full-width photo banners, image-led course cards, rows that swipe on phones and become grids on wider screens. Visitors range from newcomers to long-time devotees, many on low-end phones and slow connections, so the room stays light: one eager image per page, flat surfaces, small tokens, and motion that loads only after the page.

Depth comes from hairline gray borders, not shadows; buttons are bold and plain, as in the POC; the large rounded feature panels on the home page are the one place the room relaxes into generous shapes.

**Key Characteristics:**

- White and light gray canvas, charcoal text, one saffron accent, black primary buttons.
- Poppins in three weights (400, 600, 700), large headings tight, reading text open and capped at 70 characters a line.
- Rounded corners from three tokens; no square corners anywhere.
- Hairline borders first; faint shadows only for things that float.
- Quick, quiet motion that never touches what is on screen when the page opens.

## Colors

One warm accent on a cool, quiet field of grays. The values are Tailwind 4's OKLCH palette (the hex in brackets is the nearest sRGB match); the POC's saffron was Tailwind 3's orange-500 (#f97316), slightly less vivid than what renders today.

### Primary

- **Marigold Saffron** (Tailwind orange-500, about #ff6900): the accent. Primary calls to action on photos and dark panels, the current slide's dot, the Free badge, the early-access message, active and hover highlights, and the head bead of the japa strand on the contact page.
- **Saffron Deep** (orange-600, about #f54900): hover state of saffron buttons.
- **Saffron Ink** (orange-700, about #ca3500): saffron text on white or light gray (active navigation, hover links, check marks), where Marigold Saffron is too light to read.
- **Saffron Wash** (orange-50, about #fff7ed): the background of light saffron notes and icon chips.

### Neutral

- **Ink Black** (#000000): primary buttons, outline-button borders, the footer, dark page headers and panels, the logo on light backgrounds.
- **Ink Black Hover** (#282828): hover state of black buttons.
- **Charcoal** (gray-900, about #101828): body text and headings.
- **Graphite** (gray-700, about #364153): longer supporting text and form text.
- **Slate** (gray-600, about #4a5565): secondary text, inactive filter pills, intros.
- **Pebble** (gray-500, about #6a7282): meta text (instructor names, lesson counts), placeholder icons.
- **Divider Gray** (gray-300, about #d1d5dc): outlines of menus, inputs, FAQ rules and plan cards.
- **Hairline Gray** (gray-200, about #e5e7eb): borders of cards and panels, list dividers.
- **Soft Gray** (gray-100, about #f3f4f6): the home page's feature tiles and plan cards.
- **Band Gray** (gray-50, about #f9fafb): alternate full-width section bands.
- **Morning Paper** (#f9f9f9): the page canvas and the fill of boxed inputs.
- **White** (#ffffff): cards, the header, dialogs.

### Named Rules

**The One Flame Rule.** Marigold Saffron marks the next step and stays a small share of any screen; black carries every other button. Large saffron panels are reserved for the early-access offer.

**The Ink-on-Saffron Rule.** Text on saffron is black; saffron text on light backgrounds is Saffron Ink. White text never sits on saffron.

**The POC Palette Rule.** No colour outside this palette joins the brand. Status colours (green for done, red for errors, yellow for staff notes) appear only in their messages.

## Typography

**Display Font:** Poppins (with ui-sans-serif, system-ui, sans-serif)
**Body Font:** Poppins

**Character:** One geometric sans in three weights: friendly round letterforms for a broad audience, given hierarchy by size and spacing rather than heaviness.

### Hierarchy

- **Display** (600, 3.75rem on wide screens, 2.25rem on phones, 1.1, -0.025em): the home banner headline and page heroes.
- **Headline** (600, 2.25rem, 1.2, -0.025em): section headings ("Start with a beginner course") and page titles.
- **Title** (600, 1.25rem, 1.2): panel and card-group headings; card titles use 1.125rem at 1.25.
- **Lead** (400, 1.125rem, 1.6): section intros and page summaries, at most 70 characters a line.
- **Body** (400, 1rem, 1.5): reading text, course descriptions, help articles, at most 70 characters a line.
- **Secondary** (400, 0.875rem, 1.5): supporting text, notes, card subtitles.
- **Meta** (400, 0.75rem, 1.333): timestamps, lesson counts, instructor names, badges. Never for primary content.
- **Label** (700, 1rem): buttons and prices; uppercase only in badges.

### Named Rules

**The Three Weights Rule.** 400 for reading, 600 for headings and labels, 700 for buttons and prices. Nothing heavier, nothing lighter; no text under 12px.

**The 70-Character Rule.** Reading text stops at 70 characters a line, however wide the screen.

## Layout

Every page sits on one board: the header, the footer and each section share a 1440px content width with 16px side gutters on phones, 24px from 640px and 32px from 1024px, so their edges line up everywhere. Narrower reading columns start at the board's left edge.

Spacing follows a 4px grid, with 8px steps between larger blocks: 16, 24, 32 and 48px inside sections, and 64px (96px from 1024px) between sections. Rows of cards swipe sideways on phones (cards at 72-82% of the width, snapping) and become two- or three-column grids from 640px. The home banner is full width: photo above the text on phones, text over a dark fade beside the subject on wider screens.

**The One Board Rule.** Nothing breaks the shared content width except full-bleed bands and the home banner; everything inside a section starts on the board's edge.

**The 46px Control Rule.** Buttons and text boxes have 10px of padding above and below, so with the 24px line and 1px borders they stand 46px tall, clear of the 44px touch target. Icon-only buttons are 44px squares.

## Elevation & Depth

Flat by default, hairlines first. Cards, panels, lists and tables separate from the canvas with a 1px Hairline Gray border and at most a faint shadow; things that float above the page (menus, dialogs, the sticky course card, the help button, the banner arrows) take a slightly deeper but still faint shadow. On black surfaces an edge of white at 20% replaces any shadow.

### Shadow Vocabulary

- **Soft** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05), 0 1px 3px 0 rgb(0 0 0 / 0.04)`): cards and panels on the page.
- **Raised** (`box-shadow: 0 8px 24px -4px rgb(0 0 0 / 0.07), 0 2px 6px -2px rgb(0 0 0 / 0.05)`): menus, dialogs, the sticky course card, floating buttons.

### Named Rules

**The Hairline-First Rule.** A raised surface gets a 1px gray border before any shadow, and no shadow layer passes 7% black.

**The Colour-Not-Lift Rule.** Hover changes a border or text colour; it never grows a shadow or scales a card.

## Shapes

Softly rounded throughout, from three tokens: badges at 6px, buttons, inputs and filter pills at 8px, cards, panels, menus, dialogs and photos at 12px. The home page's large feature panels (feature tiles, the early-access and mission panels, the instructor photo) relax to 24px. Only circles (avatars, step numbers, dots, the help button) and search fields are fully round.

**The Token Corners Rule.** Every corner comes from a token. No square corners and no one-off radii.

## Components

### Buttons

Bold and plain, as in the POC.

- **Shape:** gently rounded (8px), 46px tall, 700 weight.
- **Primary:** Ink Black fill with Morning Paper text; hover darkens to Ink Black Hover in 150ms.
- **Outline:** black 1px border and black text; on hover a black fill sweeps in from the left in 200ms (a transform on a layer behind the text) and drains back in 150ms, while the text turns white.
- **Brand:** Marigold Saffron fill with black text, on photos and dark panels; hover deepens to Saffron Deep.
- **Light:** white outline and text on photos; fills white on hover.
- **Press:** any button dips to 98% for 100ms; not with reduced motion.

### Chips

- **Filter pills:** 8px corners, 2px border, 600 weight. Inactive: no border colour, Slate text, black on hover. Active: black outline with a thicker black bar along the bottom edge, drawn inside the outline so pills stay aligned.
- **Badges:** 6px corners, 12px uppercase 700. Free is saffron with black text; type badges are black with white text; Sample is a dashed gray outline.

### Cards / Containers

- **Corner Style:** 12px.
- **Background:** White on the Morning Paper canvas; Soft Gray for the home feature tiles and plan cards.
- **Shadow Strategy:** Hairline Gray border plus Soft shadow (see Elevation & Depth).
- **Border:** 1px Hairline Gray; on linked cards it darkens to a mid gray (gray-400, about #99a1af) on hover, in 150ms.
- **Internal Padding:** 20-24px; course and resource cards run their image to the edges.
- **Callouts:** notes and messages use a 12px rounded box with a light 1px border in their own colour (saffron, green or red) on a matching wash; no one-sided accent bars.

### Inputs / Fields

- **Style:** 1px Divider Gray border, Morning Paper fill, 8px corners, 46px tall; labels sit above in 14px 600.
- **Search:** fully round field with a white fill and black border, a 44px search button inside its right end.
- **Focus:** border turns black (boxed fields) or a 2px saffron ring appears (search fields).
- **Error:** red border and a red message under the field.

### Navigation

- **Header:** white, a Hairline Gray bottom edge and Soft shadow, the logo at 48px, the search field, 16px links in dark gray (gray-800, about #1e2939) with Saffron Ink for the current page and on hover, Log In as an outline button and Sign Up as a primary button.
- **Mobile:** below 1280px a 44px menu button opens a panel that drops 4px into place in 200ms; the page behind it stops scrolling while it is open.
- **Footer:** Ink Black with white text, the white logo, link groups at 1.125rem 600 headings, saffron on hover.

### Home banner (signature)

Full-width slides of a photo with white text over a dark fade, or a saffron panel with the Krishna drawing in black. Slides change only from the arrows (48px round white buttons, wider screens) or the dots (44px targets, the current one a saffron bar); a change slides in 300ms. No auto-rotation, and nothing in the banner moves when the page opens.

### Motion

- **Durations:** 100, 150, 200 and 300ms only; ease-out (`cubic-bezier(0.16, 1, 0.3, 1)`) to arrive, ease-in (`cubic-bezier(0.7, 0, 0.84, 0)`) to leave.
- **Scroll reveals:** content that starts below the fold fades in and rises 8px as it scrolls into view (blocks 300ms, cards 200ms, 30ms apart, a gentle ease-out) and is never hidden without scripts. Wheel scrolling is smoothed for a mouse or trackpad; touch screens keep their own scrolling.
- **Menus and dialogs:** menus drop 4px (150ms), the help panel slides 8px from the right and dialogs rise 8px (200ms), with backdrops fading in 150ms; FAQ answers fade in (150ms).
- **Reduced motion:** nothing slides, scales or smooths; things simply appear.

**The Quiet Motion Rule.** Motion only clarifies a change: 8px or less, 300ms or less, and nothing that is on screen when the page opens moves.

## Do's and Don'ts

### Do:

- **Do** use black bold buttons for primary actions, and saffron buttons only on photos and dark panels.
- **Do** separate surfaces with a 1px Hairline Gray border and the Soft shadow; give floating layers the Raised shadow.
- **Do** take every corner from the badge (6px), control (8px) or card (12px) token.
- **Do** cap reading text at 70 characters a line and keep text at 12px or larger.
- **Do** mark below-the-fold sections with the scroll reveal attributes, and leave everything above the fold still.
- **Do** make icon-only buttons 44px squares.

### Don't:

- **Don't** add colours outside the POC palette; the light blue of the old circular logo is not part of the brand.
- **Don't** use weights above 700 or below 400.
- **Don't** add one-sided accent bars to cards; callouts use a full light border in their colour.
- **Don't** grow shadows, scale cards or use bounce, elastic or looping decoration.
- **Don't** auto-rotate the home banner or animate anything at first paint.
- **Don't** use the japa-mala motif anywhere but the contact page.
- **Don't** use glass blur, gradient buttons or decorative blobs.
