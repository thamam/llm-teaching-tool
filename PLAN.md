# Implementation Plan

Four phases after the scaffold. Each phase is a working, demoable increment.

## Phase 0 — Scaffold (this commit)

- Repo, README, this plan.
- Decision: scripted visible output + live scoring for probability bars.

## Phase 1 — Static UI

- Three-zone layout from the Figma mockup:
  - Header with stage badge
  - Streaming output stage
  - Control strip: stage selector, temperature, Step / Run / Reset
  - Inspector: context window (colored blocks) + probability bars
- Dark theme.

## Phase 2 — Scripted model + probabilities

- `model.js`: `predict(context, temperature)` returns a softmax-like distribution over a small vocab.
- Temperature slider re-weights the distribution (bars change live).
- Step = one token from the script; Run = tokens on a timer.

## Phase 3 — Loop harness

- `harness.js`: `generate(prompt, {maxTokens})` feeds each token back into context.
- Toggle Bare (single token, wait for Step) vs Loop (autonomous until stop).

## Phase 4 — Tools

- Register tools as plain JS functions.
- When the script emits a tool-call marker, the harness runs the function and injects a tool-result block.

## Phase 5 — Memory

- A `memory` string prepended on every new turn.
- Toggle on/off so students can see forgetting.

## Out of scope for v1

- Training UI
- Bundler
- Mobile polish
