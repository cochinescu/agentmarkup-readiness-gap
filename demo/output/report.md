# AgentMarkup readiness gap

Generated 2026-08-28T16:59:26.754Z from live audits. "You" = https://calm.com -> https://www.calm.com/; competitors: https://rootd.io, https://wysa.com, https://animafelix.com.

## Top actions

| Finding | Observed evidence | Who fixes it |
| --- | --- | --- |
| OpenAI gptbot is blocked from a generic IP | gptbot → status=403; browser → status=200 | infrastructure |
| OpenAI oai-searchbot is blocked from a generic IP | oai-searchbot → status=403; browser → status=200 | infrastructure |
| Anthropic claudebot is blocked from a generic IP | claudebot → status=403; browser → status=200 | infrastructure |

## AI readiness matrix

| Check | calm.com | rootd.io | wysa.com | animafelix.com |
| --- | --- | --- | --- | --- |
| GPTBot (ChatGPT) can fetch the page | ⚠️ 403 | ⚠️ 403 | ⚠️ 403 | ✅ 200 |
| OAI-SearchBot can fetch the page | ⚠️ 403 | ⚠️ 403 | ⚠️ 403 | ✅ 200 |
| ClaudeBot (Claude) can fetch the page | ⚠️ 403 | ⚠️ 403 | ⚠️ 403 | ✅ 200 |
| PerplexityBot can fetch the page | ⚠️ 403 | ⚠️ 403 | ⚠️ 403 | ✅ 200 |
| Google-Extended can fetch the page | ✅ 200 | ✅ 200 | ✅ 200 | ✅ 200 |
| llms.txt published and valid | ⚠️ | ⚠️ | ⚠️ | ✅ |
| JSON-LD structured data | ⚠️ | ⚠️ | ✅ | ✅ |
| Content-Signal policy in robots.txt | ⚠️ | ⚠️ | – | ⚠️ |
| robots.txt allows AI crawlers | ✅ | ✅ | – | ✅ |
| Sitemap published | ✅ | ✅ | ⚠️ | ✅ |
| Core page metadata complete | ⚠️ | ⚠️ | ✅ | ✅ |
| Content in server-rendered HTML | ✅ | ✅ | ✅ | ✅ |
| Missing paths return a real 404 | ✅ | ✅ | ⚠️ | ✅ |

✅ pass · ⚠️ warning · ❌ error · UNKNOWN not auditable. Every cell comes from an observed response; nothing is inferred.

## Coverage
```
calm.com        █████░░░░░░░░░  5/14 checks passed
rootd.io        █████░░░░░░░░░  5/14 checks passed
wysa.com        ████░░░░░░░░░░  4/14 checks passed
animafelix.com  █████████████░  13/14 checks passed
```

- https://calm.com: 5 pass / 8 warn / 0 error (fetched 2026-08-28T16:59:16.914Z)
- https://rootd.io: 5 pass / 8 warn / 0 error (fetched 2026-08-28T16:59:16.880Z)
- https://wysa.com: 4 pass / 8 warn / 0 error (fetched 2026-08-28T16:59:16.880Z)
- https://animafelix.com: 13 pass / 1 warn / 0 error (fetched 2026-08-28T16:59:16.915Z)
- Grounding: homepage 200 (565142 bytes, final https://www.calm.com/); robots.txt 200

How to read the evidence: each site was requested twice, once under an AI crawler's user-agent and once as a browser. A line like `google-extended -> status=403; browser -> status=200` means that crawler was refused the exact page a browser received.

## https://calm.com warn/error findings
- WARN — OpenAI gptbot is blocked from a generic IP
  Evidence: gptbot → status=403; browser → status=200
- WARN — OpenAI oai-searchbot is blocked from a generic IP
  Evidence: oai-searchbot → status=403; browser → status=200
- WARN — Anthropic claudebot is blocked from a generic IP
  Evidence: claudebot → status=403; browser → status=200
- WARN — Perplexity perplexitybot is blocked from a generic IP
  Evidence: perplexitybot → status=403; browser → status=200
- WARN — No Content-Signal policy in robots.txt
- WARN — No llms.txt found
- WARN — No JSON-LD structured data
- WARN — Core page metadata is incomplete
  Evidence: missing: canonical

## https://rootd.io warn/error findings
- WARN — OpenAI gptbot is blocked from a generic IP
  Evidence: gptbot → status=403; browser → status=200
- WARN — OpenAI oai-searchbot is blocked from a generic IP
  Evidence: oai-searchbot → status=403; browser → status=200
- WARN — Anthropic claudebot is blocked from a generic IP
  Evidence: claudebot → status=403; browser → status=200
- WARN — Perplexity perplexitybot is blocked from a generic IP
  Evidence: perplexitybot → status=403; browser → status=200
- WARN — No Content-Signal policy in robots.txt
- WARN — No llms.txt found
- WARN — No JSON-LD structured data
- WARN — Core page metadata is incomplete
  Evidence: missing: description

## https://wysa.com warn/error findings
- WARN — OpenAI gptbot is blocked from a generic IP
  Evidence: gptbot → status=403; browser → status=200
- WARN — OpenAI oai-searchbot is blocked from a generic IP
  Evidence: oai-searchbot → status=403; browser → status=200
- WARN — Anthropic claudebot is blocked from a generic IP
  Evidence: claudebot → status=403; browser → status=200
- WARN — Perplexity perplexitybot is blocked from a generic IP
  Evidence: perplexitybot → status=403; browser → status=200
- WARN — No robots.txt found
- WARN — No llms.txt found
- WARN — No sitemap.xml found
- WARN — Missing paths answer 429, not 404
  Evidence: GET https://wysa.com/agentmarkup-probe-404-does-not-exist-9f3a2c -> 429

## https://animafelix.com warn/error findings
- WARN — No Content-Signal policy in robots.txt

## Gaps versus competitors
Versus https://rootd.io (5 vs 5 passing):
- No check where this competitor passes and you fail.

Versus https://wysa.com (5 vs 4 passing):
- They pass this check, you don't: No JSON-LD structured data
- They pass this check, you don't: Core page metadata is incomplete

Versus https://animafelix.com (5 vs 13 passing):
- They pass this check, you don't: No llms.txt found
- They pass this check, you don't: No JSON-LD structured data
- They pass this check, you don't: Core page metadata is incomplete

## Fix plan, triaged (errors first, using the audit's own fix guidance)

**1. agentmarkup can fix these** - build-time markup and crawler directives; drafts are in this folder:
- [warn] No Content-Signal policy in robots.txt -> Enable agentmarkup contentSignalHeaders so Content-Signal is written into robots.txt.
- [warn] No llms.txt found -> Generate llms.txt with agentmarkup if you want a curated agent manifest.
- [warn] No JSON-LD structured data -> Add JSON-LD with agentmarkup schema presets (webSite, organization, article, …).

**2. Needs a human content or template change** - no markup tool writes your copy:
- [warn] Core page metadata is incomplete -> Add the missing head tags; agentmarkup keeps these consistent on generated pages.

**3. Server, CDN or bot-protection settings** - your infrastructure decides, not your markup:
- [warn] OpenAI gptbot is blocked from a generic IP -> If a WAF rule blocks the "gptbot" user-agent, remove or narrow it. If you allowlist verified bots by IP, no action is needed.
- [warn] OpenAI oai-searchbot is blocked from a generic IP -> If a WAF rule blocks the "oai-searchbot" user-agent, remove or narrow it. If you allowlist verified bots by IP, no action is needed.
- [warn] Anthropic claudebot is blocked from a generic IP -> If a WAF rule blocks the "claudebot" user-agent, remove or narrow it. If you allowlist verified bots by IP, no action is needed.
- [warn] Perplexity perplexitybot is blocked from a generic IP -> If a WAF rule blocks the "perplexitybot" user-agent, remove or narrow it. If you allowlist verified bots by IP, no action is needed.

**Not visible from here at all:** third-party authority - who else cites you and how assistants weigh it. No markup tool changes that, and this report does not pretend to measure it.

## Fix exits
- JS build: `npm i -D @agentmarkup/<vite|astro|next|nuxt>` — regenerates and validates these files on every build.
- Other stacks: review and continue with out/studio-handoff.md at https://agentmarkup.dev/studio/

## Limitations
Citation/assistant visibility was NOT tested; crawl readiness is a prerequisite, not proof of ranking. UNKNOWN domains: 0. Hostname validation is textual only. Findings are a snapshot from 2026-08-28T16:59:26.754Z.
