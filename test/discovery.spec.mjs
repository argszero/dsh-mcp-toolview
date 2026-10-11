/**
 * The discovery rule: which names one event-window publication reveals.
 *
 * The vectors are per-arm, because the arms are the plugin's whole reason to
 * exist: a `tool/call` is lazy (a name is learned when the model first asks for
 * it), a `request/header` is eager (the assembled catalog names tools never
 * called), and under `mode: ptc` only the dispatch arm sees an MCP call at all.
 * The negative vectors matter as much: a client-only live chunk, an assistant
 * message, and a tool-less request header must each reveal nothing, or the
 * plugin would claim keys for material that is not a Tool name.
 *
 * `newEntries` is tested beside it because the two are one decision: the
 * subscription scans *that* slice rather than the window, and the slice rule is
 * what keeps an append O(delta) instead of O(window).
 *
 * @module test/discovery
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { newEntries, toolNamesIn, windowReader } from '../src/client/discovery.ts'
import {
  assistantMessage,
  eventSource,
  ptcDispatchStart,
  requestHeader,
  requestHeaderWithoutTools,
  toolCall,
  transientEntry,
} from './harness.mjs'

describe('names in a window', () => {
  it('reads the wire name a tool/call asked for', () => {
    assert.deepEqual(toolNamesIn([toolCall('mcp__fs__read')]), ['mcp__fs__read'])
  })

  it('reads the wire name a PTC dispatch started — the only arm that sees an MCP call under mode: ptc', () => {
    assert.deepEqual(toolNamesIn([ptcDispatchStart('mcp__fs__read')]), ['mcp__fs__read'])
  })

  it('reads the whole assembled catalog from request/header, including tools never called', () => {
    assert.deepEqual(toolNamesIn([requestHeader(['bash', 'mcp__git__status', 'mcp__fs__read'])]), [
      'bash',
      'mcp__git__status',
      'mcp__fs__read',
    ])
  })

  it('reads nothing from a request header with no tools, which is the tool-less request', () => {
    assert.deepEqual(toolNamesIn([requestHeaderWithoutTools()]), [])
  })

  it('reads nothing from a client-only live chunk presentation', () => {
    assert.deepEqual(toolNamesIn([transientEntry()]), [])
  })

  it('reads nothing from an event of another type', () => {
    assert.deepEqual(toolNamesIn([assistantMessage()]), [])
  })

  it('keeps encounter order across entries and arms', () => {
    assert.deepEqual(toolNamesIn([
      requestHeader(['mcp__b__one']),
      toolCall('mcp__a__two'),
      ptcDispatchStart('mcp__c__three'),
    ]), ['mcp__b__one', 'mcp__a__two', 'mcp__c__three'])
  })
})

describe('the delta a publication added', () => {
  it('is the whole window for a replace, which is a reader that has never looked before', () => {
    const entries = [toolCall('mcp__a__one')]
    const source = eventSource(entries)
    assert.deepEqual(newEntries(source.getSnapshot()), entries)
  })

  it('is the appended slice for an append, so a live tail costs the delta', () => {
    const source = eventSource([toolCall('mcp__a__one')])
    const added = toolCall('mcp__a__two')
    source.append(added)
    const window = source.getSnapshot()
    assert.deepEqual(newEntries(window), [added])
    // The window itself still holds everything; the delta is the saving.
    assert.equal(window.entries.length, 2)
  })

  it('is the prepended slice for a prepend, so scrolling up does not rescan the tail', () => {
    const source = eventSource([toolCall('mcp__a__one')])
    const older = toolCall('mcp__a__zero')
    source.prepend([older])
    assert.deepEqual(newEntries(source.getSnapshot()), [older])
  })

  it('is empty for a settlement, which replaces assistant material, never a Tool name', () => {
    const source = eventSource([toolCall('mcp__a__one')])
    source.settle('attempt-1')
    assert.deepEqual(newEntries(source.getSnapshot()), [])
  })
})

describe('a reader attached to one window', () => {
  it('reads the whole window on its first look, whatever published it', () => {
    // The window's `change` names the publication that produced this snapshot,
    // and a reader that just attached never saw it. Treating it as a delta would
    // drop everything that arrived before this plugin looked.
    const source = eventSource([toolCall('mcp__a__one')])
    source.append(toolCall('mcp__a__two'))
    const read = windowReader()
    assert.deepEqual(read(source.getSnapshot()), [
      toolCall('mcp__a__one'),
      toolCall('mcp__a__two'),
    ])
  })

  it('reads the whole window first, even after the renderer paged older history in', () => {
    const source = eventSource([toolCall('mcp__a__one')])
    source.prepend([toolCall('mcp__a__zero')])
    const read = windowReader()
    assert.deepEqual(read(source.getSnapshot()), [toolCall('mcp__a__zero'), toolCall('mcp__a__one')])
  })

  it('reads the delta from the second look onward', () => {
    const source = eventSource([toolCall('mcp__a__one')])
    const read = windowReader()
    read(source.getSnapshot())
    const added = toolCall('mcp__a__two')
    source.append(added)
    assert.deepEqual(read(source.getSnapshot()), [added])
  })

  it('is a fresh reader per subscription, so a re-attached window is read whole again', () => {
    const source = eventSource([toolCall('mcp__a__one')])
    const first = windowReader()
    first(source.getSnapshot())
    const second = windowReader()
    assert.deepEqual(second(source.getSnapshot()), [toolCall('mcp__a__one')])
  })
})
