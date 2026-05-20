# UI

## Principles

- Use semantic HTML.
- Use the minimum number of elements needed.
- Prefer existing shared primitives over one-off components.
- Prefer theme tokens over custom component CSS.
- Use CSS Modules.

## Rendering model

Components should be thin and declarative:

- view models in
- user actions out

Do not hide large amounts of application logic inside JSX.

Each connected component may use at most one selector. That selector should return a ViewModel representing a meaningful UX state.

Components should render `null`, loading, ready, and error states from explicit ViewModel variants rather than guessing state from raw network or domain objects every render.

## Responsive design

Design intentionally for:

- phone
- tablet
- desktop

Desktop layout must use available width meaningfully.
Do not just center a tablet layout in extra whitespace.

Prefer:

- layout primitives
- responsive containers
- flexbox only where it improves structure
- a minimal amount of CSS to express the layout cleanly

## Theme

Default theme:

- ISA-101 inspired
- grayscale first
- explicit square corners
- low decorative complexity

A strong component is one that can be fully expressed by:

- JSX
- shared primitive props
- theme tokens
- little or no custom CSS

## Buttons

Buttons should expose clear state through props:

- disabled
- default
- emphasis variant if needed by the design system

Do not create many one-off button styles inside features.

## UI Design Doctrine: ISA-101-Inspired High-Performance Interface

When designing or modifying UI, follow an ISA-101-inspired high-performance HMI style.

The goal is not visual excitement.

The goal is:

- fast scanning
- stable layout
- clear state recognition
- low visual noise
- obvious actionable controls
- no surprise movement
- no decorative color fighting with real system state

Do not claim formal ISA-101 compliance. Treat these rules as our local UI standard inspired by ISA-101 and high-performance HMI practice.

---

## Core Principles

### 1. Stability Over Flash

UI elements must not jump, pop in, resize, or push other elements around unexpectedly.

Do not conditionally render layout-affecting elements in a way that causes visible shifting.

Bad:

- loading data, then inserting a banner above existing content
- rendering buttons only after async state arrives
- showing validation errors that push the form downward
- expanding cards without reserving space
- replacing skeletons with differently sized final content
- adding filters/toolbars after the page has already painted

Good:

- reserve space before content loads
- use skeletons with the same dimensions as final content
- keep toolbar/action areas mounted
- use disabled, hidden, or placeholder states instead of late insertion
- place validation messages in reserved slots
- use overlays only when user-triggered
- keep row heights, card heights, and button areas predictable

Visual stability is a hard requirement. Unexpected layout shifts make users lose their place or click the wrong control; this is exactly what Cumulative Layout Shift measures on the web. :contentReference[oaicite:2]{index=2}

### 2. Grayscale Base, Meaningful Contrast

Use a neutral grayscale base for normal interface structure.

Default screens should feel calm.

Use contrast, weight, position, and spacing before using color.

Color must be reserved for meaning:

- abnormal state
- warning
- error
- success confirmation
- selected state
- critical action
- operator/user attention

Do not use bright color for decoration.

Do not make every card, badge, icon, and button colorful.

When everything is colorful, nothing is meaningful.

High-performance HMI practice commonly uses muted gray displays and reserves color for conditions needing attention, such as alarms or abnormal states. :contentReference[oaicite:3]{index=3}

### 3. Actionable Elements Must Be Visually Obvious

Interactive controls must be easier to find than static content.

Use:

- stronger contrast
- clear border
- clear label
- consistent placement
- consistent size
- predictable hover/focus/disabled states

Do not rely only on color to show actionability.

Buttons, links, toggles, menu items, and editable fields must be visually distinguishable from read-only data.

### 4. Square, Technical Geometry

Use square or minimally rounded corners.

Default:

- `border-radius: 0`
- or a small token such as `2px` / `4px` if the design system requires slight softening

Avoid:

- pill buttons
- bubbly cards
- large-radius panels
- playful rounded containers
- decorative shadows
- glossy gradients
- glassmorphism
- floating toy-like UI

The interface should look precise, structured, and operational.

### 5. Clear Information Levels

Organize screens by information level.

Use this hierarchy:

#### Level 1: Overview

Shows system/page status at a glance.

Use for:

- dashboards
- summaries
- health/status views
- top-level operational awareness

Do not overload Level 1 with configuration details.

#### Level 2: Area or Workflow View

Shows a specific section, list, queue, or workflow.

Use for:

- order lists
- customer lists
- inventory groups
- delivery routes
- filtered operational views

#### Level 3: Detail and Control

Shows one object or process in detail.

Use for:

- order detail
- customer detail
- edit screens
- scheduling controls
- payment/order actions

#### Level 4: Configuration and Diagnostics

Shows rarely used settings, admin tools, logs, or debugging information.

Use for:

- settings
- permissions
- integrations
- raw logs
- diagnostics
- destructive maintenance actions

Do not mix Level 4 configuration into Level 1 overview screens.

ISA-101-style HMI thinking uses layered displays so users can scan broadly first, then drill into detail and control only when needed. :contentReference[oaicite:4]{index=4}

---

## Layout Rules

### Stable Regions

Every page should have stable regions:

- header/title region
- primary action region
- filter/search region, if applicable
- main content region
- status/error region
- footer or secondary action region, if applicable

These regions should not appear, disappear, or move after page load.

If a region is sometimes empty, render an empty reserved slot or a disabled state.

### No Pop-In Controls

Do not make primary actions appear only after some condition loads.

Instead:

- render the action in disabled state
- show why it is unavailable
- enable it when conditions are met

Bad:

````tsx
{canSubmit && <Button>Submit</Button>}## UI Design Doctrine: ISA-101-Inspired High-Performance Interface

When designing or modifying UI, follow an ISA-101-inspired high-performance HMI style.

The goal is not visual excitement.

The goal is:
- fast scanning
- stable layout
- clear state recognition
- low visual noise
- obvious actionable controls
- no surprise movement
- no decorative color fighting with real system state## UI Design Doctrine: ISA-101-Inspired High-Performance Interface

When designing or modifying UI, follow an ISA-101-inspired high-performance HMI style.

The goal is not visual excitement.

The goal is:
- fast scanning
- stable layout
- clear state recognition
- low visual noise
- obvious actionable controls
- no surprise movement
- no decorative color fighting with real system state

Do not claim formal ISA-101 compliance unless the project has an actual ISA-101 review process. Treat these rules as our local UI standard inspired by ISA-101 and high-performance HMI practice.

---

## Core Principles

### 1. Stability Over Flash

UI elements must not jump, pop in, resize, or push other elements around unexpectedly.

Do not conditionally render layout-affecting elements in a way that causes visible shifting.

Bad:
- loading data, then inserting a banner above existing content
- rendering buttons only after async state arrives
- showing validation errors that push the form downward
- expanding cards without reserving space
- replacing skeletons with differently sized final content
- adding filters/toolbars after the page has already painted

Good:
- reserve space before content loads
- use skeletons with the same dimensions as final content
- keep toolbar/action areas mounted
- use disabled, hidden, or placeholder states instead of late insertion
- place validation messages in reserved slots
- use overlays only when user-triggered
- keep row heights, card heights, and button areas predictable

Visual stability is a hard requirement. Unexpected layout shifts make users lose their place or click the wrong control; this is exactly what Cumulative Layout Shift measures on the web. :contentReference[oaicite:2]{index=2}

### 2. Grayscale Base, Meaningful Contrast

Use a neutral grayscale base for normal interface structure.

Default screens should feel calm.

Use contrast, weight, position, and spacing before using color.

Color must be reserved for meaning:
- abnormal state
- warning
- error
- success confirmation
- selected state
- critical action
- operator/user attention

Do not use bright color for decoration.

Do not make every card, badge, icon, and button colorful.

When everything is colorful, nothing is meaningful.

High-performance HMI practice commonly uses muted gray displays and reserves color for conditions needing attention, such as alarms or abnormal states. :contentReference[oaicite:3]{index=3}

### 3. Actionable Elements Must Be Visually Obvious

Interactive controls must be easier to find than static content.

Use:
- stronger contrast
- clear border
- clear label
- consistent placement
- consistent size
- predictable hover/focus/disabled states

Do not rely only on color to show actionability.

Buttons, links, toggles, menu items, and editable fields must be visually distinguishable from read-only data.

### 4. Square, Technical Geometry

Use square or minimally rounded corners.

Default:
- `border-radius: 0`
- or a small token such as `2px` / `4px` if the design system requires slight softening

Avoid:
- pill buttons
- bubbly cards
- large-radius panels
- playful rounded containers
- decorative shadows
- glossy gradients
- glassmorphism
- floating toy-like UI

The interface should look precise, structured, and operational.

### 5. Clear Information Levels

Organize screens by information level.

Use this hierarchy:

#### Level 1: Overview
Shows system/page status at a glance.

Use for:
- dashboards
- summaries
- health/status views
- top-level operational awareness

Do not overload Level 1 with configuration details.

#### Level 2: Area or Workflow View
Shows a specific section, list, queue, or workflow.

Use for:
- order lists
- customer lists
- inventory groups
- delivery routes
- filtered operational views

#### Level 3: Detail and Control
Shows one object or process in detail.

Use for:
- order detail
- customer detail
- edit screens
- scheduling controls
- payment/order actions

#### Level 4: Configuration and Diagnostics
Shows rarely used settings, admin tools, logs, or debugging information.

Use for:
- settings
- permissions
- integrations
- raw logs
- diagnostics
- destructive maintenance actions

Do not mix Level 4 configuration into Level 1 overview screens.

ISA-101-style HMI thinking uses layered displays so users can scan broadly first, then drill into detail and control only when needed. :contentReference[oaicite:4]{index=4}

---

## Layout Rules

### Stable Regions

Every page should have stable regions:

- header/title region
- primary action region
- filter/search region, if applicable
- main content region
- status/error region
- footer or secondary action region, if applicable

These regions should not appear, disappear, or move after page load.

If a region is sometimes empty, render an empty reserved slot or a disabled state.

### No Pop-In Controls

Do not make primary actions appear only after some condition loads.

Instead:
- render the action in disabled state
- show why it is unavailable
- enable it when conditions are met

Bad:

```tsx
{canSubmit && <Button>Submit</Button>}
````

Better:

```tsx
<Button disabled={!canSubmit}>Submit</Button>
```

Best:

```tsx
<Button disabled={!canSubmit} aria-describedby="submit-state">
  Submit
</Button>
<p id="submit-state">
  {canSubmit ? "Ready" : "Complete required fields first"}
</p>
```

## Motion Rules

Motion must be functional, not decorative.

Allowed:

- subtle focus transition
- loading indicator
- user-triggered expansion
- progress indication

Avoid:

- bouncing
- decorative fades
- animated cards
- delayed entrance animations
- auto-playing attention effects
- blinking, except for truly urgent alarm-like states

If motion is used, it must not move surrounding layout.

---

## Component Rules

### Buttons

Buttons must be rectangular or minimally rounded.

Button hierarchy:

- primary: highest contrast
- secondary: bordered neutral
- destructive: semantic red, used sparingly
- disabled: visible but clearly unavailable

Primary actions should have stable placement.

Do not hide primary actions merely because they are unavailable.

### Cards and Panels

Cards should be quiet containers.

Use:

- thin borders
- grayscale backgrounds
- square corners
- minimal shadow or no shadow

Avoid:

- colorful card backgrounds
- large rounded corners
- heavy shadows
- decorative gradients

### Forms

Forms must be stable and scan-friendly.

Use:

- aligned labels
- reserved helper/error text
- clear required markers
- disabled states with explanation
- predictable submit/cancel placement

Do not rearrange fields after user input unless explicitly triggered.

### Status Displays

Status must be immediately understandable.

Use:

- label
- value
- timestamp, if relevant
- severity
- next action, if relevant

Do not show raw status codes without explanation.

### Dialogs and Popups

Use dialogs only for:

- confirmation
- focused editing
- destructive actions
- details that would overload the main screen

Do not use surprise popups.

Do not open a popup automatically unless it communicates a critical blocking condition.

---

## Agent Design Requirements

Before implementing UI, the agent must identify:

1. What is the screen’s information level?
   - Level 1 overview
   - Level 2 workflow/list
   - Level 3 detail/control
   - Level 4 configuration/diagnostic

2. What is the primary user action?

3. What information is read-only?

4. What states require attention?

5. What content loads asynchronously?

6. What elements could cause layout shift?

7. What regions must reserve space?

The agent must answer these before writing UI code when the change is non-trivial.

---

## Required UI Verification

For every UI change, verify:

### Visual Stability

- No primary action moves after load.
- No toolbar/filter/action region pops in late.
- No validation message pushes unrelated content.
- No async content shifts existing content.
- Skeletons match final content size.
- Images, tables, charts, and embeds have reserved dimensions.

### Action Clarity

- Primary action is visually obvious.
- Disabled actions remain visible when useful.
- Disabled actions explain why they are unavailable.
- Static text does not look clickable.
- Clickable text does look clickable.

### Color Discipline

- Normal state is mostly grayscale.
- Color is reserved for semantic meaning.
- Error/warning/success colors are not decorative.
- Color-coded states also have text or icon labels.

### Geometry

- Corners are square or minimally rounded.
- No pill-shaped controls unless required by an existing component contract.
- No decorative shadows or gradients unless already part of the project system.

### Accessibility

- Keyboard focus is visible.
- Interactive controls have accessible labels.
- Color is not the only state signal.
- Disabled states are understandable.
- Dialogs trap focus correctly.
- Error messages are associated with fields.

---

## Definition of Done for UI Work

A UI task is not done unless:

- the layout is stable before and after data loads
- no conditionally rendered element causes surrounding content to jump
- actionable controls are visually distinct
- grayscale is used as the default visual language
- color is reserved for semantic state or critical action
- corners follow the square/minimal-radius rule
- loading, empty, error, and success states are designed
- keyboard and screen-reader basics are preserved
- tests or stories cover the important states
- screenshots or visual notes are included in the handoff when useful

---

## Anti-Patterns

Do not produce UI that looks like:

- colorful SaaS marketing dashboards
- bubbly mobile app screens
- animated landing pages
- glassmorphism panels
- gradient-heavy admin tools
- randomly rounded cards
- controls that appear only after async state
- forms that jump when errors appear
- dashboards where every metric has a different color

The interface should feel like a calm control surface.

Quiet by default.

Loud only when attention is required.
