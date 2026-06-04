# demo-vue-memory-usage

How much memory (JS heap) does it take to render **10,000 items** on **Vue 3.6** with and without Vapor mode? Does Vapor win against Vue's classic Virtual DOM?

This demo is part of my talk at [FrontendNation.com](FrontendNation.com). Find the slides and article here: [Vue Vapor, Goodbye Virtual DOM!](https://nicodevs.com/frontendnation)

## Run this demo

```bash
git clone https://github.com/nicodevs/demo-vue-memory-usage
cd demo-vue-memory-usage
node benchmark.mjs
```

That's the whole workflow. `benchmark.mjs` is self contained: it installs its own dependencies (Playwright + a headless Chromium), installs and builds every scenario, drives headless Chrome to take a heap snapshot of each build, and prints the results:

```
Memory usage: Vue 3.6 Virtual DOM vs Vue 3.6 Vapor Mode (10,000 items)

  Scenario                            Virtual DOM   Vapor      Vapor advantage
  ──────────────────────────────────  ───────────   ────────   ───────────────
  Dynamic list (10k reactive rows)    …             …          …
  Components (10k child components)   …             …          …
  Static components (10k static)      …             …          …
```

(Requires Node ≥ 20.19 or ≥ 22.12)

## Scenarios

Each scenario is its own folder under `scenarios/`, holding two apps that are **identical** except for the `vapor` keyword on `<script setup>` and the mount call (`createApp` vs `createVaporApp`):

| Folder                         | What it renders                                                |
| ------------------------------ | -------------------------------------------------------------- |
| `scenarios/dynamic-list/`      | 10,000 rows in one `v-for`, each cell bound to reactive data   |
| `scenarios/components/`        | 10,000 child `<Row>` components, one per row (dynamic content) |
| `scenarios/components-static/` | 10,000 child `<Row>` components with static content            |

```
scenarios/
  dynamic-list/
    vdom/    ← Vue 3.6, classic Virtual DOM
    vapor/   ← Vue 3.6 Vapor Mode
  components/
    vdom/
    vapor/
  components-static/
    vdom/
    vapor/
```

## How the measurement works

For each built app, the benchmark:

1. Serves its `dist/` on a local port.
2. Opens it in a **fresh** headless Chrome context (so no previous page's memory lingers).
3. Waits for all 10,000 rows to be in the DOM.
4. Forces garbage collection over the DevTools protocol (`HeapProfiler.collectGarbage`), the same thing clicking "Take snapshot" does, then reads `JSHeapUsedSize`.

This is the scripted equivalent of opening **DevTools → Memory → Take heap snapshot** and reading the total, with one app per tab.

## Run a scenario by hand

```bash
cd scenarios/components/vapor
npm install
npm run build && npm run preview
```
