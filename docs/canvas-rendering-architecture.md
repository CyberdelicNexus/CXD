# Canvas rendering: where CXD is, where Miro is, and the path between

## What Miro (and Figma) do

Professional whiteboards don't render the board as a tree of DOM nodes.

- **Miro** draws the board itself onto HTML5 `<canvas>`. It uses a hybrid of
  WebGL (GPU) for heavy visual work (shadows, gradients, large object counts) and
  Canvas 2D for simpler objects. It keeps only the viewport's objects, plus a
  buffer around it, resident, and targets 60 fps (30 fps on extreme boards).
- **Figma** goes further: a C++ engine compiled to WebAssembly renders through
  WebGL/WebGPU. HTML is only used for the chrome around the canvas.
- Both keep the document model (CRDT or OT) completely separate from rendering.
  An edit updates the model, and a scene graph redraws only what changed.

Sources: [Miro system design](https://www.educative.io/blog/miro-system-design),
[Miro (Wikipedia)](https://en.wikipedia.org/wiki/Miro_(collaboration_platform)).
These are secondary sources, not Miro's own engineering docs.

## What CXD does today

- Every element is a React component in the DOM, inside one CSS-transformed
  layer (`translate + scale`). Pan and zoom are a single transform, which is
  cheap, but each pan or zoom frame still re-renders `CXDCanvas`. That parent
  re-render reaches every `CanvasElementRenderer`, because their props include
  fresh inline closures.
- Collaboration state lives in Yjs (the right model: it's a CRDT like the pros
  use), bridged into Zustand.
- Rich content (tiptap notes, embeds, tables, images) is DOM-native. This is the
  main reason a canvas or WebGL renderer can't simply be swapped in: each rich
  element would need its own drawing path, or a DOM overlay while editing.

## Recommendation: close the gap in steps, not a rewrite

A full canvas/WebGL renderer would be a months-long rewrite. It would also lose
the rich DOM elements that make CXD different. The practical path, in order of
return on effort:

1. **Viewport culling** (done: `VIEWPORT_CULL_THRESHOLD` in `cxd-canvas.tsx`).
   Boards with more than 150 elements only mount elements within one screen of
   the viewport, plus anything selected or being dragged.
2. **Stop full-tree re-renders on pan and zoom.** Memoize `CanvasElementRenderer`
   (`React.memo` with an element-identity comparator) and pass stable callbacks
   keyed by id instead of inline closures. Pan and zoom then only move the
   transform layer.
3. **Drive the transform imperatively during gestures.** Write
   `translate/scale` straight to the layer's style in a `requestAnimationFrame`
   loop, and commit to React state when the gesture ends. This is how tldraw-class
   DOM canvases hit 60 fps.
4. **Level of detail.** Below roughly 35% zoom, render elements as lightweight
   placeholders (a coloured rect plus title) instead of full rich content.
5. **Canvas or WebGL for bulk primitives only.** Connectors, lines and the dot
   grid are the best candidates to move to a single `<canvas>` layer. Rich
   elements stay DOM.

Steps 2 and 3 give most of the "feels like Miro" smoothness. Step 5 is only
worth it if boards regularly reach thousands of connectors.
