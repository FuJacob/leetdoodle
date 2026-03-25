# Infinite Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-grade infinite canvas with pan, zoom-toward-cursor, and draggable nodes using CSS transforms and Pointer Events — no canvas libraries.

**Architecture:** A fixed `viewport` div captures all pointer events. A `world` div inside it moves and scales via a single CSS `translate(x,y) scale(z)` transform with `transform-origin: 0 0`. Nodes live in world space; coordinate conversion utilities translate between screen and world space. All interaction state is stored in refs so event handlers are stable across re-renders.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, Pointer Events API

---

## File Structure

```
frontend/src/
  canvas/
    types.ts                  ← shared types: Transform, CanvasNode, NodeType
    utils/
      coordinates.ts          ← screenToWorld(), worldToScreen()
      math.ts                 ← clamp(), zoomToward()
    hooks/
      useCanvasTransform.ts   ← pan/zoom state + pointer/wheel handlers (non-passive wheel via useEffect)
      useNodeDrag.ts          ← per-node drag logic (stable callbacks via transformRef)
    Canvas.tsx                ← viewport + world div, combines pan + drag handlers at viewport level
  nodes/
    NodeRenderer.tsx          ← renders a single node (only onPointerDown, no move/up)
  App.tsx                     ← mounts Canvas
  App.css                     ← deleted / emptied
  index.css                   ← Tailwind v4 import + html/body/root fill-screen
```

No CSS Module files — all styles are Tailwind utility classes directly on elements.

---

## Task 1: Install & Configure Tailwind v4

Tailwind v4 is Vite-native — no `tailwind.config.js` needed. One plugin, one CSS import.

**Files:**
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/App.css`

- [ ] **Step 1: Install Tailwind v4**

```bash
cd frontend && pnpm add tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Add Tailwind plugin to vite.config.ts**

Read the existing `vite.config.ts` first, then add the import and plugin. The result should look like:

```ts
// frontend/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
});
```

- [ ] **Step 3: Replace index.css with Tailwind import + viewport reset**

```css
/* frontend/src/index.css */
@import "tailwindcss";

/* Tailwind's preflight handles box-sizing and margin resets. */
/* These rules ensure the canvas fills the full screen. */
html,
body,
#root {
  height: 100%;
  overflow: hidden;
}
```

- [ ] **Step 4: Clear App.css**

```css
/* frontend/src/App.css — unused, canvas fills viewport */
```

- [ ] **Step 5: Start dev server and verify Tailwind is working**

```bash
pnpm dev
```

Add a temporary `className="text-red-500"` to `App.tsx` and confirm the text is red. Remove it after confirming.

- [ ] **Step 6: Commit**

```bash
git add frontend/vite.config.ts frontend/src/index.css frontend/src/App.css
git commit -m "feat: install and configure Tailwind CSS v4"
```

---

## Task 2: Project Structure + Types

**Files:**
- Create: `frontend/src/canvas/types.ts`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p frontend/src/canvas/utils frontend/src/canvas/hooks frontend/src/nodes
```

- [ ] **Step 2: Write the types**

```ts
// frontend/src/canvas/types.ts

export interface Transform {
  x: number;    // panX — world origin offset in screen pixels
  y: number;    // panY — world origin offset in screen pixels
  zoom: number; // scale factor (1 = 100%)
}

export type NodeType = 'note'; // extend later: 'code' | 'problem'

export interface CanvasNode {
  id: string;
  type: NodeType;
  x: number;    // world-space position
  y: number;
  width: number;
  height: number;
  data: Record<string, unknown>;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/canvas/types.ts
git commit -m "feat: add canvas types"
```

---

## Task 3: Coordinate & Math Utilities

**Files:**
- Create: `frontend/src/canvas/utils/coordinates.ts`
- Create: `frontend/src/canvas/utils/math.ts`

- [ ] **Step 1: Write coordinate utilities**

```ts
// frontend/src/canvas/utils/coordinates.ts
import type { Transform } from '../types';

/**
 * Convert a screen-space point to world-space.
 * screenX/Y must be relative to the viewport's top-left corner.
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  transform: Transform,
): { x: number; y: number } {
  return {
    x: (screenX - transform.x) / transform.zoom,
    y: (screenY - transform.y) / transform.zoom,
  };
}

/**
 * Convert a world-space point to screen-space.
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  transform: Transform,
): { x: number; y: number } {
  return {
    x: worldX * transform.zoom + transform.x,
    y: worldY * transform.zoom + transform.y,
  };
}
```

- [ ] **Step 2: Write math utilities**

```ts
// frontend/src/canvas/utils/math.ts
import type { Transform } from '../types';

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5;
export const ZOOM_SENSITIVITY = 0.001;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Compute a new transform after zooming toward a screen-space point.
 * Keeps the world point under the cursor fixed during zoom.
 *
 * delta: WheelEvent.deltaY — positive = scroll down = zoom out, negative = zoom in.
 */
export function zoomToward(
  transform: Transform,
  screenX: number,
  screenY: number,
  delta: number,
): Transform {
  const factor = 1 - delta * ZOOM_SENSITIVITY;
  const newZoom = clamp(transform.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  const ratio = newZoom / transform.zoom;

  return {
    zoom: newZoom,
    x: screenX - (screenX - transform.x) * ratio,
    y: screenY - (screenY - transform.y) * ratio,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/canvas/utils/
git commit -m "feat: add coordinate and zoom math utilities"
```

---

## Task 4: useCanvasTransform Hook

Manages pan/zoom state. The wheel handler is attached via `useEffect` with `{ passive: false }` so `e.preventDefault()` works — React 19 attaches `onWheel` as a passive listener, which silently ignores `preventDefault()`.

**Key design:** `transform` is stored in both React state (for renders) and a ref (for synchronous reads in event handlers). The ref is synced via `useLayoutEffect`, which fires synchronously after the DOM commit — so the ref is always current before the next pointer event fires.

**Files:**
- Create: `frontend/src/canvas/hooks/useCanvasTransform.ts`

- [ ] **Step 1: Write the hook**

```ts
// frontend/src/canvas/hooks/useCanvasTransform.ts
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Transform } from '../types';
import { zoomToward } from '../utils/math';

const INITIAL_TRANSFORM: Transform = { x: 0, y: 0, zoom: 1 };

interface PanState {
  active: boolean;
  startX: number;
  startY: number;
  startTransformX: number;
  startTransformY: number;
}

export function useCanvasTransform(viewportRef: React.RefObject<HTMLDivElement | null>) {
  const [transform, setTransform] = useState<Transform>(INITIAL_TRANSFORM);

  // Mirror transform in a ref so event handlers can read current value
  // without depending on state (avoids stale closures and unnecessary re-renders).
  // useLayoutEffect fires synchronously after commit — ref is current before
  // any pointer events can fire, with no concurrent-mode side effects.
  const transformRef = useRef<Transform>(INITIAL_TRANSFORM);
  useLayoutEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  const panRef = useRef<PanState>({
    active: false,
    startX: 0,
    startY: 0,
    startTransformX: 0,
    startTransformY: 0,
  });

  // Non-passive wheel listener — must be attached via addEventListener to allow preventDefault.
  // React 19 attaches onWheel as passive, which silently ignores e.preventDefault().
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      setTransform(prev => zoomToward(prev, screenX, screenY, e.deltaY));
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [viewportRef]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Only pan when clicking the viewport itself, not nodes (nodes call stopPropagation).
    if (e.target !== e.currentTarget) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    // Read current transform synchronously from the ref — no stale closure.
    panRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startTransformX: transformRef.current.x,
      startTransformY: transformRef.current.y,
    };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!panRef.current.active) return;
    const dx = e.clientX - panRef.current.startX;
    const dy = e.clientY - panRef.current.startY;
    setTransform(prev => ({
      ...prev,
      x: panRef.current.startTransformX + dx,
      y: panRef.current.startTransformY + dy,
    }));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Guard: only release capture if this pointer was captured for panning.
    // If onPointerDown was stopped by a node, panRef.current.active is false
    // and this pointer was never captured here — calling releasePointerCapture
    // on an uncaptured pointer throws a DOMException.
    if (!panRef.current.active) return;
    panRef.current.active = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }, []);

  return { transform, transformRef, onPointerDown, onPointerMove, onPointerUp };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/canvas/hooks/useCanvasTransform.ts
git commit -m "feat: add useCanvasTransform hook (pan + non-passive zoom)"
```

---

## Task 5: useNodeDrag Hook

Handles dragging individual nodes in world space. Uses a `transformRef` (passed in from `useCanvasTransform`) so `onPointerMove` has a stable identity — no re-renders of all nodes on every zoom tick.

**Files:**
- Create: `frontend/src/canvas/hooks/useNodeDrag.ts`

- [ ] **Step 1: Write the hook**

```ts
// frontend/src/canvas/hooks/useNodeDrag.ts
import { useCallback, useRef } from 'react';
import type { CanvasNode, Transform } from '../types';

interface DragState {
  active: boolean;
  startScreenX: number;
  startScreenY: number;
  startWorldX: number;
  startWorldY: number;
}

type UpdateNode = (id: string, patch: Partial<CanvasNode>) => void;

export function useNodeDrag(
  transformRef: React.RefObject<Transform>,
  updateNode: UpdateNode,
) {
  const dragRef = useRef<DragState>({
    active: false,
    startScreenX: 0,
    startScreenY: 0,
    startWorldX: 0,
    startWorldY: 0,
  });
  const draggingIdRef = useRef<string | null>(null);

  // Called by NodeRenderer's onPointerDown.
  const onNodePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, node: CanvasNode) => {
      e.stopPropagation(); // prevent viewport pan from activating
      // Do NOT call setPointerCapture here — move/up are handled at the viewport
      // level which covers the full screen. Capturing on the node div would route
      // events away from the viewport, defeating that design.
      draggingIdRef.current = node.id;
      dragRef.current = {
        active: true,
        startScreenX: e.clientX,
        startScreenY: e.clientY,
        startWorldX: node.x,
        startWorldY: node.y,
      };
    },
    [],
  );

  // Called by the viewport's onPointerMove (alongside pan handler).
  // No-op when no node drag is active.
  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current.active || !draggingIdRef.current) return;
      // Read zoom from ref — stable, no stale closure, no re-render on zoom change.
      const zoom = transformRef.current.zoom;
      const dx = (e.clientX - dragRef.current.startScreenX) / zoom;
      const dy = (e.clientY - dragRef.current.startScreenY) / zoom;
      updateNode(draggingIdRef.current, {
        x: dragRef.current.startWorldX + dx,
        y: dragRef.current.startWorldY + dy,
      });
    },
    [transformRef, updateNode],
  );

  // Called by the viewport's onPointerUp (alongside pan handler).
  const onPointerUp = useCallback(
    (_e: React.PointerEvent<HTMLDivElement>) => {
      dragRef.current.active = false;
      draggingIdRef.current = null;
    },
    [],
  );

  return { onNodePointerDown, onPointerMove, onPointerUp };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/canvas/hooks/useNodeDrag.ts
git commit -m "feat: add useNodeDrag hook"
```

---

## Task 6: NodeRenderer Component

Renders a single node. Only needs `onPointerDown` — move/up are handled at the viewport level so they fire even when the cursor leaves the node during fast drags.

Styled entirely with Tailwind utility classes — no CSS file.

**Files:**
- Create: `frontend/src/nodes/NodeRenderer.tsx`

- [ ] **Step 1: Write the component**

```tsx
// frontend/src/nodes/NodeRenderer.tsx
import type { CanvasNode } from '../canvas/types';

interface NodeRendererProps {
  node: CanvasNode;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>, node: CanvasNode) => void;
}

export function NodeRenderer({ node, onPointerDown }: NodeRendererProps) {
  return (
    <div
      className="absolute cursor-grab select-none rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-sm text-zinc-300 shadow-xl active:cursor-grabbing"
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        minHeight: node.height,
      }}
      onPointerDown={e => onPointerDown(e, node)}
    >
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-blue-400">
        {node.type}
      </div>
      <div>{String(node.data.content ?? '')}</div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/nodes/NodeRenderer.tsx
git commit -m "feat: add NodeRenderer component"
```

---

## Task 7: Canvas Component

Wires everything together. Pan and node drag handlers are combined at the **viewport level** — this is the key architectural decision. It ensures move/up events always fire regardless of where the cursor is.

The dot grid background uses Tailwind's arbitrary value syntax for the radial-gradient. The world div's `transform-origin: 0 0` is set via inline style (not available as a Tailwind class in v4 without a custom plugin).

**Files:**
- Create: `frontend/src/canvas/Canvas.tsx`

- [ ] **Step 1: Write the Canvas component**

```tsx
// frontend/src/canvas/Canvas.tsx
import { useCallback, useRef, useState } from 'react';
import type { CanvasNode } from './types';
import { useCanvasTransform } from './hooks/useCanvasTransform';
import { useNodeDrag } from './hooks/useNodeDrag';
import { screenToWorld } from './utils/coordinates';
import { NodeRenderer } from '../nodes/NodeRenderer';

let nextId = 1;

function makeNode(x: number, y: number): CanvasNode {
  return {
    id: String(nextId++),
    type: 'note',
    x,
    y,
    width: 200,
    height: 80,
    data: { content: 'New note' },
  };
}

export function Canvas() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<CanvasNode[]>([]);

  // useCanvasTransform attaches the wheel listener internally via useEffect.
  // No onWheel prop needed on the viewport div.
  const {
    transform,
    transformRef,
    onPointerDown: panPointerDown,
    onPointerMove: panPointerMove,
    onPointerUp: panPointerUp,
  } = useCanvasTransform(viewportRef);

  const updateNode = useCallback((id: string, patch: Partial<CanvasNode>) => {
    setNodes(prev => prev.map(n => (n.id === id ? { ...n, ...patch } : n)));
  }, []);

  const {
    onNodePointerDown,
    onPointerMove: dragPointerMove,
    onPointerUp: dragPointerUp,
  } = useNodeDrag(transformRef, updateNode);

  // Combine pan + drag at the viewport level.
  // Both handlers are no-ops when their respective interaction isn't active.
  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      panPointerMove(e);
      dragPointerMove(e);
    },
    [panPointerMove, dragPointerMove],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      panPointerUp(e);
      dragPointerUp(e);
    },
    [panPointerUp, dragPointerUp],
  );

  // Place a node at world-space coordinates on double-click.
  // Uses transformRef.current (not state) for accurate positioning during fast interactions.
  const onDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const world = screenToWorld(
        e.clientX - rect.left,
        e.clientY - rect.top,
        transformRef.current,
      );
      setNodes(prev => [...prev, makeNode(world.x, world.y)]);
    },
    [transformRef], // stable ref object — callback never needs recreation
  );

  return (
    <div
      ref={viewportRef}
      className="fixed inset-0 overflow-hidden bg-zinc-950 [background-image:radial-gradient(circle,theme(colors.zinc.700)_1px,transparent_1px)] [background-size:32px_32px]"
      onPointerDown={panPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      <div
        className="absolute top-0 left-0"
        style={{
          transformOrigin: '0 0',
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`,
          width: 0,
          height: 0,
        }}
      >
        {nodes.map(node => (
          <NodeRenderer
            key={node.id}
            node={node}
            onPointerDown={onNodePointerDown}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/canvas/Canvas.tsx
git commit -m "feat: add Canvas component with pan, zoom, and node placement"
```

---

## Task 8: Wire Into App

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Update App.tsx**

```tsx
// frontend/src/App.tsx
import { Canvas } from './canvas/Canvas';

export default function App() {
  return <Canvas />;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: mount Canvas as root app"
```

---

## Task 9: Smoke Test

- [ ] **Step 1: Start dev server**

```bash
cd frontend && pnpm dev
```

- [ ] **Step 2: Verify manually in the browser**
  - Dark canvas background (`zinc-950`) with dot grid renders
  - Click and drag on empty space → canvas pans smoothly
  - Scroll wheel → zooms toward cursor position (world point under cursor stays fixed)
  - Double-click on empty space → a note node appears at that position
  - Drag a node → it moves; position stays correct at any zoom level
  - Pan/zoom after placing nodes → nodes move with the world correctly

- [ ] **Step 3: Fix any issues found, commit**

```bash
git add -p
git commit -m "fix: address smoke test issues"
```
