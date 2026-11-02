/**
 * Which wire Tool names a session has already revealed, read from the durable
 * Session event window.
 *
 * A keyed seat cannot be claimed declaratively for a dynamically named family:
 * `tool.call.toolview` declares the *slot*, and each occupant claims one *key*.
 * So a view for `mcp__<server>__<tool>` — a family whose members exist only
 * after an MCP server answers `tools/list`, at a time no plugin can predict —
 * has to learn its keys from the session and register them one by one.
 *
 * The client has no tool catalog of its own, which is why the reporter of the
 * gap concluded the seat was unreachable for this family. It does have the
 * Session event window, and three durable event shapes in it carry a wire name:
 *
 * - **`tool/call`** — what the model asked for. Present in every mode, one
 *   event per top-level call, and the reason a name is learned lazily.
 * - **`request/header`** — the assembled request header, whose `tools` is the
 *   complete catalog *including tools never called in this session*. Eager
 *   where `tool/call` is lazy: a row is already keyed the first time a tool runs.
 * - **`tool/ptc-dispatch-start`** — a dispatch from inside a `run_code` program.
 *   Under `mode: ptc` the request carries only `run_code` plus a generated SDK,
 *   so the first arm is empty and this one is the only channel that sees an MCP
 *   call at all. It is a durable Session event (`@deepseek-ai/dsh-tools/types`),
 *   appended when the sub-call actually starts.
 *
 * Everything here is pure: a window in, names out. The plugin's subscription
 * plumbing lives in `./index.ts`, so the rule that decides *what* is visible can
 * be read — and tested — without a browser.
 *
 * @module @argszero/dsh-mcp-toolview/client/discovery
 */
import type { SessionEventLikeEntry, SessionEventWindow } from '@deepseek-ai/dsh-api-session-controller/client';
/** Every wire Tool name one event-window delta revealed, in encounter order. */
export declare function toolNamesIn(entries: readonly SessionEventLikeEntry[]): readonly string[];
/**
 * The entries one window publication actually added.
 *
 * A publication announces its own delta, so an append costs the appended slice
 * rather than the whole window.
 * @param window - the current window and the change that produced it.
 * @returns entries worth scanning; empty when the publication added no Tool material.
 */
export declare function newEntries(window: SessionEventWindow): readonly SessionEventLikeEntry[];
/**
 * A reader for one window subscription.
 *
 * The delta is only readable by someone who saw what it was a delta *of*, and a
 * subscriber that has just attached has not: the window's `change` describes the
 * publication that produced the snapshot now in hand, which this reader never
 * witnessed. Treating that as a delta loses every name that arrived between the
 * page's own load and this plugin's first look — a live `append` from a turn
 * that ran while the bundle was still loading would hide the whole earlier
 * history, and the row would simply never appear.
 *
 * So the first read is the whole window, and the delta rule starts with the
 * first publication this reader actually observes. Reading an entry twice is
 * harmless — names are learned into a set — so the cost of the guarantee is one
 * full window scan per subscription.
 * @returns a reader taking the window's current value.
 */
export declare function windowReader(): (window: SessionEventWindow) => readonly SessionEventLikeEntry[];
