# Evaluations

Three cases, run against the submitted commit on 2026-08-28 during the build window. Expectations were written before running. Observations are what actually happened.

| Case | Input | Expected behavior | Observed result | Pass / fail | Evidence |
| --- | --- | --- | --- | --- | --- |
| Intended | `demo/input/domains.md` (calm.com as "you", headspace.com as competitor) | A gap report grounded in live per-crawler audits, with the raw server response beside every finding, findings triaged by who can actually fix them, plus three draft fix files | calm.com 5 pass / 8 warn / 0 error, headspace.com 12 pass / 2 warn / 0 error; four AI crawlers (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot) received 403 from calm.com while a browser received 200 seconds apart, and headspace.com served all of them; calm.com also publishes no llms.txt and no JSON-LD; triage put three findings on agentmarkup, one on the content owner and four on infrastructure, with third-party authority marked as not measurable here; homepage and robots.txt grounding both HTTP 200, so the drafts carry real site facts | pass | `demo/output/report.md`, `demo/output/llms.txt`, `demo/output/audit-0.json` |
| Insufficient evidence | `demo/input/insufficient.md` (a non-resolving host as "you", headspace.com as competitor) | The primary is marked UNKNOWN and excluded from comparison rather than reported as weak, and the drafts degrade to `[TODO]` stubs instead of inventing site facts | Primary reported UNKNOWN with reason "no browser baseline (crawler.control-failed)", excluded from the comparison and explicitly not called a weakness; competitor still audited normally (12 pass / 2 warn); `llms.txt` and `robots-patch.txt` emitted as `[TODO]` stubs naming the reason; Limitations recorded the failed grounding | pass | `demo/output/evals/case2-insufficient-report.md`, `demo/output/evals/case2-insufficient-llms.txt` |
| Failure / exclusion / safety | `demo/input/refused.md` (`localhost`, `192.168.1.1`, `https://user@evil.test`) | Every entry is refused and no network request is made for any of them | All three entries refused; the run stopped at validation with exit code 2 and made no network request; loopback, private-range and credentialed targets are rejected before any fetch | pass | `demo/output/evals/case3-refused-stdout.txt` |

## Run context

- **Agent:** Codex desktop (ChatGPT app, GPT-5.6 Sol, medium reasoning) for the seed-prompt path; the bundled runner `.agents/skills/agentmarkup-readiness-gap/scripts/run-audits.mjs` on Node v24.13.1 for the three cases above.
- **When:** 2026-08-28, 18:10-19:25 EEST, during the build window.
- **Baseline without the skill:** not run. The comparison of interest is against asking a chat assistant directly, which cannot issue requests under a chosen crawler user-agent and therefore cannot observe these responses at all.

## Notes

- The audit CLI exits 0 even for an unreachable host, so UNKNOWN is detected from the finding content (`crawler.control-failed`), not from the exit code. Case 2 exercises exactly that path.
- Case 3 is enforced twice: the skill refuses invalid entries during validation, and the runner independently rejects any argument that is not a canonical https origin.
