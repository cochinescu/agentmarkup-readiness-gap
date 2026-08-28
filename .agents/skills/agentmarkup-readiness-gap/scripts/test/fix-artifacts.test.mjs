import test from 'node:test';
import assert from 'node:assert/strict';

import { buildFixArtifacts } from '../lib/fix-artifacts.mjs';

const groundedHome = {
  ok: true,
  status: 200,
  title: 'Agentic Infrastructure - Vercel',
  description: 'The autonomous stack for every app and agent.',
};

test('does not replace valid llms.txt or rewrite a passing crawler policy', () => {
  const result = buildFixArtifacts({
    subjectUrl: 'https://vercel.com',
    generatedAt: '2026-08-28T16:15:28.968Z',
    home: groundedHome,
    robots: { ok: true, status: 200 },
    findings: [
      { code: 'robots.crawlers-allowed', level: 'pass', title: 'AI crawlers allowed' },
      { code: 'robots.content-signal', level: 'pass', title: 'Content-Signal present', evidence: 'search=yes, ai-input=yes, ai-train=no' },
      { code: 'llms.present', level: 'pass', title: 'llms.txt present' },
      { code: 'llms.no-discovery-link', level: 'warn', title: 'llms.txt is not linked', fix: 'Inject discovery link.' },
      { code: 'notfound.soft-404-custom', level: 'warn', title: 'Missing paths return 200', evidence: 'GET /probe -> 200', fix: 'Return 404.' },
    ],
    actions: [
      { id: 'E-001', title: 'llms.txt is not linked', owner: 'agentmarkup', evidence: 'audit-derived assertion', verify: 'Rerun and require llms discovery to pass' },
      { id: 'E-002', title: 'Missing paths return 200', owner: 'infrastructure', evidence: 'GET /probe -> 200', verify: 'GET /probe returns 404' },
    ],
  });

  assert.match(result.llmsText, /NO REPLACEMENT RECOMMENDED/);
  assert.match(result.llmsText, /rel="alternate"/);
  assert.doesNotMatch(result.llmsText, /TODO curated key pages/);
  assert.match(result.robotsText, /NO CHANGE RECOMMENDED/);
  assert.doesNotMatch(result.robotsText, /ai-train=(?:yes|no)/);
  assert.match(result.fixPackText, /E-001/);
  assert.match(result.fixPackText, /E-002/);
  assert.match(result.fixPackText, /GET \/probe returns 404/);
  assert.match(result.studioText, /Missing paths return 200/);
  assert.doesNotMatch(result.studioText, /see out\/report\.md/i);
});

test('requires owner policy input when Content-Signal is absent', () => {
  const result = buildFixArtifacts({
    subjectUrl: 'https://example.com',
    generatedAt: '2026-08-28T16:15:28.968Z',
    home: groundedHome,
    robots: { ok: true, status: 200 },
    findings: [
      { code: 'robots.no-content-signal', level: 'warn', title: 'No Content-Signal policy' },
      { code: 'llms.missing', level: 'error', title: 'llms.txt missing' },
    ],
    actions: [],
  });

  assert.match(result.robotsText, /POLICY INPUT REQUIRED/);
  assert.match(result.robotsText, /\[TODO\]/);
  assert.doesNotMatch(result.robotsText, /ai-train=(?:yes|no)/);
  assert.match(result.llmsText, /Agentic Infrastructure - Vercel/);
  assert.match(result.llmsText, /\[TODO curated key pages/);
});

test('emits TODO-only artifacts when the primary is not grounded', () => {
  const result = buildFixArtifacts({
    subjectUrl: 'https://missing.invalid',
    generatedAt: '2026-08-28T16:15:28.968Z',
    home: { ok: false, status: 'fetch-failed' },
    robots: { ok: false, status: 'fetch-failed' },
    primaryStatus: 'UNKNOWN',
    primaryReason: 'no browser baseline',
    findings: [],
    actions: [],
  });

  assert.match(result.llmsText, /\[TODO\]/);
  assert.match(result.robotsText, /\[TODO\]/);
  assert.match(result.fixPackText, /UNKNOWN/);
});

test('does not replace an invalid existing llms.txt without its source body', () => {
  const result = buildFixArtifacts({
    subjectUrl: 'https://example.com',
    generatedAt: '2026-08-28T16:15:28.968Z',
    home: groundedHome,
    robots: { ok: true, status: 200 },
    findings: [{ code: 'llms.invalid', level: 'error', title: 'llms.txt has errors', evidence: 'must start with H1' }],
    actions: [],
  });

  assert.match(result.llmsText, /REPAIR EXISTING FILE/);
  assert.match(result.llmsText, /\[TODO\]/);
  assert.doesNotMatch(result.llmsText, /## Pages/);
});
