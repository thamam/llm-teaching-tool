#!/usr/bin/env python3
"""Serve the teaching tool and proxy Groq / OpenRouter / Together."""
from __future__ import annotations
import json, os, urllib.error, urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = int(os.environ.get("PORT", "8765"))
PROVIDERS = {
    "groq": {"url": "https://api.groq.com/openai/v1/chat/completions", "key_names": ("GROQ_API_KEY",), "logprobs": False, "headers": {}},
    "openrouter": {"url": "https://openrouter.ai/api/v1/chat/completions", "key_names": ("OPENROUTER_API_KEY",), "logprobs": True, "headers": {"HTTP-Referer": "http://127.0.0.1:8765", "X-Title": "LLM Teaching Tool"}},
    "together": {"url": "https://api.together.xyz/v1/chat/completions", "key_names": ("TOGETHER_API_KEY",), "logprobs": True, "headers": {}},
}

def load_env_file():
    out = {}
    env_file = ROOT / ".env"
    if not env_file.exists():
        return out
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out

ENV_FILE = load_env_file()

def get_key(names):
    for name in names:
        val = os.environ.get(name, "").strip() or ENV_FILE.get(name, "").strip()
        if val:
            return val
    return ""

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def log_message(self, fmt, *args):
        print("[%s] %s" % (self.log_date_time_string(), fmt % args))
    def end_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    def do_OPTIONS(self):
        self.send_response(204); self.end_cors(); self.end_headers()
    def do_GET(self):
        if self.path.rstrip("/") == "/api/status":
            status = {name: bool(get_key(cfg["key_names"])) for name, cfg in PROVIDERS.items()}
            self._json(200, {"providers": status}); return
        return super().do_GET()
    def do_POST(self):
        if self.path.rstrip("/") != "/api/chat":
            self.send_error(404); return
        raw = self.rfile.read(int(self.headers.get("Content-Length", "0")))
        try:
            body = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            self._json(400, {"error": "invalid json"}); return
        provider = (body.pop("provider", None) or "groq").lower()
        if provider not in PROVIDERS:
            self._json(400, {"error": "unknown provider: " + provider}); return
        cfg = PROVIDERS[provider]
        key = get_key(cfg["key_names"])
        if not key:
            self._json(500, {"error": "No API key for %s. Set %s in .env" % (provider, cfg["key_names"][0])}); return
        if cfg["logprobs"] and body.get("logprobs") is True and provider == "together":
            body["logprobs"] = int(body.get("top_logprobs") or 5)
            body.pop("top_logprobs", None)
        if not cfg["logprobs"]:
            body.pop("logprobs", None); body.pop("top_logprobs", None)
        headers = {"Authorization": "Bearer " + key, "Content-Type": "application/json"}
        headers.update(cfg["headers"])
        req = urllib.request.Request(cfg["url"], data=json.dumps(body).encode("utf-8"), headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                self.send_response(resp.status); self.end_cors()
                self.send_header("Content-Type", resp.headers.get("Content-Type", "application/json")); self.end_headers()
                while True:
                    chunk = resp.read(4096)
                    if not chunk: break
                    self.wfile.write(chunk)
        except urllib.error.HTTPError as err:
            payload = err.read()
            self.send_response(err.code); self.end_cors()
            self.send_header("Content-Type", "application/json"); self.end_headers()
            self.wfile.write(payload or json.dumps({"error": str(err)}).encode())
        except Exception as err:
            self._json(502, {"error": str(err)})
    def _json(self, code, obj):
        data = json.dumps(obj).encode("utf-8")
        self.send_response(code); self.end_cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data))); self.end_headers()
        self.wfile.write(data)

if __name__ == "__main__":
    os.chdir(ROOT)
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("LLM Teaching Tool  ->  http://127.0.0.1:%s" % PORT)
    for name, cfg in PROVIDERS.items():
        print("  %-12s %s" % (name, "ready" if get_key(cfg["key_names"]) else "no key"))
    httpd.serve_forever()
