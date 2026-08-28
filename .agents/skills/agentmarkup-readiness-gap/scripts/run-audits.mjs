#!/usr/bin/env node
// AgentMarkup readiness gap runner. Deterministic formatting: the same audit
// results produce the same report (timestamps and live responses vary by run).
// Usage: node run-audits.mjs <you-url> [competitor-urls...]
// Exit 2 = usage error. Exit 3 = no network (sandbox): rerun with network access approved.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';

const urls = process.argv.slice(2);
if (urls.length === 0 || urls.some((u) => !/^https:\/\/[^\s@/]+\/?$/.test(u))) {
  console.error('usage: node run-audits.mjs <https-origin> [https-origins...] (canonical https origins only)');
  process.exit(2);
}
mkdirSync('out', { recursive: true });
for (const f of readdirSync('out')) {
  if (/^(audit-\d+\.json|report\.md|llms\.txt|robots-patch\.txt|studio-handoff\.md|run-summary\.json|you-home\.html|you-robots\.txt)$/.test(f)) {
    rmSync(`out/${f}`, { force: true });
  }
}
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0 Safari/537.36';

// Fail fast in a no-network sandbox instead of hanging until timeouts.
try {
  await fetch('https://registry.npmjs.org/-/ping', { signal: AbortSignal.timeout(4000) });
} catch {
  console.error('NO NETWORK: outbound requests are blocked (sandbox?). Rerun this exact command with network access approved.');
  process.exit(3);
}
// Prime the npm cache once so parallel cold npx runs do not race the install.
spawnSync('npx', ['-y', '@agentmarkup/audit@0.2.5', '--version'], { stdio: 'ignore', timeout: 30000 });

const DEADLINE_MS = 45000;
const started = Date.now();

function runAudit(url, i) {
  return new Promise((res) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; res(v); } };
    let p;
    try {
      p = spawn('npx', ['-y', '@agentmarkup/audit@0.2.5', url, '--json', '--timeout', '10000'], {
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch {
      return finish({ url, status: 'UNKNOWN', reason: 'could not start npx' });
    }
    p.on('error', () => finish({ url, status: 'UNKNOWN', reason: 'npx failed to start' }));
    let buf = '';
    p.stdout.on('data', (d) => (buf += d));
    const to = setTimeout(() => {
      p.kill('SIGKILL');
      finish({ url, status: 'UNKNOWN', reason: `killed at global ${DEADLINE_MS / 1000}s deadline` });
    }, Math.max(1000, DEADLINE_MS - (Date.now() - started)));
    p.on('close', (code) => {
      clearTimeout(to);
      let json;
      try { json = JSON.parse(buf); } catch { return finish({ url, status: 'UNKNOWN', reason: `exit ${code}, unparseable output` }); }
      const findings = Array.isArray(json.findings) ? json.findings : [];
      if (code === 2 || findings.length === 0) return finish({ url, status: 'UNKNOWN', reason: `exit ${code}, no findings returned` });
      writeFileSync(`out/audit-${i}.json`, JSON.stringify(json, null, 2));
      const counts = { pass: 0, warn: 0, error: 0 };
      for (const f of findings) counts[f.level ?? 'warn'] = (counts[f.level ?? 'warn'] || 0) + 1;
      const noBaseline = findings.some((f) => f.code === 'crawler.control-failed');
      finish({
        url, json, counts, exit: code,
        finalUrl: json.finalUrl, fetchedAt: json.fetchedAt ?? 'unrecorded',
        status: noBaseline ? 'UNKNOWN' : 'ok',
        reason: noBaseline ? 'no browser baseline (crawler.control-failed)' : undefined,
      });
    });
  });
}

async function grab(u, name) {
  const CAP = 1_000_000;
  try {
    const r = await fetch(u, {
      redirect: 'follow',
      headers: { 'user-agent': UA, accept: '*/*' },
      signal: AbortSignal.timeout(10000),
    });
    let body = '', bytes = 0;
    const dec = new TextDecoder();
    for await (const chunk of r.body ?? []) {
      bytes += chunk.byteLength;
      body += dec.decode(chunk, { stream: true });
      if (bytes >= CAP) { try { await r.body.cancel(); } catch {} break; }
    }
    writeFileSync(`out/${name}`, body);
    return { name, ok: r.status === 200 && body.length > 0, status: r.status, finalUrl: r.url, bytes };
  } catch (e) {
    return { name, ok: false, status: 'fetch-failed', error: String(e).slice(0, 120) };
  }
}

const [audits, home, robots] = await Promise.all([
  Promise.all(urls.map(runAudit)),
  grab(urls[0], 'you-home.html'),
  grab(new URL('/robots.txt', urls[0]).href, 'you-robots.txt'),
]);
const you = audits[0];
const competitors = audits.slice(1);
const now = new Date().toISOString();
const youGrounded = you.status === 'ok' && home.ok;
const robotsKnown = robots.ok || robots.status === 404; // 404 = "no robots.txt exists", still known
const homeBody = home.ok ? (await import('node:fs')).readFileSync('out/you-home.html', 'utf8') : '';
const robotsBody = robots.ok ? (await import('node:fs')).readFileSync('out/you-robots.txt', 'utf8') : '';

const warnErr = (a) => (a.json?.findings || []).filter((f) => f.level !== 'pass');
const passCodes = (a) => new Set((a.json?.findings || []).filter((f) => f.level === 'pass').map((f) => f.code));
const esc = (s) => String(s ?? '').replace(/\r/g, '').trim();
const fmt = (f) => `- ${(f.level ?? 'warn').toUpperCase()} — ${esc(f.title)}${esc(f.evidence) ? `\n  Evidence: ${esc(f.evidence)}` : ''}`;

const lines = [];
lines.push(`# AgentMarkup readiness gap`, ``);
lines.push(`Generated ${now} from live audits. "You" = ${you.url}${you.finalUrl && you.finalUrl !== you.url ? ` -> ${you.finalUrl}` : ''}; competitors: ${competitors.map((c) => c.url).join(', ') || 'none'}.`, ``);

// Executive view first: the three most serious observed findings, each with its raw evidence
// and who has to act. Observations only - no traffic, revenue or ranking claims.
const OWNER = {
  'llms.invalid': 'agentmarkup', 'llms.missing': 'agentmarkup', 'llms.no-discovery-link': 'agentmarkup',
  'jsonld.missing': 'agentmarkup', 'jsonld.invalid': 'agentmarkup',
  'robots.no-content-signal': 'agentmarkup', 'robots.crawlers-blocked': 'agentmarkup',
  'markdown.missing': 'agentmarkup', 'sitemap.missing': 'agentmarkup',
  'meta.incomplete': 'content owner', 'js.client-rendered': 'content owner',
  'notfound.soft404': 'infrastructure', 'notfound.unknown': 'infrastructure',
  'crawler.bot-challenge': 'infrastructure', 'crawler.blocked': 'infrastructure', 'crawler.rate-limited': 'infrastructure',
};
if (you.status === 'ok') {
  const top = [...(you.json.findings || []).filter((f) => f.level !== 'pass')]
    .sort((a, b) => (a.level === 'error' ? -1 : 1) - (b.level === 'error' ? -1 : 1))
    .slice(0, 3);
  if (top.length) {
    lines.push(`## Top actions`, ``);
    lines.push(`| Finding | Observed evidence | Who fixes it |`, `| --- | --- | --- |`);
    for (const f of top) {
      lines.push(`| ${esc(f.title)} | ${esc(f.evidence) || 'reported by the audit; see the findings below'} | ${OWNER[f.code] ?? 'needs review'} |`);
    }
    lines.push(``);
  }
}
// Crawler access matrix: the headline picture. One row per AI crawler, one column per site,
// each cell the observed status code. Pure text so it renders in any markdown viewer.
const CRAWLERS = [
  ['gptbot', 'GPTBot (ChatGPT)'], ['oai-searchbot', 'OAI-SearchBot'],
  ['claudebot', 'ClaudeBot (Claude)'], ['perplexitybot', 'PerplexityBot'],
  ['google-extended', 'Google-Extended'],
];
const crawlerCell = (a, key) => {
  if (a.status !== 'ok') return 'UNKNOWN';
  const f = (a.json.findings || []).find((x) => String(x.code ?? '').startsWith('crawler.') && String(x.evidence ?? '').toLowerCase().includes(key));
  if (!f) return '-';
  const m = /status=(\d{3})/.exec(f.evidence ?? '');
  const code = m ? m[1] : (f.level === 'pass' ? '200' : '?');
  return f.level === 'pass' ? `✅ ${code}` : `⚠️ ${code}`;
};
// Feature rows: one per readiness topic, matched by finding-code prefix. The audit uses a
// different code for the pass and fail state of the same check, so match on the topic.
const TOPICS = [
  ['llms.', 'llms.txt published and valid', ['llms.present', 'llms.invalid', 'llms.missing']],
  ['llms.no-discovery-link', 'llms.txt linked from the homepage', ['llms.no-discovery-link']],
  ['jsonld.', 'JSON-LD structured data', null],
  ['robots.content-signal|robots.no-content-signal', 'Content-Signal policy in robots.txt', null],
  ['robots.crawlers-', 'robots.txt allows AI crawlers', null],
  ['sitemap.', 'Sitemap published', null],
  ['meta.', 'Core page metadata complete', null],
  ['js.', 'Content in server-rendered HTML', null],
  ['notfound.', 'Missing paths return a real 404', null],
];
const icon = (lvl) => (lvl === 'pass' ? '✅' : lvl === 'error' ? '❌' : lvl === 'warn' ? '⚠️' : '–');
const topicCell = (a, prefix, only) => {
  if (a.status !== 'ok') return 'UNKNOWN';
  const fs2 = (a.json.findings || []).filter((f) => {
    const c = String(f.code ?? '');
    if (only) return only.includes(c);
    if (prefix.includes('|')) return prefix.split('|').includes(c);
    return c.startsWith(prefix) && !(prefix === 'llms.' && c === 'llms.no-discovery-link');
  });
  if (!fs2.length) return '–';
  const worst = fs2.some((f) => f.level === 'error') ? 'error' : fs2.some((f) => f.level === 'warn') ? 'warn' : 'pass';
  return icon(worst);
};
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

lines.push(`## Coverage`);
const bar = (n, total) => '█'.repeat(Math.max(0, n)) + '░'.repeat(Math.max(0, total - n));
const maxChecks = Math.max(...audits.filter((a) => a.status === 'ok').map((a) => a.counts.pass + a.counts.warn + a.counts.error), 1);
if (audits.some((a) => a.status === 'ok')) {
  lines.push('```');
  for (const a of audits) {
    const host = new URL(a.url).hostname.padEnd(Math.max(...audits.map((x) => new URL(x.url).hostname.length)));
    lines.push(a.status === 'ok'
      ? `${host}  ${bar(a.counts.pass, maxChecks)}  ${a.counts.pass}/${maxChecks} checks passed`
      : `${host}  ${'?'.repeat(maxChecks)}  UNKNOWN`);
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
  };
  const ordered = [...warnErr(you)].sort((a, b) => (a.level === 'error' ? -1 : 1) - (b.level === 'error' ? -1 : 1));
  const bucketed = { tool: [], content: [], infra: [], other: [] };
  for (const f of ordered) bucketed[BUCKET[f.code] ?? 'other'].push(f);
  const render = (arr) => arr.map((f) => `- [${f.level}] ${esc(f.title)}${f.fix ? ` -> ${esc(f.fix)}` : ''}`);

  lines.push(`## Fix plan, triaged (errors first, using the audit's own fix guidance)`);
  lines.push(``, `**1. agentmarkup can fix these** - build-time markup and crawler directives; drafts are in this folder:`);
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
writeFileSync('out/run-summary.json', JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.log('\nWROTE: out/report.md out/llms.txt out/robots-patch.txt out/studio-handoff.md');
