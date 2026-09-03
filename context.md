# Project context

Read this before changing the teaching tool. `AGENTS.md` is the product brief and working rules. This file is the history, decisions, and current constraints.

Repo: https://github.com/thamam/llm-teaching-tool
Owner: thamam
Started: 2026-09-02

## What this is

An interactive classroom tool that shows how an LLM works by adding one capability at a time:

1. **Bare** — next-token prediction
2. **Loop** — autoregressive generation (the harness that keeps calling the model)
3. **Tools** — function calling, with and without tools
4. **Memory** — context that persists across turns, with and without memory

The same mental model must hold in Mock and Live. Do not invent a second UI for the real model.

## How we got here

Work started in a design conversation (often voice), not in code.

1. Product intent: teach internals, not chat.
2. UI first. Figma mock at https://www.figma.com/design/iPxhVN1HW8khNkl2q5Rxox — dark theme, output stage, horizontal control strip, inspector split (context blocks left, candidate bars right).
3. Several layout rounds. Problems that actually happened: overlapping labels, control strip collapsing vertically, context-window text sitting too low and clipping, output box too narrow. Fixes were explicit widths, layoutGrow, and taller output/context frames.
4. Backend choice: not TF.js. Mock uses a scripted transcript plus fake temperature-sensitive bars so the demo stays coherent. Live was added later.
5. Implementation is vanilla JS, no bundler, openable via `python3 server.py`.
6. Repo created under `thamam/llm-teaching-tool` after GitHub was re-authenticated.

## Decisions that should stick

| Decision | Why |
|---|---|
| Tokens are subword-shaped strings, not characters | Character tokens teach the wrong unit. Mock script is `["The", " capital", " of", " France", " is", " Paris", "."]`. |
| Mock stays even after Live works | Groq does not return logprobs. The probability lesson lives in Mock (and in OpenRouter/Together when they actually return top-k). |
| Live goes through `server.py`, never from the browser with a raw key | Keys stay in `.env`. CORS and key leakage both argue for a proxy. |
| Providers: Groq, OpenRouter, Together | Groq for speed. OpenRouter + Together for logprobs and a fallback when Groq blocks or retires a slug. |
| Tool loop is real in Live | Model emits `tool_calls` → local `now` / `add` → `role: tool` message with `tool_call_id` → model called again. Max 4 rounds. |
| Memory is currently “last generated text prepended as a system block” | Placeholder. A summarizer is planned, not built. |
| Honesty over theater | If a provider cannot show a softmax, the inspector says so. Do not fake Live bars. |

## Current architecture

```
index.html   UI shell (dark theme, controls, output, inspector)
app.js       DOM bindings, render(state)
harness.js   stages, mock step/run, Live tool loop, memory flag
model.js     mock scripts + fake candidate distribution
live.js      providers, tool schemas, SSE client, logprob parsing
server.py    static files + POST /api/chat + GET /api/status
.env         keys, gitignored
```

Browser talks only to `/api/chat`. Body includes `provider`. Proxy strips that field, attaches the matching key, and forwards to Groq, OpenRouter, or Together.

Together wants `logprobs` as an integer, not a boolean. The proxy rewrites that.

## UI contract

Control strip: Source (Mock/Live), Provider + model, Stage (Bare/Loop/Tools/Memory), Temperature, Prompt, Step/Run/Reset.

Inspector: colored context blocks; candidate bars in Mock; real top-k when a provider returns logprobs; a note on Groq. Footer key hint from `/api/status`.

## Live models (as of 2026-09-03)

Groq retired `llama-3.1-8b-instant` and `llama-3.3-70b-versatile` on free/developer plans (2026-08-16). Do not put those slugs back.

Current Groq list in `live.js`:

- `openai/gpt-oss-20b` (default)
- `openai/gpt-oss-120b`
- `qwen/qwen3.8-27b`
- `groq/compound-mini`
- `groq/compound`

Skip whisper, prompt-guard, Orpheus. They are not chat models.

## Bugs we already hit

1. **Cloudflare 1010 on Groq.** `urllib` default User-Agent is banned. `server.py` now sends `User-Agent: LLM-Teaching-Tool/0.2`. If 1010 persists, the machine IP is flagged — use curl to confirm, then OpenRouter.
2. **Unknown Groq model.** Hard-coded Llama slugs after the Aug 2026 retirement. Fixed by switching to the list above.
3. **Figma overlap / clipping.** Historical; the HTML layout is the source of truth now.
4. **Character tokens.** First scaffold emitted one character per step. Replaced with subword chips.

## What is not done

- Memory as a running summary instead of raw last reply
- Fetching Groq’s `/v1/models` to populate the dropdown dynamically
- Together/OpenRouter model lists kept in sync with reality
- Compound models use Groq’s built-in tools; our local `now`/`add` loop may not be the right teaching path on those slugs
- Tests
- Build step / bundler (intentionally none)

## How to run

```bash
cp .env.example .env
python3 server.py
# http://127.0.0.1:8765
```

Mock works with no key. Hard-refresh after pulling JS.

## Working style from the owner

- Start from something visible (mock UI, then code).
- Keep the four-stage story intact.
- Prefer a cheap fast model for Live demos; cost should stay in pennies.
- Voice was used for early UX passes; later work is text + GitHub.
- Prefer finishing Live debug on a local coding agent (Grok Code) where the key and server restart are on the same machine.
