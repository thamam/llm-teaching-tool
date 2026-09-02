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
  this.model = "llama-3.1-8b-instant";
  this.live = new window.LLMLive.LiveClient({ model: this.model });
  this.onUpdate = null;
}

Harness.prototype._emit = function () {
  if (this.onUpdate) this.onUpdate(this.state());
};

Harness.prototype.state = function () {
  return {
    source: this.source,
    stage: this.stage,
    temperature: this.temperature,
    memoryOn: this.memoryOn,
    memory: this.memory,
    prompt: this.prompt,
    tokens: this.tokens.slice(),
    generated: this.generated,
    context: this.context,
    running: this.running,
    tops: this.tops,
    error: this.error,
    model: this.model,
    done: this.source === "mock" && this.scriptPos >= this.script.length,
  };
};

Harness.prototype.setSource = function (s) {
  this.source = s;
  this.reset(this.prompt);
};

Harness.prototype.setStage = function (s) {
  this.stage = s;
  this.memoryOn = s === "memory";
  this._emit();
};

Harness.prototype.setTemp = function (t) {
  this.temperature = t;
  this._refreshTops();
  this._emit();
};

Harness.prototype.setModel = function (m) {
  this.model = m;
  this.live.model = m;
  this._emit();
};

Harness.prototype.reset = function (prompt) {
  this.stop();
  this.prompt = prompt || this.prompt;
  this.script = window.LLMModel.getScript(this.prompt);
  this.scriptPos = 0;
  this.tokens = [];
  this.generated = "";
  this.error = "";
  this.context = [
    { role: "system", text: "You are a helpful assistant. Answer in one short sentence." },
    { role: "user", text: this.prompt },
  ];
  if (this.memoryOn && this.memory) {
    this.context.unshift({ role: "system", text: "Memory: " + this.memory });
  }
  this._refreshTops();
  this._emit();
};

Harness.prototype._refreshTops = function () {
  if (this.source === "live") {
    if (!this.tops.length) this.tops = [];
    return;
  }
  const last = this.tokens.length ? this.tokens[this.tokens.length - 1] : "start";
  this.tops = window.LLMModel.predictTokens(last, this.temperature);
};

Harness.prototype._appendToken = function (tok) {
  this.tokens.push(tok);
  this.generated += tok;
  const last = this.context[this.context.length - 1];
  if (last && last.role === "model") last.text += tok;
  else this.context.push({ role: "model", text: tok });
};

Harness.prototype.step = function () {
  if (this.source === "live") return this.liveStep();
  if (this.scriptPos >= this.script.length) {
    this.running = false;
    this._emit();
    return null;
  }
  const tok = this.script[this.scriptPos];
  this.scriptPos += 1;
  this._appendToken(tok);
  if (this.stage === "tools" && this.scriptPos === this.script.length) {
    this.context.push({ role: "tool", text: "now() \u2192 " + window.LLMLive.runLocalTool("now", {}) });
  }
  if (this.memoryOn && this.scriptPos === this.script.length) this.memory = this.generated;
  this._refreshTops();
  this._emit();
  return tok;
};

Harness.prototype._messages = function () {
  return this.context
    .filter(function (c) { return c.role !== "tool"; })
    .map(function (c) {
      return { role: c.role === "model" ? "assistant" : c.role, content: c.text };
    });
};

Harness.prototype.liveStep = async function () {
  if (this.running) return;
  this.running = true;
  this.error = "";
  this._emit();
  try {
    const payload = {
      model: this.model,
      messages: this._messages(),
      temperature: this.temperature,
      max_completion_tokens: 8,
      stream: false,
    };
    if (this.stage === "tools") payload.tools = window.LLMLive.GROQ_TOOLS;
    const data = await this.live.complete(payload);
    const msg = data.choices && data.choices[0] && data.choices[0].message;
    if (!msg) throw new Error("empty response");
    if (msg.content) {
      this._appendToken(msg.content);
      this.tops = [{ tok: msg.content, p: 1 }];
    }
    if (msg.tool_calls && msg.tool_calls.length) {
      msg.tool_calls.forEach(function (tc) {
        let args = {};
        try { args = JSON.parse(tc.function.arguments || "{}"); } catch (e) {}
        const result = window.LLMLive.runLocalTool(tc.function.name, args);
        this.context.push({
          role: "tool",
          text: tc.function.name + "(" + (tc.function.arguments || "") + ") \u2192 " + result,
        });
      }, this);
    }
    if (this.memoryOn) this.memory = this.generated;
  } catch (err) {
    if (err.name !== "AbortError") this.error = String(err.message || err);
  }
  this.running = false;
  this._emit();
};

Harness.prototype.run = function () {
  if (this.source === "live") return this.liveRun();
  const self = this;
  if (this.running) return;
  this.running = true;
  this._emit();
  function tick() {
    if (!self.running || self.scriptPos >= self.script.length) {
      self.running = false;
      self._emit();
      return;
    }
    self.step();
    setTimeout(tick, 140);
  }
  tick();
};

Harness.prototype.liveRun = async function () {
  if (this.running) return;
  this.running = true;
  this.error = "";
  this._emit();
  const self = this;
  try {
    const payload = {
      model: this.model,
      messages: this._messages(),
      temperature: this.temperature,
      max_completion_tokens: this.stage === "bare" ? 24 : 160,
      stream: true,
    };
    if (this.stage === "tools") payload.tools = window.LLMLive.GROQ_TOOLS;
    await this.live.complete(payload, function (ev) {
      if (ev.type === "text" && ev.text) {
        self._appendToken(ev.text);
        self.tops = [{ tok: ev.text, p: 1 }];
        self._emit();
      }
      if (ev.type === "finish" && ev.toolCalls && ev.toolCalls.length) {
        ev.toolCalls.forEach(function (tc) {
          if (!tc.name) return;
          let args = {};
          try { args = JSON.parse(tc.args || "{}"); } catch (e) {}
          const result = window.LLMLive.runLocalTool(tc.name, args);
          self.context.push({ role: "tool", text: tc.name + "(" + tc.args + ") \u2192 " + result });
        });
        self._emit();
      }
    });
    if (this.memoryOn) this.memory = this.generated;
  } catch (err) {
    if (err.name !== "AbortError") this.error = String(err.message || err);
  }
  this.running = false;
  this._emit();
};

Harness.prototype.stop = function () {
  this.running = false;
  if (this.live) this.live.stop();
};

window.LLMHarness = Harness;
