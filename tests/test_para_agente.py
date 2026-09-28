import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
AGENT = SITE / "para-agente"


class ParaAgenteTests(unittest.TestCase):
    def test_home_and_agent_page_expose_the_two_audiences(self):
        home = (SITE / "index.html").read_text()
        page = (AGENT / "index.html").read_text()
        self.assertIn('class="af-shell-audience af-type-context"', home)
        self.assertIn('data-audience="humano" aria-current="page">Para humano</a>', home)
        self.assertIn('data-audience="agente">Para agente</a>', home)
        self.assertIn('href="/para-agente/"', home)
        self.assertIn('>Para humano</a>', page)
        self.assertIn('aria-current="page">Para agente</a>', page)

    def test_visible_prompt_is_identical_to_downloadable_prompt(self):
        page = (AGENT / "index.html").read_text()
        start = page.index('<code id="agent-prompt">') + len('<code id="agent-prompt">')
        end = page.index('</code></pre>', start)
        visible = page[start:end].strip()
        downloadable = (AGENT / "prompt.txt").read_text().strip()
        self.assertEqual(visible, downloadable)
        self.assertIn("https://agentsflix.ai/para-agente/manifest.json", visible)
        self.assertIn("target for read_only", visible)
        self.assertIn("installed=false", visible)
        self.assertIn("pare sem improvisar a skill", visible)
        self.assertNotIn("/Users/", visible)
        self.assertNotIn("credentials", visible.lower())

    def test_manifest_routes_each_supported_environment_to_catalog_fields(self):
        manifest = json.loads((AGENT / "manifest.json").read_text())
        self.assertEqual(manifest["schema_version"], 1)
        self.assertEqual(manifest["scope"], "public")
        self.assertFalse(manifest["policy"]["private_repository_access"])
        self.assertFalse(manifest["policy"]["install_all_by_default"])
        self.assertEqual(manifest["llms_url"], "https://agentsflix.ai/llms.txt")
        self.assertEqual(manifest["page_url"], "https://agentsflix.ai/para-agente/")
        self.assertEqual(
            manifest["manifest_url"],
            "https://agentsflix.ai/para-agente/manifest.json",
        )
        targets = {target["id"]: target for target in manifest["targets"]}
        install_targets = {
            target["install_field"]
            for target in targets.values()
            if "install_field" in target
        }
        self.assertEqual(
            install_targets,
            {"install_cmd", "npx_codex", "npx_claude_code", "zip_url", "npx_any"},
        )
        self.assertEqual(targets["chatgpt"]["fallback_field"], "prompt_url")
        self.assertEqual(
            targets["hermes"]["discovery_command"],
            "hermes skills tap add AgentsFlix/skills",
        )
        self.assertEqual(targets["research"]["kind"], "read_only")
        self.assertEqual(targets["research"]["artifact_field"], "prompt_url")
        self.assertNotIn("fallback_field", targets["research"])

    def test_agent_page_has_static_content_and_accessible_controls(self):
        page = (AGENT / "index.html").read_text()
        self.assertIn('role="tablist"', page)
        self.assertEqual(page.count('role="tab"'), 6)
        self.assertIn('role="status" aria-live="polite"', page)
        self.assertIn('<h1 id="page-title">', page)
        self.assertIn('href="manifest.json"', page)
        self.assertIn("Caso você seja um agente de pesquisa, indexação ou execução", page)
        self.assertIn('data-target="research"', page)
        self.assertIn('href="https://agentsflix.ai/llms.txt"', page)
        self.assertNotIn("<iframe", page)

    def test_research_tab_and_copy_fallback_do_not_claim_unverified_actions(self):
        script = (AGENT / "app.js").read_text()
        self.assertIn(
            'research: { label: "Pesquisa / sem terminal", kind: "read_only"',
            script,
        )
        self.assertIn('target.kind === "read_only"', script)
        self.assertIn("entrega a URL para handoff e para sem improvisar", script)
        self.assertIn('copied = document.execCommand("copy")', script)
        self.assertIn("Não foi possível copiar automaticamente", script)

    def test_llms_index_lists_only_public_canonical_routes(self):
        manifest = json.loads((AGENT / "manifest.json").read_text())
        llms = (SITE / "llms.txt").read_text()
        self.assertIn(manifest["verified_at"], llms)
        for field in (
            "page_url",
            "manifest_url",
            "catalog_url",
            "repository_url",
            "prompt_url",
        ):
            self.assertIn(manifest[field], llms)
        self.assertNotIn("AgentsFlix/agentsflix", llms)
        self.assertNotIn("/Users/", llms)


if __name__ == "__main__":
    unittest.main()
