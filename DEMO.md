# Run sheet

Fallback at ~60 seconds: open [`demo/output/report.md`](demo/output/report.md).

## Say this - 20 seconds

**Team:** agentmarkup (Sebastian Cochinescu, Anima Felix; with pax-k)

**Track:** ai-search-optimization

**Who has the problem:** a founder or marketer at a B2B SaaS company whose site AI assistants keep missing.

**The job this skill does:** it audits your website and a competitor's live, identifying itself as each AI crawler, and returns an evidence-backed gap report plus draft fixes.

**Boundary - what it never does:** it never invents a score and never claims who ChatGPT cites or how anyone ranks.

Say: "AI assistants cannot understand what they cannot reliably reach, yet most teams only guess whether their website is ready. Notion tried - it ships an llms.txt - and still got it wrong. Trying is not enough; you need measurement. So we are comparing Notion with monday.com, live."

## Run this - 60 seconds

1. Codex is open at the repository root.
2. Paste [`demo/seed-prompt.md`](demo/seed-prompt.md).
3. **If Codex says `NO NETWORK` and asks to allow the command, click "Allow once".** That is the expected path.
4. Watch for: four files written to `out/` and a five-line summary printed.
5. If nothing visible after 60 seconds, open the fallback: [`demo/output/report.md`](demo/output/report.md).

While it runs, say: "The first website is treated as ours, Notion, the second as its competitor, monday.com. The skill visits both sites live while identifying itself as GPTBot, ClaudeBot, PerplexityBot and Google-Extended, then compares their responses check by check. Every claim is backed by the server's raw answer. It also drafts the fixes. This grew from agentmarkup, open-source tooling Sebastian built after realizing ChatGPT could find his wife's art studio website but could not understand it."

## Show this - 25 seconds

Open `out/report.md`. Point to Coverage, then Gaps versus competitors, then Fix plan.

**Result:** a gap report - **read the two passing-check totals off the live screen** - plus three ready-to-review drafts: `out/llms.txt`, `out/robots-patch.txt`, `out/studio-handoff.md`.

Say: "Notion passes [read count] checks, monday.com passes [read count]. Notion ships an llms.txt but [read the failure]. Google's AI crawler received [read the response] - the server evidence is printed right there."

**Evidence:** every finding carries the raw server response and a fetched-at timestamp; the Limitations section states what was not tested.

**Fallback output was produced:** 2026-08-28 during the build window, by running this same seed prompt in Codex from a clean clone.

**Limitation, say it out loud:** "This measures whether AI crawlers can reach and read a site - a prerequisite for AI visibility. It does not claim to know who ChatGPT cites, and it never turns an unknown into a score."

## Evals - 10 seconds

| Case | Result | Where |
| --- | --- | --- |
| Intended | pass - full gap report with grounded drafts | [`demo/evals.md`](demo/evals.md) |
| Insufficient evidence | pass - primary marked UNKNOWN, drafts reduced to `[TODO]` stubs | [`demo/evals.md`](demo/evals.md) |
| Failure / exclusion | pass - localhost, private IP and credentialed URL all refused, nothing fetched | [`demo/evals.md`](demo/evals.md) |

## Close - 5 seconds

**Reusable on:** any file of public domains, no edits. Same evening we ran it on animafelix.com versus Calm, Headspace and Rootd - unchanged.

**Material limitation:** crawl readiness is a prerequisite for AI visibility, not proof of it; login-only sites cannot be audited.

Say: "You leave with measured gaps, evidence, and the fixes themselves: developers install the npm packages so these files regenerate on every build; everyone else pastes the Studio handoff into agentmarkup.dev/studio."

## If a judge asks

- **Why not just ask ChatGPT?** Asking ChatGPT "can AI read my site?" gets an opinion. This dresses up as each AI crawler and finds out, with the server's answer beside every claim.
- **Is this a score?** No. Checks, gaps, evidence. An unknown stays unknown.
- **Does it work on any site?** Any public site the runner can reach. Blocked crawler requests are reported as evidence, not guessed at.
