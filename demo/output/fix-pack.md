# AgentMarkup review-only fix pack



Subject: https://calm.com

Snapshot: 2026-08-28T17:24:28.014Z



Actions: 8



### E-dde85f911173 — OpenAI gptbot is blocked from a generic IP
- **Observed:** gptbot → status=403; browser → status=200
- **Owner:** infrastructure
- **Review action:** If a WAF rule blocks the "gptbot" user-agent, remove or narrow it. If you allowlist verified bots by IP, no action is needed.
- **Done when:** Repeat paired requests; require crawler.accessible for GPTBot.

### E-b5f5a72e1c29 — OpenAI oai-searchbot is blocked from a generic IP
- **Observed:** oai-searchbot → status=403; browser → status=200
- **Owner:** infrastructure
- **Review action:** If a WAF rule blocks the "oai-searchbot" user-agent, remove or narrow it. If you allowlist verified bots by IP, no action is needed.
- **Done when:** Repeat paired requests; require crawler.accessible for OAI-SearchBot.

### E-8b623aaf0d55 — Anthropic claudebot is blocked from a generic IP
- **Observed:** claudebot → status=403; browser → status=200
- **Owner:** infrastructure
- **Review action:** If a WAF rule blocks the "claudebot" user-agent, remove or narrow it. If you allowlist verified bots by IP, no action is needed.
- **Done when:** Repeat paired requests; require crawler.accessible for ClaudeBot.

### E-168f138127c1 — Perplexity perplexitybot is blocked from a generic IP
- **Observed:** perplexitybot → status=403; browser → status=200
- **Owner:** infrastructure
- **Review action:** If a WAF rule blocks the "perplexitybot" user-agent, remove or narrow it. If you allowlist verified bots by IP, no action is needed.
- **Done when:** Repeat paired requests; require crawler.accessible for PerplexityBot.

### E-d8ec15d2abd1 — No llms.txt found
- **Observed:** No reachable /llms.txt. This is optional — it helps AI coding tools and some assistants, but major crawlers do not require it.
- **Owner:** agentmarkup
- **Review action:** Generate llms.txt with agentmarkup if you want a curated agent manifest.
- **Done when:** Rerun @agentmarkup/audit@0.2.5 and require llms.present.

### E-c8bfd6782b53 — No JSON-LD structured data
- **Observed:** The page has no JSON-LD. Structured data helps AI systems and search understand the page entity.
- **Owner:** agentmarkup
- **Review action:** Add JSON-LD with agentmarkup schema presets (webSite, organization, article, …).
- **Done when:** Rerun @agentmarkup/audit@0.2.5 and require jsonld.present.

### E-ae9f65808bd1 — Core page metadata is incomplete
- **Observed:** missing: canonical
- **Owner:** content owner
- **Review action:** Add the missing head tags; agentmarkup keeps these consistent on generated pages.
- **Done when:** Rerun @agentmarkup/audit@0.2.5 and require meta.complete.

### E-d2df9e587e55 — No Content-Signal policy in robots.txt
- **Observed:** Content-Signal in robots.txt is the canonical place to state training/search/ai-input preferences. It may still be set as an HTTP header, which fewer tools read.
- **Owner:** agentmarkup
- **Review action:** Enable agentmarkup contentSignalHeaders so Content-Signal is written into robots.txt.
- **Done when:** Rerun @agentmarkup/audit@0.2.5 and require robots.content-signal.



Nothing in this pack was applied. Review each action in the owning system, then rerun the audit.
