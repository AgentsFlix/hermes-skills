"""Keep the approved series artwork and its complete-scene layout together."""
import hashlib
import json
from pathlib import Path
import unittest


ASSISTIR = Path(__file__).resolve().parents[1] / "site" / "assistir"
APPROVED = {
    "agente-pessoal": ("agente-pessoal-v1.webp", "0f0c2ef8d546b9f85b7e5fd776cfe6d7d081903051809c5fa169cd386265032d"),
    "hermes-agent": ("hermes-agent-v2.webp", "1659850113b412589fb21b8f14a7bc9911bc3ca48afaf763de9fab1166e86028"),
    "hermes-em-operacao": ("hermes-operacao-v1.webp", "f7fc945b026fa61dc82faba50f266d782e5d944c3cd04338513c1a8a62ba406a"),
}


class ApprovedSeriesCovers(unittest.TestCase):
    def test_catalog_uses_approved_originals_without_legacy_mobile_override(self):
        series = {s["slug"]: s for s in json.loads((ASSISTIR / "series.json").read_text())["series"]}
        for slug, (filename, expected_hash) in APPROVED.items():
            with self.subTest(slug=slug):
                row = series[slug]
                path = "img/editorial/" + filename
                self.assertEqual(row["cover"], path)
                self.assertEqual(row["cover_wide"], path)
                self.assertEqual(row["cover_layout"], "editorial-wide")
                self.assertFalse(row.get("cover_mobile"))
                data = (ASSISTIR / path).read_bytes()
                self.assertEqual(hashlib.sha256(data).hexdigest(), expected_hash)
                self.assertLess(len(data), 400 * 1024)

    def test_catalog_and_player_support_complete_scene_layout(self):
        for filename in ("catalog.js", "player.js"):
            source = (ASSISTIR / filename).read_text()
            self.assertIn('cover_layout === "editorial-wide"', source)
            self.assertIn("has-editorial-cover", source)
        css = (ASSISTIR / "series-covers.css").read_text()
        self.assertIn('.has-editorial-cover .series-cover img', css)
        self.assertIn('object-fit: contain', css)
        self.assertIn('.has-editorial-cover .watch-hero-copy', css)


if __name__ == "__main__":
    unittest.main()
