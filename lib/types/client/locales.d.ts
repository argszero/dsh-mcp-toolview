/**
 * Row copy for the two shipped locales.
 *
 * Everything else in the row is caller data — a server name, a tool name, an
 * argument line — so it stays locale-neutral; only the labels and the three
 * state announcements translate. `MCP` itself is an acronym and is not
 * translated.
 *
 * @module @argszero/dsh-mcp-toolview/client/locales
 */
/** Locale namespace this plugin registers its dictionaries under. */
export declare const NS = "mcp-toolview";
/** English dictionary; the key set is the namespace's type source. */
export declare const en: {
    readonly 'row.server': "MCP server";
    readonly 'row.expand': "Show this MCP call in full";
    readonly 'row.preparing': "Calling an MCP tool…";
    readonly 'row.running': "MCP tool running";
    readonly 'row.failed': "MCP tool failed";
    readonly 'row.stopped': "MCP tool interrupted";
    readonly 'row.wireName': "Wire name";
    readonly 'row.arguments': "Arguments";
    readonly 'row.output': "Output";
    readonly 'row.inspect': "Inspect call";
};
/** Chinese dictionary, keyed identically to {@link en}. */
export declare const zh: Record<keyof typeof en, string>;
/** Key union of this namespace's dictionaries. */
export type McpToolviewKey = keyof typeof en;
