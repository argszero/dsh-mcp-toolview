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
export const NS = 'mcp-toolview'

/** English dictionary; the key set is the namespace's type source. */
export const en = {
  'row.server': 'MCP server',
  'row.expand': 'Show this MCP call in full',
  'row.preparing': 'Calling an MCP tool…',
  'row.running': 'MCP tool running',
  'row.failed': 'MCP tool failed',
  'row.stopped': 'MCP tool interrupted',
  'row.wireName': 'Wire name',
  'row.arguments': 'Arguments',
  'row.output': 'Output',
  'row.inspect': 'Inspect call',
} as const

/** Chinese dictionary, keyed identically to {@link en}. */
export const zh: Record<keyof typeof en, string> = {
  'row.server': 'MCP 服务端',
  'row.expand': '展开该次 MCP 调用',
  'row.preparing': '正在调用 MCP 工具…',
  'row.running': 'MCP 工具运行中',
  'row.failed': 'MCP 工具失败',
  'row.stopped': 'MCP 工具被中断',
  'row.wireName': '线上名称',
  'row.arguments': '参数',
  'row.output': '输出',
  'row.inspect': '查看该次调用',
}

/** Key union of this namespace's dictionaries. */
export type McpToolviewKey = keyof typeof en
