# LLM Teaching Tool

Interactive demo that teaches how LLMs work: next-token prediction, the generation loop, tools, and memory.

**Repo:** https://github.com/thamam/llm-teaching-tool

## Two sources

- **Mock** — scripted *subword* tokens plus a fake candidate distribution. Use this to teach “the model scores a vocabulary.” Works offline.
- **Live Groq** — a real fast model with streaming. Use this so students see actual tokens, tool calls, and temperature. Costs pennies.

Groq does **not** return logprobs. In Live mode the inspector shows the streamed token, not a full softmax. That is honest. Mock is where the probability bars earn their keep.

## Run

```bash
cp .env.example .env
# paste your Groq key into .env
python3 server.py
```

Open http://127.0.0.1:8765

Without a key, Mock still works.

## Controls

- **Step** — one mock token, or a short Live completion.
- **Run** — play the script, or stream a full Groq reply.
- **Bare / Loop / Tools / Memory** — same mental model in both sources.
- Default Live model: `llama-3.1-8b-instant`.

## Why a local proxy

The browser talks to `/api/chat`. `server.py` forwards to Groq. The key stays on your machine.

## Roadmap

- [x] Mock subword tokens + candidate bars
- [x] Live Groq streaming via local proxy
- [ ] Together / DeepInfra path if we want real top-k logprobs
- [ ] Proper tool-call loop (model sees the tool result and continues)
- [ ] Memory summarizer instead of raw last reply
