/**
 * The page: the shell's module loader, a real Slot registry, and the two
 * Session/locale faces this plugin reads.
 *
 * The browser half runs in a page, so the tests build a page rather than a
 * node process. Three of its four parts are the real thing:
 *
 * - **The module loader.** `window.__ModuleLoader__.load({ id, factory })` is the
 *   contract a client bundle registers under — the same one
 *   `@deepseek-ai/dsh-client-ui-primitives` and every other browser half obey.
 *   {@link page} stubs exactly that call, records what registered, and hands the
 *   factory a `require` for the platform table. Loading the shipped
 *   `lib/client.js` through it is what makes `bundle.spec.mjs` an assertion about
 *   the artifact instead of about the source.
 * - **The Slot registry.** `SlotRegistry` is not re-implemented: the shipped
 *   `@deepseek-ai/dsh-client-ui-renderer/client` bundle is loaded through the
 *   same loader and instantiated over a real Cordis `Context`, so `register`'s
 *   load-time validation (undeclared slot throws, occupied cell at the same
 *   priority throws, a keyed seat without a key throws), `entries`, and
 *   `inject`'s declaration-lifetime re-run are the upstream ones. A hand-rolled
 *   fake here would agree with whatever the plugin happened to do.
 * - **Cordis.** The registry is a `Service`; the plugin is mounted with
 *   `ctx.plugin({ inject, apply })`, exactly as a page mounts it.
 *
 * The fourth part is a fake, and deliberately so: the Session object layer
 * (`ctx.sessions`) is a browser service whose real implementation
 * (`ClientSessions`) drags in the connection, the gateway and the client store.
 * What this plugin reads from it is small and is the published contract — a
 * `SnapshotStore` of `SessionListState`, `binding(id)`, and a
 * `SessionEventSource` per binding — so {@link fakeSessions} and
 * {@link eventSource} implement exactly those interfaces, over the shapes
 * declared in `@deepseek-ai/dsh-api-session-controller/client`'s
 * `contract/events.ts` and `sessions/service.ts`. The window publications they
 * emit are the published deltas (`replace` / `prepend` / `append` /
 * `settle-assistant`), so a test can drive the very changes the plugin branches
 * on.
 *
 * @module test/harness
 */

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const require = createRequire(import.meta.url)

/** This plugin's package name, which is the module id its bundle registers under. */
export const PACKAGE = '@argszero/dsh-mcp-toolview'

/** The renderer package that owns the Slot registry. */
export const RENDERER = '@deepseek-ai/dsh-client-ui-renderer'

/** The keyed Tool view seat, as `ui-tool` declares it. */
export const SEAT = 'tool.call.toolview'

/** Let a mount's effects settle. Cordis applies effects asynchronously. */
export async function settle(milliseconds = 10) {
  await new Promise(resolve => setTimeout(resolve, milliseconds))
}

/**
 * The page's stand-in for `@deepseek-ai/dsh-client-ui-primitives`.
 *
 * The row imports one symbol from it (`TextShimmer`) and wraps its summary and
 * its running announcement in it. The real component animates its children; the
 * stub renders them unchanged, which is what the markup assertions need — a stub
 * that dropped them would make the summary invisible to every render test and
 * turn a real defect into a passing suite.
 * @param props - the primitive's props.
 * @returns the children, unanimated.
 */
function primitivesStub() {
  return { TextShimmer: props => props.children }
}

/** The page's module table: specifier -> the shared module. */
const PLATFORM = new Map([
  ['react/jsx-runtime', () => require('react/jsx-runtime')],
  ['@deepseek-ai/dsh-client-ui-primitives', primitivesStub],
])

/** Specifiers this page seeds, in the order `PLATFORM_MODULES` lists them. */
export const SEEDED = [...PLATFORM.keys()]

/**
 * The `require` a client bundle's factory is called with: the page's table, and
 * nothing else.
 * @param specifier - the module specifier the bundle requires.
 * @returns the shared module.
 */
export function pageRequire(specifier) {
  const shared = PLATFORM.get(specifier)
  if (shared === undefined) throw new Error(`${specifier} is not seeded by this page's platform table`)
  return shared()
}

/**
 * One page load: a module loader that records registrations, an evaluator that
 * runs a shipped bundle the way a classic script would, and a `require` for the
 * factory.
 */
export function page() {
  const registered = new Map()
  const loader = {
    load(spec) {
      if (registered.has(spec.id)) throw new Error(`${spec.id} was registered twice in one page load`)
      registered.set(spec.id, spec)
    },
  }
  const window = { __ModuleLoader__: loader }
  return {
    window,
    registered,
    /** Run one shipped client bundle, as the shell runs it. */
    evaluate(path) {
      // eslint-disable-next-line no-new-func -- the shell evaluates a bundle as a classic script
      new Function('window', readFileSync(path, 'utf8'))(window)
    },
    /** The exports of one registered module, its factory called with the page's table. */
    exports(id, page_require = pageRequire) {
      const spec = registered.get(id)
      if (spec === undefined) throw new Error(`${id} never registered with this page`)
      return spec.factory(page_require)
    },
  }
}

/** Absolute path of one package's shipped client bundle, resolved through node. */
export function bundlePath(specifier) {
  return require.resolve(`${specifier}/client`)
}

/**
 * A `SessionEventSource` over the published window shape.
 *
 * `getSnapshot()` returns the cached `{ entries, hasMore, revision, change }`
 * object and `subscribe` notifies synchronously on every publication — the two
 * members the plugin's subscription uses, plus the mutators a test drives
 * (`replace`, `append`, `prepend`, `settle`).
 * @param entries - the window's initial contents, published as a `replace`.
 * @returns the source and its mutators.
 */
export function eventSource(entries = []) {
  let window = {
    entries: [...entries],
    hasMore: false,
    revision: 1,
    change: { kind: 'replace', entries: [...entries] },
  }
  const listeners = new Set()
  const publish = (change, next) => {
    window = { entries: next, hasMore: window.hasMore, revision: window.revision + 1, change }
    for (const listener of [...listeners]) listener()
  }
  return {
    getSnapshot: () => window,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    /** The pages of history the renderer loaded before this plugin mounted. */
    replace(next) {
      publish({ kind: 'replace', entries: [...next] }, [...next])
    },
    /** One older page, loaded by scrolling up. */
    prepend(page) {
      publish({ kind: 'prepend', entries: [...page] }, [...page, ...window.entries])
    },
    /** One live entry, as a running turn produces it. */
    append(entry) {
      publish({ kind: 'append', entries: [entry] }, [...window.entries, entry])
    },
    /** One attempt's transient rows replaced by its durable settlement. */
    settle(attemptId, entry = undefined) {
      const change = entry === undefined
        ? { kind: 'settle-assistant', attemptId }
        : { kind: 'settle-assistant', attemptId, entry }
      publish(change, [...window.entries])
    },
    /** Live subscribers, as a count — teardown is asserted against this. */
    listeners,
  }
}

/**
 * The Session object layer, over the published `SessionListState` /
 * `SessionBinding` shapes.
 * @returns the service and the test's mutators.
 */
export function fakeSessions() {
  const byId = {}
  const bindings = new Map()
  const listeners = new Set()
  const notify = () => { for (const listener of [...listeners]) listener() }
  return {
    list: {
      getSnapshot: () => ({
        ids: Object.keys(byId),
        byId,
        // `phase` is a catalog-arrival lifecycle the plugin never reads; one
        // settled value keeps the fake from modelling a state it ignores.
        phase: 'ready',
        projectionsBySession: {},
      }),
      subscribe(listener) {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
    },
    binding: id => bindings.get(id),
    /** Retain one Session and give it an event source; returns the source. */
    bind(id, entries = []) {
      const source = eventSource(entries)
      bindings.set(id, { sessionId: id, eventSource: source })
      byId[id] = {
        id,
        displayTitle: id,
        running: false,
        retainedBy: {},
        blank: false,
        updatedAt: 0,
      }
      notify()
      return source
    },
    /** Drop the binding but keep the catalog row: a row with no renderer. */
    release(id) {
      bindings.delete(id)
      notify()
    },
    /** Drop the row and the binding: the Session left the catalog. */
    forget(id) {
      bindings.delete(id)
      delete byId[id]
      notify()
    },
    /** Publish a catalog change without adding or removing a row. */
    touch() {
      notify()
    },
    /** Live subscribers of the catalog store, as a count. */
    listeners,
  }
}

/** A locale seat that records the dictionaries a plugin registers, and their disposal. */
export function fakeLocale() {
  const dictionaries = []
  const disposed = []
  return {
    dictionaries,
    disposed,
    register(namespace, entries) {
      dictionaries.push({ namespace, dictionaries: entries })
      return () => { disposed.push(namespace) }
    },
    bind: () => (key) => key,
  }
}

/**
 * A page with a real Slot registry, a declared seat, and the plugin mounted.
 *
 * The seat is declared the way its owner declares it — a `root` registration
 * whose `children` table names `tool.call.toolview` as a `keyed`,
 * `session`-scoped child — so `slots.register` into it is validated by the same
 * code a page runs, and {@link BrowserWorld.collapse} can take the declaration
 * away and put it back, which is the load-order question the plugin's `inject`
 * gate exists for.
 * @param spec - `mount: false` leaves the plugin unmounted for the caller.
 * @returns the page, the context, the registry, the fakes, and the mount/dispose pair.
 */
export async function browserWorld(spec = {}) {
  const loaded = page()
  loaded.evaluate(bundlePath(RENDERER))
  const { SlotRegistry } = loaded.exports(RENDERER, require)
  const { Context } = await import('@deepseek-ai/cordis')

  const ctx = new Context()
  const slots = new SlotRegistry(ctx)
  const sessions = fakeSessions()
  ctx.provide('sessions', sessions)
  const locale = fakeLocale()
  ctx.provide('locale', locale)

  const declare = () => slots.register({
    name: 'root',
    children: { [SEAT]: { kind: 'keyed', scope: 'session' } },
  }, () => null)
  let declaration = declare()

  /** This plugin's shipped bundle, as the page receives it. */
  const client = () => {
    if (!loaded.registered.has(PACKAGE)) loaded.evaluate(join(ROOT, 'lib/client.js'))
    return loaded.exports(PACKAGE)
  }

  const world = {
    ctx,
    slots,
    sessions,
    locale,
    page: loaded,
    /** The plugin module the shell loads: `{ apply, inject }`. */
    client,
    /** The mounted fiber, once {@link BrowserWorld.mount} has run. */
    fiber: undefined,
    mount: async (module = client()) => {
      world.fiber = ctx.plugin({ inject: [...module.inject], apply: module.apply })
      await world.fiber.await()
      await settle()
      return world
    },
    dispose: async () => {
      await world.fiber?.dispose()
      world.fiber = undefined
      await settle()
    },
    /** Take the seat's declaration away: a bundle row unloading. */
    collapse: async () => {
      declaration()
      await settle()
    },
    /** Declare the seat again: an owner mounting after this plugin. */
    declare: async () => {
      declaration = declare()
      await settle()
    },
    /** Every entry currently occupying the seat. */
    entries: () => slots.entries(SEAT),
    /** The `options.key` of every entry currently occupying the seat. */
    keys: () => slots.entries(SEAT).map(entry => entry.options.key),
  }
  if (spec.mount !== false) await world.mount()
  return world
}

/** One `{ type: 'event', event }` entry, the shape a durable Session event arrives in. */
export function eventEntry(event) {
  return { type: 'event', event }
}

/** One `{ type: 'transient', event }` entry: a client-only live chunk presentation. */
export function transientEntry(chunk = {}) {
  return { type: 'transient', event: { type: 'assistant/live-chunk', seq: 1, time: 0, data: chunk } }
}

/** A `tool/call` durable event. */
export function toolCall(name, callId = `c-${name}`) {
  return eventEntry({ type: 'tool/call', seq: 1, time: 0, data: { callId, name } })
}

/** A `tool/ptc-dispatch-start` durable event. */
export function ptcDispatchStart(name, subCallId = `s-${name}`) {
  return eventEntry({ type: 'tool/ptc-dispatch-start', seq: 1, time: 0, data: { subCallId, name } })
}

/** A `request/header` durable event carrying an assembled tool catalog. */
export function requestHeader(names, callId = 'h') {
  return eventEntry({
    type: 'request/header',
    seq: 1,
    time: 0,
    data: {
      header: { tools: names.map(name => ({ name, description: '', parameters: {} })) },
      reason: 'initial',
      callId,
    },
  })
}

/** A `request/header` durable event for a request that assembled no tools. */
export function requestHeaderWithoutTools() {
  return eventEntry({ type: 'request/header', seq: 1, time: 0, data: { header: {}, reason: 'initial' } })
}

/** A durable event of a type this plugin has no interest in. */
export function assistantMessage() {
  return eventEntry({ type: 'assistant/message', seq: 1, time: 0, data: { blocks: [] } })
}
