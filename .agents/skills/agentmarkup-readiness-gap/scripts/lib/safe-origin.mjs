import { isIP } from 'node:net';

const SHELL_METACHARACTERS = /[\s;&|`$<>()\\!*{}'"]/u;
const HOST_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;
const RESERVED_HOSTS = new Set([
  'broadcasthost',
  'instance-data',
  'ip6-localhost',
  'ip6-loopback',
  'kubernetes.default.svc',
  'localhost.localdomain',
  'metadata',
  'metadata.google.internal',
]);
const RESERVED_SUFFIXES = [
  '.arpa',
  '.corp',
  '.example',
  '.home',
  '.internal',
  '.invalid',
  '.intranet',
  '.lan',
  '.local',
  '.localdomain',
  '.onion',
  '.svc',
  '.test',
];

export class SafeOriginError extends TypeError {
  constructor(code, message) {
    super(message);
    this.name = 'SafeOriginError';
    this.code = code;
  }
}

function refuse(code, message) {
  throw new SafeOriginError(code, `refused: ${message}`);
}

function validateHostname(hostname) {
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    refuse('localhost', `localhost names are not allowed ("${hostname}")`);
  }

  if (
    RESERVED_HOSTS.has(hostname) ||
    RESERVED_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    refuse(
      'private-or-reserved-hostname',
      `private or reserved hostname is not allowed ("${hostname}")`,
    );
  }

  const labels = hostname.split('.');
  if (
    hostname.length > 253 ||
    labels.length < 2 ||
    labels.some((label) => !HOST_LABEL.test(label))
  ) {
    refuse('invalid-hostname', `invalid hostname ("${hostname}")`);
  }
}

/**
 * Convert a user-supplied domain or HTTP(S) URL to a textual public HTTPS
 * origin. This deliberately does not perform DNS resolution.
 */
export function canonicalizePublicOrigin(entry) {
  if (typeof entry !== 'string' || entry.trim() === '') {
    refuse('empty-entry', 'entry must be a non-empty string');
  }

  const raw = entry.trim();
  if (SHELL_METACHARACTERS.test(raw)) {
    refuse('shell-metacharacter', 'shell metacharacters are not allowed');
  }

  const scheme = /^([a-z][a-z\d+.-]*):/iu.exec(raw);
  const looksLikeHostPort = /^[^/?#]+:\d+(?:[/?#]|$)/u.test(raw);
  if (scheme && !looksLikeHostPort && !/^https?:$/iu.test(scheme[0])) {
    refuse(
      'unsupported-scheme',
      `only http and https URLs are allowed (got "${scheme[1].toLowerCase()}:")`,
    );
  }

  const hasHttpScheme = /^https?:\/\//iu.test(raw);
  const candidate = hasHttpScheme ? raw : `https://${raw}`;
  const authority = candidate.slice(candidate.indexOf('//') + 2).split(/[/?#]/u, 1)[0];
  if (authority.includes('@')) {
    refuse('credentials', 'credentials or "@" in the URL authority are not allowed');
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    refuse('invalid-url', 'entry is not a valid HTTP(S) URL');
  }

  if (parsed.username !== '' || parsed.password !== '') {
    refuse('credentials', 'credentials or "@" in the URL authority are not allowed');
  }

  let hostname = parsed.hostname.toLowerCase();
  const ipCandidate = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;
  if (isIP(ipCandidate) !== 0) {
    refuse('ip-literal', `IP literals are not allowed ("${ipCandidate}")`);
  }

  hostname = hostname.replace(/\.$/u, '');
  validateHostname(hostname);

  const port = parsed.port === '443' ? '' : parsed.port;
  return `https://${hostname}${port ? `:${port}` : ''}`;
}

/**
 * Assert that a runner argument is already in canonical public-origin form.
 */
export function assertCanonicalPublicOrigin(origin) {
  const canonical = canonicalizePublicOrigin(origin);
  if (origin !== canonical) {
    refuse('non-canonical-origin', `expected canonical HTTPS origin "${canonical}"`);
  }
  return canonical;
}
