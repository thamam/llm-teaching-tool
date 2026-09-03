// Live client: Groq / OpenRouter / Together via the local proxy.
const TOOLS = [
  { type: "function", function: { name: "now", description: "Return the current time as an ISO-8601 string.", parameters: { type: "object", properties: {}, additionalProperties: false } } },
  { type: "function", function: { name: "add", description: "Add two numbers and return the sum as a string.", parameters: { type: "object", properties: { a: { type: "number" }, b: { type: "number" } }, required: ["a", "b"] } } }
];
const PROVIDERS = {
  groq: {
    label: "Groq", logprobs: false,
    models: ["openai/gpt-oss-20b", "openai/gpt-oss-120b", "qwen/qwen3.8-27b", "groq/compound-mini", "groq/compound"]
  },
  openrouter: {
    label: "OpenRouter", logprobs: true,
    models: ["openai/gpt-4o-mini", "meta-llama/llama-3.1-8b-instruct", "google/gemini-2.0-flash-001"]
  },
  together: {
    label: "Together", logprobs: true,
    models: ["meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", "Qwen/Qwen2.5-7B-Instruct-Turbo"]
  }
};
function runLocalTool(name, args) {
  args = args || {};
  if (name === "now") return new Date().toISOString();
  if (name === "add") return String(Number(args.a) + Number(args.b));
  return "unknown tool";
}
function logprobToTops(logprobs) {
  if (!logprobs) return [];
  const content = logprobs.content;
  if (content && content.length) {
    const last = content[content.length - 1];
    const alts = last.top_logprobs || [{ token: last.token, logprob: last.logprob }];
    return alts.map(function (a) { return { tok: a.token, p: Math.exp(a.logprob); }; }).sort(function (a, b) { return b.p - a.p; });
  }
  if (logprobs.tokens && logprobs.tokens.length) {
    const i = logprobs.tokens.length - 1;
    let alts = [];
    const top = logprobs.top_logprobs;
    if (Array.isArray(top) && top[i]) {
      Object.keys(top[i]).forEach(function (tok) { alts.push({ tok: tok, p: Math.exp(top[i][tok]) }); });
    } else {
      alts = [{ tok: logprobs.tokens[i], p: Math.exp(logprobs.token_logprobs[i] || 0) }];
    }
    return alts.sort(function (a, b) { return b.p - a.p; });
  }
  return [];
}
function LiveClient(opts) {
  this.endpoint = (opts && opts.endpoint) || "/api/chat";
  this.provider = (opts && opts.provider) || "groq";
  this.model = (opts && opts.model) || PROVIDERS.groq.models[0];
  this.abort = null;
}
LiveClient.prototype.stop = function () { if (this.abort) this.abort.abort(); this.abort = null; };
LiveClient.prototype.complete = async function (payload, onDelta) {
  this.stop();
  this.abort = new AbortController();
  payload.provider = this.provider;
  payload.model = payload.model || this.model;
  const res = await fetch(this.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: this.abort.signal,
  });
  if (!res.ok) {
    let text = await res.text();
    try { const j = JSON.parse(text); text = (j.error && j.error.message) || j.error || text; } catch (e) {}
    throw new Error(typeof text === "string" ? text : JSON.stringify(text));
  }
  if (!payload.stream) {
    const data = await res.json();
    const choice = data.choices && data.choices[0];
    const tops = logprobToTops(choice && choice.logprobs);
    if (onDelta && tops.length) onDelta({ type: "logprobs", tops: tops });
    return data;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "", full = "", toolCalls = [], lastTops = [];
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buf += decoder.decode(chunk.value, { stream: true });
    const parts = buf.split("\n");
    buf = parts.pop();
    for (let i = 0; i < parts.length; i++) {
      let line = parts[i].trim();
      if (!line || line.charAt(0) === ":") continue;
      if (line.indexOf("data:") === 0) line = line.slice(5).trim();
      if (line === "[DONE]") continue;
      let json; try { json = JSON.parse(line); } catch (e) { continue; }
      const choice = json.choices && json.choices[0];
      if (!choice) continue;
      const delta = choice.delta || {};
      if (delta.content) { full += delta.content; if (onDelta) onDelta({ type: "text", text: delta.content }); }
      if (choice.logprobs) { lastTops = logprobToTops(choice.logprobs); if (onDelta && lastTops.length) onDelta({ type: "logprobs", tops: lastTops }); }
      if (delta.tool_calls) {
        delta.tool_calls.forEach(function (tc) {
          const idx = typeof tc.index === "number" ? tc.index : 0;
          if (!toolCalls[idx]) toolCalls[idx] = { id: "", name: "", args: "" };
          if (tc.id) toolCalls[idx].id = tc.id;
          if (tc.function && tc.function.name) toolCalls[idx].name += tc.function.name;
          if (tc.function && tc.function.arguments) toolCalls[idx].args += tc.function.arguments;
        });
      }
      if (choice.finish_reason && onDelta) onDelta({ type: "finish", reason: choice.finish_reason, toolCalls: toolCalls.filter(Boolean), tops: lastTops });
    }
  }
  return { text: full, toolCalls: toolCalls.filter(Boolean), tops: lastTops };
};
window.LLMLive = { LiveClient: LiveClient, TOOLS: TOOLS, GROQ_TOOLS: TOOLS, PROVIDERS: PROVIDERS, runLocalTool: runLocalTool, logprobToTops: logprobToTops };
