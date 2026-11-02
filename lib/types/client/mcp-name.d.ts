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
export declare const MCP_PREFIX = "mcp__";
/** Whether a wire Tool name belongs to the MCP namespace. */
export declare function isMcpToolName(name: string): boolean;
/** Display label for one MCP wire Tool name. */
export interface McpToolLabel {
    /**
     * Derived server name, or `null` when the name does not split into exactly
     * one server/tool pair — the caller then shows the wire name as the title
     * rather than a guess.
     */
    readonly server: string | null;
    /** Tool segment when {@link server} is set, the whole wire name otherwise. */
    readonly tool: string;
}
/**
 * Split an MCP wire name into its server and tool segments for display.
 * @param name - wire Tool name, as dispatched by the keyed seat.
 * @returns the label; a non-MCP or undecidable name carries `server: null`.
 */
export declare function mcpToolLabel(name: string): McpToolLabel;
