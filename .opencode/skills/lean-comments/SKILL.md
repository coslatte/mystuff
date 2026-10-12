---
name: lean-comments
description: Keep code comments to a minimum. Delete any comment that restates what the code already says, and spend the comments actually kept on the non-obvious why. Use when writing, reviewing or cleaning comments, JSDoc, Javadoc or CSS block comments. Triggers on: comment, comments, jsdoc, javadoc, documentation, cleanup, noise, over-commented.
---

# Lean comments

A comment has to answer a question the code cannot answer on its own. If it does
not, it is dead weight: it costs a line to read, it goes stale, and it invites the
next reader to trust a description instead of reading the code.

The default answer is no comment. Adding one is a decision, not a courtesy.

## Delete on sight

- Restating the code. `// increment the counter` above `i++`.
- Labelling markup or selectors. `<!-- metadata -->` above a `<div>` whose class
  already says `metadata`.
- Narrating a function body step by step. The body is the narration.
- Echoing a well-known name. `// Keeps a canvas backing store in sync...` above
  `useCanvasSize`.
- Repeating a type, a prop, a field or a magic value without its reason.
  `/** The name. */ String name` adds nothing; `/** Null for releases that only
  exist on another platform. */` earns its place because it fixes a meaning the
  type cannot.
- Commented-out code. Delete it and recover it from history if it matters.
- "TODO" without a name attached to it.
- Section banners that only exist to break up a short file.

## Keep, and spend these sparingly

- **The non-obvious why**, when the reason lives far from the line it explains.
- **Magic numbers with a derivation.** Where `32` comes from beats `ROW_HEIGHT`.
- **Framework and platform traps.** `saveAndFlush` instead of `save`, deleting
  after commit, not setting the interrupt flag on a network error. Anything that
  looks like a mistake and is not.
- **Deleted-code archaeology with a real reason left.** Why an older client path
  still exists, why a secret travels in a header.
- **Deliberate weirdness**, so the next person does not "fix" it.
- **Constraints that span distant code.** An invariant enforced in three files.

Write those in one or two lines. If it takes a paragraph, the code probably wants
to be restructured instead.

## Backend Java

Documenting functions here is good practice, and this repo does it. Keep the
Javadoc on service and controller methods, and prefer what the signature cannot
carry: side effects, thrown exceptions, transaction and framework constraints,
what the returned DTO deliberately omits.

Cut the `@param`/`@return` block that only repeats the name and type. Prefer
imports over a fully qualified name when linking.

## Frontend

The frontend leans much further towards silence. Aim for files with zero
comments; a TSX or `.astro` component whose names are good should need none.
React props, TypeScript types and Astro frontmatter already document themselves.

What survives the cut:

- One header comment per stylesheet describing the effect, not each block.
- A comment on a canvas draw or an animation, since the pixels are the only
  documentation of what it should look like.
- Magic numbers whose derivation is not visible.
- Custom element registration, hydration and browser workarounds.

In Astro templates, `<!-- ... -->` labels are noise. In CSS, a comment that
restates the declaration below it is noise; one that explains a technique choice
is not.

## Workflow for agents

Find the candidates:

```
rg -n '^\s*(//|/\*|\*|<!--)' src/frontend/src src/backend/src
```

Read each one and ask what question it answers. If the answer is already in the
code, cut it. Then check the build and tests still pass.

## Before and after

```ts
// Bad: three lines restating three lines of code.
// Increment the index
// Store the current user
// Clear the error
index++;
currentUser = user;
setError(null);

// Good: one line for the part that is not obvious.
currentUser = user; // the editor renders for the user being edited, not the viewer
```

```css
/* Bad: the declaration says this. */
/* Visible on black surfaces. */
.brut-up--on-dark {
  border-color: #fff;
}

/* Good: explains the technique and why the obvious one does not work. */
/*
 * The chunky outline is an inset box shadow, not a border: a real border would
 * thicken unevenly as the radius animates and shift everything next to it.
 */
```

## Rules

Never add a comment while writing code. Finish the code first, then add a
comment only where the finished code is genuinely hard to follow.

Never translate a comment out of English. Everything that reaches git is English,
comments included.