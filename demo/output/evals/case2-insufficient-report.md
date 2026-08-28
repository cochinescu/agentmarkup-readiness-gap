# AgentMarkup readiness gap

Generated 2026-08-28T15:42:18.358Z from live audits. "You" = https://nonexistent-zz9x7q-skillathon.invalid -> https://nonexistent-zz9x7q-skillathon.invalid/; competitors: https://monday.com.

## Can AI crawlers reach the page?

| Crawler | nonexistent-zz9x7q-skillathon.invalid | monday.com |
| --- | --- | --- |
| GPTBot (ChatGPT) | UNKNOWN | ✅ 200 |
| OAI-SearchBot | UNKNOWN | ✅ 200 |
| ClaudeBot (Claude) | UNKNOWN | ✅ 200 |
| PerplexityBot | UNKNOWN | ✅ 200 |
| Google-Extended | UNKNOWN | ✅ 200 |

## Coverage
```
nonexistent-zz9x7q-skillathon.invalid  ??????????????  UNKNOWN
monday.com                             █████████████░  13/14 checks passed
```

- https://nonexistent-zz9x7q-skillathon.invalid: UNKNOWN (no browser baseline (crawler.control-failed)) — excluded from comparison, not a weakness
- https://monday.com: 13 pass / 1 warn / 0 error (fetched 2026-08-28T15:42:12.046Z)
- Grounding: homepage fetch-failed — NOT usable as evidence; robots.txt fetch-failed — NOT usable as evidence

How to read the evidence: each site was requested twice, once under an AI crawler's user-agent and once as a browser. A line like `google-extended -> status=403; browser -> status=200` means that crawler was refused the exact page a browser received.

## https://monday.com warn/error findings
- WARN — llms.txt is not linked from the homepage

## Fix exits
- JS build: `npm i -D @agentmarkup/<vite|astro|next|nuxt>` — regenerates and validates these files on every build.
- Other stacks: review and continue with out/studio-handoff.md at https://agentmarkup.dev/studio/

## Limitations
Citation/assistant visibility was NOT tested; crawl readiness is a prerequisite, not proof of ranking. UNKNOWN domains: 1. Grounding for "you" failed or was unusable, so drafts are [TODO] stubs. Hostname validation is textual only. Findings are a snapshot from 2026-08-28T15:42:18.358Z.
