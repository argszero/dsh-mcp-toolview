window.__ModuleLoader__.load({ id: "@argszero/dsh-mcp-toolview", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/discovery.ts
function namesInEvent(entry) {
  if (entry.type !== "event") return [];
  const event = entry.event;
  switch (event.type) {
    case "tool/call":
    case "tool/ptc-dispatch-start":
      return [event.data.name];
    case "request/header":
      return (event.data.header.tools ?? []).map((schema) => schema.name);
    default:
      return [];
  }
}
function toolNamesIn(entries) {
  const names = [];
  for (const entry of entries) names.push(...namesInEvent(entry));
  return names;
}
function newEntries(window) {
  switch (window.change.kind) {
    case "append":
    case "prepend":
      return window.change.entries;
    case "replace":
      return window.entries;
    default:
      return [];
  }
}
function windowReader() {
  let first = true;
  return (window) => {
    if (first) {
      first = false;
      return window.entries;
    }
    return newEntries(window);
  };
}

// src/client/mcp-name.ts
var MCP_PREFIX = "mcp__";
var SERVER_NAME = /^[A-Za-z0-9_-]{1,32}$/u;
function isMcpToolName(name) {
  return name.startsWith(MCP_PREFIX) && name.length > MCP_PREFIX.length;
}
function mcpToolLabel(name) {
  if (!isMcpToolName(name)) return { server: null, tool: name };
  const rest = name.slice(MCP_PREFIX.length);
  let index = rest.indexOf("__");
  let server = null;
  let tool = name;
  while (index !== -1) {
    const candidate = rest.slice(0, index);
    const remainder = rest.slice(index + 2);
    if (remainder.length > 0 && SERVER_NAME.test(candidate)) {
      if (server !== null) return { server: null, tool: name };
      server = candidate;
      tool = remainder;
    }
    index = rest.indexOf("__", index + 1);
  }
  return { server, tool };
}

// src/client/McpToolRow.tsx
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/row-model.ts
function firstLine(text) {
  const newline = text.indexOf("\n");
  return newline === -1 ? text : text.slice(0, newline);
}
function mcpRowState(block) {
  if (!("kind" in block)) return block.phase === "preparing" ? "preparing" : "running";
  if (block.error?.code === "interrupted") return "stopped";
  return block.isError ? "error" : "ok";
}
function argsRawOf(block) {
  if ("kind" in block) return block.call?.argsRaw ?? "";
  return block.phase === "start" ? block.argsRaw : "";
}
function argSummary(argsRaw, callId) {
  if (argsRaw === "") return callId;
  let parsed;
  try {
    parsed = JSON.parse(argsRaw);
  } catch {
    return firstLine(argsRaw);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return firstLine(argsRaw);
  for (const value of Object.values(parsed)) {
    if (typeof value === "string" && value !== "") return firstLine(value);
  }
  return firstLine(argsRaw);
}
function flattenContent(content, error) {
  const parts = [];
  for (const block of content) {
    if (block.type === "text") parts.push(block.text);
    else parts.push(JSON.stringify(block, null, 2));
  }
  if (parts.length === 0 && error !== void 0) parts.push(`${error.name}: ${error.code}`);
  return parts.length === 0 ? null : parts.join("\n");
}
function mcpRowModel(block) {
  const state = mcpRowState(block);
  const settled = "kind" in block;
  const wireName = settled ? block.call?.name ?? block.name : block.name;
  const argsRaw = argsRawOf(block);
  const output = settled ? flattenContent(block.content, block.error) : null;
  return {
    state,
    wireName,
    summary: argSummary(argsRaw, block.callId),
    argsRaw: argsRaw === "" ? null : argsRaw,
    output,
    errorSummary: state === "error" && output !== null ? firstLine(output) : null
  };
}

// src/client/McpToolRow.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var CARD = { display: "flex", flexDirection: "column", gap: 6, padding: "6px 10px" };
var ROW = { display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 };
var BADGE = {
  flex: "none",
  padding: "0 4px",
  border: "1px solid currentColor",
  borderRadius: 4,
  fontSize: 10,
  lineHeight: "16px",
  letterSpacing: 0.4,
  opacity: 0.75
};
var TITLE = { flex: "none", fontWeight: 600 };
var SEPARATOR = { flex: "none", opacity: 0.4 };
var SUMMARY = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  opacity: 0.8
};
var BODY = { display: "flex", flexDirection: "column", gap: 8, paddingLeft: 10 };
var LABEL = { fontSize: 11, opacity: 0.7 };
var PRE = {
  margin: "2px 0 0",
  padding: "6px 8px",
  borderRadius: 4,
  background: "rgba(127, 127, 127, 0.12)",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 12,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  maxHeight: 320,
  overflow: "auto"
};
var HIDDEN = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap"
};
function stateStatus(state, t) {
  switch (state) {
    case "running":
      return t("row.running");
    case "error":
      return t("row.failed");
    default:
      return null;
  }
}
function McpToolRow(props) {
  if (props.phase === "preparing") {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: CARD, "data-tool": props.block.name, "data-state": "preparing", children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: ROW, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: BADGE, children: "MCP" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: HIDDEN, children: props.t("row.preparing") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: TITLE, children: props.block.name }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.TextShimmer, { active: true, children: props.t("row.preparing") })
    ] }) });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StartedMcpRow, { ...props });
}
function StartedMcpRow({ block, inspect, useDisclosure, t }) {
  const model = mcpRowModel(block);
  const { expanded, toggle } = useDisclosure();
  const label = mcpToolLabel(model.wireName);
  const expandable = model.argsRaw !== null || model.output !== null;
  const open = expanded && expandable;
  const running = model.state === "running";
  const title = label.server === null ? model.wireName : label.tool;
  const status = stateStatus(model.state, t);
  const summary = model.state === "stopped" ? t("row.stopped") : model.errorSummary ?? model.summary;
  const toggleFromKeyboard = (event) => {
    if (!expandable || event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggle();
  };
  const disclosure = expandable ? {
    role: "button",
    tabIndex: 0,
    "aria-expanded": open,
    "aria-label": t("row.expand"),
    onClick: toggle,
    onKeyDown: toggleFromKeyboard
  } : {};
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: CARD, "data-tool": model.wireName, "data-state": model.state, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: ROW, "data-expandable": expandable ? "true" : void 0, ...disclosure, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: BADGE, children: "MCP" }),
      status === null ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: HIDDEN, children: status }),
      label.server === null ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: BADGE, "data-server": label.server, title: t("row.server"), children: label.server }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: TITLE, "data-title": title, children: title }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: SEPARATOR, "aria-hidden": true, children: "\xB7" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.TextShimmer, { active: running, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: SUMMARY, children: summary }) })
    ] }),
    open ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: BODY, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: LABEL, children: t("row.wireName") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { style: PRE, "data-wire-name": true, children: model.wireName })
      ] }),
      model.argsRaw === null ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: LABEL, children: t("row.arguments") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { style: PRE, "data-arguments": true, children: model.argsRaw })
      ] }),
      model.output === null ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: LABEL, children: t("row.output") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { style: PRE, "data-output": true, "data-error": model.state === "error" ? "true" : void 0, children: model.output })
      ] }),
      inspect === void 0 ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", onClick: inspect, style: { cursor: "pointer" }, children: t("row.inspect") })
    ] }) : null
  ] });
}

// src/client/locales.ts
var NS = "mcp-toolview";
var en = {
  "row.server": "MCP server",
  "row.expand": "Show this MCP call in full",
  "row.preparing": "Calling an MCP tool\u2026",
  "row.running": "MCP tool running",
  "row.failed": "MCP tool failed",
  "row.stopped": "MCP tool interrupted",
  "row.wireName": "Wire name",
  "row.arguments": "Arguments",
  "row.output": "Output",
  "row.inspect": "Inspect call"
};
var zh = {
  "row.server": "MCP \u670D\u52A1\u7AEF",
  "row.expand": "\u5C55\u5F00\u8BE5\u6B21 MCP \u8C03\u7528",
  "row.preparing": "\u6B63\u5728\u8C03\u7528 MCP \u5DE5\u5177\u2026",
  "row.running": "MCP \u5DE5\u5177\u8FD0\u884C\u4E2D",
  "row.failed": "MCP \u5DE5\u5177\u5931\u8D25",
  "row.stopped": "MCP \u5DE5\u5177\u88AB\u4E2D\u65AD",
  "row.wireName": "\u7EBF\u4E0A\u540D\u79F0",
  "row.arguments": "\u53C2\u6570",
  "row.output": "\u8F93\u51FA",
  "row.inspect": "\u67E5\u770B\u8BE5\u6B21\u8C03\u7528"
};

// src/client/index.ts
var SEAT = "tool.call.toolview";
var inject = ["slots", "sessions", "locale"];
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "mcp-toolview: dictionaries");
  ctx.effect(() => discoverMcpToolviews(ctx), "mcp-toolview: discovery");
}
function discoverMcpToolviews(ctx) {
  const sessions = ctx.sessions;
  const names = /* @__PURE__ */ new Set();
  let live = null;
  const sync = () => {
    if (live === null) return;
    const claimed = /* @__PURE__ */ new Set();
    for (const entry of ctx.slots.entries(SEAT)) {
      if (entry.options.key !== void 0) claimed.add(entry.options.key);
    }
    for (const name of names) {
      if (live.has(name) || claimed.has(name)) continue;
      live.set(name, ctx.slots.register(
        { name: SEAT, key: name, locale: NS, registrant: "mcp-toolview" },
        McpToolRow
      ));
    }
  };
  const learn = (candidates) => {
    let grew = false;
    for (const name of candidates) {
      if (names.has(name) || !isMcpToolName(name)) continue;
      names.add(name);
      grew = true;
    }
    if (grew) sync();
  };
  const windows = /* @__PURE__ */ new Map();
  const watch = (binding) => {
    const read = windowReader();
    const scan = () => {
      learn(toolNamesIn(read(binding.eventSource.getSnapshot())));
    };
    scan();
    windows.set(binding.sessionId, binding.eventSource.subscribe(scan));
  };
  const reconcile = () => {
    const bound = /* @__PURE__ */ new Map();
    for (const summary of Object.values(sessions.list.getSnapshot().byId)) {
      const binding = sessions.binding(summary.id);
      if (binding !== void 0) bound.set(summary.id, binding);
    }
    for (const [sessionId, stop] of windows) {
      if (bound.has(sessionId)) continue;
      stop();
      windows.delete(sessionId);
    }
    for (const [sessionId, binding] of bound) {
      if (windows.has(sessionId)) continue;
      watch(binding);
    }
  };
  const stopInject = ctx.slots.inject(SEAT, () => {
    const entries = /* @__PURE__ */ new Map();
    live = entries;
    sync();
    return () => {
      if (live === entries) live = null;
      for (const dispose of entries.values()) dispose();
    };
  });
  reconcile();
  const stopList = sessions.list.subscribe(reconcile);
  return () => {
    stopInject();
    stopList();
    for (const stop of windows.values()) stop();
    windows.clear();
  };
}
return module.exports; } });
