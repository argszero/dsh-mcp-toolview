/**
 * Browser half of `@argszero/dsh-mcp-toolview`.
 *
 * One contribution, into a seat that already exists: `ui-tool` declares
 * `tool.call.toolview` as a `keyed`, `session`-scoped seat and dispatches it by
 * wire Tool name, falling back to its generic card for an unclaimed key. A
 * keyed seat declares the *slot*, never its keys, so a family whose member names
 * exist only at runtime can still be claimed — one registration per name.
 *
 * The names come from the Session event window (see `./discovery.ts`), which
 * means this plugin reads the same durable material a replay reads: the rows it
 * produces are the rows a cold replay produces, in the same places.
 *
 * Two rules the wiring keeps:
 *
 * - **Registration waits for the declaration.** `slots.register` throws into an
 *   undeclared seat, so entries are minted inside `slots.inject`, which also
 *   re-runs when the declaring entry collapses and returns — load order stops
 *   mattering, and a session that paged its history in before this plugin
 *   mounted still gets its rows.
 * - **An occupied key is left alone.** Another plugin's view for the same wire
 *   name is a decision, not an accident; this one skips it rather than throwing
 *   or shadowing.
 *
 * @module @argszero/dsh-mcp-toolview/client
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SessionBinding } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
// Type-only: pulls the locale plugin's ctx.locale merge and the SlotRegistry's
// ctx.slots merge.
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import { toolNamesIn, windowReader } from './discovery.ts'
import { isMcpToolName } from './mcp-name.ts'
import { McpToolRow } from './McpToolRow.tsx'
import { en, NS, zh, type McpToolviewKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** MCP tool-row copy. */
    'mcp-toolview': McpToolviewKey
  }
}

export type { McpToolRowProps } from './McpToolRow.tsx'
export type { McpToolLabel } from './mcp-name.ts'
export type { McpRowModel, McpRowState } from './row-model.ts'

/** The keyed Tool view seat this plugin contributes to. */
const SEAT = 'tool.call.toolview'

/** Services this browser half needs: the Slot registry, the Session object layer, and the locale seat. */
export const inject = ['slots', 'sessions', 'locale']

/**
 * Client plugin body: register the dictionaries, then learn and claim the
 * session's MCP Tool names.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'mcp-toolview: dictionaries')
  ctx.effect(() => discoverMcpToolviews(ctx), 'mcp-toolview: discovery')
}

/**
 * Follow every bound Session's event window and keep one keyed entry per MCP
 * Tool name it reveals.
 * @param ctx - client root context.
 * @returns teardown: every subscription and every registration.
 */
function discoverMcpToolviews(ctx: ClientContext): () => void {
  const sessions = ctx.sessions
  // Names are remembered for the plugin's life while registrations are not: a
  // collapsing declaration takes its entries with it, and a later one must be
  // able to mint them again without re-reading any session.
  const names = new Set<string>()
  /** Live registrations by wire name; null while no declaration is live. */
  let live: Map<string, () => void> | null = null

  const sync = (): void => {
    if (live === null) return
    const claimed = new Set<string>()
    for (const entry of ctx.slots.entries(SEAT)) {
      if (entry.options.key !== undefined) claimed.add(entry.options.key)
    }
    for (const name of names) {
      if (live.has(name) || claimed.has(name)) continue
      live.set(name, ctx.slots.register(
        { name: SEAT, key: name, locale: NS, registrant: 'mcp-toolview' },
        McpToolRow,
      ))
    }
  }

  const learn = (candidates: readonly string[]): void => {
    let grew = false
    for (const name of candidates) {
      if (names.has(name) || !isMcpToolName(name)) continue
      names.add(name)
      grew = true
    }
    if (grew) sync()
  }

  // One event-window subscription per bound Session. A Session is retained by
  // whoever renders it, and `sessions.binding` reports exactly that — so the
  // sessions this plugin watches are the sessions with rows to render.
  const windows = new Map<SessionId, () => void>()

  const watch = (binding: SessionBinding): void => {
    // The reader, not the subscription, owns "have I looked yet": the window's
    // delta only means something to a reader that saw what it was a delta of.
    const read = windowReader()
    const scan = (): void => {
      learn(toolNamesIn(read(binding.eventSource.getSnapshot())))
    }
    // The window may already hold the events — a session opened, or a turn run,
    // before this plugin mounted still gets its rows.
    scan()
    windows.set(binding.sessionId, binding.eventSource.subscribe(scan))
  }

  const reconcile = (): void => {
    const bound = new Map<SessionId, SessionBinding>()
    // `byId` carries catalog rows and retained subagent fallbacks; a row whose
    // binding is absent is not rendered anywhere, so it has no rows to claim.
    for (const summary of Object.values(sessions.list.getSnapshot().byId)) {
      const binding = sessions.binding(summary.id)
      if (binding !== undefined) bound.set(summary.id, binding)
    }
    for (const [sessionId, stop] of windows) {
      if (bound.has(sessionId)) continue
      stop()
      windows.delete(sessionId)
    }
    for (const [sessionId, binding] of bound) {
      if (windows.has(sessionId)) continue
      watch(binding)
    }
  }

  const stopInject = ctx.slots.inject(SEAT, () => {
    const entries = new Map<string, () => void>()
    live = entries
    sync()
    return () => {
      if (live === entries) live = null
      for (const dispose of entries.values()) dispose()
    }
  })

  reconcile()
  const stopList = sessions.list.subscribe(reconcile)

  return () => {
    stopInject()
    stopList()
    for (const stop of windows.values()) stop()
    windows.clear()
  }
}
