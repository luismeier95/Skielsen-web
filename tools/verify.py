"""Run static validation and JavaScript syntax checks without executing app code."""
import argparse
from html.parser import HTMLParser
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


class InlineScripts(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.active = None
        self.scripts = []

    def handle_starttag(self, tag, attrs):
        if tag != "script":
            return
        attrs = dict(attrs)
        kind = attrs.get("type", "").strip().lower()
        if "src" not in attrs and kind in (
            "", "module", "text/javascript", "application/javascript",
        ):
            self.active = (self.getpos()[0], kind == "module", [])

    def handle_data(self, data):
        if self.active is not None:
            self.active[2].append(data)

    def handle_endtag(self, tag):
        if tag == "script" and self.active is not None:
            self.scripts.append(self.active)
            self.active = None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--syntax-only", action="store_true")
    args = parser.parse_args()
    node = shutil.which("node")
    if not node:
        print("ERROR: Node.js must be available on PATH.", file=sys.stderr)
        return 1

    failures = 0
    if not args.syntax_only:
        print("Static validation", flush=True)
        result = subprocess.run([sys.executable, str(ROOT / "tools/validate_static.py")], cwd=ROOT)
        failures += result.returncode != 0

    files = sorted(p for p in (ROOT / "public").rglob("*")
                   if p.suffix.lower() in {".js", ".mjs", ".cjs"} and p.is_file())
    for path in files:
        print(f"Syntax: {path.relative_to(ROOT)}", flush=True)
        failures += subprocess.run([node, "--check", str(path)], cwd=ROOT).returncode != 0

    inline_count = 0
    for folder in ("public", "docs"):
        for path in sorted((ROOT / folder).rglob("*.html")):
            scripts = InlineScripts()
            scripts.feed(path.read_text(encoding="utf-8-sig"))
            scripts.close()
            for line, module, chunks in scripts.scripts:
                source = "".join(chunks)
                if not source.strip():
                    continue
                inline_count += 1
                print(f"Inline syntax: {path.relative_to(ROOT)}:{line}", flush=True)
                mode = "module" if module else "commonjs"
                result = subprocess.run(
                    [node, "--check", f"--input-type={mode}"], input=source,
                    encoding="utf-8", cwd=ROOT,
                )
                failures += result.returncode != 0

    print(f"Checked {len(files)} JS files and {inline_count} inline scripts; failures: {failures}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
