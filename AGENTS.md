# AGENTS.md

Instructions for any coding agent working in this repository.

## Read first

1. **`context.md`** — required. History, decisions, current Groq model slugs, known failures (Cloudflare 1010, retired Llama ids). Do not skip it.
2. This file — product definition and rules.
3. `README.md` — how a human runs the demo.

If `context.md` and the code disagree on a *current* fact (model id, provider URL), trust the code and update `context.md` in the same change.

## Product

**LLM Teaching Tool** is a browser demo that teaches how language models work by stacking one mechanism at a time:

| Stage | What the student should see |
|---|---|
| Bare | One next token (or a short Live completion) |
| Loop | Tokens appended in a generation loop |
| Tools | Optional function calls (`now`, `add`) spliced into context |
| Memory | Earlier output sitting in the context window on the next run |

There are two sources:

- **Mock** — scripted subword tokens + a fake, temperature-sensitive candidate distribution. Offline. This is the probability lesson.
- **Live** — Groq / OpenRouter / Together through `server.py`. Real tokens, real tool loop. Logprobs only if the provider returns them.

It is a teaching instrument, not a chatbot. Coherence of the *explanation* beats model quality.

## Stack

Vanilla HTML/JS. No bundler, no framework, no `node_modules`.

| File | Role |
|---|---|
| `index.html` | Shell and CSS |
| `app.js` | Render + events |
| `harness.js` | Stages, mock clock, Live tool loop |
| `model.js` | Mock scripts and fake softmax |
| `live.js` | Providers, SSE, tools, logprob parse |
| `server.py` | Static server + OpenAI-compatible proxy |

## Rules

- Keep Mock and Live on the same UI and the same four stages.
- Do not put API keys in the repo, in JS, or in `context.md`. `.env` is gitignored.
- Do not restore `llama-3.1-8b-instant` or `llama-3.3-70b-versatile` as Groq defaults. They were retired for free/developer accounts on 2026-08-16. Current default: `openai/gpt-oss-20b`.
- Do not invent Live probability bars on Groq. Groq does not support `logprobs`.
- Tokens in Mock are subword-shaped strings, not characters.
- The browser only talks to `/api/chat`. Provider routing stays in `server.py`.
- Prefer small, visible diffs. Match the existing IIFE / `prototype` style. Do not introduce a build step unless asked.
- After a behavioral change, update `context.md` (decisions or “what is not done”). After a product-shape change, update this file too.

## Run

```bash
cp .env.example .env
python3 server.py
```

Open http://127.0.0.1:8765

## Safe demo path

Mock works with no network. For Live, Groq + `openai/gpt-oss-20b` is the intended cheap path. If Groq returns Cloudflare 1010 after the User-Agent fix in `server.py`, switch provider to OpenRouter rather than rewriting the client.
