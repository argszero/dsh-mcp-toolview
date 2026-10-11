# @argszero/dsh-mcp-toolview

MCP tool calls rendered as the calls they are, in the dsh Web shell.

A browser-half plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It
restores nothing, changes no harness behaviour, and adds no host-side code: it claims one keyed slot
entry per MCP tool name and lets the shipped generic card handle everything else.

## The gap

`ui-tool` declares `tool.call.toolview` as a **keyed**, session-scoped seat and dispatches it by wire
Tool name. A keyed seat declares the *slot*, never its keys, so a view can only claim a name it
already knows at registration time. The shipped views do exactly that — `read`, `bash`, `skill`,
`present`, `schedule_create` — every one of them a name the harness registers itself.

An MCP server's tools are not that. `mcp__<server>__<tool>` names exist only after a server answers
`tools/list`, at a time no plugin can predict, so the family falls through to the generic card: the
wire name flattened into one line of argument text, and nothing that says which server the call went
to.

The seat is not unreachable, it is just *lazily* claimable. The client has no tool catalog of its
own, but the Session it is rendering does — three durable event shapes in the session's event window
carry a wire name, and this plugin learns its keys from them.

## Install

The package is an ordinary harness plugin: declare it in a bundle patch (the package ships one) or
add the row to a profile.

```yaml
- insert:
    - id: mcp-toolview
      name: '@argszero/dsh-mcp-toolview'
```

Disabling or removing that row removes every contribution and restores the shipped generic card.

## What it does

- **Learns names from the session.** Three arms, each durable material a replay also reads:
  - `tool/call` — what the model asked for, in every mode. Lazy: a name is learned when it is first
    called.
  - `request/header` — the assembled request header, whose `tools` is the complete catalog
    **including tools never called in this session**. Eager: a row is already keyed the first time a
    tool runs.
  - `tool/ptc-dispatch-start` — a dispatch from inside a `run_code` program. Under `mode: ptc` the
    request carries only `run_code` plus a generated SDK, so the first two arms see nothing and this
    is the only channel that sees an MCP call at all.
- **Claims one keyed entry per MCP name**, inside `slots.inject('tool.call.toolview', …)` so
  registration waits for the declaration and load order stops mattering.
- **Renders the call with its provenance.** A server chip, the tool name, and a one-line argument
  summary in the collapsed row; the whole wire name, the full argument JSON, and the result in the
  expanded body.
- **Replaces nothing.** A name outside the MCP namespace is never claimed; a key another plugin
  already occupies is skipped, never thrown or shadowed; an unclaimed name still renders the shipped
  generic card. Disposing the fiber removes exactly the entries it minted.

## Reading the wire name as a label

The MCP bridge normalizes the raw tool name into the public
`mcp__<serverName>__<rawName>` form, appending a 12-hex digest when normalization was lossy — and
its own contract says the public name is **never parsed to recover** the pair (`mcp-client` keeps
`serverName`/`rawName` from registration). A view has no registration to keep; it has a name and a
user who wants to know which server a call went to. So this plugin reads the name as a *label*, under
two rules that keep that honest:

1. **Ambiguity is reported, not guessed.** The server segment is returned only when exactly one split
   of the name is consistent with the server-name contract. A server whose own name contains `__`
   leaves the split undecidable, and the row then shows the wire name as the title with no server
   chip — rather than picking a split and presenting a guess as a reading.
2. **The wire name always survives.** A truncated, character-replaced, or ambiguous name still has
   its whole wire name in the expanded body, so a fragment is never mistaken for the identity. The
   keyed seat dispatches on that name, so it is exact even when the label cannot be.

## Composition

- **Another view for the same name wins.** An occupied key is skipped: a plugin that claims
  `mcp__filesystem__read_file` has made a decision, and this one does not shadow it.
- **No hooks on the stage boundary.** The row dispatches to a separate component per stage, so a call
  advancing from `preparing` to `start` mounts a component with its own hook list rather than
  changing hook order inside one.
- **The disclosure is the owner's.** Expansion state comes from the seat's `useDisclosure` hook, never
  local state, so a remount cannot invent an expansion the enclosing turn did not have.
- **Everything rendered is derived from the frozen call slice**, so a cold replay renders what the
  live turn rendered.

## Limits

- Under `mode: ptc` the model calls `run_code`, so a name learned from a dispatch marks the moment a
  sub-call started: the row appears with the dispatch, not before it.
- A name learned lazily shows the row from its `tool/call` onward. Until then the shipped generic
  card renders the call, which is what happens today.
- The row does not open attachments or manage image URLs; the seat's own `loadImage`/`openFile`
  callbacks are not used, because an MCP argument is text this row shows verbatim.

## Layout

```
src/index.ts          node half — deliberately empty; mounting the row is what
                      makes the shell discover the browser half (dsh.client)
src/client/index.ts   slot contribution and the per-session discovery wiring
src/client/discovery.ts  the three arms, as a pure rule over one event window
src/client/mcp-name.ts   the wire name read as a label
src/client/row-model.ts  every rendered field, derived from one frozen call slice
src/client/McpToolRow.tsx  the row
src/client/locales.ts    en/zh copy
```

## Tests

```sh
npm test          # build + unit, integration and packaging specs
npm run test:inject   # mutate the source and require that the suite catches it
```

The suite mounts the plugin on a **real** `SlotRegistry` (the shipped
`@deepseek-ai/dsh-client-ui-renderer/client` bundle, loaded through a stub module loader) over a real
Cordis `Context`, drives real event-window publications, and renders the registered component with
`react-dom/server`. The Session object layer is the one fake, built to the published
`SessionListState`/`SessionBinding`/`SessionEventWindow` shapes; nothing about the slot seam is
simulated.

`npm run test:inject` mutates the source, rebuilds, and runs the affected spec: an arm whose mutation
leaves the suite green proves nothing, and is reported as `SILENT`.

## License

MIT
