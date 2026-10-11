/**
 * Defect injection: mutate the source, rebuild, run the affected suite, and
 * require that the mutation is caught. An arm whose mutation leaves the suite
 * green is SILENT — it proves nothing about the test that was supposed to hold
 * the line.
 *
 * Every arm here rebuilds first, because the suite loads the **built artifact**:
 * the unit specs import `src/client/*.ts` (node strips the types), but the
 * integration, bundle and packaging specs read `lib/`, and the browser half the
 * tests mount is `lib/client.js` — the file the shell loads. A mutation that
 * only reached `src/` would leave the bundle under test unmutated and go SILENT
 * for the wrong reason. The source is restored **and the tree rebuilt** whatever
 * happened: an injector that can leave a mutation, or a stale `lib/`, in the
 * tree would be worse than no injector.
 *
 * Every mutation is a defect this plugin could plausibly ship — a guard made
 * unreachable, a rule relaxed, an arm dropped, a preference removed, a
 * condition inverted. None is engineered to be caught: each names the shape of
 * mistake the arm exists for.
 *
 * Run from the plugin root: `npm run test:inject`.
 *
 * The control arm is the unmutated suite, run first: every mutant is compared
 * against a suite that is known green, so a repository-wide failure (a broken
 * dependency, a missing build) cannot be mistaken for a caught defect.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const MUTATIONS = [
  {
    name: 'the namespace test accepts the bare prefix, so a name with no leaf is claimed as a tool',
    file: 'src/client/mcp-name.ts',
    arms: 'mcp-name.spec.mjs',
    edits: [['  return name.startsWith(MCP_PREFIX) && name.length > MCP_PREFIX.length', '  return name.startsWith(MCP_PREFIX)']],
  },
  {
    name: 'the namespace test is inverted, so a name outside the MCP family is read as one',
    file: 'src/client/mcp-name.ts',
    arms: 'mcp-name.spec.mjs',
    edits: [['  if (!isMcpToolName(name)) return { server: null, tool: name }', '  if (isMcpToolName(name)) return { server: null, tool: name }']],
  },
  {
    name: 'the first consistent split is kept instead of ambiguity being reported, so a server named with separators gets a guessed chip',
    file: 'src/client/mcp-name.ts',
    arms: 'mcp-name.spec.mjs',
    edits: [['      if (server !== null) return { server: null, tool: name }', '      if (server !== null) return { server, tool }']],
  },
  {
    name: 'the server-name contract is not consulted, so an impossible server segment is accepted',
    file: 'src/client/mcp-name.ts',
    arms: 'mcp-name.spec.mjs',
    edits: [['    if (remainder.length > 0 && SERVER_NAME.test(candidate)) {', '    if (remainder.length > 0) {']],
  },
  {
    name: 'a settled call is failed or ok by the wrong polarity, so every successful call renders red',
    file: 'src/client/row-model.ts',
    arms: 'row-model.spec.mjs',
    edits: [["  return block.isError ? 'error' : 'ok'", "  return block.isError ? 'ok' : 'error'"]],
  },
  {
    name: 'the interruption identity is misspelled, so a call the user stopped is reported as an MCP failure',
    file: 'src/client/row-model.ts',
    arms: 'row-model.spec.mjs',
    edits: [["  if (block.error?.code === 'interrupted') return 'stopped'", "  if (block.error?.code === 'cancelled') return 'stopped'"]],
  },
  {
    name: 'an empty-string argument is summarized, so a row whose server sent a blank field shows nothing useful',
    file: 'src/client/row-model.ts',
    arms: 'row-model.spec.mjs',
    edits: [["    if (typeof value === 'string' && value !== '') return firstLine(value)", "    if (typeof value === 'string') return firstLine(value)"]],
  },
  {
    name: 'the argument summary reads keys instead of values, so every call to one server summarizes alike',
    file: 'src/client/row-model.ts',
    arms: 'row-model.spec.mjs',
    edits: [['  for (const value of Object.values(parsed)) {', '  for (const value of Object.keys(parsed)) {']],
  },
  {
    name: 'a failed call with no content blocks loses its failure identity, leaving an empty body',
    file: 'src/client/row-model.ts',
    arms: 'row-model.spec.mjs',
    edits: [['  if (parts.length === 0 && error !== undefined) parts.push(`${error.name}: ${error.code}`)', '  if (parts.length === 0 && error !== undefined) parts.push(``)']],
  },
  {
    name: 'the error summary is taken from any row with output, so a successful call is summarized as a failure line',
    file: 'src/client/row-model.ts',
    arms: 'row-model.spec.mjs',
    edits: [["    errorSummary: state === 'error' && output !== null ? firstLine(output) : null,", "    errorSummary: state !== 'preparing' && output !== null ? firstLine(output) : null,"]],
  },
  {
    name: 'the PTC dispatch arm is dropped, so under mode: ptc an MCP call is never seen at all',
    file: 'src/client/discovery.ts',
    arms: 'discovery.spec.mjs',
    edits: [["    case 'tool/call':\n    case 'tool/ptc-dispatch-start':", "    case 'tool/call':"]],
  },
  {
    name: 'the assembled catalog is ignored, so a name is only learned once the model has already called it',
    file: 'src/client/discovery.ts',
    arms: 'discovery.spec.mjs',
    edits: [['      return (event.data.header.tools ?? []).map(schema => schema.name)', '      return []']],
  },
  {
    name: 'a prepended page is read as the whole window, so freshly paged history is rescanned instead of read as a delta',
    file: 'src/client/discovery.ts',
    arms: 'discovery.spec.mjs',
    edits: [[
      "      return window.change.entries\n    case 'replace':",
      "      return window.entries\n    case 'replace':",
    ]],
  },
  {
    name: 'the reader treats its first look as a delta, so a turn that ran before the bundle mounted is invisible',
    file: 'src/client/discovery.ts',
    arms: 'discovery.spec.mjs',
    edits: [['      first = false\n      return window.entries', '      first = false\n      return newEntries(window)']],
  },
  {
    name: 'the namespace guard is dropped from learning, so core tool names are claimed as MCP names',
    file: 'src/client/index.ts',
    arms: 'plugin.spec.mjs',
    edits: [['      if (names.has(name) || !isMcpToolName(name)) continue', '      if (names.has(name)) continue']],
  },
  {
    name: 'an occupied key is not skipped, so this plugin throws into another plugin\u2019s decision',
    file: 'src/client/index.ts',
    arms: 'plugin.spec.mjs',
    edits: [['      if (live.has(name) || claimed.has(name)) continue', '      if (live.has(name)) continue']],
  },
  {
    name: 'a returning declaration does not re-mint its entries, so history paged in before the owner mounted is never claimed again',
    file: 'src/client/index.ts',
    arms: 'plugin.spec.mjs',
    edits: [['    const entries = new Map<string, () => void>()\n    live = entries\n    sync()', '    const entries = new Map<string, () => void>()\n    live = entries']],
  },
  {
    name: 'the server chip is rendered even when the name does not say which server it was',
    file: 'src/client/McpToolRow.tsx',
    arms: 'plugin.spec.mjs',
    edits: [[
      "        {label.server === null\n          ? null\n          : <span style={BADGE} data-server={label.server} title={t('row.server')}>{label.server}</span>}",
      "        <span style={BADGE} data-server={label.server ?? ''} title={t('row.server')}>{label.server ?? ''}</span>",
    ]],
  },
  {
    name: 'a stopped call is summarized as its failure line, so the row blames the server for the user\u2019s decision',
    file: 'src/client/McpToolRow.tsx',
    arms: 'plugin.spec.mjs',
    edits: [["  const summary = model.state === 'stopped' ? t('row.stopped') : model.errorSummary ?? model.summary", '  const summary = model.errorSummary ?? model.summary']],
  },
  {
    name: 'the disclosure needs both an argument line and an output, so a running call cannot be expanded',
    file: 'src/client/McpToolRow.tsx',
    arms: 'plugin.spec.mjs',
    edits: [['  const expandable = model.argsRaw !== null || model.output !== null', '  const expandable = model.argsRaw !== null && model.output !== null']],
  },
  {
    name: 'the running state is not announced, so a screen reader hears a row that never says it is working',
    file: 'src/client/McpToolRow.tsx',
    arms: 'plugin.spec.mjs',
    edits: [["    case 'running': return t('row.running')", "    case 'running': return null"]],
  },
]

/**
 * How long one build or one suite may take before the arm is abandoned.
 *
 * Not a performance budget: a mutation can turn a bounded loop into an unbounded
 * one, and without a deadline that arm does not fail — it runs forever, and the
 * `finally` that restores the source never runs either, so the tree is left
 * mutated and every later run inherits the defect (measured: an arm that turned a
 * `return` into a `continue` inside a `while` wedged the injector until it was
 * killed, and left the mutated file on disk). A deadline makes that arm FAIL
 * instead, which is what the arm was for.
 */
const DEADLINE_MS = 120_000

/** Rebuild `lib/` from `src/`: types, client declarations, and the browser bundle. */
function build() {
  try {
    const tsc = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc')
    execFileSync(process.execPath, [tsc], { cwd: ROOT, stdio: 'pipe', timeout: DEADLINE_MS })
    execFileSync(process.execPath, [tsc, '-p', 'tsconfig.client.json'], { cwd: ROOT, stdio: 'pipe', timeout: DEADLINE_MS })
    execFileSync(process.execPath, [join(ROOT, 'scripts', 'build-client.mjs')], { cwd: ROOT, stdio: 'pipe', timeout: DEADLINE_MS })
    return true
  } catch {
    return false
  }
}

/** Run one suite file; true when it failed, plus its output. */
function runSuite(arms) {
  try {
    execFileSync(process.execPath, ['--test', `test/${arms}`], { cwd: ROOT, stdio: 'pipe', timeout: DEADLINE_MS })
    return { failed: false, output: '', hung: false }
  } catch (error) {
    const hung = error.code === 'ETIMEDOUT' || (error.signal !== null && error.signal !== undefined)
    return { failed: true, hung, output: String(error.stdout ?? '') + String(error.stderr ?? '') }
  }
}

// The control arm: the unmutated tree. A suite that is red on its own makes every
// CAUGHT below meaningless, so it is asserted rather than assumed.
if (!build()) {
  console.log('CONTROL UNBUILDABLE: src/ does not compile, no arm below proves anything')
  process.exit(1)
}
const control = runSuite('*.spec.mjs')
if (control.failed) {
  console.log('CONTROL RED: the unmutated suite fails, no arm below proves anything')
  console.log(control.output)
  process.exit(1)
}
console.log('CONTROL: the unmutated suite is green')

let silent = 0
let unbuildable = 0
let hung = 0
for (const mutation of MUTATIONS) {
  const path = join(ROOT, mutation.file)
  const original = readFileSync(path, 'utf8')
  let mutated = original
  let anchored = true
  for (const [find, replace] of mutation.edits) {
    if (!original.includes(find)) {
      anchored = false
      console.log(`SKIP (anchor missing): ${mutation.name}`)
    }
    mutated = mutated.replace(find, replace)
  }
  if (!anchored) continue

  writeFileSync(path, mutated)
  let built = false
  let result = { failed: false, output: '', hung: false }
  try {
    built = build()
    if (built) result = runSuite(mutation.arms)
  } finally {
    // Restore the source and rebuild, whatever happened: leaving either a mutation
    // or a stale `lib/` behind is the failure mode this file exists to avoid, and a
    // stale `lib/` is how an arm goes SILENT.
    writeFileSync(path, original)
    build()
  }

  if (!built) {
    unbuildable += 1
    console.log(`UNBUILDABLE (proves nothing): ${mutation.name}`)
    continue
  }
  if (result.hung) {
    hung += 1
    console.log(`HUNG (the suite never reached a verdict): ${mutation.name} (${mutation.arms})`)
    continue
  }
  const caught = result.failed && /fail [1-9]/.test(result.output)
  if (!caught) silent += 1
  console.log(`${caught ? 'CAUGHT' : 'SILENT'}: ${mutation.name} (${mutation.arms})`)
}
console.log(`SILENT ARMS: ${silent === 0 ? 'none' : String(silent)}; HUNG: ${hung === 0 ? 'none' : String(hung)}; UNBUILDABLE: ${unbuildable === 0 ? 'none' : String(unbuildable)}`)
if (silent > 0 || unbuildable > 0 || hung > 0) process.exit(1)
