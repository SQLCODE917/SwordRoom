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
