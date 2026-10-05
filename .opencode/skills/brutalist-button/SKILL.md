---
name: brutalist-button
description: Reusable brutalist hover animation for buttons and links (black surface that reveals a yellow fill sliding up from the bottom). Use when adding CTA buttons, navigation actions or any interactive element that should look like the existing `.brut-up` buttons. Triggers on: button, hover, animation, brutalist, brut-up, repos button.
---

# Brutalist "up" button

A black surface with white text that reveals a yellow fill sliding up from the
bottom on hover/focus. It uses the same reveal as `.soc`, where the platform
name slides out on hover.

## Source of truth

CSS: `frontend/src/styles/brutal-button.css`, imported from
`frontend/src/styles/global.css`. Read the values there rather than repeating
them here; they change.

## Usage

```astro
<a href="https://example.com" target="_blank" rel="noopener noreferrer" class="brut-up">
  <span>label ↗</span>
</a>
```

On a dark surface, add `.brut-up--on-dark` so the border stays visible:

```astro
<a href="..." class="brut-up brut-up--on-dark"><span>view repositories ↗</span></a>
```

Wrap the label in a child element (`<span>`). The fill is a `::before` pseudo
element, and only `.brut-up > *` is raised above it, so bare text in the button
would be painted over.

## Rules

Keep the CSS in `brutal-button.css`. Do not inline keyframes or transitions.
Include the `:focus-visible` state and respect `prefers-reduced-motion`; the
shared styles already do both, so do not re-declare them.

## Reference implementation

The repos action in `frontend/src/pages/index.astro`.