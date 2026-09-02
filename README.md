# LLM Teaching Tool

Interactive demo: next-token prediction, the generation loop, tools, and memory.

**Repo:** https://github.com/thamam/llm-teaching-tool

## Sources

- **Mock** — scripted subword tokens + candidate bars. Offline.
- **Live** — Groq, OpenRouter, or Together through a local proxy.

Groq is fastest but has no logprobs. OpenRouter and Together can return top-k logprobs, so the inspector bars are real on those paths.

## Tool loop

On the Tools stage, Live sends function schemas (`now`, `add`). If the model emits `tool_calls`, the harness runs them locally, appends a `tool` message, and calls the model again until it answers in text. Max four rounds.

## Run

```bash
cp .env.example .env
# fill any keys you have — you only need one provider
python3 server.py
```

Open http://127.0.0.1:8765

The footer shows which keys loaded.

## Models

| Provider    | Default                          | Logprobs |
|-------------|----------------------------------|----------|
| Groq        | llama-3.1-8b-instant             | no       |
| OpenRouter  | openai/gpt-4o-mini               | yes*     |
| Together    | Meta-Llama-3.1-8B-Instruct-Turbo | yes      |

*Depends on the routed model. If a model rejects `logprobs`, text still streams.
