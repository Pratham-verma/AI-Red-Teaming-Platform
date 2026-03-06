#!/usr/bin/env python3
"""Serve the Lumina-Red dashboard from project root."""

import http.server
import socketserver
import webbrowser
from pathlib import Path

PORT = 8080
ROOT = Path(__file__).resolve().parent


def main():
    import os
    os.chdir(ROOT)
    Handler = http.server.SimpleHTTPRequestHandler
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        url = f"http://127.0.0.1:{PORT}/dashboard/"
        print(f"Lumina-Red Dashboard: {url}")
        print("Press Ctrl+C to stop")
        try:
            webbrowser.open(url)
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
