# agentmarkup-readiness-gap

**Can the AI crawlers behind ChatGPT, Claude and Perplexity actually read your website - and can they read your competitor's?**

Ask an assistant that question and you get an opinion. This skill dresses up as each crawler, asks the servers, and prints their answers.

Given a file with your domain and up to three competitors, `$agentmarkup-readiness-gap` requests every site twice - once under each AI crawler's user-agent, once as a browser - compares the results check by check, and writes an evidence-backed gap report plus the fix files themselves.

- **Track:** `ai-search-optimization`
- **Team:** agentmarkup (`cochinescu`, `pax-k`)
- **Run it:** paste [`demo/seed-prompt.md`](demo/seed-prompt.md) into Codex at the repository root.

## What it produces

Real output from `demo/input/domains.md`, committed in [`demo/output/report.md`](demo/output/report.md):

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

```
notion.so   ████████░░░░░░  8/14 checks passed
monday.com  █████████████░  13/14 checks passed
```

Every cell is an observed status code from a real request. Notion ships an `llms.txt` and it is invalid; Google's AI crawler is refused the exact page a browser receives.

Alongside the report it writes three reviewable drafts, never applied automatically: [`llms.txt`](demo/output/llms.txt) (filled from the live homepage), [`robots-patch.txt`](demo/output/robots-patch.txt) (built against the live robots.txt, existing directives preserved, conflicts flagged), and [`studio-handoff.md`](demo/output/studio-handoff.md).

Findings are triaged by **who can actually fix them** - agentmarkup, a human content change, or server and CDN settings - and the report states plainly that third-party authority is not measurable here at all.

## Evaluation

Three cases, run against this commit on 2026-08-28 during the build window. Full detail and evidence paths in [`demo/evals.md`](demo/evals.md).

| Case | What was tested | Observed | Result |
| --- | --- | --- | --- |
| Intended | [`domains.md`](demo/input/domains.md) - notion.so vs monday.com | 8/5/1 vs 13/1/0; four gaps where monday.com passes and Notion fails; drafts grounded in HTTP 200 fetches | **pass** ([evidence](demo/output/report.md)) |
| Insufficient evidence | [`insufficient.md`](demo/input/insufficient.md) - unreachable primary | Primary marked UNKNOWN and excluded from comparison rather than called weak; drafts degraded to `[TODO]` stubs naming the reason; competitor still audited normally | **pass** ([evidence](demo/output/evals/case2-insufficient-report.md)) |
| Failure / exclusion | [`refused.md`](demo/input/refused.md) - `localhost`, `192.168.1.1`, credentialed URL | All three refused at validation, exit code 2, no network request made | **pass** ([evidence](demo/output/evals/case3-refused-stdout.txt)) |

Reusability was checked on a second, unrelated input the same day - animafelix.com against Calm, Headspace and Rootd - with no edits to the skill.

## How it works

1. The skill validates the domains file and fixes roles: the first entry is "you" and keeps that role even if it is refused, so a competitor is never silently promoted.
2. It runs the bundled [`run-audits.mjs`](.agents/skills/agentmarkup-readiness-gap/scripts/run-audits.mjs), which audits every domain in parallel through the public npm package [`@agentmarkup/audit@0.2.5`](https://www.npmjs.com/package/@agentmarkup/audit) and grounds the drafts with two bounded fetches of your own homepage and robots.txt.
3. The runner writes the report and drafts deterministically, so the same audit results always produce the same report. The agent only reads them and prints a five-line summary.

No API keys, no accounts, no MCP servers. One npm package is fetched at run time; everything else is in this repository.

## What it does not do

It measures whether AI crawlers can reach and read a site, which is a prerequisite for AI visibility - not proof of it. It does not test who ChatGPT cites, does not rank anyone, and never turns an unknown into a score. Unreachable targets are reported as UNKNOWN and excluded from comparison. Hostname validation is textual; login-only sites cannot be audited.

## Fixing what it finds

- **Sites with a JS build:** `npm i -D @agentmarkup/<vite|astro|next|nuxt>` regenerates and validates these files on every build.
- **Everything else:** paste [`demo/output/studio-handoff.md`](demo/output/studio-handoff.md) into <https://agentmarkup.dev/studio/>.

Built on [agentmarkup](https://agentmarkup.dev), MIT-licensed open-source tooling by Sebastian Cochinescu at Anima Felix - written after realizing ChatGPT could find his wife's art studio website but could not understand it.

## Licence

MIT, see [`LICENSE`](LICENSE). Event rules and the organizer's template documentation remain in [`RULES.md`](RULES.md) and [`AGENTS.md`](AGENTS.md).
