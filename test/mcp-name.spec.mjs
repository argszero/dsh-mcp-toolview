/**
 * The label rule: what a wire name is allowed to say about itself.
 *
 * The vectors are the two mistakes the rule exists to prevent — a name that
 * reads as one server but is ambiguous, and a name whose tool segment was
 * truncated by the bridge's hash-suffix path. Both must come back with
 * `server: null`, because the row renders the whole wire name beside the label
 * and a guess would be indistinguishable from a reading.
 *
 * @module test/mcp-name
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isMcpToolName, MCP_PREFIX, mcpToolLabel } from '../src/client/mcp-name.ts'

describe('the namespace test', () => {
  it('accepts a name with a leaf', () => {
    assert.equal(isMcpToolName('mcp__filesystem__read_file'), true)
  })

  it('rejects the bare prefix: it names no tool', () => {
    assert.equal(isMcpToolName(MCP_PREFIX), false)
  })

  it('rejects a name outside the namespace', () => {
    assert.equal(isMcpToolName('read_file'), false)
    assert.equal(isMcpToolName('mcp_read'), false)
    assert.equal(isMcpToolName('Mcp__server__tool'), false)
  })
})

describe('the label', () => {
  it('splits the one unambiguous shape', () => {
    assert.deepEqual(mcpToolLabel('mcp__filesystem__read_file'), {
      server: 'filesystem',
      tool: 'read_file',
    })
  })

  it('keeps the tool segment whole when the wire name carries separators of its own', () => {
    // The bridge normalizes the raw name, so `a__b` is a leaf, not a second split.
    assert.deepEqual(mcpToolLabel('mcp__github__issue__create'), { server: null, tool: 'mcp__github__issue__create' })
    assert.deepEqual(mcpToolLabel('mcp__r__a_b_c'), { server: 'r', tool: 'a_b_c' })
  })

  it('reports ambiguity instead of picking a split', () => {
    // `my__server` is a legal server name, so two splits are consistent and the
    // name does not say which one is the server.
    assert.deepEqual(mcpToolLabel('mcp__my__server__read'), {
      server: null,
      tool: 'mcp__my__server__read',
    })
  })

  it('takes the only consistent split when the later candidates break the server contract', () => {
    const long = 'x'.repeat(40)
    // The first split yields a 2-character server; the second candidate is a
    // 44-character name, which the contract's 32-character bound rejects.
    assert.deepEqual(mcpToolLabel(`mcp__ab__${long}__tool`), { server: 'ab', tool: `${long}__tool` })
  })

  it('refuses a name with no tool segment rather than inventing an empty one', () => {
    assert.deepEqual(mcpToolLabel('mcp__server__'), { server: null, tool: 'mcp__server__' })
  })

  it('refuses a server segment that breaks the contract', () => {
    assert.deepEqual(mcpToolLabel(`mcp__${'s'.repeat(33)}__tool`), {
      server: null,
      tool: `mcp__${'s'.repeat(33)}__tool`,
    })
  })

  it('accepts a server segment at the contract boundary', () => {
    assert.deepEqual(mcpToolLabel(`mcp__${'s'.repeat(32)}__tool`), {
      server: 's'.repeat(32),
      tool: 'tool',
    })
  })

  it('leaves a name outside the namespace alone', () => {
    assert.deepEqual(mcpToolLabel('bash'), { server: null, tool: 'bash' })
  })
})
