# LLM Teaching Tool

Interactive demo that teaches how large language models work by building up from the simplest possible model to a full agent harness.

**Repo:** https://github.com/thamam/llm-teaching-tool

## Stages

1. **Bare model** — next-token prediction. Watch the model score the vocabulary and emit one token at a time.
2. **Loop** — each emitted token feeds back into the context so the model generates a full response on its own.
3. **Tools** — the harness can intercept a function-call pattern, run a tool, and splice the result back into the context.
4. **Memory** — toggle a running note that persists across turns. Turn it off and watch the model “forget.”

## Why scripted outputs?

A tiny in-browser model cannot produce coherent sentences. The visible text is a scripted transcript so the demo stays readable. The probability bars are still driven by a live scoring function (temperature-sensitive). That split is the honest part students learn from: *what the model scores* vs *what the harness does with it*.

## Stack

- Vanilla HTML / CSS / JS
- No build step, no framework
- TensorFlow.js can be dropped in later for a real character-level model

## Run

Open `index.html` in a browser. That is it.

## Roadmap

- [x] Phase 0: scaffold + plan
- [x] Phase 1: static UI matching the Figma mockup
- [x] Phase 2: scripted model + live probability bars
- [ ] Phase 3: loop harness polish (stop sequences, max tokens)
- [ ] Phase 4: real tool-call parsing
- [ ] Phase 5: memory summarizer
