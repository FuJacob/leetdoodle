# Leetdoodle Design Manifesto

## Why This Exists

Leetdoodle is starting to develop a real visual language.

We recently introduced a softer, slightly rounded chrome style for the canvas
controls. It feels better than the older straight-edged treatment because it is:

- calmer
- more intentional
- easier to scan
- more consistent with the warm neutral theme already in the app

Right now the app mixes two systems:

- older square-edged cards and controls
- newer rounded controls and dock surfaces

That inconsistency makes the product feel accidental.

This document defines the design system we want going forward so new work
extends one coherent visual language instead of adding another local style.

## Visual Thesis

Leetdoodle should feel like a warm, focused workspace for collaborative problem
solving.

The product is not trying to feel:

- corporate
- glassy
- hyper-minimal
- toy-like

It should feel:

- warm
- grounded
- precise
- quiet
- slightly playful

The best shorthand is:

> soft geometry, crisp borders, warm surfaces, restrained color

## Core Principles

### 1. Soft By Default

Controls and surfaces should use slight rounding by default.

This does **not** mean everything becomes bubbly or pill-shaped.
It means hard 90-degree corners are no longer the default for UI surfaces.

Default posture:

- controls: softly rounded
- cards and nodes: softly rounded
- floating panels and docks: softly rounded
- pills and tags: fully rounded

Exceptions:

- canvas edges that sit flush to the viewport
- separators, rules, and rails
- purely structural lines

### 2. Border-Led, Not Shadow-Led

Leetdoodle should get most of its structure from:

- surface contrast
- border contrast
- spacing

not from heavy elevation or blur.

We prefer:

- thin borders
- warm layered backgrounds
- subtle hover and active states

We avoid:

- deep shadows
- translucent glass chrome
- floating neon UI

### 3. Warm Neutral Base, Focused Accent

Our visual base is already correct:

- warm neutrals for surfaces and text
- blue as the main interactive accent
- green/yellow/red for semantic states

Accent color should communicate interaction or state change, not decorate every
surface.

### 4. One Geometry System

We should not mix:

- hard square cards
- rounded buttons
- sharp inputs
- pill badges

inside the same interface cluster.

Each screen or workspace region should feel like it belongs to one geometry
family.

For Leetdoodle, that family is:

- slight rounding for structural surfaces
- full rounding only for chips, badges, and tiny status elements

### 5. Chrome And Content Are Different Layers

Global app chrome should feel more compact and controlled than node content.

Chrome includes:

- top bars
- docks
- tool switches
- zoom controls
- presence controls
- add-node launchers

Content includes:

- problem nodes
- code nodes
- note nodes
- test results

Chrome should be tighter and more utility-like.
Content should breathe more.

## Geometry System

### Radius Scale

Use a small radius scale and reuse it everywhere.

- `r0`: square, only for flush structural edges and rules
- `r1`: slight rounding, default for controls and containers
- `r2`: full pill, only for tags, chips, and status badges

In Tailwind terms today:

- default control/container radius: `rounded-md`
- pill/tag radius: `rounded-full`

Do not introduce random one-off radii unless there is a strong product reason.

### What Gets Rounded

Rounded by default:

- buttons
- icon buttons
- inputs
- node shells
- dock panels
- floating menus
- action trays
- code and result sub-panels

Usually not rounded:

- viewport-flush top bar outer edge
- full-width app bars that terminate at the screen edges
- border separators

Important nuance:

A top bar can be flush to the viewport while the controls inside it are still
rounded. Flush shell, soft children.

## Surface System

We already have the right semantic surface model:

- `surface-1`: main resting surface
- `surface-2`: recessed or secondary controls
- `surface-3`: active or emphasized sub-surface

Rules:

- structural shell defaults to `surface-1`
- nested control defaults to `surface-2`
- active state can move to `surface-3`

Do not use raw primitive colors in components when a semantic surface token can
express intent.

## Border System

Borders are a first-class part of the design language.

Use them to define:

- control boundaries
- stacked menu items
- node shells
- section headers
- active focus transitions

Rules:

- default border is always visible
- focus border should become the interactive accent
- border thickness should stay visually light

Do not hide structure behind shadow if a border can communicate it more clearly.

## Typography System

Typography should stay simple and utilitarian.

We are not building a marketing site.

Use hierarchy through:

- size
- weight
- letter spacing
- text color

Patterns:

- uppercase micro-labels for chrome labels and metadata
- strong medium-weight titles for node headers and section titles
- muted small text for help and hints
- primary text for meaningful content

Avoid decorative typography in the canvas workspace.

## Component Rules

### Top Bar

The top bar is the primary global control plane.

Rules:

- flush to the top
- spans full width
- uses a border-bottom, not a floating card treatment
- contains compact rounded child controls
- left side is product identity plus primary mode switching
- right side is session and environment controls

Correct use:

- `Leetdoodle | Select | Draw` on the left
- `Share | Invite | Presence | Zoom | Theme` on the right

### Bottom Docks

Bottom docks are secondary utilities, not global navigation.

Rules:

- compact launcher visible by default
- expanded panel appears only when invoked
- panel uses the same rounded surface language as the rest of the chrome

Examples:

- bottom-right add-node launcher
- bottom-left session-tree dock

### Nodes

Nodes are content containers and should visually relate to the chrome system.

Rules:

- node shell should be softly rounded
- node header should feel like part of the shell, not a separate widget
- nested content blocks can use softer inset surfaces
- pills/tags inside nodes should be fully rounded

We should stop mixing:

- square node shells
- rounded internal content blocks

That reads as two systems colliding.

### Buttons

Buttons should look like tactile tools, not plain text links in boxes.

Default button shape:

- slightly rounded
- bordered
- compact
- surface-driven

Active buttons:

- stronger border
- stronger text color
- slightly raised surface contrast

Do not use oversized button chrome unless the action is genuinely primary.

### Menus And Popovers

Menus should feel like compact extensions of the chrome.

Rules:

- softly rounded container
- stacked actions with clear spacing
- same control styling as top-bar buttons
- click-outside closes

### Tags And Badges

Tags are the only place where full pill rounding is the default.

Rules:

- use for topic chips, difficulty, tiny state markers
- keep text small and concise
- do not turn large buttons into pills

## Interaction Rules

Motion and interaction should feel restrained and precise.

Prefer:

- quick hover color shifts
- border color transitions
- compact expand/collapse behavior

Avoid:

- floaty overshoot animations
- large springy movement
- constant motion for idle UI

The canvas is already a high-motion environment because users pan, drag, draw,
and collaborate in real time. The chrome should stabilize that, not compete
with it.

## Consistency Rules

### Do

- reuse semantic tokens
- reuse shared chrome classes/components
- prefer one radius family per screen region
- keep controls compact
- let content breathe more than chrome

### Do Not

- introduce a new local corner style for one feature
- mix square shells and rounded child controls in the same cluster
- solve hierarchy with bigger shadows
- add decorative gradients or effects to utility chrome
- create "just this once" custom buttons when shared control styles exist

## Implementation Direction

This manifesto is not only visual. It should shape code structure too.

We should prefer:

- shared visual primitives for chrome
- semantic surface utilities
- small reusable control shells
- one source of truth for radius and spacing conventions

That means new frontend work should usually build on shared primitives rather
than restyling each feature locally.

## Migration Policy

When touching an old UI surface, do not preserve the old sharp geometry by
default.

Instead:

1. move it into the new radius family
2. align it to semantic surfaces
3. align it to shared control patterns
4. remove old conflicting styling rather than supporting both

We do not want a forever-mixed design system.

## Review Checklist

Before merging a frontend UI change, ask:

- Does this use the warm surface system correctly?
- Does this match the soft-corner geometry family?
- Is the border and spacing treatment consistent with nearby UI?
- Is this reusing a shared visual primitive where one should exist?
- Are we accidentally mixing the old square style with the new rounded style?
- Is this control compact enough for canvas chrome?
- Is this content area visually distinct from chrome?

If the answer to the fifth question is yes, the design is not done yet.

## Current Direction In One Sentence

Leetdoodle UI should be built from warm layered surfaces, crisp borders, and
slightly rounded geometry, with no visual mixing between the old hard-edged
system and the new softer one.
