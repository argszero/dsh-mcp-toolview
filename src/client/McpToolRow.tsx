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

import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import { TextShimmer } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import { mcpToolLabel } from './mcp-name.ts'
import { mcpRowModel, type McpRowState } from './row-model.ts'
import type { NS } from './locales.ts'

/** Full props of this package's keyed Tool view: the seat's owner payload plus the locale seat. */
export type McpToolRowProps = ToolCallViewProps & PropsLocale<typeof NS>

const CARD: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 10px' }
const ROW: CSSProperties = { display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }
const BADGE: CSSProperties = {
  flex: 'none',
  padding: '0 4px',
  border: '1px solid currentColor',
  borderRadius: 4,
  fontSize: 10,
  lineHeight: '16px',
  letterSpacing: 0.4,
  opacity: 0.75,
}
const TITLE: CSSProperties = { flex: 'none', fontWeight: 600 }
const SEPARATOR: CSSProperties = { flex: 'none', opacity: 0.4 }
const SUMMARY: CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  opacity: 0.8,
}
const BODY: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 10 }
const LABEL: CSSProperties = { fontSize: 11, opacity: 0.7 }
const PRE: CSSProperties = {
  margin: '2px 0 0',
  padding: '6px 8px',
  borderRadius: 4,
  background: 'rgba(127, 127, 127, 0.12)',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 12,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  maxHeight: 320,
  overflow: 'auto',
}
const HIDDEN: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
}

/** Visually hidden announcement for the colour-only running and error tones. */
function stateStatus(state: McpRowState, t: McpToolRowProps['t']): string | null {
  switch (state) {
    case 'running': return t('row.running')
    case 'error': return t('row.failed')
    default: return null
  }
}

/**
 * Render one MCP call.
 * @param props - the seat's owner payload plus this namespace's locale seat.
 * @returns the preparing placeholder, or the full row once dispatched.
 */
export function McpToolRow(props: McpToolRowProps): ReactNode {
  if (props.phase === 'preparing') {
    return (
      <div style={CARD} data-tool={props.block.name} data-state="preparing">
        <div style={ROW}>
          <span style={BADGE}>MCP</span>
          <span style={HIDDEN}>{props.t('row.preparing')}</span>
          <span style={TITLE}>{props.block.name}</span>
          <TextShimmer active>{props.t('row.preparing')}</TextShimmer>
        </div>
      </div>
    )
  }
  return <StartedMcpRow {...props} />
}

/** The dispatched/settled row: the only stage with a disclosure. */
function StartedMcpRow({ block, inspect, useDisclosure, t }: Exclude<McpToolRowProps, { phase: 'preparing' }>) {
  const model = mcpRowModel(block)
  const { expanded, toggle } = useDisclosure()
  const label = mcpToolLabel(model.wireName)
  const expandable = model.argsRaw !== null || model.output !== null
  const open = expanded && expandable
  const running = model.state === 'running'
  const title = label.server === null ? model.wireName : label.tool
  const status = stateStatus(model.state, t)
  // A stopped call says so instead of showing a result line the user already read.
  const summary = model.state === 'stopped' ? t('row.stopped') : model.errorSummary ?? model.summary
  const toggleFromKeyboard = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!expandable || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    toggle()
  }
  const disclosure = expandable
    ? {
      role: 'button' as const,
      tabIndex: 0,
      'aria-expanded': open,
      'aria-label': t('row.expand'),
      onClick: toggle,
      onKeyDown: toggleFromKeyboard,
    }
    : {}
  return (
    <div style={CARD} data-tool={model.wireName} data-state={model.state}>
      <div style={ROW} data-expandable={expandable ? 'true' : undefined} {...disclosure}>
        <span style={BADGE}>MCP</span>
        {status === null ? null : <span style={HIDDEN}>{status}</span>}
        {/* The server chip appears only when the wire name says which server it
            was; the whole name is in the expanded body either way. */}
        {label.server === null
          ? null
          : <span style={BADGE} data-server={label.server} title={t('row.server')}>{label.server}</span>}
        <span style={TITLE} data-title={title}>{title}</span>
        <span style={SEPARATOR} aria-hidden>·</span>
        <TextShimmer active={running}>
          <span style={SUMMARY}>{summary}</span>
        </TextShimmer>
      </div>
      {open
        ? (
          <div style={BODY}>
            <div>
              <div style={LABEL}>{t('row.wireName')}</div>
              <pre style={PRE} data-wire-name>{model.wireName}</pre>
            </div>
            {model.argsRaw === null
              ? null
              : (
                <div>
                  <div style={LABEL}>{t('row.arguments')}</div>
                  <pre style={PRE} data-arguments>{model.argsRaw}</pre>
                </div>
              )}
            {model.output === null
              ? null
              : (
                <div>
                  <div style={LABEL}>{t('row.output')}</div>
                  <pre style={PRE} data-output data-error={model.state === 'error' ? 'true' : undefined}>
                    {model.output}
                  </pre>
                </div>
              )}
            {inspect === undefined
              ? null
              : <button type="button" onClick={inspect} style={{ cursor: 'pointer' }}>{t('row.inspect')}</button>}
          </div>
        )
        : null}
    </div>
  )
}
