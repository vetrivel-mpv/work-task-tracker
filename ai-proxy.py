#!/usr/bin/env python3
"""Tiny CORS proxy for Northstar Delivery AI assist.

Browsers cannot call the Gemini API (or many OpenAI endpoints) directly —
no Access-Control-Allow-Origin. This proxies OpenAI-shaped chat completions
from localhost to Google's OpenAI-compatible Gemini endpoint (or another
upstream you pass).

Usage:
  python3 ai-proxy.py
  # optional: python3 ai-proxy.py 8787
  # optional upstream:
  #   AI_PROXY_UPSTREAM=https://api.openai.com/v1/chat/completions python3 ai-proxy.py

Then in Settings → AI assist:
  Provider: Gemini
  Endpoint: http://127.0.0.1:8787/v1/chat/completions
  API key:  your Google AI Studio key (AIza…)
  Model:    gemini-2.0-flash   (or another Gemini model id)

Chrome / Gemini Pro in the sidebar is NOT used — only an AI Studio API key.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
UPSTREAM = os.environ.get(
    'AI_PROXY_UPSTREAM',
    'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
).rstrip('/')


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header(
            'Access-Control-Allow-Headers',
            'Content-Type, Authorization',
        )

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        if self.path.rstrip('/') not in ('/v1/chat/completions', '/chat/completions', ''):
            self.send_response(404)
            self._cors()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"error":"use POST /v1/chat/completions"}')
            return

        length = int(self.headers.get('Content-Length') or 0)
        body = self.rfile.read(length) if length else b'{}'
        auth = self.headers.get('Authorization') or ''

        req = urllib.request.Request(
            UPSTREAM,
            data=body,
            method='POST',
            headers={
                'Content-Type': 'application/json',
                'Authorization': auth,
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                data = resp.read()
                status = resp.status
        except urllib.error.HTTPError as e:
            data = e.read() or json.dumps({'error': str(e)}).encode()
            status = e.code
        except Exception as e:
            data = json.dumps({'error': str(e)}).encode()
            status = 502

        self.send_response(status)
        self._cors()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        sys.stderr.write('[ai-proxy] ' + (fmt % args) + '\n')


if __name__ == '__main__':
    print(f'AI assist proxy on http://127.0.0.1:{PORT}/v1/chat/completions')
    print(f'  upstream → {UPSTREAM}')
    print('  Leave this running while using Summarize day signals.')
    ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
