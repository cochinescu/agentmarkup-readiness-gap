# AgentMarkup readiness gap

Generated 2026-08-28T16:43:53.693Z from live audits. "You" = https://nonexistent-zz9x7q-skillathon.invalid -> https://nonexistent-zz9x7q-skillathon.invalid/; competitors: https://headspace.com.

## AI readiness matrix

| Check | nonexistent-zz9x7q-skillathon.invalid | headspace.com |
| --- | --- | --- |
| GPTBot (ChatGPT) can fetch the page | UNKNOWN | ✅ 200 |
| OAI-SearchBot can fetch the page | UNKNOWN | ✅ 200 |
| ClaudeBot (Claude) can fetch the page | UNKNOWN | ✅ 200 |
| PerplexityBot can fetch the page | UNKNOWN | ✅ 200 |
| Google-Extended can fetch the page | UNKNOWN | ✅ 200 |
| llms.txt published and valid | UNKNOWN | ✅ |
| llms.txt linked from the homepage | UNKNOWN | ⚠️ |
| JSON-LD structured data | UNKNOWN | ✅ |
| Content-Signal policy in robots.txt | UNKNOWN | ⚠️ |
| robots.txt allows AI crawlers | UNKNOWN | ✅ |
| Sitemap published | UNKNOWN | ✅ |
| Core page metadata complete | UNKNOWN | ✅ |
| Content in server-rendered HTML | UNKNOWN | ✅ |
| Missing paths return a real 404 | UNKNOWN | ✅ |

✅ pass · ⚠️ warning · ❌ error · UNKNOWN not auditable. Every cell comes from an observed response; nothing is inferred.

## Coverage
```
nonexistent-zz9x7q-skillathon.invalid  ??????????????  UNKNOWN
headspace.com                          ████████████░░  12/14 checks passed
```

- https://nonexistent-zz9x7q-skillathon.invalid: UNKNOWN (no browser baseline (crawler.control-failed)) — excluded from comparison, not a weakness
- https://headspace.com: 12 pass / 2 warn / 0 error (fetched 2026-08-28T16:43:44.319Z)
- Grounding: homepage fetch-failed — NOT usable as evidence; robots.txt fetch-failed — NOT usable as evidence

How to read the evidence: each site was requested twice, once under an AI crawler's user-agent and once as a browser. A line like `google-extended -> status=403; browser -> status=200` means that crawler was refused the exact page a browser received.

## https://headspace.com warn/error findings
- WARN — No Content-Signal policy in robots.txt
- WARN — llms.txt is not linked from the homepage

## Fix exits
- JS build: `npm i -D @agentmarkup/<vite|astro|next|nuxt>` — regenerates and validates these files on every build.
- Other stacks: review and continue with out/studio-handoff.md at https://agentmarkup.dev/studio/

## Limitations
Citation/assistant visibility was NOT tested; crawl readiness is a prerequisite, not proof of ranking. UNKNOWN domains: 1. Grounding for "you" failed or was unusable, so drafts are [TODO] stubs. Hostname validation is textual only. Findings are a snapshot from 2026-08-28T16:43:53.693Z.
