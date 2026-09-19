#!/usr/bin/env python3
import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from wordfreq import zipf_frequency

DEREWO_URL = "https://raw.githubusercontent.com/cytobi/chelem/main/datasets/derewo/derewo-v-ww-bll-320000g-2012-12-31-1.0/derewo-v-ww-bll-320000g-2012-12-31-1.0.txt"

PRELIM_KEEP = 2.70
PRELIM_REVIEW = 2.20
OCCURRENCE_THRESHOLD = 35.0

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

def fetch_derewo_classes():
    req = urllib.request.Request(DEREWO_URL, headers={"User-Agent": "Skielsen-Wortkette-Audit/1.0"})
    with urllib.request.urlopen(req, timeout=60) as response:
        raw = response.read()
    text = raw.decode("utf-8", errors="replace")
    classes = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        if len(parts) < 2:
            continue
        try:
            hk = int(parts[1])
        except ValueError:
            continue
        word = parts[0].upper()
        classes[word] = min(hk, classes.get(word, hk))
    return classes

def band(score):
    if score >= PRELIM_KEEP:
        return "keep"
    if score >= PRELIM_REVIEW:
        return "review"
    return "drop"

def main():
    targets = fetch_targets()
    derewo = fetch_derewo_classes()
    rows = []
    for row in targets:
        word = str(row["compound_word"])
        score = round(float(zipf_frequency(word.lower(), "de", wordlist="large")), 2)
        hk = derewo.get(word.upper())
        # 0..100 occurrence index. DeReWo is authoritative when available:
        # lower HK = more frequent. wordfreq supplies a secondary modern/web signal.
        derewo_component = 0 if hk is None else max(0, min(100, 100 - 4 * max(0, hk - 5)))
        zipf_component = max(0, min(100, (score - 1.0) * 25))
        occurrence_score = round((0.7 * derewo_component + 0.3 * zipf_component) if hk is not None else zipf_component, 1)
        rows.append({
            "edge_id": int(row["edge_id"]),
            "compound_word": word,
            "zipf": score,
            "derewo_class": hk,
            "occurrence_score": occurrence_score,
            "occurrence_threshold_decision": "keep" if occurrence_score >= OCCURRENCE_THRESHOLD else "drop",
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
        "source": "Composite audit: DeReWo 2013 (DeReKo general-language frequency class) + wordfreq 3.1.1 German large list",
        "license_note": "wordfreq code Apache-2.0; included frequency data CC BY-SA 4.0 / attributed sources.",
        "production_occurrence_threshold": OCCURRENCE_THRESHOLD,
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
