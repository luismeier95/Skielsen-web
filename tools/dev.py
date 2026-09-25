"""Serve public/ locally using only the Python standard library."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PUBLIC = Path(__file__).resolve().parents[1] / "public"


class DevHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Bind address (default: 127.0.0.1; use 0.0.0.0 for your local network)",
    )
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    handler = partial(DevHandler, directory=str(PUBLIC))
    with ThreadingHTTPServer((args.host, args.port), handler) as server:
        display_host = "127.0.0.1" if args.host == "0.0.0.0" else args.host
        print(f"Listening on: {args.host}:{server.server_port}", flush=True)
        print(f"App: http://{display_host}:{server.server_port}/", flush=True)
        print("Standalone: /dna-test/ | Stop: Ctrl+C", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
