/**
 * The artifact the shell loads, not the source it was built from.
 *
 * A client bundle is not a module the page imports: the shell evaluates
 * `lib/client.js` as a script, and the file registers itself with the shell's
 * own loader — `window.__ModuleLoader__.load({ id, factory })`. Three things
 * have to be true for that to work in a real page, and none of them is visible
 * from `tsc`:
 *
 * - **the id is the package name**, because that is the identity the shell
 *   resolves and the name a page's module table is keyed by;
 * - **the factory asks for nothing the shell does not seed** — the page's
 *   `require` is the frozen platform table, and a bundle that reaches for any
 *   other specifier fails at the first render rather than at build time;
 * - **the exports are the plugin contract** (`apply`, `inject`), because that is
 *   what the shell mounts.
 *
 * The load below is the real one: the file is evaluated with a stub loader, and
 * its factory is called with a `require` that throws for anything outside the
 * seeded table.
 *
 * @module test/bundle
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { PACKAGE, page, pageRequire, ROOT, SEEDED } from './harness.mjs'

const MANIFEST = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const BUILD = JSON.parse(readFileSync(join(ROOT, 'lib', 'client.js.build.json'), 'utf8'))

/**
 * The platform modules this bundle is allowed to require.
 *
 * Pinned rather than derived: the shell's seeded table is a decision made by
 * `@deepseek-ai/dsh-client-web`'s `PLATFORM_MODULES`, and a bundle that starts
 * requiring a fourth module should stop here and be checked against that list
 * rather than quietly widening what a consumer must have installed.
 */
const REQUIRED = ['@deepseek-ai/dsh-client-ui-primitives', 'react/jsx-runtime']

describe('the client bundle', () => {
  it('registers with the shell loader under the package name', () => {
    const loaded = page()
    loaded.evaluate(join(ROOT, 'lib', 'client.js'))
    assert.deepEqual([...loaded.registered.keys()], [PACKAGE])
    assert.equal(PACKAGE, MANIFEST.name)
  })

  it('registers a factory rather than evaluating its plugins at load time', () => {
    const loaded = page()
    loaded.evaluate(join(ROOT, 'lib', 'client.js'))
    assert.equal(typeof loaded.registered.get(PACKAGE).factory, 'function')
  })

  it('exports the plugin contract the shell mounts', () => {
    const loaded = page()
    loaded.evaluate(join(ROOT, 'lib', 'client.js'))
    const module = loaded.exports(PACKAGE)
    assert.equal(typeof module.apply, 'function')
    assert.ok(Array.isArray(module.inject))
    assert.ok(module.inject.every(name => typeof name === 'string' && name.length > 0))
  })

  it('declares exactly the injected services it needs', () => {
    const loaded = page()
    loaded.evaluate(join(ROOT, 'lib', 'client.js'))
    assert.deepEqual([...loaded.exports(PACKAGE).inject], ['slots', 'sessions', 'locale'])
  })

  it('requires only modules the shell seeds, so the page can resolve every one of them', () => {
    for (const specifier of REQUIRED) {
      assert.doesNotThrow(() => pageRequire(specifier), `${specifier} is not seeded by the page`)
    }
    // The factory itself is the proof: calling it runs every top-level require.
    const loaded = page()
    loaded.evaluate(join(ROOT, 'lib', 'client.js'))
    assert.doesNotThrow(() => loaded.exports(PACKAGE))
  })

  it('fails loudly when handed a require that cannot resolve one of them', () => {
    // The page's require is the contract; a bundle tested against a permissive
    // one would pass here and fail in a browser.
    const loaded = page()
    loaded.evaluate(join(ROOT, 'lib', 'client.js'))
    assert.throws(
      () => loaded.exports(PACKAGE, specifier => { throw new Error(`not seeded: ${specifier}`) }),
      /not seeded/,
    )
  })

  it('agrees with the build manifest about what it requires', () => {
    assert.deepEqual([...BUILD.required].sort(), [...REQUIRED].sort())
    assert.deepEqual(BUILD.externals.filter(name => REQUIRED.includes(name)).sort(), [...REQUIRED].sort())
  })

  it('is the bundle the manifest measured', () => {
    const bytes = readFileSync(join(ROOT, 'lib', 'client.js')).byteLength
    assert.equal(bytes, BUILD.bytes)
    assert.equal(BUILD.id, PACKAGE)
  })

  it('seeds the row through a platform module the shell shares', () => {
    // `SEEDED` is the page's table; the bundle requiring one of its entries is
    // what makes the row's own components part of the shared platform rather
    // than a second copy of them.
    assert.ok(REQUIRED.some(specifier => SEEDED.includes(specifier)))
  })
})

describe('the manifest the shell reads', () => {
  it('declares the browser half and its platform', () => {
    assert.equal(MANIFEST.dsh?.client?.platform, 'web')
    assert.ok(Array.isArray(MANIFEST.dsh?.client?.inject))
  })

  it('ships the browser half under its own export', () => {
    assert.equal(MANIFEST.exports['./client'].default, './lib/client.js')
    assert.ok(MANIFEST.files.includes('lib/client.js'))
  })

  it('declares the bundle patch the loader mounts', () => {
    assert.equal(MANIFEST.dsh?.bundle?.patch, './cordis.patch.yml')
  })
})
