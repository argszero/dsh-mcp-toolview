/**
 * The row's view model: pure derivation from one frozen call slice.
 *
 * Every field comes from the block the seat hands over — the same durable
 * call/result material a replayed session re-derives — so a cold replay renders
 * byte-identically to the live turn. Nothing here reads a session, a remote, or
 * the MCP connection the call went to.
 *
 * @module @argszero/dsh-mcp-toolview/client/row-model
 */

import type { ToolCallBlock, ToolResultNode } from '@deepseek-ai/dsh-client-ui-conversation/client'

/** Row lifecycle, in the vocabulary the other atomic Tool views use. */
export type McpRowState = 'preparing' | 'running' | 'ok' | 'error' | 'stopped'

/** First physical line of a block of text; the collapsed-summary unit. */
export function firstLine(text: string): string {
  const newline = text.indexOf('\n')
  return newline === -1 ? text : text.slice(0, newline)
}

/**
 * Lifecycle of one call, from the settled result when there is one.
 * @param block - the stage the seat dispatched.
 * @returns the state the row renders.
 */
export function mcpRowState(block: ToolCallBlock): McpRowState {
  if (!('kind' in block)) return block.phase === 'preparing' ? 'preparing' : 'running'
  // `interrupted` is the harness's own cancellation identity: a call the user
  // stopped is not a failure of the MCP server, and saying so would be wrong.
  if (block.error?.code === 'interrupted') return 'stopped'
  return block.isError ? 'error' : 'ok'
}

/** The argument JSON a stage publishes; a result whose call left the window has none. */
function argsRawOf(block: ToolCallBlock): string {
  if ('kind' in block) return block.call?.argsRaw ?? ''
  // A preparing call's arguments are still streaming, and the seat renders that
  // stage without an argument line at all.
  return block.phase === 'start' ? block.argsRaw : ''
}

/** First line of the raw argument JSON, used when nothing better can be read. */
function rawFallback(argsRaw: string, callId: string): string {
  return argsRaw === '' ? callId : firstLine(argsRaw)
}

/**
 * One-line argument summary for the collapsed row.
 *
 * The first string-valued argument, wherever it sits in the object: MCP servers
 * name their arguments after their own domain (`repo`, `query`, `path`), and a
 * fixed key list would be a guess about a toolset the plugin has never seen.
 * Falls back to the raw JSON's first line while arguments are still streaming,
 * which is the only state where the object cannot be parsed at all.
 * @param argsRaw - the call's recorded argument JSON.
 * @param callId - identity to fall back to for a call with no readable argument.
 * @returns the summary text.
 */
export function argSummary(argsRaw: string, callId: string): string {
  if (argsRaw === '') return callId
  let parsed: unknown
  try {
    parsed = JSON.parse(argsRaw)
  } catch {
    // Mid-stream truncation: a partial prefix is still more useful than nothing.
    return firstLine(argsRaw)
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return firstLine(argsRaw)
  for (const value of Object.values(parsed)) {
    if (typeof value === 'string' && value !== '') return firstLine(value)
  }
  return firstLine(argsRaw)
}

/**
 * Flatten a settled result's content blocks to display text: text blocks
 * verbatim, every other block shape as pretty JSON (a resource reference or an
 * image descriptor has no text of its own, and dropping it would hide that the
 * call returned something).
 * @param content - the recorded result content.
 * @param error - the recorded failure identity, when the call failed.
 * @returns the flattened text, or null when the result carries none.
 */
export function flattenContent(
  content: ToolResultNode['content'],
  error: ToolResultNode['error'],
): string | null {
  const parts: string[] = []
  for (const block of content) {
    if (block.type === 'text') parts.push(block.text)
    else parts.push(JSON.stringify(block, null, 2))
  }
  if (parts.length === 0 && error !== undefined) parts.push(`${error.name}: ${error.code}`)
  return parts.length === 0 ? null : parts.join('\n')
}

/** Everything the settled row renders, derived once from the frozen slice. */
export interface McpRowModel {
  readonly state: McpRowState
  /** The wire name, verbatim — the only identity that survives a lossy split. */
  readonly wireName: string
  /** Argument summary for the collapsed row. */
  readonly summary: string
  /** Argument JSON for the expanded body; null when the call left the window. */
  readonly argsRaw: string | null
  /** Flattened result text; null while running or when the result has no text. */
  readonly output: string | null
  /** First line of the output on a failed row; null otherwise. */
  readonly errorSummary: string | null
}

/**
 * Derive the settled row model.
 * @param block - a dispatched or settled call.
 * @returns the model.
 */
export function mcpRowModel(block: ToolCallBlock): McpRowModel {
  const state = mcpRowState(block)
  const settled = 'kind' in block
  const wireName = settled ? (block.call?.name ?? block.name) : block.name
  const argsRaw = argsRawOf(block)
  const output = settled ? flattenContent(block.content, block.error) : null
  return {
    state,
    wireName,
    summary: argSummary(argsRaw, block.callId),
    argsRaw: argsRaw === '' ? null : argsRaw,
    output,
    errorSummary: state === 'error' && output !== null ? firstLine(output) : null,
  }
}
