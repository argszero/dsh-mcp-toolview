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
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import { type McpToolviewKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** MCP tool-row copy. */
        'mcp-toolview': McpToolviewKey;
    }
}
export type { McpToolRowProps } from './McpToolRow.tsx';
export type { McpToolLabel } from './mcp-name.ts';
export type { McpRowModel, McpRowState } from './row-model.ts';
/** Services this browser half needs: the Slot registry, the Session object layer, and the locale seat. */
export declare const inject: string[];
/**
 * Client plugin body: register the dictionaries, then learn and claim the
 * session's MCP Tool names.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
