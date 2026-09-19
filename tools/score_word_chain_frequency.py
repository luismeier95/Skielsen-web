#!/usr/bin/env python3
import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from wordfreq import zipf_frequency

PRELIM_KEEP = 2.70
PRELIM_REVIEW = 2.20

def db_config():
    text = Path("public/assets/js/06-db-bootstrap.js").read_text(encoding="utf-8")
    url = re.search(r"https://[a-z0-9]+\.supabase\.co", text)
    key = re.search(r"sb_publishable_[A-Za-z0-9_-]+", text)
    if not url or not key:
        raise RuntimeError("Supabase public config not found")
    return url.group(0), key.group(0)

def fetch_targets():
    supabase_url, supabase_key = db_config()
    req = urllib.request.Request(
        supabase_url + "/rest/v1/rpc/get_word_chain_frequency_targets",
        method="POST",
        data=b"{}",
        headers={
            "apikey": supabase_key,
            "Authorization": "Bearer " + supabase_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))

def band(score):
    if score >= PRELIM_KEEP:
        return "keep"
    if score >= PRELIM_REVIEW:
        return "review"
    return "drop"

def main():
    targets = fetch_targets()
    rows = []
    for row in targets:
        word = str(row["compound_word"])
        score = round(float(zipf_frequency(word, "de", wordlist="large")), 2)
        rows.append({
            "edge_id": int(row["edge_id"]),
            "compound_word": word,
            "zipf": score,
            "preliminary_decision": band(score),
        })

    rows.sort(key=lambda r: (-r["zipf"], r["compound_word"]))
    scores = [r["zipf"] for r in rows]
    hist = {}
    for r in rows:
        hist[r["preliminary_decision"]] = hist.get(r["preliminary_decision"], 0) + 1

    named = {}
    for name in ("HUNDELEINE", "HUNDESPORT"):
        named[name] = next((r for r in rows if r["compound_word"] == name), None)

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": "wordfreq 3.1.1, German large list; multi-source corpus snapshot through about 2021",
        "license_note": "wordfreq code Apache-2.0; included frequency data CC BY-SA 4.0 / attributed sources.",
        "preliminary_thresholds": {
            "keep_min_zipf": PRELIM_KEEP,
            "review_min_zipf": PRELIM_REVIEW,
            "drop_below_zipf": PRELIM_REVIEW,
        },
        "summary": {
            "count": len(rows),
            "min_zipf": min(scores) if scores else None,
            "max_zipf": max(scores) if scores else None,
            "bands": hist,
            "named_examples": named,
        },
        "rows": rows,
    }

    out = Path("data/wortkette-frequency-audit.json")
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload["summary"], ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
