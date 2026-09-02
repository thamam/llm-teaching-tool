function Harness() {
  this.source = "mock";
  this.stage = "bare";
  this.temperature = 0.7;
  this.memoryOn = false;
  this.memory = "";
  this.prompt = "What is the capital of France?";
  this.script = [];
  this.scriptPos = 0;
  this.tokens = [];
  this.generated = "";
  this.context = [];
  this.running = false;
  this.tops = [];
  this.error = "";
  this.provider = "groq";
  this.model = window.LLMLive.PROVIDERS.groq.models[0];
  this.live = new window.LLMLive.LiveClient({ provider: this.provider, model: this.model });
  this.onUpdate = null;
}
Harness.prototype._emit = function () { if (this.onUpdate) this.onUpdate(this.state()); };
Harness.prototype.state = function () {
  return {
    source: this.source, stage: this.stage, temperature: this.temperature,
    memoryOn: this.memoryOn, memory: this.memory, prompt: this.prompt,
    tokens: this.tokens.slice(), generated: this.generated, context: this.context,
    running: this.running, tops: this.tops, error: this.error,
    provider: this.provider, model: this.model,
    logprobs: !!(window.LLMLive.PROVIDERS[this.provider] && window.LLMLive.PROVIDERS[this.provider].logprobs),
    done: this.source === "mock" && this.scriptPos >= this.script.length,
  };
};
Harness.prototype.setSource = function (s) { this.source = s; this.reset(this.prompt); };
Harness.prototype.setStage = function (s) { this.stage = s; this.memoryOn = s === "memory"; this._emit(); };
Harness.prototype.setTemp = function (t) { this.temperature = t; this._refreshTops(); this._emit(); };
Harness.prototype.setProvider = function (p) {
  this.provider = p; this.live.provider = p;
  const models = window.LLMLive.PROVIDERS[p].models;
  if (models.indexOf(this.model) === -1) this.setModel(models[0]); else this._emit();
};
Harness.prototype.setModel = function (m) { this.model = m; this.live.model = m; this._emit(); };
Harness.prototype.reset = function (prompt) {
  this.stop();
  this.prompt = prompt || this.prompt;
  this.script = window.LLMModel.getScript(this.prompt);
  this.scriptPos = 0; this.tokens = []; this.generated = ""; this.error = "";
  this.context = [
    { role: "system", text: "You are a helpful assistant. Prefer a short answer. If a tool would help, call it." },
    { role: "user", text: this.prompt },
  ];
  if (this.memoryOn && this.memory) this.context.unshift({ role: "system", text: "Memory: " + this.memory });
  this._refreshTops(); this._emit();
};
Harness.prototype._refreshTops = function () {
  if (this.source === "live") return;
  const last = this.tokens.length ? this.tokens[this.tokens.length - 1] : "start";
  this.tops = window.LLMModel.predictTokens(last, this.temperature);
};
Harness.prototype._appendToken = function (tok) {
  this.tokens.push(tok); this.generated += tok;
  const last = this.context[this.context.length - 1];
  if (last && last.role === "model") last.text += tok;
  else this.context.push({ role: "model", text: tok });
};
Harness.prototype.step = function () {
  if (this.source === "live") return this.liveTurn({ stream: false, maxTokens: 12, rounds: 1 });
  if (this.scriptPos >= this.script.length) { this.running = false; this._emit(); return null; }
  const tok = this.script[this.scriptPos];
  this.scriptPos += 1; this._appendToken(tok);
  if (this.stage === "tools" && this.scriptPos === this.script.length) {
    const result = window.LLMLive.runLocalTool("now", {});
    this.context.push({ role: "tool", text: "now() \u2192 " + result, name: "now" });
  }
  if (this.memoryOn && this.scriptPos === this.script.length) this.memory = this.generated;
  this._refreshTops(); this._emit(); return tok;
};
Harness.prototype._apiMessages = function () {
  const out = [];
  this.context.forEach(function (c) {
    if (c.role === "system") out.push({ role: "system", content: c.text });
    else if (c.role === "user") out.push({ role: "user", content: c.text });
    else if (c.role === "model") {
      const msg = { role: "assistant", content: c.text || null };
      if (c.tool_calls && c.tool_calls.length) msg.tool_calls = c.tool_calls;
      out.push(msg);
    } else if (c.role === "tool") {
      out.push({ role: "tool", tool_call_id: c.tool_call_id || "call_local", name: c.name || "tool", content: c.result || c.text });
    }
  });
  return out;
};
Harness.prototype._wantsLogprobs = function () {
  return !!(window.LLMLive.PROVIDERS[this.provider] && window.LLMLive.PROVIDERS[this.provider].logprobs);
};
Harness.prototype._applyLogprobs = function (tops) { if (tops && tops.length) this.tops = tops; };
Harness.prototype.liveTurn = async function (opts) {
  opts = opts || {};
  if (this.running) return;
  this.running = true; this.error = ""; this._emit();
  const self = this;
  const maxRounds = opts.rounds || (this.stage === "tools" ? 4 : 1);
  const stream = opts.stream !== false;
  try {
    for (let round = 0; round < maxRounds; round++) {
      if (!this.running) break;
      const payload = {
        model: this.model, messages: this._apiMessages(), temperature: this.temperature,
        max_tokens: opts.maxTokens || (this.stage === "bare" ? 24 : 200), stream: stream,
      };
      if (this._wantsLogprobs()) { payload.logprobs = true; payload.top_logprobs = 5; }
      if (this.stage === "tools") { payload.tools = window.LLMLive.TOOLS; payload.tool_choice = "auto"; }
      let finish = { reason: "stop", toolCalls: [], tops: [] };
      const data = await this.live.complete(payload, function (ev) {
        if (ev.type === "text" && ev.text) { self._appendToken(ev.text); self._emit(); }
        if (ev.type === "logprobs") self._applyLogprobs(ev.tops);
        if (ev.type === "finish") finish = ev;
      });
      if (!stream) {
        const choice = data.choices && data.choices[0];
        const msg = choice && choice.message;
        if (!msg) throw new Error("empty response");
        if (msg.content) this._appendToken(msg.content);
        this._applyLogprobs(window.LLMLive.logprobToTops(choice.logprobs));
        finish.reason = choice.finish_reason || "stop";
        finish.toolCalls = (msg.tool_calls || []).map(function (tc) {
          return { id: tc.id || "", name: tc.function && tc.function.name, args: (tc.function && tc.function.arguments) || "{}" };
        });
      }
      if (finish.tops) this._applyLogprobs(finish.tops);
      if (finish.reason === "tool_calls" && finish.toolCalls && finish.toolCalls.length) {
        this.context.push({
          role: "model", text: "",
          tool_calls: finish.toolCalls.map(function (tc) {
            return { id: tc.id || ("call_" + tc.name), type: "function", function: { name: tc.name, arguments: tc.args || "{}" } };
          }),
        });
        finish.toolCalls.forEach(function (tc) {
          if (!tc.name) return;
          let args = {}; try { args = JSON.parse(tc.args || "{}"); } catch (e) {}
          const result = window.LLMLive.runLocalTool(tc.name, args);
          self.context.push({ role: "tool", name: tc.name, tool_call_id: tc.id || ("call_" + tc.name), result: result, text: tc.name + "(" + (tc.args || "") + ") \u2192 " + result });
        });
        this._emit(); continue;
      }
      break;
    }
    if (this.memoryOn) this.memory = this.generated;
  } catch (err) {
    if (err.name !== "AbortError") this.error = String(err.message || err);
  }
  this.running = false; this._emit();
};
Harness.prototype.run = function () {
  if (this.source === "live") {
    return this.liveTurn({ stream: true, maxTokens: this.stage === "bare" ? 32 : 220, rounds: this.stage === "tools" ? 4 : 1 });
  }
  const self = this;
  if (this.running) return;
  this.running = true; this._emit();
  function tick() {
    if (!self.running || self.scriptPos >= self.script.length) { self.running = false; self._emit(); return; }
    self.step(); setTimeout(tick, 140);
  }
  tick();
};
Harness.prototype.stop = function () { this.running = false; if (this.live) this.live.stop(); };
window.LLMHarness = Harness;
