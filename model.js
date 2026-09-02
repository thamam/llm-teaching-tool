// Mock model: scripted *subword* tokens + a fake temperature-sensitive distribution.
// Live generation lives in live.js (Groq). Mock stays so students can see a full candidate set.

const CANDIDATES = {
  start: [
    { tok: "The", p: 0.62 },
    { tok: "Paris", p: 0.14 },
    { tok: "France", p: 0.08 },
    { tok: "It", p: 0.07 },
    { tok: "A", p: 0.05 },
    { tok: "Capital", p: 0.04 },
  ],
  "The": [
    { tok: " capital", p: 0.71 },
    { tok: " city", p: 0.12 },
    { tok: " country", p: 0.08 },
    { tok: " answer", p: 0.05 },
    { tok: " official", p: 0.03 },
    { tok: " main", p: 0.01 },
  ],
  " capital": [
    { tok: " of", p: 0.88 },
    { tok: " city", p: 0.06 },
    { tok: " is", p: 0.03 },
    { tok: ",", p: 0.02 },
    { tok: " in", p: 0.01 },
  ],
  " of": [
    { tok: " France", p: 0.81 },
    { tok: " the", p: 0.09 },
    { tok: " Paris", p: 0.05 },
    { tok: " Europe", p: 0.03 },
    { tok: " a", p: 0.02 },
  ],
  " France": [
    { tok: " is", p: 0.77 },
    { tok: "?", p: 0.08 },
    { tok: ",", p: 0.07 },
    { tok: " was", p: 0.05 },
    { tok: ".", p: 0.03 },
  ],
  " is": [
    { tok: " Paris", p: 0.64 },
    { tok: " Lyon", p: 0.14 },
    { tok: " Marseille", p: 0.08 },
    { tok: " Nice", p: 0.06 },
    { tok: " Toulouse", p: 0.05 },
    { tok: " Bordeaux", p: 0.03 },
  ],
  " Paris": [
    { tok: ".", p: 0.72 },
    { tok: ",", p: 0.14 },
    { tok: "!", p: 0.06 },
    { tok: " —", p: 0.05 },
    { tok: " and", p: 0.03 },
  ],
};

const SCRIPTS = {
  default: ["The", " capital", " of", " France", " is", " Paris", "."],
  "capital of france": ["The", " capital", " of", " France", " is", " Paris", "."],
  "what is 2+2": ["Two", " plus", " two", " equals", " four", "."],
};

function getScript(prompt) {
  const key = (prompt || "").trim().toLowerCase();
  for (const k of Object.keys(SCRIPTS)) {
    if (k !== "default" && key.includes(k)) return SCRIPTS[k].slice();
  }
  return SCRIPTS.default.slice();
}

function softmaxTemps(rows, temperature) {
  const t = Math.max(0.05, Number(temperature) || 0.7);
  const scaled = rows.map(function (r) {
    return { tok: r.tok, w: Math.pow(Math.max(r.p, 1e-6), 1 / t) };
  });
  const sum = scaled.reduce(function (a, b) { return a + b.w; }, 0);
  return scaled
    .map(function (r) { return { tok: r.tok, p: r.w / sum }; })
    .sort(function (a, b) { return b.p - a.p; });
}

function predictTokens(lastTok, temperature) {
  const rows = CANDIDATES[lastTok] || CANDIDATES.start;
  return softmaxTemps(rows, temperature);
}

window.LLMModel = { getScript, predictTokens, CANDIDATES };
