/**
 * The row model: one frozen call slice in, every rendered field out.
 *
 * The vectors below are the four stages the seat dispatches plus the two
 * degraded slices a replayed session produces — a result whose own `tool/call`
 * left the loaded window (so the wire name must come from the result), and a
 * result with no content blocks at all (so the failure line is the identity).
 * Each one is a case where a plausible simplification renders something false:
 * a stopped call shown as failed, an empty argument line shown as a missing
 * call, a window-truncated result shown as a nameless tool.
 *
 * @module test/row-model
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { argSummary, firstLine, flattenContent, mcpRowModel, mcpRowState } from '../src/client/row-model.ts'

/** Shared call head; every block below differs only in what its stage adds. */
const head = {
  callId: 'call-1',
  name: 'mcp__filesystem__read_file',
  turn: 1,
  step: 1,
  time: 0,
  subCalls: [],
  args: {},
}

const preparing = { ...head, phase: 'preparing' }
const started = { ...head, phase: 'start', argsRaw: '{"path":"/tmp/notes.md"}' }

/** A settled result; `over` replaces the fields a case is about. */
const settled = (over = {}) => ({
  kind: 'tool-result',
  seq: 1,
  time: 0,
  callId: 'call-1',
  name: 'mcp__filesystem__read_file',
  args: {},
  call: { name: 'mcp__filesystem__read_file', argsRaw: '{"path":"/tmp/notes.md"}' },
  callTime: 0,
  content: [{ type: 'text', text: 'hello\nworld' }],
  isError: false,
  subCalls: [],
  ...over,
})

describe('firstLine', () => {
  it('is the whole string when there is no newline', () => {
    assert.equal(firstLine('one line'), 'one line')
  })

  it('stops at the first newline', () => {
    assert.equal(firstLine('first\nsecond\nthird'), 'first')
  })

  it('is empty for leading whitespace that starts with a newline', () => {
    assert.equal(firstLine('\nrest'), '')
  })
})

describe('state', () => {
  it('is preparing while arguments are still streaming', () => {
    assert.equal(mcpRowState(preparing), 'preparing')
  })

  it('is running once the call was dispatched', () => {
    assert.equal(mcpRowState(started), 'running')
  })

  it('is ok for a settled call that reported no error', () => {
    assert.equal(mcpRowState(settled()), 'ok')
  })

  it('is error for a settled call that reported one', () => {
    assert.equal(mcpRowState(settled({ isError: true })), 'error')
  })

  it('is stopped, not failed, for a call the user interrupted', () => {
    // The harness's own cancellation identity: the MCP server did nothing wrong,
    // and calling it a failure would blame the server for the user's decision.
    const interrupted = settled({ isError: true, error: { name: 'ToolError', code: 'interrupted' } })
    assert.equal(mcpRowState(interrupted), 'stopped')
  })
})

describe('argument summary', () => {
  it('reads the first string-valued argument, wherever the server put it', () => {
    assert.equal(argSummary('{"repo":"dsh","query":"tools"}', 'call-1'), 'dsh')
    assert.equal(argSummary('{"n":3,"query":"tools"}', 'call-1'), 'tools')
  })

  it('skips empty strings rather than summarizing as blank', () => {
    assert.equal(argSummary('{"a":"","b":"real"}', 'call-1'), 'real')
  })

  it('keeps only the first line of the chosen argument', () => {
    assert.equal(argSummary('{"query":"line one\\nline two"}', 'call-1'), 'line one')
  })

  it('falls back to the raw text while arguments are still streaming', () => {
    assert.equal(argSummary('{"path":"/tmp/no', 'call-1'), '{"path":"/tmp/no')
  })

  it('falls back to the call identity when there is no argument text at all', () => {
    assert.equal(argSummary('', 'call-1'), 'call-1')
  })

  it('falls back to the raw text when the arguments are not an object', () => {
    assert.equal(argSummary('"just a string"', 'call-1'), '"just a string"')
    assert.equal(argSummary('[1,2]', 'call-1'), '[1,2]')
    assert.equal(argSummary('null', 'call-1'), 'null')
  })

  it('falls back to the raw text when no argument is a non-empty string', () => {
    assert.equal(argSummary('{"n":3,"flag":true}', 'call-1'), '{"n":3,"flag":true}')
  })
})

describe('result content', () => {
  it('keeps text blocks verbatim', () => {
    assert.equal(flattenContent([{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }], undefined), 'a\nb')
  })

  it('pretty-prints a block shape that carries no text of its own', () => {
    // Dropping it would hide that the call returned anything at all.
    const content = [{ type: 'image', mimeType: 'image/png', data: 'AA==' }]
    assert.equal(flattenContent(content, undefined), JSON.stringify(content[0], null, 2))
  })

  it('is the failure identity when a failed call recorded no content', () => {
    assert.equal(flattenContent([], { name: 'ToolError', code: 'E_IO' }), 'ToolError: E_IO')
  })

  it('is null when there is neither content nor a failure', () => {
    assert.equal(flattenContent([], undefined), null)
  })

  it('leaves the recorded failure out when the call did return content', () => {
    assert.equal(flattenContent([{ type: 'text', text: 'partial output' }], { name: 'ToolError', code: 'E_IO' }), 'partial output')
  })
})

describe('the row model', () => {
  it('takes the wire name from the paired call when the result still has one', () => {
    assert.equal(mcpRowModel(settled()).wireName, 'mcp__filesystem__read_file')
  })

  it('takes the wire name from the result when window truncation took the call', () => {
    const truncated = settled({ name: 'mcp__git__status', call: null })
    const model = mcpRowModel(truncated)
    assert.equal(model.wireName, 'mcp__git__status')
    // With the call gone the argument view is gone with it; the row shows no
    // argument line rather than an invented one.
    assert.equal(model.argsRaw, null)
    assert.equal(model.summary, 'call-1')
  })

  it('has no argument view during preparation, which is the stage the seat renders without one', () => {
    const model = mcpRowModel(preparing)
    assert.equal(model.argsRaw, null)
    assert.equal(model.summary, 'call-1')
    assert.equal(model.output, null)
  })

  it('exposes the streamed arguments once dispatched', () => {
    const model = mcpRowModel(started)
    assert.equal(model.argsRaw, '{"path":"/tmp/notes.md"}')
    assert.equal(model.summary, '/tmp/notes.md')
    assert.equal(model.output, null)
    assert.equal(model.state, 'running')
  })

  it('summarizes a failure by its first output line', () => {
    const failed = settled({ isError: true, content: [{ type: 'text', text: 'ENOENT: no such file\nstack' }] })
    const model = mcpRowModel(failed)
    assert.equal(model.state, 'error')
    assert.equal(model.output, 'ENOENT: no such file\nstack')
    assert.equal(model.errorSummary, 'ENOENT: no such file')
  })

  it('leaves the error summary empty for a call that succeeded', () => {
    assert.equal(mcpRowModel(settled()).errorSummary, null)
  })

  it('leaves the error summary empty for a call the user stopped', () => {
    const interrupted = settled({ isError: true, error: { name: 'ToolError', code: 'interrupted' } })
    const model = mcpRowModel(interrupted)
    assert.equal(model.state, 'stopped')
    assert.equal(model.errorSummary, null)
  })
})
