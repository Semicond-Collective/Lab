import csv
import tempfile
import unittest
from pathlib import Path

from scripts.sync_scholar import (
    prepare_snapshot,
    publication_from_scholarly,
    publications_from_csv,
    scholar_id_from_url,
    select_profile,
    stable_id,
)


class ScholarSyncTests(unittest.TestCase):
    def test_profile_url_extracts_id(self):
        self.assertEqual(
            scholar_id_from_url("https://scholar.google.com/citations?user=Smr99uEAAAAJ&hl=en"),
            "Smr99uEAAAAJ",
        )
        self.assertEqual(
            scholar_id_from_url("https://scholar.google.it/citations?user=2q1-iQUAAAAJ&hl=it"),
            "2q1-iQUAAAAJ",
        )

    def test_publication_is_normalized(self):
        item = publication_from_scholarly(
            {
                "bib": {
                    "title": "Light in Motion",
                    "author": ["M Righetto", "A Researcher"],
                    "pub_year": "2026",
                    "venue": "Journal of Materials",
                },
                "author_pub_id": "Smr99uEAAAAJ:abc123",
            },
            "Smr99uEAAAAJ",
        )
        self.assertEqual(item["id"], stable_id("Light in Motion", 2026))
        self.assertEqual(item["authors"], "M Righetto, A Researcher")
        self.assertIn("citation_for_view=Smr99uEAAAAJ:abc123", item["url"])

    def test_csv_import_and_partial_response_guard(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "scholar.csv"
            with path.open("w", newline="", encoding="utf-8") as handle:
                writer = csv.DictWriter(handle, fieldnames=["Title", "Authors", "Publication", "Year"])
                writer.writeheader()
                writer.writerow({"Title": "A paper", "Authors": "M Righetto", "Publication": "Nature", "Year": "2026"})
            items = publications_from_csv(path, "Smr99uEAAAAJ")
            self.assertEqual(len(items), 1)
            self.assertEqual(items[0]["venue"], "Nature")
            with self.assertRaisesRegex(ValueError, "shorter list"):
                prepare_snapshot(items, "https://scholar.google.com/citations?user=Smr99uEAAAAJ", previous_count=20)

    def test_duplicate_profile_rows_are_kept(self):
        item = {
            "id": stable_id("Same paper", 2024),
            "title": "Same paper",
            "authors": "M Righetto",
            "venue": "A journal",
            "year": 2024,
            "url": "https://example.com/paper",
        }
        snapshot = prepare_snapshot([item, item], "https://scholar.google.com/citations?user=Smr99uEAAAAJ")
        self.assertEqual(len(snapshot["publications"]), 2)
        self.assertNotEqual(snapshot["publications"][0]["id"], snapshot["publications"][1]["id"])

    def test_profile_discovery_rejects_ambiguous_matches(self):
        candidates = [{"name": "Marcello Righetto", "affiliation": "University of Padova", "scholar_id": "Smr99uEAAAAJ"}]
        self.assertEqual(select_profile(candidates), "Smr99uEAAAAJ")
        with self.assertRaisesRegex(ValueError, "unambiguous"):
            select_profile(candidates + [{"name": "Marcello Righetto", "affiliation": "Oxford", "scholar_id": "AnotherAAAAAJ"}])


if __name__ == "__main__":
    unittest.main()
