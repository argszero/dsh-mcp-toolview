/**
 * Node half of @argszero/dsh-mcp-toolview.
 *
 * Deliberately empty. The plugin's whole substance lives in the browser half,
 * and the browser half reaches the page because this package declares
 * `dsh.client` — @deepseek-ai/dsh-client-modules scans the host Loader's entries
 * for that declaration, so mounting this row is what puts the MCP tool row in
 * the Web shell. A node half that did anything here would be duplicating a
 * decision the client already owns: the MCP bridge has already registered the
 * tools, and the row renders what the session recorded about the call.
 *
 * @module @argszero/dsh-mcp-toolview
 */

/** Required services: none — this half only has to exist for the row to mount. */
export const inject: readonly string[] = []

/**
 * Mount the package. The browser half is discovered from the manifest, not
 * from here, so there is nothing to install on the host.
 */
export function apply(): void {}
