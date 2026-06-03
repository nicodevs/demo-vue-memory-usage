#!/usr/bin/env node
// Memory-usage benchmark: Vue 3.6 (Virtual DOM) vs Vue 3.6 Vapor Mode.
//
//   node benchmark.mjs
//
// Self-contained: installs its own deps (Playwright + headless Chromium),
// installs & builds every scenario, serves each build, drives headless Chrome,
// forces GC, reads the JS heap size, and prints a comparison table.
// Nothing to set up first — clone the repo and run this file.

import { spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))

// Scenarios, in the order they're reported. Each is a folder under scenarios/
// holding two byte-identical apps (`vdom/` and `vapor/`) that differ only by the
// `vapor` keyword and the mount call.
const SCENARIOS = [
  { id: 'dynamic-list', label: 'Dynamic list (10k reactive rows)' },
  { id: 'components', label: 'Components (10k child components)' },
  { id: 'components-static', label: 'Static components (10k static)' },
]
const VARIANTS = ['vdom', 'vapor']
const ITEMS = 10000
// Heap size varies a little run-to-run (GC timing). Average over N snapshots.
// Override with e.g. `SAMPLES=100 node benchmark.mjs`.
const SAMPLES = Math.max(1, Number(process.env.SAMPLES) || 5)

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
  if (r.status !== 0) throw new Error(`\`${cmd} ${args.join(' ')}\` failed in ${cwd}`)
}

// ---- 1. Bootstrap the benchmark's own dependencies -------------------------
if (!existsSync(join(root, 'node_modules', 'playwright'))) {
  console.log('📦  Installing benchmark dependencies (Playwright)…')
  run('npm', ['install'], root)
}
// Idempotent: a no-op once the browser is cached.
console.log('🌐  Ensuring headless Chromium is available…')
run('npx', ['playwright', 'install', 'chromium'], root)

const { chromium } = await import('playwright')

// ---- 2. Install & build every scenario app ---------------------------------
for (const { id } of SCENARIOS) {
  for (const variant of VARIANTS) {
    const dir = join(root, 'scenarios', id, variant)
    if (!existsSync(join(dir, 'node_modules'))) {
      console.log(`\n📦  install ${id}/${variant}`)
      run('npm', ['install'], dir)
    }
    console.log(`🔨  build   ${id}/${variant}`)
    run('npm', ['run', 'build'], dir)
  }
}

// ---- 3. A tiny static server for a built `dist/` ---------------------------
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}
function serve(distDir) {
  const server = createServer(async (req, res) => {
    let urlPath = decodeURIComponent((req.url || '/').split('?')[0])
    if (urlPath === '/') urlPath = '/index.html'
    let file = join(distDir, urlPath)
    if (!file.startsWith(distDir)) {
      res.writeHead(403).end()
      return
    }
    let body
    try {
      body = await readFile(file)
    } catch {
      file = join(distDir, 'index.html') // SPA fallback
      body = await readFile(file)
    }
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' })
    res.end(body)
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve({
        url: `http://127.0.0.1:${port}/`,
        close: () => new Promise((r) => server.close(r)),
      })
    })
  })
}

// ---- 4. Measure one built app's live JS heap -------------------------------
// Mirrors DevTools' "Take heap snapshot": force GC first, then read the size.
async function measureHeap(browser, url) {
  const page = await browser.newPage()
  const client = await page.context().newCDPSession(page)
  await client.send('Performance.enable')
  await page.goto(url, { waitUntil: 'load' })
  // Wait until all rows are actually in the DOM.
  await page.waitForFunction(
    (n) => document.querySelectorAll('tr').length >= n,
    ITEMS,
    { timeout: 60000 },
  )
  // Let layout settle, then collect garbage a few times so the number is clean.
  await page.waitForTimeout(300)
  for (let i = 0; i < 3; i++) {
    await client.send('HeapProfiler.collectGarbage')
    await page.waitForTimeout(150)
  }
  const { metrics } = await client.send('Performance.getMetrics')
  const used = metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? 0
  await page.close()
  return used
}

// ---- 5. Run the matrix -----------------------------------------------------
console.log(
  `\n📸  Taking heap snapshots in headless Chrome (averaging ${SAMPLES} per app)…`,
)
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const results = []
for (const { id, label } of SCENARIOS) {
  const row = { id, label }
  for (const variant of VARIANTS) {
    const distDir = join(root, 'scenarios', id, variant, 'dist')
    const site = await serve(distDir) // serve once, reload per sample
    process.stdout.write(`   ${id}/${variant} … `)
    let sum = 0
    for (let i = 0; i < SAMPLES; i++) sum += await measureHeap(browser, site.url)
    await site.close()
    row[variant] = sum / SAMPLES
    console.log(`${(row[variant] / 1048576).toFixed(1)} MB`)
  }
  results.push(row)
}
await browser.close()

// ---- 6. Report -------------------------------------------------------------
const mb = (b) => `${(b / 1048576).toFixed(1)} MB`
const cols = [
  { head: 'Scenario', get: (r) => r.label, w: Math.max(8, ...results.map((r) => r.label.length)) },
  { head: 'Virtual DOM', get: (r) => mb(r.vdom), w: 11 },
  { head: 'Vapor', get: (r) => mb(r.vapor), w: 8 },
  { head: 'Vapor advantage', get: (r) => `${(r.vdom / r.vapor).toFixed(2)}× lighter`, w: 15 },
]
const pad = (s, w) => s + ' '.repeat(Math.max(0, w - s.length))
const line = (cells) => '  ' + cells.map((c, i) => pad(c, cols[i].w)).join('   ')

console.log(`\nMemory usage — Vue 3.6 Virtual DOM vs Vue 3.6 Vapor Mode (${ITEMS.toLocaleString()} items)\n`)
console.log(line(cols.map((c) => c.head)))
console.log(line(cols.map((c) => '─'.repeat(c.w))))
for (const r of results) console.log(line(cols.map((c) => c.get(r))))
console.log()
