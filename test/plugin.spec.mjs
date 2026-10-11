/**
 * The browser half, mounted on a real registry.
 *
 * The claim under test is the one the reporter of the gap said was impossible:
 * a keyed seat whose occupants are named at runtime can still be claimed. So the
 * vectors are the three discovery arms, the four ways a name is *not* a member
 * (another namespace, a malformed prefix, a client-only live chunk, a tool-less
 * header), the two composition rules the wiring promises (an occupied key is
 * left alone, an undeclared seat is waited for), and the lifecycle (collapse,
 * re-declaration, session release, fiber teardown).
 *
 * The last group renders the entry the seat would render. That is the point of
 * rendering rather than asserting the props exist: `slots.register` validating a
 * component and the component producing a row are different facts, and only the
 * second one is what a user sees.
 *
 * @module test/plugin
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { en, NS, zh } from '../src/client/locales.ts'
import {
  browserWorld,
  eventEntry,
  assistantMessage,
  ptcDispatchStart,
  requestHeader,
  requestHeaderWithoutTools,
  SEAT,
  settle,
  toolCall,
  transientEntry,
} from './harness.mjs'

/** A dispatched call slice, the argument shape the row renders. */
const startBlock = (name, argsRaw) => ({
  phase: 'start',
  callId: 'c1',
  name,
  turn: 1,
  step: 1,
  time: 0,
  subCalls: [],
  args: {},
  argsRaw,
})

/** The props the seat supplies to one keyed view, with the disclosure held open. */
const viewProps = (block, expanded = true) => ({
  phase: 'start',
  block,
  callId: block.callId,
  toolName: block.name,
  useDisclosure: () => ({ expanded, toggle: () => {} }),
  openFile: () => {},
  loadImage: () => Promise.resolve(null),
  t: key => key,
})

describe('mounting', () => {
  it('declares the services it binds', async () => {
    const world = await browserWorld({ mount: false })
    assert.deepEqual([...world.client().inject], ['slots', 'sessions', 'locale'])
    await world.dispose()
  })

  it('registers its dictionaries under its own namespace, with both locales keyed alike', async () => {
    const world = await browserWorld()
    assert.deepEqual(world.locale.dictionaries.map(entry => entry.namespace), [NS])
    assert.deepEqual(world.locale.dictionaries[0].dictionaries, { zh, en })
    assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort())
    await world.dispose()
  })

  it('claims nothing for a session that has revealed no MCP name', async () => {
    const world = await browserWorld({ mount: false })
    world.sessions.bind('s1', [requestHeader(['bash', 'read_file']), assistantMessage()])
    await world.mount()
    assert.deepEqual(world.keys(), [])
    await world.dispose()
  })
})

describe('the three discovery arms', () => {
  it('claims the names in an assembled catalog, including tools never called', async () => {
    const world = await browserWorld({ mount: false })
    world.sessions.bind('s1', [requestHeader(['bash', 'mcp__filesystem__read_file', 'mcp__git__status'])])
    await world.mount()
    assert.deepEqual(world.keys(), ['mcp__filesystem__read_file', 'mcp__git__status'])
    await world.dispose()
  })

  it('claims a name lazily, when the model first calls it', async () => {
    const world = await browserWorld({ mount: false })
    const source = world.sessions.bind('s1', [])
    await world.mount()
    assert.deepEqual(world.keys(), [])
    source.append(toolCall('mcp__filesystem__read_file'))
    await settle()
    assert.deepEqual(world.keys(), ['mcp__filesystem__read_file'])
    await world.dispose()
  })

  it('claims a name dispatched from inside a run_code program, which is the only arm visible under mode: ptc', async () => {
    const world = await browserWorld({ mount: false })
    const source = world.sessions.bind('s1', [])
    await world.mount()
    source.append(ptcDispatchStart('mcp__filesystem__read_file'))
    await settle()
    assert.deepEqual(world.keys(), ['mcp__filesystem__read_file'])
    await world.dispose()
  })

  it('reads history the renderer paged in before this plugin mounted', async () => {
    const world = await browserWorld({ mount: false })
    const source = world.sessions.bind('s1', [toolCall('mcp__a__one')])
    source.prepend([toolCall('mcp__b__two')])
    await world.mount()
    assert.deepEqual(world.keys(), ['mcp__b__two', 'mcp__a__one'])
    await world.dispose()
  })

  it('reads the whole window when the last publication it never saw was a live append', async () => {
    // The page can mount a client bundle after the session has been open and a
    // turn has already run: the window's own `change` then describes an append
    // this plugin never witnessed, and reading it as a delta would drop every
    // name the earlier turns produced.
    const world = await browserWorld({ mount: false })
    const source = world.sessions.bind('s1', [toolCall('mcp__a__one')])
    source.append(toolCall('mcp__a__two'))
    await world.mount()
    assert.deepEqual(world.keys(), ['mcp__a__one', 'mcp__a__two'])
    await world.dispose()
  })

  it('ignores material that carries no Tool name', async () => {
    const world = await browserWorld({ mount: false })
    const source = world.sessions.bind('s1', [])
    await world.mount()
    source.append(transientEntry())
    source.append(assistantMessage())
    source.append(requestHeaderWithoutTools())
    await settle()
    assert.deepEqual(world.keys(), [])
    await world.dispose()
  })

  it('ignores a name outside the MCP namespace', async () => {
    const world = await browserWorld({ mount: false })
    const source = world.sessions.bind('s1', [])
    await world.mount()
    for (const name of ['bash', 'read_file', 'mcp_read', 'Mcp__server__tool', 'mcp__']) {
      source.append(toolCall(name))
    }
    await settle()
    assert.deepEqual(world.keys(), [])
    await world.dispose()
  })

  it('claims one entry per name, however many times the name is revealed', async () => {
    const world = await browserWorld({ mount: false })
    const source = world.sessions.bind('s1', [toolCall('mcp__a__one')])
    await world.mount()
    source.append(toolCall('mcp__a__one'))
    source.append(requestHeader(['mcp__a__one']))
    await settle()
    assert.deepEqual(world.keys(), ['mcp__a__one'])
    await world.dispose()
  })

  it('claims one entry for a name two sessions both revealed', async () => {
    const world = await browserWorld({ mount: false })
    world.sessions.bind('s1', [toolCall('mcp__a__one')])
    world.sessions.bind('s2', [toolCall('mcp__a__one')])
    await world.mount()
    assert.deepEqual(world.keys(), ['mcp__a__one'])
    await world.dispose()
  })

  it('claims nothing for a catalog row whose Session is retained nowhere', async () => {
    const world = await browserWorld({ mount: false })
    world.sessions.bind('s1', [toolCall('mcp__a__one')])
    world.sessions.release('s1')
    await world.mount()
    assert.deepEqual(world.keys(), [])
    await world.dispose()
  })
})

describe('session lifecycle', () => {
  it('stops reading a Session once it is released, and reads the next one that appears', async () => {
    const world = await browserWorld({ mount: false })
    const source = world.sessions.bind('s1', [])
    await world.mount()
    assert.equal(source.listeners.size, 1)
    world.sessions.release('s1')
    await settle()
    assert.equal(source.listeners.size, 0)
    const next = world.sessions.bind('s2', [toolCall('mcp__a__one')])
    await settle()
    assert.equal(next.listeners.size, 1)
    // The name learned from the released Session survives: the registration is
    // not, the knowledge is.
    assert.deepEqual(world.keys(), ['mcp__a__one'])
    await world.dispose()
  })

  it('reuses the existing subscription when a touched catalog republishes the same Session', async () => {
    const world = await browserWorld({ mount: false })
    const source = world.sessions.bind('s1', [])
    await world.mount()
    world.sessions.touch()
    await settle()
    assert.equal(source.listeners.size, 1)
    await world.dispose()
  })
})

describe('composition with other occupants', () => {
  it('leaves a key another plugin already claimed, and still claims its own', async () => {
    const world = await browserWorld({ mount: false })
    world.slots.register({ name: SEAT, key: 'mcp__a__one', locale: 'conversation', registrant: 'rival' }, () => null)
    world.sessions.bind('s1', [toolCall('mcp__a__one'), toolCall('mcp__a__two')])
    await world.mount()
    assert.deepEqual(world.keys(), ['mcp__a__one', 'mcp__a__two'])
    // The rival's entry came first and is untouched; ours is the one the plugin
    // minted, which is the entry carrying this namespace.
    assert.deepEqual(world.entries().map(entry => entry.locale), ['conversation', NS])
    await world.dispose()
  })

  it('hands the key back when it is disposed, so the next occupant can take it', async () => {
    const world = await browserWorld({ mount: false })
    world.sessions.bind('s1', [toolCall('mcp__a__one')])
    await world.mount()
    assert.throws(
      () => world.slots.register({ name: SEAT, key: 'mcp__a__one', locale: 'conversation' }, () => null),
      /already has an entry/,
    )
    await world.dispose()
    assert.doesNotThrow(
      () => world.slots.register({ name: SEAT, key: 'mcp__a__one', locale: 'conversation' }, () => null),
    )
  })

  it('waits for the seat declaration, then claims it — load order does not matter', async () => {
    const world = await browserWorld({ mount: false })
    await world.collapse()
    world.sessions.bind('s1', [toolCall('mcp__a__one')])
    await world.mount()
    assert.deepEqual(world.keys(), [])
    await world.declare()
    assert.deepEqual(world.keys(), ['mcp__a__one'])
    await world.dispose()
  })

  it('re-claims every remembered name when the declaration comes back, without re-reading a session', async () => {
    const world = await browserWorld({ mount: false })
    const source = world.sessions.bind('s1', [toolCall('mcp__a__one')])
    await world.mount()
    assert.deepEqual(world.keys(), ['mcp__a__one'])
    await world.collapse()
    assert.deepEqual(world.keys(), [])
    // The window is emptied before the declaration returns: nothing can be
    // re-learned from it, so a re-claim proves the names were remembered.
    source.replace([])
    await world.declare()
    assert.deepEqual(world.keys(), ['mcp__a__one'])
    await world.dispose()
  })
})

describe('teardown', () => {
  it('removes every entry and every subscription', async () => {
    const world = await browserWorld({ mount: false })
    const source = world.sessions.bind('s1', [toolCall('mcp__a__one')])
    await world.mount()
    assert.equal(world.keys().length, 1)
    assert.equal(world.sessions.listeners.size, 1)
    await world.dispose()
    assert.deepEqual(world.keys(), [])
    assert.equal(source.listeners.size, 0)
    assert.equal(world.sessions.listeners.size, 0)
    assert.deepEqual(world.locale.disposed, [NS])
  })
})

describe('the row the seat renders', () => {
  it('names the server and the tool, and shows the whole wire name in the body', async () => {
    const world = await browserWorld({ mount: false })
    world.sessions.bind('s1', [toolCall('mcp__filesystem__read_file')])
    await world.mount()
    const Row = world.entries()[0].component
    const html = renderToStaticMarkup(Row(viewProps(startBlock('mcp__filesystem__read_file', '{"path":"/tmp/a.md"}'))))
    assert.match(html, /data-server="filesystem"/)
    assert.match(html, /data-title="read_file"/)
    // The label is a reading; the identity is the wire name, and it is always
    // in the body so a fragment can never be mistaken for it.
    assert.match(html, /data-wire-name="true">mcp__filesystem__read_file</)
    assert.match(html, /data-arguments="true">/)
    assert.match(html, /row\.running/)
    await world.dispose()
  })

  it('expands a call that has arguments but no output yet', async () => {
    const world = await browserWorld({ mount: false })
    world.sessions.bind('s1', [toolCall('mcp__git__status')])
    await world.mount()
    const Row = world.entries()[0].component
    const html = renderToStaticMarkup(Row(viewProps(startBlock('mcp__git__status', '{"repo":"dsh"}'), false)))
    assert.match(html, /data-expandable="true"/)
    await world.dispose()
  })

  it('shows no server chip when the name does not say which server it was', async () => {
    const world = await browserWorld({ mount: false })
    world.sessions.bind('s1', [toolCall('mcp__my__server__read')])
    await world.mount()
    const Row = world.entries()[0].component
    const html = renderToStaticMarkup(Row(viewProps(startBlock('mcp__my__server__read', '{}'))))
    assert.doesNotMatch(html, /data-server=/)
    assert.match(html, /data-title="mcp__my__server__read"/)
    await world.dispose()
  })

  it('renders the preparing stage without a disclosure', async () => {
    const world = await browserWorld({ mount: false })
    world.sessions.bind('s1', [toolCall('mcp__filesystem__read_file')])
    await world.mount()
    const Row = world.entries()[0].component
    const preparing = { ...startBlock('mcp__filesystem__read_file', ''), phase: 'preparing' }
    delete preparing.argsRaw
    const html = renderToStaticMarkup(Row({ ...viewProps(preparing), phase: 'preparing', block: preparing }))
    assert.match(html, /data-state="preparing"/)
    assert.doesNotMatch(html, /role="button"/)
    await world.dispose()
  })

  it('renders the settled result and its output', async () => {
    const world = await browserWorld({ mount: false })
    world.sessions.bind('s1', [toolCall('mcp__git__status')])
    await world.mount()
    const Row = world.entries()[0].component
    const block = {
      ...startBlock('mcp__git__status', '{"repo":"dsh"}'),
      kind: 'tool-result',
      seq: 2,
      call: { name: 'mcp__git__status', argsRaw: '{"repo":"dsh"}' },
      callTime: 0,
      content: [{ type: 'text', text: 'clean' }],
      isError: false,
    }
    delete block.phase
    delete block.argsRaw
    const html = renderToStaticMarkup(Row({ ...viewProps(block), phase: 'result', block }))
    assert.match(html, /data-state="ok"/)
    assert.match(html, /data-output="true">clean</)
    await world.dispose()
  })

  it('renders a stopped call as stopped rather than failed', async () => {
    const world = await browserWorld({ mount: false })
    world.sessions.bind('s1', [toolCall('mcp__git__status')])
    await world.mount()
    const Row = world.entries()[0].component
    const block = {
      ...startBlock('mcp__git__status', '{}'),
      kind: 'tool-result',
      seq: 2,
      call: { name: 'mcp__git__status', argsRaw: '{}' },
      callTime: 0,
      content: [],
      isError: true,
      error: { name: 'ToolError', code: 'interrupted' },
    }
    delete block.phase
    delete block.argsRaw
    const html = renderToStaticMarkup(Row({ ...viewProps(block), phase: 'result', block }))
    assert.match(html, /data-state="stopped"/)
    // The row says the user stopped it instead of showing a failure line.
    assert.match(html, /row\.stopped/)
    await world.dispose()
  })

  it('does not expand a settled call with neither arguments nor output', async () => {
    const world = await browserWorld({ mount: false })
    world.sessions.bind('s1', [toolCall('mcp__git__status')])
    await world.mount()
    const Row = world.entries()[0].component
    const block = {
      ...startBlock('mcp__git__status', ''),
      kind: 'tool-result',
      seq: 2,
      call: null,
      callTime: null,
      content: [],
      isError: false,
    }
    delete block.phase
    delete block.argsRaw
    const html = renderToStaticMarkup(Row({ ...viewProps(block, true), phase: 'result', block }))
    assert.doesNotMatch(html, /role="button"/)
    await world.dispose()
  })

  it('opens the inspector when the seat supplied one', async () => {
    const world = await browserWorld({ mount: false })
    world.sessions.bind('s1', [toolCall('mcp__git__status')])
    await world.mount()
    const Row = world.entries()[0].component
    const props = { ...viewProps(startBlock('mcp__git__status', '{}')), inspect: () => {} }
    const html = renderToStaticMarkup(Row(props))
    assert.match(html, /row\.inspect/)
    await world.dispose()
  })

  it('leaves the inspector out when the seat supplied none', async () => {
    const world = await browserWorld({ mount: false })
    world.sessions.bind('s1', [toolCall('mcp__git__status')])
    await world.mount()
    const Row = world.entries()[0].component
    const html = renderToStaticMarkup(Row(viewProps(startBlock('mcp__git__status', '{}'))))
    assert.doesNotMatch(html, /row\.inspect/)
    await world.dispose()
  })

  it('carries the event entry shape it was built for', async () => {
    // `eventEntry` is harness material; this keeps the import honest rather than
    // leaving an unused binding behind.
    assert.deepEqual(eventEntry(toolCall('mcp__a__one').event), toolCall('mcp__a__one'))
  })
})
