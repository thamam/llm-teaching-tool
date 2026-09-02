// Tiny scoring function + scripted transcript.
// Real TF.js model can replace predict() later without touching the harness.

const VOCAB = "abcdefghijklmnopqrstuvwxyz .,'-?!".split("");

const SCRIPTS = {
  default: "The capital of France is Paris.",
  "capital of france": "The capital of France is Paris.",
  "what is 2+2": "Two plus two equals four.",
};

function getScript(prompt) {
  const key = (prompt || "").trim().toLowerCase();
  for (const k of Object.keys(SCRIPTS)) {
    if (k !== "default" && key.includes(k)) return SCRIPTS[k];
  }
  return SCRIPTS.default;
}

// Temperature-sensitive fake softmax over the vocab.
// Peak sits near the next scripted character so the bars feel related to the output.
function predict(context, temperature, nextChar) {
  const target = (nextChar || " ").toLowerCase();
  const targetIdx = VOCAB.indexOf(target);
  const t = Math.max(0.05, Number(temperature) || 0.7);
  const logits = VOCAB.map((_, i) => {
    const d = targetIdx >= 0 ? Math.abs(i - targetIdx) : i;
    return -d / (0.4 + t * 2);
  });
  const maxL = Math.max.apply(null, logits);
  const exps = logits.map((l) => Math.exp((l - maxL) / t));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

function topN(probs, n) {
  n = n || 6;
  return probs
    .map(function (p, i) {
      return { char: VOCAB[i] === " " ? "\u2423" : VOCAB[i], raw: VOCAB[i], p: p };
    })
    .sort(function (a, b) {
      return b.p - a.p;
    })
    .slice(0, n);
}

window.LLMModel = { VOCAB, getScript, predict, topN };
