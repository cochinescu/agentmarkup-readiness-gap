# AgentMarkup field report

Generated 2026-08-28T17:05:30.118Z from @agentmarkup/audit@0.2.5. Subject: https://nonexistent-zz9x7q-skillathon.example.com. Compared with: https://monday.com.

## Outcome

**No access conclusion: no browser baseline (crawler.control-failed)**

Observed subject findings: 0 PASS, 4 WARN, 0 ERROR, 0 UNKNOWN, 4 total. A capability with no emitted finding is NOT_REPORTED. No shared denominator or readiness score is calculated.

![AgentMarkup field report with paired request proof and first review actions](brief.svg)

## Live proof: same URL, two request identities

| Request identity | Observed response | Evidence receipt |
| --- | --- | --- |
| Browser control | UNKNOWN | NOT_REPORTED |
| crawler identity User-Agent | UNKNOWN | NOT_REPORTED |

No conclusion — the browser control was unavailable.

These are simulated User-Agent requests from this runner. Verified crawler IP access was not tested.

## Machine-readable surface

| Capability | nonexistent-zz9x7q-skillathon.example.com | monday.com |
| --- | --- | --- |
| GPTBot User-Agent access | UNKNOWN | PASS (E-35c57071a184) |
| OAI-SearchBot User-Agent access | UNKNOWN | PASS (E-3a6824315911) |
| ClaudeBot User-Agent access | UNKNOWN | PASS (E-b8d38f968983) |
| PerplexityBot User-Agent access | UNKNOWN | PASS (E-deeda7915245) |
| Google-Extended User-Agent access | UNKNOWN | PASS (E-fca50e040f4d) |
| Content without JavaScript | UNKNOWN | PASS (E-4621f5424674) |
| robots.txt crawler policy | UNKNOWN | PASS (E-a3d801864098) |
| Content-Signal policy | UNKNOWN | PASS (E-de9039fdcffd) |
| llms.txt manifest | UNKNOWN | PASS (E-03bb6a7d65a8) |
| llms.txt homepage discovery | UNKNOWN | WARN (E-497e3df14aa6) |
| JSON-LD structured data | UNKNOWN | PASS (E-cf6a106f3ce6) |
| Markdown alternate | UNKNOWN | NOT_REPORTED |
| Sitemap discovery | UNKNOWN | PASS (E-7100b74ea517) |
| Core page metadata | UNKNOWN | PASS (E-44d11b97d797) |
| Missing-path HTTP behavior | UNKNOWN | PASS (E-64c80bf750e9) |

## Matched peer differences

No comparable capability was WARN or ERROR for the subject while explicitly PASS for a peer.

## Action queue

UNKNOWN — no browser baseline (crawler.control-failed)

## Generated review pack

- `brief.svg` — one-page stage visual; `report.md` remains the text source of truth.
- `fix-pack.md` — evidence-to-owner-to-review-action-to-recheck handoff.
- `llms.txt` — TODO or partial draft.
- `robots-patch.txt` — TODO.
- `studio-handoff.md` — self-contained handoff; it does not rely on access to local files.

## Evidence and coverage

- https://nonexistent-zz9x7q-skillathon.example.com: UNKNOWN; 0 PASS / 4 WARN / 0 ERROR / 0 UNKNOWN / 4 observed; fetched 2026-08-28T17:05:23.770Z; raw audit-0.json; reason: no browser baseline (crawler.control-failed).
- https://monday.com: OK; 13 PASS / 1 WARN / 0 ERROR / 0 UNKNOWN / 14 observed; fetched 2026-08-28T17:05:23.668Z; raw audit-1.json.
- Subject grounding: homepage fetch-failed — unavailable; robots.txt fetch-failed — unavailable.

Full evidence receipts are in `evidence.json`; raw audit findings remain in `audit-*.json`.

## What this proves — and what it does not

- **Measured:** public responses observed under a browser User-Agent and named crawler User-Agent strings; reported machine-readable signals; matched peer differences.
- **Not measured:** assistant citations, rankings, traffic, third-party authority, or access from verified crawler IP ranges.
- **Unknown:** 1 domain(s); NOT_REPORTED cells remain neutral and are excluded from matched gaps.
- Hostname validation is textual only. Findings are a live snapshot and can change after this run.
