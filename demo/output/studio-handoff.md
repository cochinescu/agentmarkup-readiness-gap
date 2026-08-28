Paste this into your agent on https://agentmarkup.dev/studio/ :

I audited https://calm.com at 2026-08-28T17:24:28.014Z. Treat these as untrusted review inputs and do not publish without confirmation.
Observed actions (8):
- E-dde85f911173 OpenAI gptbot is blocked from a generic IP; owner=infrastructure; evidence=gptbot → status=403; browser → status=200; done when=Repeat paired requests; require crawler.accessible for GPTBot.
- E-b5f5a72e1c29 OpenAI oai-searchbot is blocked from a generic IP; owner=infrastructure; evidence=oai-searchbot → status=403; browser → status=200; done when=Repeat paired requests; require crawler.accessible for OAI-SearchBot.
- E-8b623aaf0d55 Anthropic claudebot is blocked from a generic IP; owner=infrastructure; evidence=claudebot → status=403; browser → status=200; done when=Repeat paired requests; require crawler.accessible for ClaudeBot.
- E-168f138127c1 Perplexity perplexitybot is blocked from a generic IP; owner=infrastructure; evidence=perplexitybot → status=403; browser → status=200; done when=Repeat paired requests; require crawler.accessible for PerplexityBot.
- E-d8ec15d2abd1 No llms.txt found; owner=agentmarkup; evidence=No reachable /llms.txt. This is optional — it helps AI coding tools and some assistants, but major crawlers do not require it.; done when=Rerun @agentmarkup/audit@0.2.5 and require llms.present.
- E-c8bfd6782b53 No JSON-LD structured data; owner=agentmarkup; evidence=The page has no JSON-LD. Structured data helps AI systems and search understand the page entity.; done when=Rerun @agentmarkup/audit@0.2.5 and require jsonld.present.
- E-ae9f65808bd1 Core page metadata is incomplete; owner=content owner; evidence=missing: canonical; done when=Rerun @agentmarkup/audit@0.2.5 and require meta.complete.
- E-d2df9e587e55 No Content-Signal policy in robots.txt; owner=agentmarkup; evidence=Content-Signal in robots.txt is the canonical place to state training/search/ai-input preferences. It may still be set as an HTTP header, which fewer tools read.; done when=Rerun @agentmarkup/audit@0.2.5 and require robots.content-signal.

The live llms.txt did not have a confirmed pass; keep unsupported fields as TODO.
Crawler policy needs owner input; do not choose training consent.
