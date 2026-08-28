import assert from 'node:assert/strict';
import test from 'node:test';

import { renderBriefSvg } from '../lib/render-brief-svg.mjs';

const baseView = (overrides = {}) => ({
  generatedAt: '2026-08-28T16:30:00.000Z',
  subject: 'example.dev',
  competitors: ['peer.dev'],
  outcome: { severity: 'warn', title: 'One access gap needs review' },
  proof: {
    mode: 'differential',
    title: 'Same homepage request',
    browserLabel: 'Browser control',
    browserStatus: '200',
    crawlerLabel: 'Google-Extended',
    crawlerStatus: '403',
    verdict: 'Crawler identity received a different response',
    evidence: 'google-extended -> status=403; browser -> status=200',
  },
  actions: [
    {
      severity: 'error',
      title: 'Review crawler access policy',
      owner: 'Infrastructure',
      evidence: 'Google-Extended received HTTP 403.',
      verify: 'Repeat the same paired request and compare status codes.',
    },
  ],
  ...overrides,
});

test('renders a fixed, accessible evidence sheet with the required visual tokens', () => {
  const svg = renderBriefSvg(baseView());

  assert.match(svg, /<svg\b[^>]*\bwidth="1440"[^>]*\bheight="900"[^>]*\bviewBox="0 0 1440 900"[^>]*\brole="img"/);
  assert.match(svg, /<title\b[^>]*>AgentMarkup field report for example\.dev<\/title>/);
  assert.match(svg, /<desc\b[^>]*>[^<]+<\/desc>/);
  assert.match(svg, /font-family="system-ui,/);
  assert.match(svg, /font-family="ui-monospace,/);

  for (const color of ['#162033', '#2563EB', '#087F6B', '#B65F08', '#B42318', '#667085']) {
    assert.ok(svg.includes(color), `expected palette color ${color}`);
  }
});

test('escapes untrusted text, removes controls, and emits no active or external content', () => {
  const svg = renderBriefSvg(baseView({
    subject: `Acme <>&"'\u0000 Labs`,
    competitors: [`Peer <>&"'\u0007 Works`],
    outcome: { severity: 'unknown', title: `<script>alert("x")</script> & 'unknown'` },
    proof: {
      ...baseView().proof,
      title: `Probe <>&"'`,
      evidence: `<script src="https://bad.invalid/x.js">& exploit</script>`,
    },
  }));

  assert.ok(svg.includes(`Acme &lt;&gt;&amp;&quot;&apos; Labs`));
  assert.ok(svg.includes(`Probe &lt;&gt;&amp;&quot;&apos;`));
  assert.ok(svg.includes(`&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &apos;unknown&apos;`));
  assert.doesNotMatch(svg, /<script\b/i);
  assert.doesNotMatch(svg, /<foreignObject\b/i);
  assert.doesNotMatch(svg, /\b(?:href|xlink:href)\s*=/i);
  assert.doesNotMatch(svg, /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/);
  assert.match(svg, />UNKNOWN</);
});

test('renders the differential trace and at most two explicit action cards', () => {
  const svg = renderBriefSvg(baseView({
    outcome: { severity: 'error', title: 'Differential response confirmed' },
    proof: { ...baseView().proof, severity: 'warn' },
    actions: [
      {
        severity: 'warn',
        title: 'Inspect the edge policy',
        owner: 'Infrastructure',
        evidence: 'Browser 200; crawler identity 403.',
        verify: 'Repeat the paired request.',
      },
      {
        severity: 'unknown',
        title: 'Confirm verified-crawler behavior',
        owner: 'Site owner',
        evidence: 'Verified crawler IP behavior was not measured.',
        verify: 'Review provider logs before changing policy.',
      },
      {
        severity: 'pass',
        title: 'This third card must not render',
        owner: 'Nobody',
        evidence: 'Outside the visual limit.',
        verify: 'Not applicable.',
      },
    ],
  }));

  assert.match(svg, /data-mode="differential"/);
  assert.match(svg, />DIFFERENTIAL RESPONSE</);
  assert.match(svg, />Browser control</);
  assert.match(svg, />Google-Extended</);
  assert.match(svg, />200</);
  assert.match(svg, />403</);
  assert.match(svg, />ERROR</);
  assert.match(svg, />WARN</);
  assert.match(svg, />UNKNOWN</);
  assert.match(svg, /d="M300 445 H348 V459 H966"[^>]+stroke="#B65F08"[^>]+marker-end="url\(#arrow-warn\)"/);
  assert.equal((svg.match(/data-action-card=/g) ?? []).length, 2);
  assert.doesNotMatch(svg, /This third card must not render/);
});

test('renders matched identities as an explicit pass state', () => {
  const svg = renderBriefSvg(baseView({
    outcome: { severity: 'pass', title: 'All tested identities matched the browser' },
    proof: {
      mode: 'matched',
      title: 'Same homepage request',
      browserLabel: 'Browser control',
      browserStatus: '200',
      crawlerLabel: 'GPTBot identity',
      crawlerStatus: '200',
      verdict: 'Both requests received HTTP 200',
      evidence: 'gptbot -> status=200; browser -> status=200',
    },
    actions: [],
  }));

  assert.match(svg, /data-mode="matched"/);
  assert.match(svg, />MATCHED RESPONSE</);
  assert.match(svg, />PASS</);
  assert.match(svg, /No remediation action is justified by this proof/);
});

test('caps and wraps long fields so they cannot expand the canvas or markup without bound', () => {
  const unbroken = 'X'.repeat(5_000);
  const svg = renderBriefSvg(baseView({
    subject: unbroken,
    competitors: [unbroken, unbroken, unbroken, unbroken, unbroken],
    outcome: { severity: 'warn', title: unbroken },
    proof: { ...baseView().proof, evidence: unbroken },
    actions: [{ severity: 'warn', title: unbroken, owner: unbroken, evidence: unbroken, verify: unbroken }],
  }));

  assert.ok(svg.length < 35_000, `expected bounded SVG output, got ${svg.length} characters`);
  assert.doesNotMatch(svg, /X{200}/);
  assert.match(svg, /…/);
});
