---
name: brutalist-button
description: Reusable brutalist hover animation for buttons/links (black surface that reveals a yellow fill sliding up from the bottom, with a slight lift). Use when adding CTA buttons, navigation actions or any interactive element that must match the site's motion language. Triggers on: boton, button, hover, animacion, brutalist, brut-up, repos button.
---

# Brutalist "up" button

Reusable hover animation used across `cosmiclatteweb`. The button starts as a
black surface with white text and reveals a yellow fill sliding up from the
bottom on hover/focus, while lifting a couple of pixels. This mirrors the
motion language of the `.soc` social buttons.

## Source of truth
- CSS: `frontend/src/styles/brutal-button.css`
- Imported globally from `frontend/src/styles/global.css` (`@import "./brutal-button.css";`)

## Usage
```astro
<a href="https://example.com" target="_blank" rel="noopener noreferrer" class="brut-up">
  <span>label ↗</span>
</a>
```

On dark/black surfaces, add `.brut-up--on-dark` so the border stays visible:
```astro
<a href="..." class="brut-up brut-up--on-dark"><span>view repositories ↗</span></a>
```

The label MUST be wrapped in a child element (`<span>`) so it stays above the
sliding `::before` fill (`z-index` layering).

## Rules
1. Keep the CSS in `brutal-button.css`; do not duplicate the keyframes/transition inline.
2. Always wrap the button label in a child element.
3. Include a `:focus-visible` state (already handled by the shared styles).
4. Respect `prefers-reduced-motion` (already handled).
5. Animation parameters: fill slide `0.35s cubic-bezier(0.7, 0, 0.3, 1)`;
   lift `translateY(-2px)` with `0.3s cubic-bezier(0.34, 1.56, 0.64, 1)`.

## Reference implementation
See the repos action in `frontend/src/pages/index.astro`.
