import { createHash } from 'node:crypto';

export const AUDIT_PACKAGE = '@agentmarkup/audit@0.2.5';
export const STATES = Object.freeze(['PASS', 'WARN', 'ERROR', 'NOT_REPORTED', 'UNKNOWN']);

const CRAWLER_IDS = Object.freeze([
  'gptbot',
  'oai-searchbot',
  'claudebot',
  'perplexitybot',
  'google-extended',
]);

const CRAWLER_DISPLAY_NAMES = Object.freeze({
  gptbot: 'GPTBot',
  'oai-searchbot': 'OAI-SearchBot',
  claudebot: 'ClaudeBot',
  perplexitybot: 'PerplexityBot',
  'google-extended': 'Google-Extended',
});

const CRAWLER_CODES = Object.freeze([
  'crawler.probe-failed',
  'crawler.content-differential',
  'crawler.accessible',
  'crawler.rate-limited',
  'crawler.bot-challenge',
  'crawler.ua-differential-block',
  'crawler.origin-error',
  'crawler.differential-unknown',
]);

const crawlerCapability = (crawlerId) => ({
  id: `crawler.${crawlerId}`,
  label: `${CRAWLER_DISPLAY_NAMES[crawlerId]} User-Agent access`,
  owner: 'infrastructure',
  codes: CRAWLER_CODES,
  passCodes: ['crawler.accessible'],
  verify: `Repeat paired requests; require crawler.accessible for ${CRAWLER_DISPLAY_NAMES[crawlerId]}.`,
});

export const CAPABILITY_TAXONOMY = Object.freeze([
  ...CRAWLER_IDS.map(crawlerCapability),
  {
    id: 'content.server-rendering', label: 'Content without JavaScript', owner: 'content owner',
    codes: ['js.empty-shell', 'js.thin-html', 'js.server-rendered'], passCodes: ['js.server-rendered'],
    verify: `Rerun ${AUDIT_PACKAGE} and require js.server-rendered.`,
  },
  {
    id: 'robots.crawler-policy', label: 'robots.txt crawler policy', owner: 'agentmarkup',
    codes: ['robots.missing', 'robots.blocks-crawlers', 'robots.crawlers-allowed'], passCodes: ['robots.crawlers-allowed'],
    verify: `Rerun ${AUDIT_PACKAGE} and require robots.crawlers-allowed.`,
  },
  {
    id: 'robots.content-signal', label: 'Content-Signal policy', owner: 'agentmarkup',
    codes: ['robots.content-signal', 'robots.no-content-signal'], passCodes: ['robots.content-signal'],
    verify: `Rerun ${AUDIT_PACKAGE} and require robots.content-signal.`,
  },
  {
    id: 'llms.manifest', label: 'llms.txt manifest', owner: 'agentmarkup',
    codes: ['llms.invalid', 'llms.present', 'llms.missing'], passCodes: ['llms.present'],
    verify: `Rerun ${AUDIT_PACKAGE} and require llms.present.`,
  },
  {
    id: 'llms.discovery', label: 'llms.txt homepage discovery', owner: 'agentmarkup',
    codes: ['llms.no-discovery-link'], passCodes: [],
    verify: 'Confirm the homepage discovery link exists, then rerun the audit and require llms.no-discovery-link not to be reported.',
  },
  {
    id: 'structured-data.jsonld', label: 'JSON-LD structured data', owner: 'agentmarkup',
    codes: ['jsonld.missing', 'jsonld.invalid', 'jsonld.present'], passCodes: ['jsonld.present'],
    verify: `Rerun ${AUDIT_PACKAGE} and require jsonld.present.`,
  },
  {
    id: 'content.markdown-alternate', label: 'Markdown alternate', owner: 'agentmarkup',
    codes: ['markdown.present'], passCodes: ['markdown.present'],
    verify: `Rerun ${AUDIT_PACKAGE} and require markdown.present.`,
  },
  {
    id: 'discovery.sitemap', label: 'Sitemap discovery', owner: 'agentmarkup',
    codes: ['sitemap.present', 'sitemap.missing'], passCodes: ['sitemap.present'],
    verify: `Rerun ${AUDIT_PACKAGE} and require sitemap.present.`,
  },
  {
    id: 'metadata.core', label: 'Core page metadata', owner: 'content owner',
    codes: ['meta.complete', 'meta.incomplete'], passCodes: ['meta.complete'],
    verify: `Rerun ${AUDIT_PACKAGE} and require meta.complete.`,
  },
  {
    id: 'http.not-found', label: 'Missing-path HTTP behavior', owner: 'infrastructure',
    codes: ['notfound.unknown', 'notfound.ok', 'notfound.non-404', 'notfound.soft-404', 'notfound.soft-404-custom'],
    passCodes: ['notfound.ok'],
    verify: `Repeat the missing-path probe and require notfound.ok (HTTP 404 or 410).`,
  },
]);

export const AUDIT_FINDING_CODES = Object.freeze([
  'crawler.control-failed',
  ...CRAWLER_CODES,
  'js.empty-shell', 'js.thin-html', 'js.server-rendered',
  'robots.missing', 'robots.blocks-crawlers', 'robots.crawlers-allowed',
  'robots.content-signal', 'robots.no-content-signal',
  'llms.invalid', 'llms.present', 'llms.missing', 'llms.no-discovery-link',
  'jsonld.missing', 'jsonld.invalid', 'jsonld.present',
  'markdown.present',
  'sitemap.present', 'sitemap.missing',
  'notfound.unknown', 'notfound.ok', 'notfound.non-404', 'notfound.soft-404', 'notfound.soft-404-custom',
  'meta.complete', 'meta.incomplete',
]);

const CAPABILITY_BY_ID = new Map(CAPABILITY_TAXONOMY.map((capability, index) => [capability.id, { ...capability, order: index }]));
const CAPABILITY_BY_CODE = new Map();
for (const capability of CAPABILITY_TAXONOMY.slice(CRAWLER_IDS.length)) {
  for (const code of capability.codes) CAPABILITY_BY_CODE.set(code, capability.id);
}

const STATE_BY_LEVEL = Object.freeze({ pass: 'PASS', warn: 'WARN', error: 'ERROR' });
const STATE_ORDER = Object.freeze({ ERROR: 0, WARN: 1, PASS: 2, NOT_REPORTED: 3, UNKNOWN: 4 });

function crawlerIdFromFinding(finding) {
  const text = `${finding.evidence ?? ''}\n${finding.title ?? ''}`.toLowerCase();
  return CRAWLER_IDS.find((crawlerId) => text.includes(crawlerId));
}

function capabilityIdFor(finding) {
  if (CRAWLER_CODES.includes(finding.code)) {
    const crawlerId = crawlerIdFromFinding(finding);
    return crawlerId ? `crawler.${crawlerId}` : undefined;
  }
  return CAPABILITY_BY_CODE.get(finding.code);
}

function stableId(siteUrl, capabilityId, code) {
  const digest = createHash('sha256')
    .update(`${siteUrl}\u0000${capabilityId}\u0000${code}`)
    .digest('hex')
    .slice(0, 12);
  return `E-${digest}`;
}

function normalizeFinding(finding, context) {
  const capabilityId = capabilityIdFor(finding);
  const crawlerId = String(finding.code ?? '').startsWith('crawler.') ? crawlerIdFromFinding(finding) : undefined;
  const level = Object.hasOwn(STATE_BY_LEVEL, finding.level) ? finding.level : 'warn';
  const unknownCode = String(finding.code ?? '').endsWith('.unknown') ||
    finding.code === 'crawler.probe-failed' || finding.code === 'crawler.differential-unknown';
  const state = unknownCode ? 'UNKNOWN' : (STATE_BY_LEVEL[finding.level] ?? 'UNKNOWN');
  const hasDirectEvidence = typeof finding.evidence === 'string' && finding.evidence.trim().length > 0;
  const basis = hasDirectEvidence ? 'direct-observation' : 'audit-derived';
  const evidence = hasDirectEvidence
    ? finding.evidence
    : (finding.detail || finding.title || `Audit emitted ${finding.code}.`);
  const receiptCapability = capabilityId ?? `unmapped.${finding.code ?? 'finding'}`;
  const receiptId = stableId(context.url, receiptCapability, finding.code ?? 'unknown-code');
  return {
    ...finding,
    level,
    state,
    capabilityId,
    crawlerId,
    basis,
    evidence,
    receiptId,
    sourceAuditFilename: context.sourceAuditFilename,
    fetchedAt: context.fetchedAt,
  };
}

function receiptFor(finding, siteUrl) {
  return {
    id: finding.receiptId,
    siteUrl,
    capabilityId: finding.capabilityId,
    basis: finding.basis,
    code: finding.code,
    level: finding.level,
    state: finding.state,
    evidence: finding.evidence,
    sourceAuditFilename: finding.sourceAuditFilename,
    fetchedAt: finding.fetchedAt,
  };
}

function countObserved(findings) {
  const counts = { PASS: 0, WARN: 0, ERROR: 0, UNKNOWN: 0, total: findings.length };
  for (const finding of findings) {
    if (finding.state === 'PASS' || finding.state === 'WARN' || finding.state === 'ERROR' || finding.state === 'UNKNOWN') counts[finding.state] += 1;
  }
  return counts;
}

function bestFinding(findings) {
  return [...findings].sort((left, right) => STATE_ORDER[left.state] - STATE_ORDER[right.state])[0];
}

export function normalizeAuditRecord(record, { index = 0, sourceFilename } = {}) {
  const sourceAuditFilename = sourceFilename ?? record.sourceAuditFilename ?? `audit-${index}.json`;
  const fetchedAt = record.fetchedAt ?? record.json?.fetchedAt ?? 'unrecorded';
  const rawFindings = Array.isArray(record.json?.findings) ? record.json.findings : [];
  const findings = rawFindings.map((finding) => normalizeFinding(finding, {
    url: record.url,
    sourceAuditFilename,
    fetchedAt,
  }));
  const unknown = String(record.status ?? '').toLowerCase() !== 'ok' || findings.some(({ code }) => code === 'crawler.control-failed');
  const capabilities = CAPABILITY_TAXONOMY.map((taxonomy) => {
    if (unknown) return { ...taxonomy, state: 'UNKNOWN', finding: undefined, receiptId: undefined };
    const matching = findings.filter(({ capabilityId }) => capabilityId === taxonomy.id);
    const finding = matching.length > 0 ? bestFinding(matching) : undefined;
    return {
      ...taxonomy,
      state: finding?.state ?? 'NOT_REPORTED',
      finding,
      receiptId: finding?.receiptId,
    };
  });
  const capabilityStateCounts = Object.fromEntries(STATES.map((state) => [state, 0]));
  for (const capability of capabilities) capabilityStateCounts[capability.state] += 1;
  capabilityStateCounts.total = capabilities.length;
  return {
    url: record.url,
    finalUrl: record.finalUrl ?? record.json?.finalUrl,
    fetchedAt,
    status: unknown ? 'UNKNOWN' : 'OK',
    reason: unknown ? (record.reason ?? 'no usable browser baseline') : undefined,
    sourceAuditFilename,
    reportedCounts: record.counts,
    observedCounts: countObserved(findings),
    capabilityStateCounts,
    findings,
    capabilities,
    unmappedFindings: findings.filter(({ capabilityId }) => capabilityId === undefined),
    evidenceReceipts: findings.map((finding) => receiptFor(finding, record.url)),
  };
}

function actionFor(capability, peerGaps) {
  const finding = capability.finding;
  const matchingGaps = peerGaps.filter(({ capabilityId }) => capability.id === capabilityId);
  const reviewAction = finding.fix || (finding.code === 'llms.invalid'
    ? 'Repair the existing llms.txt so it starts with one H1 site name; preserve its current content until the source file is reviewed.'
    : 'Review this finding with the responsible owner; confirm the cause before applying a change.');
  const title = finding.code === 'crawler.bot-challenge'
    ? `${capability.label.replace(/ access$/u, '')} received a bot challenge`
    : (finding.title || finding.code);
  return {
    id: finding.receiptId,
    receiptId: finding.receiptId,
    capabilityId: capability.id,
    code: finding.code,
    level: finding.level,
    state: finding.state,
    title,
    owner: capability.owner,
    evidence: finding.evidence,
    fix: finding.fix || '',
    reviewAction,
    verify: capability.verify,
    basis: finding.basis,
    peerProof: matchingGaps.map(({ peer }) => peer),
  };
}

export function buildReportModel(records, { primaryIndex = 0, sourceFilenames = [] } = {}) {
  if (!Array.isArray(records) || records.length === 0) throw new TypeError('records must contain at least one audit record');
  if (!Number.isInteger(primaryIndex) || primaryIndex < 0 || primaryIndex >= records.length) throw new RangeError('primaryIndex is outside records');

  const sites = records.map((record, index) => normalizeAuditRecord(record, {
    index,
    sourceFilename: sourceFilenames[index],
  }));
  const primary = sites[primaryIndex];
  const eligiblePeers = sites.filter((site, index) => index !== primaryIndex && site.status === 'OK');
  const peerGaps = [];
  if (primary.status === 'OK') {
    for (const primaryCapability of primary.capabilities) {
      if (primaryCapability.state !== 'WARN' && primaryCapability.state !== 'ERROR') continue;
      for (const peer of eligiblePeers) {
        const peerCapability = peer.capabilities.find(({ id }) => id === primaryCapability.id);
        if (peerCapability?.state !== 'PASS') continue;
        peerGaps.push({
          capabilityId: primaryCapability.id,
          owner: primaryCapability.owner,
          primary: {
            url: primary.url,
            state: primaryCapability.state,
            code: primaryCapability.finding.code,
            receiptId: primaryCapability.receiptId,
          },
          peer: {
            url: peer.url,
            state: peerCapability.state,
            code: peerCapability.finding.code,
            receiptId: peerCapability.receiptId,
          },
        });
      }
    }
  }

  const primaryActions = primary.status === 'OK'
    ? primary.capabilities
      .filter(({ state }) => state === 'ERROR' || state === 'WARN')
      .map((capability) => actionFor(capability, peerGaps))
      .sort((left, right) => {
        const severity = STATE_ORDER[left.state] - STATE_ORDER[right.state];
        if (severity !== 0) return severity;
        const peerEvidence = Number(right.peerProof.length > 0) - Number(left.peerProof.length > 0);
        if (peerEvidence !== 0) return peerEvidence;
        return CAPABILITY_BY_ID.get(left.capabilityId).order - CAPABILITY_BY_ID.get(right.capabilityId).order;
      })
    : [];

  return {
    auditVersion: AUDIT_PACKAGE,
    capabilities: CAPABILITY_TAXONOMY,
    sites,
    primary,
    eligiblePeers,
    peerGaps,
    primaryActions,
    evidenceReceipts: sites.flatMap(({ evidenceReceipts }) => evidenceReceipts),
  };
}
