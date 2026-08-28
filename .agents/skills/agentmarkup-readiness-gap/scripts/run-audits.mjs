#!/usr/bin/env node
// AgentMarkup field-report runner. Same audit data produces the same structure;
// timestamps and live responses vary. Exit 2 = refused input. Exit 3 = no network/auditor.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';

import { buildFixArtifacts } from './lib/fix-artifacts.mjs';
import { renderBriefSvg } from './lib/render-brief-svg.mjs';
import { buildReportModel } from './lib/report-model.mjs';
import { assertCanonicalPublicOrigin } from './lib/safe-origin.mjs';

const processStarted = Date.now();
let urls;
try {
  urls = process.argv.slice(2).map(assertCanonicalPublicOrigin);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'refused: invalid origin');
  process.exit(2);
}
if (urls.length === 0) {
  console.error('usage: node run-audits.mjs <https-origin> [https-origins...] (canonical public https origins only)');
  process.exit(2);
}
if (urls.length > 4) {
  console.error('refused: at most four canonical public origins are allowed');
  process.exit(2);
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0 Safari/537.36';
const AUDIT_PACKAGE = '@agentmarkup/audit@0.2.5';
try {
  await fetch('https://registry.npmjs.org/-/ping', { signal: AbortSignal.timeout(4000) });
} catch {
  console.error('NO NETWORK: outbound requests are blocked. Previous output was preserved.');
  process.exit(3);
}
const prime = spawnSync('npx', ['-y', AUDIT_PACKAGE, '--version'], { stdio: 'ignore', timeout: 20000 });
if (prime.status !== 0) {
  console.error(`AUDITOR UNAVAILABLE: ${AUDIT_PACKAGE} did not become ready within 20 seconds. Previous output was preserved.`);
  process.exit(3);
}

mkdirSync('out', { recursive: true });
for (const file of readdirSync('out')) {
  if (/^(audit-\d+\.json|report\.md|brief\.svg|evidence\.json|fix-pack\.md|llms\.txt|robots-patch\.txt|studio-handoff\.md|run-summary\.json|you-home\.html|you-robots\.txt)$/.test(file)) {
    rmSync(`out/${file}`, { force: true });
  }
}

const DEADLINE_MS = 55000;
function runAudit(url, index) {
  return new Promise((resolve) => {
    let complete = false;
    const finish = (value) => { if (!complete) { complete = true; resolve(value); } };
    let child;
    try {
      child = spawn('npx', ['-y', AUDIT_PACKAGE, url, '--json', '--timeout', '10000'], {
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch {
      finish({ url, status: 'UNKNOWN', reason: 'could not start npx' });
      return;
    }
    child.on('error', () => finish({ url, status: 'UNKNOWN', reason: 'npx failed to start' }));
    let stdout = '';
    child.stdout.on('data', (chunk) => {
      if (stdout.length < 2_000_000) stdout += chunk;
    });
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      finish({ url, status: 'UNKNOWN', reason: `killed at global ${DEADLINE_MS / 1000}s deadline` });
    }, Math.max(1000, DEADLINE_MS - (Date.now() - processStarted)));
    child.on('close', (exit) => {
      clearTimeout(timeout);
      let json;
      try { json = JSON.parse(stdout); } catch {
        finish({ url, status: 'UNKNOWN', reason: `exit ${exit}, unparseable output` });
        return;
      }
      const findings = Array.isArray(json.findings) ? json.findings : [];
      if (exit === 2 || findings.length === 0) {
        finish({ url, status: 'UNKNOWN', reason: `exit ${exit}, no findings returned` });
        return;
      }
      writeFileSync(`out/audit-${index}.json`, JSON.stringify(json, null, 2));
      const counts = { pass: 0, warn: 0, error: 0 };
      for (const finding of findings) counts[finding.level ?? 'warn'] = (counts[finding.level ?? 'warn'] || 0) + 1;
      const noBaseline = findings.some(({ code }) => code === 'crawler.control-failed');
      finish({
        url, json, counts, exit,
        finalUrl: json.finalUrl,
        fetchedAt: json.fetchedAt ?? 'unrecorded',
        status: noBaseline ? 'UNKNOWN' : 'ok',
        reason: noBaseline ? 'no browser baseline (crawler.control-failed)' : undefined,
      });
    });
  });
}

async function grab(url, name) {
  const cap = 1_000_000;
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': UA, accept: '*/*' },
      signal: AbortSignal.timeout(10000),
    });
    let body = '';
    let bytes = 0;
    const decoder = new TextDecoder();
    for await (const chunk of response.body ?? []) {
      bytes += chunk.byteLength;
      body += decoder.decode(chunk, { stream: true });
      if (bytes >= cap) { try { await response.body.cancel(); } catch {} break; }
    }
    writeFileSync(`out/${name}`, body);
    return { name, ok: response.status === 200 && body.length > 0, status: response.status, finalUrl: response.url, bytes };
  } catch (error) {
    return { name, ok: false, status: 'fetch-failed', error: String(error).slice(0, 120) };
  }
}

const [audits, home, robots] = await Promise.all([
  Promise.all(urls.map(runAudit)),
  grab(urls[0], 'you-home.html'),
  grab(new URL('/robots.txt', urls[0]).href, 'you-robots.txt'),
]);
const now = new Date().toISOString();
const model = buildReportModel(audits, { sourceFilenames: audits.map((_, index) => `audit-${index}.json`) });
const primary = model.primary;
const homeBody = home.ok ? readFileSync('out/you-home.html', 'utf8') : '';
const clean = (value) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
const md = (value) => clean(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('|', '\\|');
const title = /<title[^>]*>([^<]*)</i.exec(homeBody)?.[1];
const description =
  /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i.exec(homeBody)?.[1] ??
  /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i.exec(homeBody)?.[1];

const fixes = buildFixArtifacts({
  subjectUrl: primary.url,
  generatedAt: now,
  home: { ...home, title, description },
  robots,
  primaryStatus: primary.status === 'OK' ? 'ok' : 'UNKNOWN',
  primaryReason: primary.reason,
  findings: primary.findings,
  actions: model.primaryActions,
});
writeFileSync('out/llms.txt', fixes.llmsText);
writeFileSync('out/robots-patch.txt', fixes.robotsText);
writeFileSync('out/fix-pack.md', fixes.fixPackText);
writeFileSync('out/studio-handoff.md', fixes.studioText);

const crawlerAction = model.primaryActions.find(({ capabilityId }) => capabilityId.startsWith('crawler.'));
const proofCapability = crawlerAction
  ? primary.capabilities.find(({ id }) => id === crawlerAction.capabilityId)
  : primary.capabilities.find(({ id, state }) => id.startsWith('crawler.') && state === 'PASS');
const proofFinding = proofCapability?.finding;
const responseMatch = /([a-z-]+)\s*(?:→|->)\s*status=(\d{3});\s*browser\s*(?:→|->)\s*status=(\d{3})/i.exec(proofFinding?.evidence ?? '');
const proofMode = proofCapability?.state === 'PASS' ? 'matched' : 'differential';
const crawlerLabel = proofCapability?.label.replace(/ User-Agent access$/u, '') ?? 'crawler identity';
const browserStatus = responseMatch?.[3] ?? (primary.status === 'OK' ? 'NOT REPORTED' : 'UNKNOWN');
const crawlerStatus = responseMatch?.[2] ?? (primary.status === 'OK' ? 'NOT REPORTED' : 'UNKNOWN');
const crawlerPasses = primary.capabilities.filter(({ id, state }) => id.startsWith('crawler.') && state === 'PASS').length;
const outcomeSeverity = primary.status !== 'OK'
  ? 'unknown'
  : primary.observedCounts.ERROR > 0 ? 'error' : primary.observedCounts.WARN > 0 ? 'warn' : 'pass';
const outcomeTitle = primary.status !== 'OK'
  ? `No access conclusion: ${primary.reason}`
  : `${crawlerPasses} crawler User-Agent identities matched the browser control; ${model.primaryActions.length} review action${model.primaryActions.length === 1 ? '' : 's'} remain.`;
const proofVerdict = primary.status !== 'OK'
  ? 'No conclusion — the browser control was unavailable.'
  : proofMode === 'matched'
    ? `Both request identities received HTTP ${crawlerStatus}.`
    : `${crawlerLabel} received HTTP ${crawlerStatus}; the browser control received HTTP ${browserStatus}.`;
const svgActions = model.primaryActions.slice(0, 2).map((action) => ({
  severity: action.state,
  title: action.title,
  owner: action.owner,
  evidence: `[${action.id}] ${action.evidence}`,
  verify: action.verify,
}));
writeFileSync('out/brief.svg', renderBriefSvg({
  generatedAt: now,
  subject: new URL(primary.url).hostname,
  competitors: model.eligiblePeers.map(({ url }) => new URL(url).hostname),
  outcome: { severity: outcomeSeverity, title: outcomeTitle },
  proof: {
    mode: proofMode,
    severity: proofCapability?.state ?? 'UNKNOWN',
    title: 'Same homepage, browser control versus crawler User-Agent',
    browserLabel: 'Browser control', browserStatus,
    crawlerLabel, crawlerStatus,
    verdict: proofVerdict,
    evidence: proofFinding ? `[${proofFinding.receiptId}] ${proofFinding.evidence}` : 'No paired response evidence was reported.',
  },
  actions: svgActions,
}));

const report = ['# AgentMarkup field report', ''];
report.push(`Generated ${md(now)} from ${md(model.auditVersion)}. Subject: ${md(primary.url)}. Compared with: ${model.eligiblePeers.map(({ url }) => md(url)).join(', ') || 'none'}.`, '');
report.push('## Outcome', '', `**${md(outcomeTitle)}**`, '');
report.push(`Observed subject findings: ${primary.observedCounts.PASS} PASS, ${primary.observedCounts.WARN} WARN, ${primary.observedCounts.ERROR} ERROR, ${primary.observedCounts.UNKNOWN} UNKNOWN, ${primary.observedCounts.total} total. A capability with no emitted finding is NOT_REPORTED. No shared denominator or readiness score is calculated.`, '');
report.push('![AgentMarkup field report with paired request proof and first review actions](brief.svg)', '');
report.push('## Live proof: same URL, two request identities', '');
report.push('| Request identity | Observed response | Evidence receipt |', '| --- | --- | --- |');
report.push(`| Browser control | ${md(browserStatus)} | ${md(proofFinding?.receiptId ?? 'NOT_REPORTED')} |`);
report.push(`| ${md(crawlerLabel)} User-Agent | ${md(crawlerStatus)} | ${md(proofFinding?.receiptId ?? 'NOT_REPORTED')} |`, '');
report.push(md(proofVerdict), '', 'These are simulated User-Agent requests from this runner. Verified crawler IP access was not tested.', '');

report.push('## Machine-readable surface', '');
report.push(`| Capability | ${model.sites.map(({ url }) => md(new URL(url).hostname)).join(' | ')} |`, `| --- | ${model.sites.map(() => '---').join(' | ')} |`);
for (const capability of model.capabilities) {
  const cells = model.sites.map((site) => {
    const cell = site.capabilities.find(({ id }) => id === capability.id);
    return cell.receiptId ? `${cell.state} (${cell.receiptId})` : cell.state;
  });
  report.push(`| ${md(capability.label)} | ${cells.map(md).join(' | ')} |`);
}
report.push('');

report.push('## Crawl-access scoreboard', '', '```diff');
const scoreboardWidth = Math.max(...model.sites.map(({ url }) => new URL(url).hostname.length));
const scoreboardTotal = Math.max(...model.sites.map(({ observedCounts }) => observedCounts.total), 1);
const scoreboardBar = (passed) => '█'.repeat(Math.max(0, passed)) + '░'.repeat(Math.max(0, scoreboardTotal - passed));
for (const site of model.sites) {
  const hostname = new URL(site.url).hostname.padEnd(scoreboardWidth);
  if (site.status !== 'OK') {
    report.push(`! ${hostname}  ${'?'.repeat(scoreboardTotal)}  UNKNOWN — not auditable`);
    continue;
  }
  const blocked = site.capabilities.filter(({ id, state }) => id.startsWith('crawler.') && (state === 'WARN' || state === 'ERROR')).length;
  const marker = blocked > 0 ? '-' : site.observedCounts.ERROR > 0 || site.observedCounts.WARN > 2 ? '!' : '+';
  const note = blocked > 0
    ? `${blocked} crawler User-Agent${blocked === 1 ? '' : 's'} refused`
    : site.observedCounts.ERROR > 0 ? 'error-level finding'
      : site.observedCounts.WARN > 2 ? 'gaps to review'
        : 'readable by every crawler identity tested';
  report.push(`${marker} ${hostname}  ${scoreboardBar(site.observedCounts.PASS)}  ${String(site.observedCounts.PASS).padStart(2)}/${scoreboardTotal}  ${note}`);
}
report.push('```', '');

report.push('## Matched peer differences', '');
if (model.peerGaps.length === 0) {
  report.push('No comparable capability was WARN or ERROR for the subject while explicitly PASS for a peer.', '');
} else {
  for (const gap of model.peerGaps) {
    const capability = model.capabilities.find(({ id }) => id === gap.capabilityId);
    report.push(`- **${md(capability.label)}:** subject ${md(gap.primary.state)} (${md(gap.primary.receiptId)}); ${md(new URL(gap.peer.url).hostname)} ${md(gap.peer.state)} (${md(gap.peer.receiptId)}). Owner: ${md(gap.owner)}.`);
  }
  report.push('');
}

report.push('## Action queue', '');
if (model.primaryActions.length === 0) {
  report.push(primary.status === 'OK' ? 'No review action is justified by the reported findings.' : `UNKNOWN — ${md(primary.reason)}`, '');
} else {
  for (const action of model.primaryActions) {
    report.push(`### ${md(action.id)} — ${md(action.title)}`, '');
    report.push(`- **State:** ${md(action.state)}; basis: ${md(action.basis)}`);
    report.push(`- **Observed:** ${md(action.evidence)}`);
    report.push(`- **Owner:** ${md(action.owner)}`);
    report.push(`- **Review action:** ${md(action.reviewAction)}`);
    report.push(`- **Done when:** ${md(action.verify)}`);
    if (action.peerProof.length) report.push(`- **Peer proof:** ${action.peerProof.map(({ url }) => md(new URL(url).hostname)).join(', ')} explicitly passed this capability.`);
    report.push('');
  }
}

report.push('## Generated review pack', '');
report.push('- `brief.svg` — one-page stage visual; `report.md` remains the text source of truth.');
report.push('- `fix-pack.md` — evidence-to-owner-to-review-action-to-recheck handoff.');
report.push(`- \`llms.txt\` — ${fixes.llmsText.includes('NO REPLACEMENT RECOMMENDED') ? 'NO REPLACEMENT RECOMMENDED; contains only the supported discovery snippet' : fixes.llmsText.includes('[TODO]') ? 'TODO or partial draft' : 'grounded review draft'}.`);
report.push(`- \`robots-patch.txt\` — ${fixes.robotsText.includes('NO CHANGE RECOMMENDED') ? 'NO CHANGE RECOMMENDED' : fixes.robotsText.includes('POLICY INPUT REQUIRED') ? 'POLICY INPUT REQUIRED' : 'TODO'}.`);
report.push('- `studio-handoff.md` — self-contained handoff; it does not rely on access to local files.', '');

report.push('## Evidence and coverage', '');
for (const site of model.sites) {
  report.push(`- ${md(site.url)}: ${site.status}; ${site.observedCounts.PASS} PASS / ${site.observedCounts.WARN} WARN / ${site.observedCounts.ERROR} ERROR / ${site.observedCounts.UNKNOWN} UNKNOWN / ${site.observedCounts.total} observed; fetched ${md(site.fetchedAt)}; raw ${md(site.sourceAuditFilename)}${site.reason ? `; reason: ${md(site.reason)}` : ''}.`);
}
report.push(`- Subject grounding: homepage ${md(home.status)}${home.ok ? ` (${home.bytes} bytes; final ${md(home.finalUrl)})` : ' — unavailable'}; robots.txt ${md(robots.status)}${robots.status === 404 ? ' — no file exists' : robots.ok ? '' : ' — unavailable'}.`, '');
report.push('Full evidence receipts are in `evidence.json`; raw audit findings remain in `audit-*.json`.', '');
report.push('## What this proves — and what it does not', '');
report.push('- **Measured:** public responses observed under a browser User-Agent and named crawler User-Agent strings; reported machine-readable signals; matched peer differences.');
report.push('- **Not measured:** assistant citations, rankings, traffic, third-party authority, or access from verified crawler IP ranges.');
report.push(`- **Unknown:** ${model.sites.filter(({ status }) => status === 'UNKNOWN').length} domain(s); NOT_REPORTED cells remain neutral and are excluded from matched gaps.`);
report.push('- Hostname validation is textual only. Findings are a live snapshot and can change after this run.', '');
writeFileSync('out/report.md', `${report.join('\n').trimEnd()}\n`);

writeFileSync('out/evidence.json', JSON.stringify({
  schemaVersion: 1, generatedAt: now, auditPackage: model.auditVersion,
  subject: primary.url, receipts: model.evidenceReceipts,
}, null, 2));
const summary = {
  generatedAt: now,
  durationMs: Date.now() - processStarted,
  auditPackage: model.auditVersion,
  you: primary.url,
  youGrounded: primary.status === 'OK' && home.ok,
  observedCounts: primary.observedCounts,
  reviewActions: model.primaryActions.length,
  peerGaps: model.peerGaps.length,
  audits: audits.map(({ json, ...rest }) => rest),
  grounding: [home, robots],
  artifacts: ['report.md', 'brief.svg', 'fix-pack.md', 'evidence.json', 'llms.txt', 'robots-patch.txt', 'studio-handoff.md'],
};
<<<<<<< HEAD
if (audits.some((a) => a.status === 'ok')) {
  const heads = audits.map((a) => new URL(a.url).hostname);
  lines.push(`## AI readiness matrix`, ``);
  lines.push(`| Check | ${heads.join(' | ')} |`, `| --- | ${audits.map(() => '---').join(' | ')} |`);
  for (const [key, label] of CRAWLERS) {
    const row = audits.map((a) => crawlerCell(a, key));
    if (row.every((c) => c === '-')) continue;
    lines.push(`| ${label} can fetch the page | ${row.join(' | ')} |`);
  }
  for (const [prefix, label, only] of TOPICS) {
    const row = audits.map((a) => topicCell(a, prefix, only));
    if (row.every((c) => c === '–')) continue;
    lines.push(`| ${label} | ${row.join(' | ')} |`);
  }
  lines.push(``, `✅ pass · ⚠️ warning · ❌ error · UNKNOWN not auditable. Every cell comes from an observed response; nothing is inferred.`, ``);
}

lines.push(`## Observed-check coverage`);
const bar = (n, total) => '█'.repeat(Math.max(0, n)) + '░'.repeat(Math.max(0, total - n));
const maxChecks = Math.max(...audits.filter((a) => a.status === 'ok').map((a) => a.counts.pass + a.counts.warn + a.counts.error), 1);
if (audits.some((a) => a.status === 'ok')) {
  // Rendered as a diff block so viewers colour the lines: green for sites an AI crawler can
  // read, red for sites refusing one. The marker is derived from observed results only.
  const pad = Math.max(...audits.map((x) => new URL(x.url).hostname.length));
  const blockedCount = (a) => (a.json?.findings || []).filter((f) => String(f.code ?? '').startsWith('crawler.') && f.level !== 'pass').length;
  lines.push('```diff');
  for (const a of audits) {
    const host = new URL(a.url).hostname.padEnd(pad);
    if (a.status !== 'ok') { lines.push(`! ${host}  ${'?'.repeat(maxChecks)}  UNKNOWN - not auditable`); continue; }
    const blocked = blockedCount(a);
    const marker = blocked > 0 || a.counts.error > 0 ? '-' : a.counts.warn > 2 ? '!' : '+';
    const note = blocked > 0 ? `${blocked} AI crawler${blocked > 1 ? 's' : ''} refused` : a.counts.error > 0 ? 'error-level finding' : a.counts.warn > 2 ? 'gaps to close' : 'answered every crawler tested';
    lines.push(`${marker} ${host}  ${bar(a.counts.pass, maxChecks)}  ${String(a.counts.pass).padStart(2)}/${maxChecks}  ${note}`);
  }
  lines.push('```', ``);
}
for (const a of audits) {
  lines.push(a.status === 'ok'
    ? `- ${a.url}: ${a.counts.pass} pass / ${a.counts.warn} warn / ${a.counts.error} error (fetched ${a.fetchedAt})`
    : `- ${a.url}: UNKNOWN (${a.reason}) — excluded from comparison, not a weakness`);
}
lines.push(`- Grounding: homepage ${home.status}${home.ok ? ` (${home.bytes} bytes, final ${home.finalUrl})` : ' — NOT usable as evidence'}; robots.txt ${robots.status}${robots.status === 404 ? ' (no robots.txt exists)' : robots.ok ? '' : ' — NOT usable as evidence'}`, ``);
lines.push(`How to read the evidence: each site was requested twice, once under an AI crawler's user-agent and once as a browser. A line like \`google-extended -> status=403; browser -> status=200\` means that crawler was refused the exact page a browser received.`, ``);
for (const a of audits) {
  if (a.status !== 'ok') continue;
  lines.push(`## ${a.url} warn/error findings`);
  const fs2 = warnErr(a);
  lines.push(...(fs2.length ? fs2.map(fmt) : ['- none']), ``);
}
if (you.status === 'ok' && competitors.some((c) => c.status === 'ok')) {
  lines.push(`## Gaps versus competitors`);
  // The audit uses distinct codes for fail vs pass states of the same check.
  const FAIL_TO_PASS = {
    'jsonld.missing': 'jsonld.present', 'jsonld.invalid': 'jsonld.present',
    'llms.invalid': 'llms.present', 'llms.missing': 'llms.present',
    'robots.no-content-signal': 'robots.content-signal', 'robots.crawlers-blocked': 'robots.crawlers-allowed',
    'crawler.bot-challenge': 'crawler.accessible', 'crawler.blocked': 'crawler.accessible',
    'meta.incomplete': 'meta.complete', 'sitemap.missing': 'sitemap.present',
    'js.client-rendered': 'js.server-rendered', 'notfound.soft404': 'notfound.ok',
  };
  for (const c of competitors.filter((c) => c.status === 'ok')) {
    const cPass = passCodes(c);
    const gaps = warnErr(you).filter((f) =>
      !String(f.code ?? '').endsWith('.unknown') &&
      (cPass.has(f.code) || cPass.has(FAIL_TO_PASS[f.code])));
    lines.push(`Versus ${c.url} (${you.counts.pass} vs ${c.counts.pass} passing):`);
    lines.push(...(gaps.length ? gaps.map((f) => `- They pass this check, you don't: ${esc(f.title)}`) : ['- No check where this competitor passes and you fail.']), ``);
  }
}
if (you.status === 'ok') {
  // Triage: what a build-time markup tool can fix, what a human must write, what infrastructure
  // decides, and what nothing here can see. Stated plainly so the report never implies markup
  // solves everything.
  const BUCKET = {
    'llms.invalid': 'tool', 'llms.missing': 'tool', 'llms.no-discovery-link': 'tool',
    'jsonld.missing': 'tool', 'jsonld.invalid': 'tool',
    'robots.no-content-signal': 'tool', 'robots.crawlers-blocked': 'tool',
    'markdown.missing': 'tool', 'sitemap.missing': 'tool',
    'meta.incomplete': 'content', 'js.client-rendered': 'content',
    'notfound.soft404': 'infra', 'notfound.unknown': 'infra',
    'crawler.bot-challenge': 'infra', 'crawler.blocked': 'infra', 'crawler.rate-limited': 'infra',
    'crawler.ua-differential-block': 'infra', 'crawler.ip-block': 'infra',
  };
  const ordered = [...warnErr(you)].sort((a, b) => (a.level === 'error' ? -1 : 1) - (b.level === 'error' ? -1 : 1));
  const bucketed = { tool: [], content: [], infra: [], other: [] };
  for (const f of ordered) bucketed[BUCKET[f.code] ?? (String(f.code ?? '').startsWith('crawler.') ? 'infra' : 'other')].push(f);
  const render = (arr) => arr.map((f) => `- [${f.level}] ${esc(f.title)}${f.fix ? ` -> ${esc(f.fix)}` : ''}`);

  lines.push(`## Fix plan, triaged (errors first, using the audit's own fix guidance)`);
  lines.push(``, `**1. Candidate fixes agentmarkup can generate** - build-time markup and crawler directives; drafts are in this folder:`);
  lines.push(...(bucketed.tool.length ? render(bucketed.tool) : ['- none']));
  lines.push(``, `**2. Needs a human content or template change** - no markup tool writes your copy:`);
  lines.push(...(bucketed.content.length ? render(bucketed.content) : ['- none']));
  lines.push(``, `**3. Server, CDN or bot-protection settings** - your infrastructure decides, not your markup:`);
  lines.push(...(bucketed.infra.length ? render(bucketed.infra) : ['- none']));
  if (bucketed.other.length) { lines.push(``, `**4. Other findings:**`, ...render(bucketed.other)); }
  lines.push(``, `**Not visible from here at all:** third-party authority - who else cites you and how assistants weigh it. No markup tool changes that, and this report does not pretend to measure it.`, ``);
}
lines.push(`## Fix exits`);
lines.push(`- JS build: \`npm i -D @agentmarkup/<vite|astro|next|nuxt>\` — regenerates and validates these files on every build.`);
lines.push(`- Other stacks: review and continue with out/studio-handoff.md at https://agentmarkup.dev/studio/`, ``);
lines.push(`## Limitations`);
lines.push(`Citation/assistant visibility was NOT tested; crawl readiness is a prerequisite, not proof of ranking. UNKNOWN domains: ${audits.filter((a) => a.status !== 'ok').length}. ${youGrounded ? '' : 'Grounding for "you" failed or was unusable, so drafts are [TODO] stubs. '}Hostname validation is textual only. Findings are a snapshot from ${now}.`);
writeFileSync('out/report.md', lines.join('\n') + '\n');

// Draft artifacts: grounded only when the primary audit AND its grounding are usable.
if (youGrounded) {
  const title = /<title[^>]*>([^<]*)</i.exec(homeBody)?.[1];
  const desc =
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i.exec(homeBody)?.[1] ??
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i.exec(homeBody)?.[1];
  writeFileSync('out/llms.txt', [
    `# ${esc(title) || '[TODO site name]'}`, ``,
    `> ${esc(desc) || '[TODO one-line site description]'}`, ``,
    `## Pages`, `- [TODO curated key pages with one-line descriptions]`, ``,
    `# Draft generated ${now} by agentmarkup-readiness-gap from the live homepage of ${you.url} (HTTP ${home.status}); review before publishing`,
  ].join('\n') + '\n');
} else {
  writeFileSync('out/llms.txt', [
    `# [TODO site name]`, ``, `> [TODO one-line site description]`, ``,
    `# [TODO] stub only: ${you.status !== 'ok' ? `primary audit UNKNOWN (${you.reason})` : `homepage fetch not usable as evidence (status ${home.status})`} — no site facts were derivable. Generated ${now}.`,
  ].join('\n') + '\n');
}

if (you.status === 'ok' && robotsKnown) {
  const conflicts = [];
  for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended']) {
    const grp = new RegExp(`user-agent:\\s*${bot}[\\s\\S]{0,200}?disallow:\\s*/\\s*$`, 'im');
    if (robots.ok && grp.test(robotsBody)) conflicts.push(`# CONFLICT: existing robots.txt has a Disallow group for ${bot} — resolve before applying.`);
  }
  writeFileSync('out/robots-patch.txt', [
    `# Append to your existing robots.txt — this block preserves existing directives.`,
    robots.status === 404 ? `# Note: no robots.txt exists today (HTTP 404); this block can become the whole file.` : `# Built against your live robots.txt (HTTP ${robots.status}).`,
    ...conflicts,
    `# Review before publishing. Generated ${now} from live audit of ${you.url}.`,
    `# BEGIN agentmarkup AI crawlers`,
    `Content-Signal: search=yes, ai-train=no`,
    `User-agent: GPTBot`, `Allow: /`,
    `User-agent: ClaudeBot`, `Allow: /`,
    `User-agent: PerplexityBot`, `Allow: /`,
    `User-agent: Google-Extended`, `Allow: /`,
    `# END agentmarkup AI crawlers`,
  ].join('\n') + '\n');
} else {
  writeFileSync('out/robots-patch.txt', [
    `# [TODO] stub only: ${you.status !== 'ok' ? `primary audit UNKNOWN (${you.reason})` : `robots.txt fetch not usable as evidence (status ${robots.status})`} — no patch was derivable. Generated ${now}.`,
  ].join('\n') + '\n');
}

writeFileSync('out/studio-handoff.md', [
  `Paste this into your agent on https://agentmarkup.dev/studio/ :`, ``,
  `I ran the agentmarkup-readiness-gap skill on ${you.url}${you.status === 'ok' ? '' : ' (result UNKNOWN — the auditor could not establish a baseline)'}. Import my draft below, help me finish identity, access policy and curated pages, then compile my agent surface and give me the install plan.`, ``,
  `Draft findings: see out/report.md (generated ${now}).`,
].join('\n') + '\n');

const summary = { generatedAt: now, you: you.url, youGrounded, audits: audits.map(({ json, ...rest }) => rest), grounding: [home, robots] };
=======
>>>>>>> pax-pr
writeFileSync('out/run-summary.json', JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.log('\nWROTE: out/report.md out/brief.svg out/fix-pack.md out/evidence.json out/llms.txt out/robots-patch.txt out/studio-handoff.md');
