import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AUDIT_FINDING_CODES,
  AUDIT_PACKAGE,
  CAPABILITY_TAXONOMY,
  STATES,
  buildReportModel,
} from '../lib/report-model.mjs';

const fetchedAt = '2026-08-28T16:15:28.968Z';
const crawlers = ['gptbot', 'oai-searchbot', 'claudebot', 'perplexitybot', 'google-extended'];

const crawlerPasses = () => crawlers.map((crawler) => ({
  code: 'crawler.accessible',
  level: 'pass',
  title: `${crawler} can reach the page`,
  evidence: `${crawler} → status=200; browser → status=200`,
}));

const vercelFindings = [
  ...crawlerPasses(),
  { code: 'js.server-rendered', level: 'pass', title: 'Content is present without JavaScript', evidence: 'raw text length=3694' },
  { code: 'robots.crawlers-allowed', level: 'pass', title: 'robots.txt does not block the expected AI crawlers' },
  { code: 'robots.content-signal', level: 'pass', title: 'Content-Signal policy present', evidence: 'search=yes, ai-input=yes, ai-train=no' },
  { code: 'llms.present', level: 'pass', title: 'llms.txt is present and well-formed' },
  { code: 'llms.no-discovery-link', level: 'warn', title: 'llms.txt is not linked from the homepage', fix: 'Inject the discovery link.' },
  { code: 'jsonld.present', level: 'pass', title: 'JSON-LD structured data present' },
  { code: 'sitemap.present', level: 'pass', title: 'Sitemap found' },
  { code: 'meta.complete', level: 'pass', title: 'Core page metadata present' },
  {
    code: 'notfound.soft-404-custom',
    level: 'warn',
    title: 'Missing paths return 200, not 404',
    evidence: 'GET https://vercel.com/agentmarkup-probe-404-does-not-exist-9f3a2c -> 200, body differs from the homepage',
    fix: 'Serve the same not-found page with a 404 status rather than 200.',
  },
];

const record = (url, findings, overrides = {}) => ({
  url,
  finalUrl: url,
  fetchedAt,
  status: 'ok',
  counts: findings.reduce((counts, finding) => ({ ...counts, [finding.level]: counts[finding.level] + 1 }), { pass: 0, warn: 0, error: 0 }),
  json: { findings },
  ...overrides,
});

test('normalizes the complete @agentmarkup/audit@0.2.5 capability taxonomy', () => {
  assert.equal(AUDIT_PACKAGE, '@agentmarkup/audit@0.2.5');
  assert.deepEqual(STATES, ['PASS', 'WARN', 'ERROR', 'NOT_REPORTED', 'UNKNOWN']);
  assert.equal(CAPABILITY_TAXONOMY.length, 15);
  assert.deepEqual(
    new Set(AUDIT_FINDING_CODES),
    new Set([
      'crawler.control-failed', 'crawler.probe-failed', 'crawler.content-differential', 'crawler.accessible',
      'crawler.rate-limited', 'crawler.bot-challenge', 'crawler.ua-differential-block', 'crawler.origin-error',
      'crawler.differential-unknown', 'js.empty-shell', 'js.thin-html', 'js.server-rendered',
      'robots.missing', 'robots.blocks-crawlers', 'robots.crawlers-allowed', 'robots.content-signal',
      'robots.no-content-signal', 'llms.invalid', 'llms.present', 'llms.missing', 'llms.no-discovery-link',
      'jsonld.missing', 'jsonld.invalid', 'jsonld.present', 'markdown.present', 'sitemap.present',
      'sitemap.missing', 'notfound.unknown', 'notfound.ok', 'notfound.non-404', 'notfound.soft-404',
      'notfound.soft-404-custom', 'meta.complete', 'meta.incomplete',
    ]),
  );
});

test('reports the Vercel capture as 12 pass, 2 warn, and 14 observed without inventing a score', () => {
  const model = buildReportModel([record('https://vercel.com', vercelFindings)]);
  assert.deepEqual(model.primary.observedCounts, { PASS: 12, WARN: 2, ERROR: 0, UNKNOWN: 0, total: 14 });
  assert.deepEqual(model.primary.capabilityStateCounts, {
    PASS: 12, WARN: 2, ERROR: 0, NOT_REPORTED: 1, UNKNOWN: 0, total: 15,
  });
  assert.equal(model.primary.capabilities.find(({ id }) => id === 'content.markdown-alternate').state, 'NOT_REPORTED');
  assert.equal('score' in model, false);
  assert.equal('score' in model.primary, false);
});

test('keeps crawler identities distinct despite the shared crawler.accessible code', () => {
  const { primary } = buildReportModel([record('https://vercel.com', vercelFindings)]);
  for (const crawler of crawlers) {
    const capability = primary.capabilities.find(({ id }) => id === `crawler.${crawler}`);
    assert.equal(capability.state, 'PASS');
    assert.equal(capability.finding.crawlerId, crawler);
  }
});

test('matches notfound.soft-404-custom to a peer notfound.ok and orders it first', () => {
  const peerFindings = vercelFindings
    .filter(({ code }) => code !== 'notfound.soft-404-custom')
    .concat({ code: 'notfound.ok', level: 'pass', title: 'Missing paths return a real 404', evidence: 'GET https://netlify.com/probe -> 404' });
  const unknownPeer = { url: 'https://unknown.dev', status: 'UNKNOWN', reason: 'no browser baseline', fetchedAt };
  const model = buildReportModel([
    record('https://vercel.com', vercelFindings),
    record('https://netlify.com', peerFindings),
    unknownPeer,
  ], { sourceFilenames: ['audit-0.json', 'audit-1.json', 'audit-2.json'] });

  assert.deepEqual(model.eligiblePeers.map(({ url }) => url), ['https://netlify.com']);
  const gap = model.peerGaps.find(({ capabilityId }) => capabilityId === 'http.not-found');
  assert.equal(gap.primary.code, 'notfound.soft-404-custom');
  assert.equal(gap.peer.code, 'notfound.ok');
  assert.equal(gap.owner, 'infrastructure');
  assert.equal(model.primaryActions[0].code, 'notfound.soft-404-custom');
  assert.equal(model.primaryActions[0].owner, 'infrastructure');
  assert.match(model.primaryActions[0].verify, /notfound\.ok/);
});

test('attaches deterministic evidence receipts and keeps action fields needed by renderers', () => {
  const first = buildReportModel([record('https://vercel.com', vercelFindings)]);
  const rerun = buildReportModel([record('https://vercel.com', vercelFindings, { fetchedAt: '2026-08-28T17:00:00.000Z' })]);
  const direct = first.evidenceReceipts.find(({ code }) => code === 'notfound.soft-404-custom');
  const derived = first.evidenceReceipts.find(({ code }) => code === 'llms.no-discovery-link');

  assert.equal(direct.id, rerun.evidenceReceipts.find(({ code }) => code === direct.code).id);
  assert.equal(direct.basis, 'direct-observation');
  assert.equal(direct.sourceAuditFilename, 'audit-0.json');
  assert.equal(direct.fetchedAt, fetchedAt);
  assert.equal(derived.basis, 'audit-derived');

  for (const field of ['id', 'code', 'level', 'title', 'owner', 'evidence', 'fix', 'reviewAction', 'verify', 'basis']) {
    assert.ok(field in first.primaryActions[0], `missing action field ${field}`);
  }
  assert.equal(first.primary.findings.length, 14);
});

test('turns audit wording into a clear review action without inventing missing source content', () => {
  const findings = [
    ...crawlerPasses().filter(({ evidence }) => !evidence.startsWith('google-extended')),
    {
      code: 'crawler.bot-challenge',
      level: 'warn',
      title: 'Google google-extended hit a bot challenge',
      evidence: 'google-extended → status=403; browser → status=200',
    },
    {
      code: 'llms.invalid',
      level: 'error',
      title: 'llms.txt has errors',
      evidence: 'llms.txt must start with an H1 heading (# Site Name)',
    },
  ];
  const model = buildReportModel([record('https://subject.example.com', findings)]);
  const llmsAction = model.primaryActions.find(({ code }) => code === 'llms.invalid');
  const crawlerAction = model.primaryActions.find(({ code }) => code === 'crawler.bot-challenge');

  assert.equal(llmsAction.reviewAction, 'Repair the existing llms.txt so it starts with one H1 site name; preserve its current content until the source file is reviewed.');
  assert.equal(crawlerAction.title, 'Google-Extended User-Agent received a bot challenge');
});

test('keeps an audit unknown neutral and out of actions and peer gaps', () => {
  const primaryFindings = vercelFindings
    .filter(({ code }) => code !== 'notfound.soft-404-custom')
    .concat({ code: 'notfound.unknown', level: 'warn', title: 'Could not determine missing-path behavior', evidence: 'too-many-redirects' });
  const peerFindings = vercelFindings
    .filter(({ code }) => code !== 'notfound.soft-404-custom')
    .concat({ code: 'notfound.ok', level: 'pass', title: 'Missing paths return 404', evidence: 'GET /probe -> 404' });
  const model = buildReportModel([
    record('https://subject.example.com', primaryFindings),
    record('https://peer.example.com', peerFindings),
  ]);

  assert.equal(model.primary.capabilities.find(({ id }) => id === 'http.not-found').state, 'UNKNOWN');
  assert.equal(model.primaryActions.some(({ code }) => code === 'notfound.unknown'), false);
  assert.equal(model.peerGaps.some(({ capabilityId }) => capabilityId === 'http.not-found'), false);
});
