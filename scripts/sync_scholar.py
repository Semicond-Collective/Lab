#!/usr/bin/env python3
"""Refresh the site's publication snapshot from a public Google Scholar profile."""

import argparse
import csv
import hashlib
import json
import re
import sys
import unicodedata
from datetime import datetime, timezone
from itertools import islice
from pathlib import Path
from urllib.parse import parse_qs, quote, urlencode, urlparse


ROOT = Path(__file__).resolve().parents[1]
PROFILE_PATH = ROOT / "scholar-profile.json"
OUTPUT_PATH = ROOT / "data" / "publications.json"


def scholar_id_from_url(profile_url):
    parsed = urlparse(profile_url)
    if parsed.netloc not in {"scholar.google.com", "scholar.google.it"} or parsed.path != "/citations":
        raise ValueError("Use a public Google Scholar citations profile URL.")
    scholar_id = parse_qs(parsed.query).get("user", [""])[0]
    if not re.fullmatch(r"[A-Za-z0-9_-]{8,20}", scholar_id):
        raise ValueError("The Google Scholar profile URL has no valid user ID.")
    return scholar_id


def normalized_key(value):
    value = unicodedata.normalize("NFKD", str(value or ""))
    value = "".join(char for char in value if not unicodedata.combining(char))
    return re.sub(r"\s+", " ", value.casefold()).strip()


def stable_id(title, year):
    key = f"{normalized_key(title)}|{year or ''}"
    return "pub-" + hashlib.sha256(key.encode("utf-8")).hexdigest()[:16]


def safe_https(url):
    parsed = urlparse(str(url or ""))
    return url if parsed.scheme == "https" and parsed.netloc else None


def publication_from_scholarly(publication, scholar_id):
    bib = publication.get("bib") or {}
    title = str(bib.get("title") or "").strip()
    if not title:
        return None
    year_text = str(bib.get("pub_year") or bib.get("year") or "").strip()
    year = int(year_text) if re.fullmatch(r"\d{4}", year_text) else None
    authors = bib.get("author") or ""
    if isinstance(authors, list):
        authors = ", ".join(authors)
    venue = bib.get("venue") or bib.get("journal") or bib.get("conference") or ""
    profile_publication_id = publication.get("author_pub_id")
    scholar_url = None
    if profile_publication_id:
        scholar_url = (
            "https://scholar.google.com/citations?view_op=view_citation"
            f"&user={quote(scholar_id)}&citation_for_view={quote(profile_publication_id, safe=':')}"
        )
    url = safe_https(publication.get("pub_url")) or scholar_url
    return {
        "id": stable_id(title, year),
        "title": title,
        "authors": str(authors).strip(),
        "venue": str(venue).strip(),
        "year": year,
        "url": url or f"https://scholar.google.com/citations?user={quote(scholar_id)}",
    }


def publications_from_profile(scholar_id):
    from scholarly import scholarly

    author = scholarly.search_author_id(scholar_id)
    name = normalized_key(author.get("name"))
    if name != "marcello righetto":
        raise ValueError(f"Scholar profile is for {author.get('name')!r}, not Marcello Righetto.")
    author = scholarly.fill(author, sections=["publications"])
    return [publication_from_scholarly(item, scholar_id) for item in author.get("publications", [])]


def select_profile(candidates):
    affiliations = ("padova", "padua", "oxford", "university college london", "nanyang")
    matches = [
        candidate for candidate in candidates
        if normalized_key(candidate.get("name")) == "marcello righetto"
        and any(place in normalized_key(candidate.get("affiliation")) for place in affiliations)
        and candidate.get("scholar_id")
    ]
    if len(matches) != 1:
        raise ValueError("Could not identify one unambiguous Marcello Righetto Scholar profile; set profile_url manually.")
    return matches[0]["scholar_id"]


def discover_profile_id():
    from scholarly import scholarly

    return select_profile(list(islice(scholarly.search_author("Marcello Righetto"), 10)))


def publications_from_csv(csv_path, scholar_id):
    with csv_path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        rows = []
        for row in reader:
            fields = {str(key).strip().casefold(): value for key, value in row.items() if key}
            title = (fields.get("title") or "").strip()
            if not title:
                continue
            year_text = (fields.get("year") or "").strip()
            year = int(year_text) if re.fullmatch(r"\d{4}", year_text) else None
            rows.append({
                "id": stable_id(title, year),
                "title": title,
                "authors": (fields.get("authors") or fields.get("author") or "").strip(),
                "venue": (fields.get("publication") or fields.get("journal") or fields.get("venue") or "").strip(),
                "year": year,
                "url": safe_https(fields.get("url") or fields.get("link"))
                or f"https://scholar.google.com/scholar?{urlencode({'q': title})}",
            })
    return rows


def prepare_snapshot(publications, profile_url, previous_count=0):
    ordered = sorted(
        (publication.copy() for publication in publications if publication),
        key=lambda item: (-(item["year"] or 0), normalized_key(item["title"])),
    )
    if not ordered:
        raise ValueError("Scholar returned no publications; keeping the previous snapshot.")
    if previous_count >= 10 and len(ordered) < previous_count * 0.75:
        raise ValueError("Scholar returned a substantially shorter list; keeping the previous snapshot.")
    seen = {}
    for publication in ordered:
        base_id = publication["id"]
        seen[base_id] = seen.get(base_id, 0) + 1
        if seen[base_id] > 1:
            publication["id"] = f"{base_id}-{seen[base_id]}"
    return {
        "source": "Google Scholar",
        "profile_url": profile_url,
        "synced_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "publications": ordered,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", type=Path, help="Import a Google Scholar CSV export instead of fetching the profile")
    args = parser.parse_args(argv)
    config = json.loads(PROFILE_PATH.read_text(encoding="utf-8"))
    prior = json.loads(OUTPUT_PATH.read_text(encoding="utf-8")) if OUTPUT_PATH.exists() else {}
    profile_url = config.get("profile_url", "").strip() or (prior.get("profile_url") or "")
    if profile_url:
        scholar_id = scholar_id_from_url(profile_url)
    elif args.csv:
        raise ValueError("Set profile_url in scholar-profile.json before importing CSV.")
    else:
        scholar_id = discover_profile_id()
        profile_url = f"https://scholar.google.com/citations?user={scholar_id}"
        print(f"Discovered Google Scholar profile {scholar_id}.")
    previous_count = len(prior.get("publications", [])) if prior.get("source") == "Google Scholar" else 0
    publications = publications_from_csv(args.csv, scholar_id) if args.csv else publications_from_profile(scholar_id)
    snapshot = prepare_snapshot(publications, f"https://scholar.google.com/citations?user={scholar_id}", previous_count)
    OUTPUT_PATH.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if not config.get("profile_url"):
        PROFILE_PATH.write_text(json.dumps({"profile_url": snapshot["profile_url"]}, indent=2) + "\n", encoding="utf-8")
    print(f"Saved {len(snapshot['publications'])} Google Scholar publications.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as error:
        print(f"Scholar refresh failed: {error}", file=sys.stderr)
        sys.exit(1)
