# Evaluations

Three cases rerun locally on 2026-08-28 after the field-report implementation. Expectations were fixed before each run. Observations below are the recorded results, not edited targets.

| Case | Input | Expected behavior | Observed result | Pass / fail | Evidence |
| --- | --- | --- | --- | --- | --- |
| Intended | `demo/input/domains.md` (calm.com as subject; rootd.io, wysa.com, and animafelix.com as peers) | Produce a one-page field report with paired User-Agent/control proof, normalized capability states, matched peer gaps, evidence receipts, and finding-specific review artifacts | Completed in 11.4 seconds; subject had 5 PASS and 8 WARN across 13 observed findings; GPTBot User-Agent received 403 while browser control received 200; nine matched subject-peer differences across seven capabilities; eight review actions; the llms.txt draft grounded only captured homepage content; robots output required owner policy input; SVG parsed successfully | pass | `demo/output/report.md`, `demo/output/brief.svg`, `demo/output/fix-pack.md`, `demo/output/evidence.json`, `demo/output/audit-0.json` |
| Insufficient evidence | `demo/input/insufficient.md` (non-resolving subject, monday.com peer) | Mark the subject UNKNOWN, keep every subject capability neutral, exclude it from peer gaps, emit no action, and reduce fix artifacts to TODOs | Completed in 9.1 seconds; subject reported UNKNOWN because no browser baseline was available; all subject capability cells were UNKNOWN; monday.com still audited; zero peer gaps and zero actions; llms, robots, and fix pack were TODO-only; SVG remained valid | pass | `demo/output/evals/case2-insufficient-report.md`, `demo/output/evals/case2-insufficient-llms.txt`, `demo/output/evals/case2-insufficient-fix-pack.md`, `demo/output/evals/case2-insufficient-brief.svg` |
| Failure / exclusion / safety | `demo/input/refused.md` (`localhost`, private IP, credentialed URL) | Refuse every entry before any fetch or auditor process | The pure validator refused all three independently with explicit reasons; direct runner validation of `https://127.0.0.1` exited 2 and preserved the previous report byte-for-byte; the safe-origin regression suite passed | pass | `demo/output/evals/case3-refused-stdout.txt`, `.agents/skills/agentmarkup-readiness-gap/scripts/test/safe-origin.test.mjs` |

## Run context

- **Agent:** Codex desktop for the skill path; Node v24.14.0 for the runner and tests.
- **Auditor:** exact pin `@agentmarkup/audit@0.2.5`.
- **When:** 2026-08-28, 19:48-20:24 EEST.
- **Focused regression suite:** 27 tests passed across normalization, matched gaps, UNKNOWN handling, conditional artifacts, input refusal, SVG escaping, accessibility, and bounded layout.
- **Baseline without the skill:** not rerun. A normal chat answer cannot issue paired requests under chosen crawler User-Agent strings and retain their audit evidence.

## Notes

- Audit exit 1 means a usable result with an error finding; it is not a runner failure.
- `notfound.unknown` is normalized to UNKNOWN and never becomes a peer gap or review action.
- `NOT_REPORTED` is neutral. It is never counted as failure or used in comparison.
- Crawler requests use simulated User-Agent identities from the runner host. Verified crawler IP behavior, assistant citations, ranking, traffic, and third-party authority were not tested.
- The safety validator is textual only. DNS resolution and DNS rebinding are outside this run.
