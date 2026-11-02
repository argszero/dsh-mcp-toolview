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
import type { ToolCallBlock, ToolResultNode } from '@deepseek-ai/dsh-client-ui-conversation/client';
/** Row lifecycle, in the vocabulary the other atomic Tool views use. */
export type McpRowState = 'preparing' | 'running' | 'ok' | 'error' | 'stopped';
/** First physical line of a block of text; the collapsed-summary unit. */
export declare function firstLine(text: string): string;
/**
 * Lifecycle of one call, from the settled result when there is one.
 * @param block - the stage the seat dispatched.
 * @returns the state the row renders.
 */
export declare function mcpRowState(block: ToolCallBlock): McpRowState;
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
export declare function argSummary(argsRaw: string, callId: string): string;
/**
 * Flatten a settled result's content blocks to display text: text blocks
 * verbatim, every other block shape as pretty JSON (a resource reference or an
 * image descriptor has no text of its own, and dropping it would hide that the
 * call returned something).
 * @param content - the recorded result content.
 * @param error - the recorded failure identity, when the call failed.
 * @returns the flattened text, or null when the result carries none.
 */
export declare function flattenContent(content: ToolResultNode['content'], error: ToolResultNode['error']): string | null;
/** Everything the settled row renders, derived once from the frozen slice. */
export interface McpRowModel {
    readonly state: McpRowState;
    /** The wire name, verbatim — the only identity that survives a lossy split. */
    readonly wireName: string;
    /** Argument summary for the collapsed row. */
    readonly summary: string;
    /** Argument JSON for the expanded body; null when the call left the window. */
    readonly argsRaw: string | null;
    /** Flattened result text; null while running or when the result has no text. */
    readonly output: string | null;
    /** First line of the output on a failed row; null otherwise. */
    readonly errorSummary: string | null;
}
/**
 * Derive the settled row model.
 * @param block - a dispatched or settled call.
 * @returns the model.
 */
export declare function mcpRowModel(block: ToolCallBlock): McpRowModel;
