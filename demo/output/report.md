# AgentMarkup readiness gap

Generated 2026-08-28T16:03:15.503Z from live audits. "You" = https://notion.so -> https://www.notion.com/; competitors: https://monday.com.

## Top actions

| Finding | Observed evidence | Who fixes it |
| --- | --- | --- |
| llms.txt has errors | reported by the audit; see the findings below | agentmarkup |
| Google google-extended hit a bot challenge | google-extended → status=403; browser → status=200 | infrastructure |
| No Content-Signal policy in robots.txt | reported by the audit; see the findings below | agentmarkup |

## AI readiness matrix

| Check | notion.so | monday.com |
| --- | --- | --- |
| GPTBot (ChatGPT) can fetch the page | ✅ 200 | ✅ 200 |
| OAI-SearchBot can fetch the page | ✅ 200 | ✅ 200 |
| ClaudeBot (Claude) can fetch the page | ✅ 200 | ✅ 200 |
| PerplexityBot can fetch the page | ✅ 200 | ✅ 200 |
| Google-Extended can fetch the page | ⚠️ 403 | ✅ 200 |
| llms.txt published and valid | ❌ | ✅ |
| llms.txt linked from the homepage | ⚠️ | ⚠️ |
| JSON-LD structured data | ⚠️ | ✅ |
| Content-Signal policy in robots.txt | ⚠️ | ✅ |
| robots.txt allows AI crawlers | ✅ | ✅ |
| Sitemap published | ✅ | ✅ |
| Core page metadata complete | ✅ | ✅ |
| Content in server-rendered HTML | ✅ | ✅ |
| Missing paths return a real 404 | ⚠️ | ✅ |

✅ pass · ⚠️ warning · ❌ error · UNKNOWN not auditable. Every cell comes from an observed response; nothing is inferred.

## Coverage
```
notion.so   ████████░░░░░░  8/14 checks passed
monday.com  █████████████░  13/14 checks passed
```

- https://notion.so: 8 pass / 5 warn / 1 error (fetched 2026-08-28T16:03:05.810Z)
- https://monday.com: 13 pass / 1 warn / 0 error (fetched 2026-08-28T16:03:05.708Z)
- Grounding: homepage 200 (241475 bytes, final https://www.notion.com/); robots.txt 200

How to read the evidence: each site was requested twice, once under an AI crawler's user-agent and once as a browser. A line like `google-extended -> status=403; browser -> status=200` means that crawler was refused the exact page a browser received.

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

## Fix plan, triaged (errors first, using the audit's own fix guidance)

**1. agentmarkup can fix these** - build-time markup and crawler directives; drafts are in this folder:
- [error] llms.txt has errors
- [warn] No Content-Signal policy in robots.txt -> Enable agentmarkup contentSignalHeaders so Content-Signal is written into robots.txt.
- [warn] llms.txt is not linked from the homepage -> agentmarkup injects this discovery link automatically.
- [warn] No JSON-LD structured data -> Add JSON-LD with agentmarkup schema presets (webSite, organization, article, …).

**2. Needs a human content or template change** - no markup tool writes your copy:
- none

**3. Server, CDN or bot-protection settings** - your infrastructure decides, not your markup:
- [warn] Google google-extended hit a bot challenge -> Allowlist the crawler by its published IP ranges (verified bots) rather than relying on user-agent rules.
- [warn] Could not determine how missing paths are handled

**Not visible from here at all:** third-party authority - who else cites you and how assistants weigh it. No markup tool changes that, and this report does not pretend to measure it.

## Fix exits
- JS build: `npm i -D @agentmarkup/<vite|astro|next|nuxt>` — regenerates and validates these files on every build.
- Other stacks: review and continue with out/studio-handoff.md at https://agentmarkup.dev/studio/

## Limitations
Citation/assistant visibility was NOT tested; crawl readiness is a prerequisite, not proof of ranking. UNKNOWN domains: 0. Hostname validation is textual only. Findings are a snapshot from 2026-08-28T16:03:15.503Z.
