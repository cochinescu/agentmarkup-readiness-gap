# AgentMarkup demo run sheet

If the live run takes more than 60 seconds, open [`demo/output/brief.svg`](demo/output/brief.svg). Then open [`demo/output/report.md`](demo/output/report.md).

## Open — 15 seconds

Say:

> A growth marketer can see that AI access is weak, but cannot give the web team defensible proof, the correct owner, or a safe next action. AgentMarkup turns one domain file into a live field report: same-URL request evidence, matched competitor gaps, an owner queue, and review-only fix artifacts.

The boundary is important: this is crawl-readiness evidence. It does not claim assistant citations, ranking, traffic, or access from verified crawler IP ranges.

## Run — about 15 seconds

1. Open Codex at the repository root.
2. Paste the contents of [`demo/seed-prompt.md`](demo/seed-prompt.md).
3. If Codex asks for network access, allow this run once.
4. Expect the live runner to finish in about 10 seconds. It writes the report, visual, fix pack, receipts, review artifacts, raw audits, and run summary under `out/`.
5. At 60 seconds, stop waiting and use the saved fallback.

<<<<<<< HEAD
Say: "When someone asks ChatGPT for help with anxiety, ChatGPT has to be able to read the site first. We are checking four apps in that category, live - and three of them returned HTTP 403 to the AI-crawler user-agents we tested while returning 200 to a browser seconds apart. We cannot tell from outside whether that is deliberate or a bot-protection rule; we can only show you the responses."
=======
While it runs, say:
>>>>>>> pax-pr

> The first domain is the subject. The second is the peer. The skill sends one browser-control request and named crawler User-Agent requests to the same public page. It compares only like-for-like capabilities. An unknown stays unknown, and an unreported check stays neutral.

## Show — 60 seconds

### 1. Start with the proof sheet

Open `out/brief.svg`.

<<<<<<< HEAD
Open `out/report.md`. Point to **Top actions**, then the **AI readiness matrix** - every check as a row, every site as a column, green ticks against warnings and one red error - then the colour-coded coverage block (red lines are sites that returned 403 to a tested crawler user-agent, green is one that answered all of them), then the triaged fix plan.
=======
Point to these three parts:
>>>>>>> pax-pr

- **Outcome:** Calm has 1 crawler User-Agent identity that matched the browser control, with 8 review actions remaining. This is a count, not a readiness score.
- **Same URL, two identities:** the browser control received HTTP 200, while the GPTBot User-Agent received HTTP 403.
- **First actions:** each card has a severity, evidence receipt, owner, and exact recheck condition.

<<<<<<< HEAD
Say: "Look at the matrix - one column per company, one row per check, every cell a real response. Three of these sites returned 403 to the ChatGPT, Claude and Perplexity crawler user-agents while a browser got 200, seconds apart from the same machine. The fourth column, animafelix.com, answered every crawler we tested - and it is our own site, disclosed in the input file as the reference implementation for this tooling."
=======
Say:
>>>>>>> pax-pr

> This is the signature moment: one URL, two request identities, two observed responses. The visual does not hide the distinction between the overall site result and this specific crawler warning.

### 2. Show why the peer comparison is useful

Open `out/report.md`. Go to **Machine-readable surface**, then **Crawl-access scoreboard**, then **Matched peer differences**. The diff block shows refused crawler identities in red and the fully readable reference implementation in green.

Say:

> The peers produced nine matched differences across seven capabilities. Animafelix passed the four crawler-access capabilities and llms.txt where Calm warned; Wysa and Animafelix also supplied matched proof for structured data and metadata. These are like-for-like differences, not a generic checklist opinion.

Show the first action. Calm returned 200 to the browser control and 403 to GPTBot, while Animafelix passed the same capability. Then open `out/llms.txt`.

Say:

> Calm had no reachable llms.txt. The skill grounded only the title and description from the captured homepage and left the uncaptured page list as TODO instead of inventing it.

Open `out/robots-patch.txt`.

Say:

> The robots finding needs a product-policy choice. The skill says POLICY INPUT REQUIRED. It does not invent consent for training.

Nothing in the review pack is applied or published.

## Evidence and fallback — 15 seconds

The saved intended run is in [`demo/output/`](demo/output/). It was produced by this runner on 2026-08-28 from Calm, Rootd, Wysa, and Animafelix. Its run summary records the package pin, timing, observed counts, URLs, and grounding responses.

The three recorded evaluations are in [`demo/evals.md`](demo/evals.md):

| Case | Verified result |
| --- | --- |
| Intended | Live report, valid SVG, 9 matched peer differences, 8 owner actions |
| Insufficient evidence | Subject UNKNOWN, zero gaps, zero actions, TODO-only artifacts |
| Refused input | Localhost, private IP, and credentialed URL refused before the audit |

## Close — 10 seconds

Say:

> AgentMarkup turns a vague AI-readiness question into a reviewable engineering handoff: observed response, peer proof, owner, safe draft, and done-when check. It is reusable on one subject and up to three public peers without changing the skill.

## If a judge asks

- **Are these verified crawler visits?** No. They are simulated User-Agent requests from the runner host. The report says that verified crawler IP behavior was not tested.
- **Why is there no score?** The auditor does not emit one fixed shared denominator. UNKNOWN and NOT_REPORTED remain neutral, so the skill does not invent a percentage.
- **Why use a competitor?** A gap is promoted only when the subject warns or fails and the same capability passes for an eligible peer.
- **Does it make changes?** No. It creates review-only artifacts. A human must approve policy and publishing actions.
- **What remains unverified?** Citations, ranking, traffic, third-party authority, verified crawler networks, DNS rebinding, and behavior after the recorded live snapshot.
