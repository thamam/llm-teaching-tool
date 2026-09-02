// Groq (OpenAI-compatible) client.
// Browser talks to the local proxy at /api/chat so the key never sits in the page.

const GROQ_TOOLS = [
  {
    type: "function",
    function: {
      name: "now",
      description: "Return the current time as an ISO-8601 string.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "add",
      description: "Add two numbers.",
      parameters: {
        type: "object",
        properties: {
          a: { type: "number" },
          b: { type: "number" },
        },
        required: ["a", "b"],
      },
    },
  },
];

function runLocalTool(name, args) {
  if (name === "now") return new Date().toISOString();
  if (name === "add") return String(Number(args.a) + Number(args.b));
  return "unknown tool";
}

function LiveClient(opts) {
  this.endpoint = (opts && opts.endpoint) || "/api/chat";
  this.model = (opts && opts.model) || "llama-3.1-8b-instant";
  this.abort = null;
}

LiveClient.prototype.stop = function () {
  if (this.abort) this.abort.abort();
  this.abort = null;
};

LiveClient.prototype.complete = async function (payload, onDelta) {
  this.stop();
  this.abort = new AbortController();
  const res = await fetch(this.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: this.abort.signal,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || ("HTTP " + res.status));
  }
  if (!payload.stream) {
    return res.json();
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let full = "";
  let toolCalls = [];
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buf += decoder.decode(chunk.value, { stream: true });
    const parts = buf.split("\n");
    buf = parts.pop();
    for (let i = 0; i < parts.length; i++) {
      let line = parts[i].trim();
      if (!line) continue;
      if (line.indexOf("data:") === 0) line = line.slice(5).trim();
      if (line === "[DONE]") continue;
      let json;
      try { json = JSON.parse(line); } catch (e) { continue; }
      const choice = json.choices && json.choices[0];
      if (!choice) continue;
      const delta = choice.delta || {};
      if (delta.content) {
        full += delta.content;
        if (onDelta) onDelta({ type: "text", text: delta.content });
      }
      if (delta.tool_calls) {
        delta.tool_calls.forEach(function (tc) {
          const idx = tc.index || 0;
          if (!toolCalls[idx]) toolCalls[idx] = { id: tc.id || "", name: "", args: "" };
          if (tc.id) toolCalls[idx].id = tc.id;
          if (tc.function && tc.function.name) toolCalls[idx].name += tc.function.name;
          if (tc.function && tc.function.arguments) toolCalls[idx].args += tc.function.arguments;
        });
      }
      if (choice.finish_reason && onDelta) {
        onDelta({ type: "finish", reason: choice.finish_reason, toolCalls: toolCalls });
      }
    }
  }
  return { text: full, toolCalls: toolCalls };
};

window.LLMLive = { LiveClient: LiveClient, GROQ_TOOLS: GROQ_TOOLS, runLocalTool: runLocalTool };
