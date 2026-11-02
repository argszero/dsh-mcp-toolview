/**
 * The MCP tool row: one atomic Tool call rendered as the server-qualified call
 * it is, instead of the generic card that flattens the wire name into a line of
 * argument text.
 *
 * The shape mirrors the shipped atomic views (`ui-skill`'s `SkillRow`,
 * `ui-tool`'s `SearchRow`) rather than importing them: a keyed occupant owns its
 * own presentation, and this package cannot reach the shipped row internals
 * anyway (they are module-private to `@deepseek-ai/dsh-client-ui-tool`). What it
 * does reuse is the shell's own vocabulary — the platform-shared
 * `@deepseek-ai/dsh-client-ui-primitives`, and the owner's `useDisclosure` hook,
 * which is what makes the disclosure reset with the enclosing turn.
 *
 * Two structural rules carried from the shipped rows:
 *
 * - **No hooks on the stage boundary.** `McpToolRow` dispatches to a separate
 *   component per stage, so a call advancing from `preparing` to `start` mounts
 *   a component with its own hook list instead of changing hook order inside one.
 * - **The disclosure hook is the owner's.** Expansion state comes from
 *   `useDisclosure()`, never from local state, so a remount cannot invent an
 *   expansion the turn did not have.
 *
 * @module @argszero/dsh-mcp-toolview/client/McpToolRow
 */
import type { ReactNode } from 'react';
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client';
import type { NS } from './locales.ts';
/** Full props of this package's keyed Tool view: the seat's owner payload plus the locale seat. */
export type McpToolRowProps = ToolCallViewProps & PropsLocale<typeof NS>;
/**
 * Render one MCP call.
 * @param props - the seat's owner payload plus this namespace's locale seat.
 * @returns the preparing placeholder, or the full row once dispatched.
 */
export declare function McpToolRow(props: McpToolRowProps): ReactNode;
