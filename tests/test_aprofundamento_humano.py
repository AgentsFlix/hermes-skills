import json
from pathlib import Path
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
AREA = SITE / "aprofundamento-humano"


class AprofundamentoHumanoTests(unittest.TestCase):
    def test_area_is_reachable_from_the_public_home(self):
        home = (SITE / "index.html").read_text()
        page = (AREA / "index.html").read_text()

        self.assertIn('href="/aprofundamento-humano/" data-section="aprofundamento">Aprofundamento</a>', home)
        self.assertEqual(home.count('data-section="aprofundamento"'), 1)
        self.assertIn('aria-current="page">Aprofundamento humano</a>', page)
        self.assertNotIn('src="../analytics.js"', page)
        self.assertIn("6</strong> assessments disponíveis", page)
        self.assertEqual(page.count("Comece por aqui"), 1)

    def test_catalog_exposes_the_six_available_assessments(self):
        page = (AREA / "index.html").read_text()
        for name in (
            "Perfil DISC",
            "Modos de aprendizagem",
            "Modo de agir",
            "Big Five",
            "Eneagrama",
            "MBTI",
        ):
            self.assertIn(name, page)
        for target in ("disc", "aprendizagem", "acao", "big-five", "eneagrama", "jung"):
            self.assertIn(f'href="#{target}"', page)
        self.assertIn("Não é diagnóstico psicológico", page)
        self.assertIn("Acessa seus resultados", page)

    def test_catalog_reuses_the_approved_manual_spatial_gallery(self):
        page = (AREA / "index.html").read_text()
        catalog = (AREA / "catalog.js").read_text()
        approved = '../design-system/approved.css'

        self.assertIn(f'href="{approved}"', page)
        self.assertGreater(page.index(f'href="{approved}"'), page.index('href="styles.css"'))
        self.assertTrue((SITE / "design-system" / "approved.css").is_file())
        self.assertEqual(page.count('class="af-spatial-card assessment-card"'), 6)
        self.assertEqual(page.count('class="af-spatial-preview"'), 6)
        self.assertIn('class="af-gallery-controls"', page)
        self.assertIn('aria-roledescription="galeria de assessments"', page)
        self.assertIn('aria-live="polite"', page)
        self.assertIn('event.key === "Home"', catalog)
        self.assertIn('event.key === "End"', catalog)
        self.assertIn('"ArrowLeft", "ArrowRight"', catalog)
        self.assertNotIn("setInterval", catalog)
        self.assertNotIn("setTimeout", catalog)

    def test_each_assessment_has_its_own_descriptive_generated_art(self):
        page = (AREA / "index.html").read_text()
        styles = (AREA / "styles.css").read_text()
        assets = {
            "disc": "Pessoa escolhendo uma direção entre quatro possibilidades",
            "aprendizagem": "Pessoa conectando peças de um caminho de aprendizagem",
            "acao": "Pessoa dando o primeiro passo entre blocos",
            "big-five": "Pessoa observando cinco dimensões em equilíbrio",
            "eneagrama": "Pessoa refletindo sobre nove peças conectadas",
            "jung": "Pessoa abrindo duas perspectivas complementares",
        }

        for slug, alt in assets.items():
            with self.subTest(asset=slug):
                self.assertIn(f'src="assets/{slug}.webp"', page)
                self.assertIn(f'alt="{alt}"', page)
                self.assertTrue((AREA / "assets" / f"{slug}.webp").is_file())
        self.assertNotIn('../onboarding/', page)
        self.assertIn(".assessment-gallery .af-spatial-cover::after {\n  content: none;\n}", styles)
        self.assertIn("mix-blend-mode: normal;", styles)
        self.assertIn("opacity: 1;", styles)

    def test_area_consumes_shared_tokens_without_forking_them(self):
        page = (AREA / "index.html").read_text()
        styles = (AREA / "styles.css").read_text()
        shared = '../design-system/tokens.css'

        self.assertIn(f'href="{shared}"', page)
        self.assertLess(page.index(f'href="{shared}"'), page.index('href="styles.css"'))
        self.assertTrue((SITE / "design-system" / "tokens.css").is_file())
        self.assertNotRegex(styles, r"--af-[a-z0-9-]+\s*:")
        for token in ("--af-bg", "--af-text", "--af-panel", "--af-brand", "--af-target"):
            self.assertIn(f"var({token})", styles)

    def test_disc_keeps_the_three_round_scoring_contract(self):
        result = self.run_model(
            """
            const answers = {};
            AgentFlixDiscData.questions.forEach((question, index) => {
              if ([...question.mapping].sort().join('') !== 'CDIS') throw new Error('mapeamento inválido');
              answers[index] = { most: 0, least: 1, somewhat: 2 };
            });
            const scores = AgentFlixDiscModel.score(
              AgentFlixDiscData.questions,
              answers,
              AgentFlixDiscData.weights
            );
            console.log(JSON.stringify({
              questions: AgentFlixDiscData.questions.length,
              rounds: AgentFlixDiscData.rounds.map(round => round.id),
              weights: AgentFlixDiscData.weights,
              scores,
              total: Object.values(scores).reduce((sum, value) => sum + value, 0)
            }));
            """
        )
        self.assertEqual(result["questions"], 10)
        self.assertEqual(result["rounds"], ["most", "least", "somewhat"])
        self.assertEqual(result["weights"], {"most": 5, "least": 0, "somewhat": 2, "unselected": 3})
        self.assertEqual(result["total"], 100)
        self.assertEqual(set(result["scores"]), {"D", "I", "S", "C"})

    def test_answers_stay_in_the_browser_and_sources_compile(self):
        page = (AREA / "index.html").read_text()
        app = (AREA / "disc.js").read_text()
        self.assertIn('id="disc-form" novalidate', page)
        self.assertIn('document.createElement("fieldset")', app)
        self.assertIn("sessionStorage", app)
        self.assertNotIn("fetch(", app)
        self.assertNotIn("XMLHttpRequest", app)
        for path in sorted(AREA.glob("*.js")):
            with self.subTest(path=path.name):
                subprocess.run(["node", "--check", str(path)], check=True, capture_output=True, text=True)

    def run_model(self, body):
        script = f"""
        const fs = require('fs');
        const vm = require('vm');
        global.window = global;
        vm.runInThisContext(fs.readFileSync({json.dumps(str(AREA / 'disc-data.js'))}, 'utf8'));
        vm.runInThisContext(fs.readFileSync({json.dumps(str(AREA / 'disc-model.js'))}, 'utf8'));
        {body}
        """
        completed = subprocess.run(["node", "-e", script], check=True, capture_output=True, text=True)
        return json.loads(completed.stdout)


if __name__ == "__main__":
    unittest.main()
