# AgentMarkup readiness gap

Generated 2026-08-28T15:08:41.215Z from live audits. "You" = https://nonexistent-zz9x7q-skillathon.invalid -> https://nonexistent-zz9x7q-skillathon.invalid/; competitors: https://monday.com.

## Coverage
- https://nonexistent-zz9x7q-skillathon.invalid: UNKNOWN (no browser baseline (crawler.control-failed)) — excluded from comparison, not a weakness
- https://monday.com: 13 pass / 1 warn / 0 error (fetched 2026-08-28T15:08:33.798Z)
- Grounding: homepage fetch-failed — NOT usable as evidence; robots.txt fetch-failed — NOT usable as evidence

## https://monday.com warn/error findings
- WARN — llms.txt is not linked from the homepage

## Fix exits
- JS build: `npm i -D @agentmarkup/<vite|astro|next|nuxt>` — regenerates and validates these files on every build.
- Other stacks: review and continue with out/studio-handoff.md at https://agentmarkup.dev/studio/

## Limitations
Citation/assistant visibility was NOT tested; crawl readiness is a prerequisite, not proof of ranking. UNKNOWN domains: 1. Grounding for "you" failed or was unusable, so drafts are [TODO] stubs. Hostname validation is textual only. Findings are a snapshot from 2026-08-28T15:08:41.215Z.
