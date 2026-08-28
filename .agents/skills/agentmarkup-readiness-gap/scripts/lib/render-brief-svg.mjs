const COLORS = Object.freeze({
  ink: '#162033',
  trace: '#2563EB',
  pass: '#087F6B',
  warn: '#B65F08',
  error: '#B42318',
  unknown: '#667085',
});

const TONES = Object.freeze({
  PASS: { color: COLORS.pass, tint: '#E7F5F1', marker: 'arrow-pass' },
  WARN: { color: COLORS.warn, tint: '#FFF3E8', marker: 'arrow-warn' },
  ERROR: { color: COLORS.error, tint: '#FDECEC', marker: 'arrow-error' },
  UNKNOWN: { color: COLORS.unknown, tint: '#F0F2F5', marker: 'arrow-unknown' },
});

function cleanText(value, maxChars = 240, fallback = 'Not reported') {
  let safe = '';
  for (const character of String(value ?? '')) {
    const point = character.codePointAt(0);
    const validXml =
      (point >= 0x20 && point <= 0xd7ff) ||
      (point >= 0xe000 && point <= 0xfffd) ||
      (point >= 0x10000 && point <= 0x10ffff);
    const bidiControl =
      (point >= 0x202a && point <= 0x202e) ||
      (point >= 0x2066 && point <= 0x2069);
    safe += validXml && !bidiControl ? character : ' ';
  }
  safe = safe.replace(/\s+/gu, ' ').trim();
  if (!safe) safe = fallback;

  const points = [...safe];
  if (points.length <= maxChars) return safe;
  return `${points.slice(0, Math.max(1, maxChars - 1)).join('')}…`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function withEllipsis(value, limit) {
  const points = [...value];
  if (points.length <= limit) return value;
  return `${points.slice(0, Math.max(1, limit - 1)).join('')}…`;
}

function wrapText(value, columns, maxLines, fallback = 'Not reported') {
  const input = cleanText(value, columns * maxLines * 3, fallback);
  const words = input.split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const chunks = [];
    let rest = word;
    while ([...rest].length > columns) {
      chunks.push([...rest].slice(0, columns).join(''));
      rest = [...rest].slice(columns).join('');
    }
    if (rest) chunks.push(rest);

    for (const chunk of chunks) {
      const candidate = current ? `${current} ${chunk}` : chunk;
      if ([...candidate].length <= columns) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = chunk;
      }
      if (lines.length === maxLines) break;
    }
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && current) lines.push(current);

  const consumed = lines.join(' ').replace(/…$/u, '');
  if (consumed.length < input.length && lines.length) {
    lines[lines.length - 1] = withEllipsis(lines[lines.length - 1], columns - 1).replace(/…?$/u, '…');
  }
  return lines.slice(0, maxLines);
}

function normalizeStatus(value, fallback = 'UNKNOWN') {
  const token = cleanText(value, 24, '').toLowerCase();
  if (/^(pass|passed|ok|success|matched)$/.test(token)) return 'PASS';
  if (/^(warn|warning|review)$/.test(token)) return 'WARN';
  if (/^(error|fail|failed|critical|blocked)$/.test(token)) return 'ERROR';
  if (/^(unknown|not reported|unavailable)$/.test(token)) return 'UNKNOWN';
  return fallback;
}

function outcomeData(outcome, proofMode) {
  if (outcome && typeof outcome === 'object' && !Array.isArray(outcome)) {
    return {
      status: normalizeStatus(outcome.severity ?? outcome.status, proofMode === 'matched' ? 'PASS' : 'WARN'),
      title: cleanText(outcome.title ?? outcome.summary ?? outcome.label, 130),
    };
  }
  return {
    status: proofMode === 'matched' ? 'PASS' : 'WARN',
    title: cleanText(outcome, 130),
  };
}

function textBlock(lines, x, y, options = {}) {
  const {
    size = 16,
    weight = 500,
    fill = COLORS.ink,
    lineHeight = Math.round(size * 1.35),
    mono = false,
    letterSpacing = 0,
  } = options;
  const family = mono
    ? 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
    : 'system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
  const tspans = lines
    .map((line, index) => `<tspan x="${x}"${index ? ` dy="${lineHeight}"` : ''}>${escapeXml(line)}</tspan>`)
    .join('');
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${family}" font-size="${size}" font-weight="${weight}" letter-spacing="${letterSpacing}">${tspans}</text>`;
}

function statusBadge(x, y, status) {
  const tone = TONES[status] ?? TONES.UNKNOWN;
  const width = status === 'UNKNOWN' ? 96 : 78;
  return [
    `<rect x="${x}" y="${y}" width="${width}" height="32" rx="16" fill="${tone.tint}" stroke="${tone.color}" stroke-width="1"/>`,
    `<text x="${x + width / 2}" y="${y + 21}" text-anchor="middle" fill="${tone.color}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="12" font-weight="700" letter-spacing="0.7">${status}</text>`,
  ].join('');
}

function responseNode(x, y, value, status) {
  const tone = TONES[status] ?? TONES.UNKNOWN;
  return [
    `<rect x="${x}" y="${y}" width="150" height="58" rx="12" fill="${tone.tint}" stroke="${tone.color}" stroke-width="1.5"/>`,
    textBlock(wrapText(value, 12, 1), x + 75, y + 36, { size: 21, weight: 760, fill: tone.color, mono: true }),
  ].join('').replace(`x="${x + 75}"`, `x="${x + 75}" text-anchor="middle"`);
}

function actionCard(action, index, count) {
  const one = count === 1;
  const x = one ? 64 : 64 + index * 656;
  const width = one ? 1312 : 640;
  const status = normalizeStatus(action?.severity);
  const owner = cleanText(action?.owner, 54);
  const title = wrapText(action?.title, one ? 48 : 54, 2);
  const evidence = wrapText(action?.evidence, one ? 74 : 70, one ? 2 : 1);
  const verify = wrapText(action?.verify, one ? 74 : 70, one ? 2 : 1);

  const parts = [
    `<g data-action-card="${index + 1}">`,
    `<rect x="${x}" y="648" width="${width}" height="174" rx="16" fill="#FFFFFF" stroke="#D8E0EB"/>`,
    statusBadge(x + 24, 666, status),
    textBlock([`OWNER / ${owner}`], x + 128, 687, { size: 12, weight: 700, fill: COLORS.unknown, mono: true, letterSpacing: 0.4 }),
  ];

  if (one) {
    parts.push(
      textBlock(title, x + 24, 727, { size: 23, weight: 720, lineHeight: 27 }),
      textBlock(['OBSERVED EVIDENCE'], x + 584, 682, { size: 11, weight: 700, fill: COLORS.unknown, mono: true, letterSpacing: 0.6 }),
      textBlock(evidence, x + 584, 707, { size: 15, weight: 520, lineHeight: 20 }),
      textBlock(['DONE WHEN'], x + 584, 762, { size: 11, weight: 700, fill: COLORS.trace, mono: true, letterSpacing: 0.6 }),
      textBlock(verify, x + 584, 787, { size: 15, weight: 620, lineHeight: 20 }),
    );
  } else {
    parts.push(
      textBlock(title, x + 24, 727, { size: 19, weight: 720, lineHeight: 23 }),
      textBlock(['EVIDENCE'], x + 24, 779, { size: 10, weight: 700, fill: COLORS.unknown, mono: true, letterSpacing: 0.6 }),
      textBlock(evidence, x + 96, 779, { size: 13, weight: 520 }),
      textBlock(['VERIFY'], x + 24, 804, { size: 10, weight: 700, fill: COLORS.trace, mono: true, letterSpacing: 0.6 }),
      textBlock(verify, x + 96, 804, { size: 13, weight: 620 }),
    );
  }
  parts.push('</g>');
  return parts.join('\n');
}

export function renderBriefSvg(view = {}) {
  const proof = view?.proof && typeof view.proof === 'object' ? view.proof : {};
  const mode = String(proof.mode ?? '').toLowerCase() === 'matched' ? 'matched' : 'differential';
  const subject = cleanText(view?.subject, 64, 'Subject not reported');
  const generatedAt = cleanText(view?.generatedAt, 48, 'Generation time not reported');
  const peers = Array.isArray(view?.competitors)
    ? view.competitors.slice(0, 3).map((peer) => cleanText(peer, 48))
    : [];
  const peerLine = peers.length ? `Compared with ${peers.join(' · ')}` : 'No comparison domain supplied';
  const outcome = outcomeData(view?.outcome, mode);
  const outcomeTone = TONES[outcome.status];
  const crawlerTraceStatus = mode === 'matched'
    ? 'PASS'
    : normalizeStatus(proof.severity ?? proof.status, 'WARN');
  const crawlerTone = TONES[crawlerTraceStatus] ?? TONES.UNKNOWN;
  const actions = Array.isArray(view?.actions) ? view.actions.slice(0, 2) : [];

  const title = `AgentMarkup field report for ${subject}`;
  const description = `${mode === 'matched' ? 'Matched' : 'Differential'} same-URL request evidence for ${subject}. The sheet records response identities, observed status values, and up to two review actions.`;
  const modeLabel = mode === 'matched' ? 'MATCHED RESPONSE' : 'DIFFERENTIAL RESPONSE';
  const browserLabel = wrapText(proof.browserLabel, 24, 1, 'Browser control');
  const crawlerLabel = wrapText(proof.crawlerLabel, 24, 1, 'Crawler identity');

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900" viewBox="0 0 1440 900" role="img" aria-labelledby="report-title report-desc">`,
    `<title id="report-title">${escapeXml(title)}</title>`,
    `<desc id="report-desc">${escapeXml(description)}</desc>`,
    `<defs>`,
    `<marker id="arrow-blue" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${COLORS.trace}"/></marker>`,
    ...Object.entries(TONES).map(([name, tone]) => `<marker id="${tone.marker}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${tone.color}"/></marker>`),
    `</defs>`,
    `<rect width="1440" height="900" fill="#F7F9FC"/>`,
    `<path d="M64 42 H1376" stroke="#CAD5E3" stroke-width="1"/>`,
    textBlock(['AGENTMARKUP / FIELD REPORT'], 64, 72, { size: 12, weight: 750, fill: COLORS.trace, mono: true, letterSpacing: 1.3 }),
    textBlock([generatedAt], 1376, 72, { size: 11, weight: 600, fill: COLORS.unknown, mono: true }),
    textBlock(wrapText(subject, 42, 1), 64, 126, { size: 39, weight: 760 }),
    textBlock(wrapText(peerLine, 100, 1), 64, 156, { size: 14, weight: 520, fill: COLORS.unknown }),
    `<rect x="64" y="174" width="1312" height="50" rx="12" fill="${outcomeTone.tint}" stroke="${outcomeTone.color}"/>`,
    statusBadge(80, 183, outcome.status),
    textBlock(wrapText(outcome.title, 112, 1), 192, 206, { size: 16, weight: 700, fill: outcomeTone.color }),

    `<g data-mode="${mode}">`,
    `<rect x="64" y="244" width="1312" height="370" rx="20" fill="#FFFFFF" stroke="#D8E0EB"/>`,
    textBlock(['SAME URL / TWO REQUEST IDENTITIES'], 96, 278, { size: 11, weight: 750, fill: COLORS.trace, mono: true, letterSpacing: 1 }),
    textBlock(wrapText(proof.title, 70, 1, 'Paired homepage request'), 96, 309, { size: 22, weight: 720 }),
    `<rect x="96" y="339" width="204" height="142" rx="14" fill="#F1F5FB" stroke="#BFCDE0"/>`,
    textBlock(['SAME URL'], 116, 365, { size: 10, weight: 750, fill: COLORS.unknown, mono: true, letterSpacing: 0.8 }),
    textBlock(wrapText(subject, 19, 3), 116, 397, { size: 17, weight: 720, lineHeight: 22 }),
    `<path d="M300 375 H348 V367 H966" fill="none" stroke="${COLORS.trace}" stroke-width="3" marker-end="url(#arrow-blue)"/>`,
    `<path d="M300 445 H348 V459 H966" fill="none" stroke="${crawlerTone.color}" stroke-width="3" marker-end="url(#${crawlerTone.marker})"/>`,
    `<rect x="372" y="339" width="242" height="58" rx="12" fill="#EAF1FF" stroke="${COLORS.trace}"/>`,
    textBlock(browserLabel, 392, 374, { size: 15, weight: 680, fill: COLORS.trace }),
    `<rect x="372" y="431" width="242" height="58" rx="12" fill="${crawlerTone.tint}" stroke="${crawlerTone.color}"/>`,
    textBlock(crawlerLabel, 392, 466, { size: 15, weight: 680, fill: crawlerTone.color }),
    responseNode(986, 339, proof.browserStatus, 'PASS'),
    responseNode(986, 431, proof.crawlerStatus, crawlerTraceStatus),
    textBlock(['HTTP RESPONSE'], 1160, 374, { size: 10, weight: 700, fill: COLORS.unknown, mono: true, letterSpacing: 0.5 }),
    textBlock(['HTTP RESPONSE'], 1160, 466, { size: 10, weight: 700, fill: COLORS.unknown, mono: true, letterSpacing: 0.5 }),
    `<path d="M96 514 H1344" stroke="#D8E0EB"/>`,
    statusBadge(96, 532, mode === 'matched' ? 'PASS' : crawlerTraceStatus),
    textBlock([modeLabel], 210, 553, { size: 12, weight: 760, fill: crawlerTone.color, mono: true, letterSpacing: 0.8 }),
    textBlock(wrapText(proof.verdict, 76, 1), 410, 553, { size: 14, weight: 680 }),
    textBlock(['EVIDENCE'], 96, 591, { size: 10, weight: 750, fill: COLORS.unknown, mono: true, letterSpacing: 0.7 }),
    textBlock(wrapText(proof.evidence, 112, 1), 178, 591, { size: 13, weight: 560, fill: COLORS.unknown, mono: true }),
    `</g>`,

    ...(actions.length
      ? actions.map((action, index) => actionCard(action, index, actions.length))
      : [
          `<rect x="64" y="648" width="1312" height="174" rx="16" fill="#FFFFFF" stroke="#D8E0EB"/>`,
          statusBadge(88, 670, mode === 'matched' ? 'PASS' : 'UNKNOWN'),
          textBlock(['NO REVIEW ACTION'], 200, 691, { size: 11, weight: 750, fill: COLORS.unknown, mono: true, letterSpacing: 0.7 }),
          textBlock(['No remediation action is justified by this proof.'], 88, 747, { size: 22, weight: 710 }),
          textBlock(['Keep the evidence receipt and rerun after the site or edge policy changes.'], 88, 783, { size: 14, weight: 520, fill: COLORS.unknown }),
        ]),

    `<path d="M64 847 H1376" stroke="#CAD5E3"/>`,
    textBlock(['STATE KEY'], 64, 875, { size: 10, weight: 750, fill: COLORS.unknown, mono: true, letterSpacing: 0.7 }),
    ...[
      ['PASS', 142], ['WARN', 226], ['ERROR', 310], ['UNKNOWN', 402],
    ].map(([status, x]) => {
      const tone = TONES[status];
      return `<g><circle cx="${x}" cy="871" r="5" fill="${tone.color}"/><text x="${x + 11}" y="875" fill="${tone.color}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="10" font-weight="700">${status}</text></g>`;
    }),
    textBlock(['MEASURED: paired user-agent responses  /  NOT MEASURED: ranking, citation, or verified-crawler access'], 1376, 875, { size: 10, weight: 600, fill: COLORS.unknown, mono: true }),
    `</svg>`,
  ].join('\n');

  // Right-aligned header/footer labels use only static markup changes.
  return svg
    .replace(`x="1376" y="72"`, `x="1376" y="72" text-anchor="end"`)
    .replace(`x="1376" y="875"`, `x="1376" y="875" text-anchor="end"`);
}
