/**
 * The MCP public-name convention, read as a display label.
 *
 * `@deepseek-ai/dsh-mcp-client` registers every tool it bridges under
 * `mcp__<serverName>__<rawName>`, normalized to the DeepSeek function-name
 * contract. That public name is what the model calls and what the keyed
 * `tool.call.toolview` seat dispatches on, so it is the only identity a view
 * has — and reading it is exactly what the bridge's own contract forbids for
 * *routing* ("the public name is never parsed to recover it"): the caller must
 * keep `(serverName, rawName)` from registration, not from the string.
 *
 * A view has no registration to keep. It has a name and a user who wants to
 * know which server a call went to, so it reads the name — as a label, never as
 * an identity. The two rules that keep that honest:
 *
 * 1. **Ambiguity is reported, not guessed.** The server segment is only
 *    returned when exactly one split of the name is consistent with the
 *    server-name contract; a server name containing `__` (the contract allows
 *    it) leaves the split undecidable, and the label says so by returning
 *    `null` instead of picking one.
 * 2. **The wire name always survives.** A truncated or character-replaced name
 *    (the bridge appends a 12-hex digest when normalization was lossy) yields a
 *    label whose tool segment is a fragment; the row renders the whole wire
 *    name beside the label, so a fragment is never mistaken for the identity.
 *
 * @module @argszero/dsh-mcp-toolview/client/mcp-name
 */

/** Namespace prefix `@deepseek-ai/dsh-mcp-client` puts on every bridged tool. */
export const MCP_PREFIX = 'mcp__'

/**
 * The bridge's server-name contract (its plugin config's `serverName`):
 * `[A-Za-z0-9_-]{1,32}`. The view uses it only to decide whether a split is
 * *possible*, which is what the ambiguity rule needs.
 */
const SERVER_NAME = /^[A-Za-z0-9_-]{1,32}$/u

/** Whether a wire Tool name belongs to the MCP namespace. */
export function isMcpToolName(name: string): boolean {
  return name.startsWith(MCP_PREFIX) && name.length > MCP_PREFIX.length
}

/** Display label for one MCP wire Tool name. */
export interface McpToolLabel {
  /**
   * Derived server name, or `null` when the name does not split into exactly
   * one server/tool pair — the caller then shows the wire name as the title
   * rather than a guess.
   */
  readonly server: string | null
  /** Tool segment when {@link server} is set, the whole wire name otherwise. */
  readonly tool: string
}

/**
 * Split an MCP wire name into its server and tool segments for display.
 * @param name - wire Tool name, as dispatched by the keyed seat.
 * @returns the label; a non-MCP or undecidable name carries `server: null`.
 */
export function mcpToolLabel(name: string): McpToolLabel {
  if (!isMcpToolName(name)) return { server: null, tool: name }
  const rest = name.slice(MCP_PREFIX.length)
  let index = rest.indexOf('__')
  let server: string | null = null
  let tool = name
  while (index !== -1) {
    const candidate = rest.slice(0, index)
    const remainder = rest.slice(index + 2)
    if (remainder.length > 0 && SERVER_NAME.test(candidate)) {
      // A second consistent split means the name does not say which one is the
      // server; stop and report the name whole.
      if (server !== null) return { server: null, tool: name }
      server = candidate
      tool = remainder
    }
    index = rest.indexOf('__', index + 1)
  }
  return { server, tool }
}
