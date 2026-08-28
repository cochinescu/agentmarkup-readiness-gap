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
writeFileSync('out/run-summary.json', JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.log('\nWROTE: out/report.md out/brief.svg out/fix-pack.md out/evidence.json out/llms.txt out/robots-patch.txt out/studio-handoff.md');
