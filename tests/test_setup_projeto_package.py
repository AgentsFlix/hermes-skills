"""Integridade e privacidade do pacote público setup-projeto."""

import hashlib
import json
from pathlib import Path
import re
import unittest
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parents[1]
SLUG = "setup-projeto"
VERSION = "1.0.0"
PUBLIC = ROOT / "skills" / SLUG
WELL_KNOWN = ROOT / "docs/.well-known/skills" / SLUG
ZIP = ROOT / "docs/packages" / f"{SLUG}.zip"


def files_under(root: Path) -> dict[str, bytes]:
    return {
        path.relative_to(root).as_posix(): path.read_bytes()
        for path in sorted(root.rglob("*"))
        if path.is_file()
    }


class SetupProjetoPackageTests(unittest.TestCase):
    def assert_integrity(self, root: Path):
        files = files_under(root)
        receipt = json.loads(files["integrity.json"])
        self.assertEqual(receipt["schema_version"], 1)
        self.assertEqual(receipt["version"], VERSION)
        expected = {name for name in files if name != "integrity.json"}
        self.assertEqual(set(receipt["files"]), expected)
        for name, expected_hash in receipt["files"].items():
            self.assertEqual(hashlib.sha256(files[name]).hexdigest(), expected_hash, name)
        return files

    def test_public_and_well_known_integrity_receipts_match_their_trees(self):
        public = self.assert_integrity(PUBLIC)
        well_known = self.assert_integrity(WELL_KNOWN)
        self.assertEqual(set(public), set(well_known))
        self.assertEqual(len(public), 20)

    def test_zip_is_byte_identical_to_well_known_package(self):
        expected = files_under(WELL_KNOWN)
        with ZipFile(ZIP) as archive:
            actual = {
                name.removeprefix(f"{SLUG}/"): archive.read(name)
                for name in archive.namelist()
                if not name.endswith("/")
            }
        self.assertEqual(actual, expected)

    def test_final_surfaces_have_no_personal_paths_or_secret_material(self):
        payload = b"\n".join([
            *files_under(PUBLIC).values(),
            *files_under(WELL_KNOWN).values(),
            (ROOT / f"docs/prompt/{SLUG}.md").read_bytes(),
        ])
        for marker in (b"/Users/", b"C:\\Users\\", b"josecarlosamorim", b"Fotos Pessoais"):
            self.assertNotIn(marker, payload)
        for pattern in (
            rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
            rb"github_pat_[A-Za-z0-9_]{20,}",
            rb"gh[pousr]_[A-Za-z0-9]{20,}",
            rb"sk-[A-Za-z0-9]{20,}",
            rb"AKIA[A-Z0-9]{16}",
            rb"xox[baprs]-[A-Za-z0-9-]{20,}",
        ):
            self.assertIsNone(re.search(pattern, payload), pattern)


if __name__ == "__main__":
    unittest.main()
