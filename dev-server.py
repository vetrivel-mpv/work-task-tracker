#!/usr/bin/env python3
"""Same as `python3 -m http.server`, except every response carries
Cache-Control: no-store — so editing a .js/.css file and reloading the
browser always gets the current version instead of a stale cached copy.
Plain http.server sends no cache headers at all, which leaves the browser
free to serve old JS from its own heuristic cache after repeated visits —
exactly the kind of "my fix isn't showing up" confusion this avoids.
"""
import http.server
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        super().end_headers()


if __name__ == '__main__':
    with socketserver.TCPServer(('', PORT), NoCacheHandler) as httpd:
        print(f'Northstar Delivery running at http://localhost:{PORT} (caching disabled)')
        httpd.serve_forever()
