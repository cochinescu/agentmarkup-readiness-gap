# AgentMarkup readiness gap

Generated 2026-08-28T15:08:21.593Z from live audits. "You" = https://notion.so -> https://www.notion.com/; competitors: https://monday.com.

## Coverage
- https://notion.so: 8 pass / 5 warn / 1 error (fetched 2026-08-28T15:08:11.149Z)
- https://monday.com: 13 pass / 1 warn / 0 error (fetched 2026-08-28T15:08:11.153Z)
- Grounding: homepage 200 (241475 bytes, final https://www.notion.com/); robots.txt 200

## https://notion.so warn/error findings
- WARN — Google google-extended hit a bot challenge
  Evidence: google-extended → status=403; browser → status=200
- WARN — No Content-Signal policy in robots.txt
- ERROR — llms.txt has errors
- WARN — llms.txt is not linked from the homepage
- WARN — No JSON-LD structured data
- WARN — Could not determine how missing paths are handled
  Evidence: too-many-redirects

## https://monday.com warn/error findings
- WARN — llms.txt is not linked from the homepage

## Gaps versus competitors
Versus https://monday.com (8 vs 13 passing):
- They pass this check, you don't: Google google-extended hit a bot challenge
- They pass this check, you don't: No Content-Signal policy in robots.txt
- They pass this check, you don't: llms.txt has errors
- They pass this check, you don't: No JSON-LD structured data

## Fix plan (the audit's own fix guidance, errors first)
1. [warn] Allowlist the crawler by its published IP ranges (verified bots) rather than relying on user-agent rules.
2. [warn] Enable agentmarkup contentSignalHeaders so Content-Signal is written into robots.txt.
3. [warn] agentmarkup injects this discovery link automatically.
4. [warn] Add JSON-LD with agentmarkup schema presets (webSite, organization, article, …).

## Fix exits
- JS build: `npm i -D @agentmarkup/<vite|astro|next|nuxt>` — regenerates and validates these files on every build.
- Other stacks: review and continue with out/studio-handoff.md at https://agentmarkup.dev/studio/

## Limitations
Citation/assistant visibility was NOT tested; crawl readiness is a prerequisite, not proof of ranking. UNKNOWN domains: 0. Hostname validation is textual only. Findings are a snapshot from 2026-08-28T15:08:21.593Z.
