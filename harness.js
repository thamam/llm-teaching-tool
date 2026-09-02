// Loop / tools / memory harness. Pure JS.

const TOOLS = {
  now: function () {
    return new Date().toISOString();
  },
  add: function (a, b) {
    return String(Number(a) + Number(b));
  },
};

function Harness() {
  this.stage = "bare";
  this.temperature = 0.7;
  this.memoryOn = false;
  this.memory = "";
  this.prompt = "What is the capital of France?";
  this.script = "";
  this.scriptPos = 0;
  this.generated = "";
  this.context = [];
  this.running = false;
  this.tops = [];
  this.onUpdate = null;
}

Harness.prototype._emit = function () {
  if (this.onUpdate) this.onUpdate(this.state());
};

Harness.prototype.state = function () {
  return {
    stage: this.stage,
    temperature: this.temperature,
    memoryOn: this.memoryOn,
    memory: this.memory,
    prompt: this.prompt,
    generated: this.generated,
    context: this.context,
    running: this.running,
    tops: this.tops,
    done: this.scriptPos >= this.script.length,
  };
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

Harness.prototype.reset = function (prompt) {
  this.stop();
  this.prompt = prompt || this.prompt;
  this.script = window.LLMModel.getScript(this.prompt);
  this.scriptPos = 0;
  this.generated = "";
  this.context = [
    { role: "system", text: "You are a helpful assistant." },
    { role: "user", text: this.prompt },
  ];
  if (this.memoryOn && this.memory) {
    this.context.unshift({ role: "system", text: "Memory: " + this.memory });
  }
  this._refreshTops();
  this._emit();
};

Harness.prototype._nextChar = function () {
  if (this.scriptPos >= this.script.length) return "";
  return this.script.charAt(this.scriptPos);
};

Harness.prototype._refreshTops = function () {
  const next = this._nextChar() || ".";
  const ctxText = this.context.map(function (c) { return c.text; }).join(" ") + this.generated;
  const probs = window.LLMModel.predict(ctxText, this.temperature, next);
  this.tops = window.LLMModel.topN(probs, 6);
};

Harness.prototype.step = function () {
  if (this.scriptPos >= this.script.length) {
    this.running = false;
    this._emit();
    return null;
  }
  const ch = this._nextChar();
  this.scriptPos += 1;
  this.generated += ch;

  const last = this.context[this.context.length - 1];
  if (last && last.role === "model") {
    last.text += ch;
  } else {
    this.context.push({ role: "model", text: ch });
  }

  if (this.stage === "tools" && this.scriptPos === this.script.length) {
    const result = TOOLS.now();
    this.context.push({ role: "tool", text: "now() \u2192 " + result });
  }

  if (this.memoryOn && this.scriptPos === this.script.length) {
    this.memory = this.generated;
  }

  this._refreshTops();
  this._emit();
  return ch;
};

Harness.prototype.run = function (maxTokens) {
  const self = this;
  if (this.running) return;
  this.running = true;
  this._emit();
  const limit = maxTokens || 80;
  let i = 0;
  function tick() {
    if (!self.running || i >= limit || self.scriptPos >= self.script.length) {
      self.running = false;
      self._emit();
      return;
    }
    self.step();
    i += 1;
    setTimeout(tick, 90);
  }
  tick();
};

Harness.prototype.stop = function () {
  this.running = false;
};

window.LLMHarness = Harness;
window.LLMTools = TOOLS;
