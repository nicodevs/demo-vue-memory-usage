# demo-vue-memory-usage

How much memory (JS heap) does it take to render **10,000 items** — and how much
does **Vue 3.6 Vapor Mode** save over Vue 3.6's classic Virtual DOM?

The Virtual DOM keeps a whole tree of vnodes in memory, plus a component
instance for every component. Vapor keeps neither: it holds the real DOM and one
small effect per dynamic binding. So Vapor uses less memory, and the gap widens
the more components you have.

## Run it

```bash
git clone https://github.com/nicodevs/demo-vue-memory-usage
cd demo-vue-memory-usage
node benchmark.mjs
```

That's the whole workflow. `benchmark.mjs` is self-contained — it installs its
own dependencies (Playwright + a headless Chromium), installs and builds every
scenario, drives headless Chrome to take a heap snapshot of each build, and
prints the results:

```
Memory usage — Vue 3.6 Virtual DOM vs Vue 3.6 Vapor Mode (10,000 items)

  Scenario                            Virtual DOM   Vapor      Vapor advantage
  ──────────────────────────────────  ───────────   ────────   ───────────────
  Dynamic list (10k reactive rows)    …             …          …
  Static list (10k static rows)       …             …          …
  Components (10k child components)    …             …          …
```

(Requires Node ≥ 20.19 or ≥ 22.12 — Vite 8's build needs it.)

## Scenarios

Each scenario is its own folder under `scenarios/`, holding two apps that are
**byte-identical except** for the `vapor` keyword on `<script setup>` and the
mount call (`createApp` vs `createVaporApp`):

| Folder | What it renders |
| ------ | --------------- |
| `scenarios/dynamic-list/` | 10,000 rows in one `v-for`, each cell bound to reactive data |
| `scenarios/static-list/`  | 10,000 rows in one `v-for`, static cell content |
| `scenarios/components/`   | 10,000 child `<Row>` components, one per row |

```
scenarios/
  dynamic-list/
    vdom/    ← Vue 3.6, classic Virtual DOM
    vapor/   ← Vue 3.6 Vapor Mode
  static-list/
    vdom/  vapor/
  components/
    vdom/  vapor/
```

## How the measurement works

For each built app the benchmark:

1. Serves its `dist/` on a local port.
2. Opens it in a **fresh** headless-Chrome context (so no previous page's memory
   lingers).
3. Waits for all 10,000 rows to be in the DOM.
4. Forces garbage collection over the DevTools protocol (`HeapProfiler.collectGarbage`)
   — the same thing clicking "Take snapshot" does — then reads `JSHeapUsedSize`.

This is the scripted equivalent of opening **DevTools → Memory → Take heap
snapshot** and reading the total, with one app per tab.

## What you should see

Vapor wins everywhere, and wins biggest in the `components` scenario: that's the
per-component-instance overhead the Virtual DOM carries and Vapor doesn't. Watch
how the Virtual DOM's memory jumps when the same list is split into components,
while Vapor barely moves.

## Run a scenario by hand

Each app is a normal Vite project:

```bash
cd scenarios/components/vapor
npm install
npm run build && npm run preview   # open the URL, then DevTools → Memory
# or: npm run dev
```
