import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  SafeOriginError,
  assertCanonicalPublicOrigin,
  canonicalizePublicOrigin,
} from '../lib/safe-origin.mjs';

function assertRefused(entry, code, message) {
  assert.throws(
    () => canonicalizePublicOrigin(entry),
    (error) => {
      assert.ok(error instanceof SafeOriginError);
      assert.equal(error.code, code);
      assert.equal(error.message, message);
      return true;
    },
  );
}

describe('canonicalizePublicOrigin', () => {
  it('canonicalizes valid domains to an HTTPS origin', () => {
    assert.equal(canonicalizePublicOrigin('example.com'), 'https://example.com');
    assert.equal(
      canonicalizePublicOrigin(' HTTPS://Docs.Example.COM:443/guide?from=test#intro '),
      'https://docs.example.com',
    );
    assert.equal(canonicalizePublicOrigin('http://example.com:80/path'), 'https://example.com');
    assert.equal(canonicalizePublicOrigin('https://example.com:8443/path'), 'https://example.com:8443');
    assert.equal(canonicalizePublicOrigin('https://BÜCHER.de./catalog'), 'https://xn--bcher-kva.de');
  });

  it('refuses all IPv4 and IPv6 literals, including private and loopback addresses', () => {
    assertRefused(
      'https://192.168.1.1',
      'ip-literal',
      'refused: IP literals are not allowed ("192.168.1.1")',
    );
    assertRefused(
      'https://127.0.0.1',
      'ip-literal',
      'refused: IP literals are not allowed ("127.0.0.1")',
    );
    assertRefused(
      'https://[::1]',
      'ip-literal',
      'refused: IP literals are not allowed ("::1")',
    );
    assertRefused(
      'https://8.8.8.8',
      'ip-literal',
      'refused: IP literals are not allowed ("8.8.8.8")',
    );
  });

  it('refuses localhost and dot-localhost aliases', () => {
    assertRefused(
      'localhost',
      'localhost',
      'refused: localhost names are not allowed ("localhost")',
    );
    assertRefused(
      'https://api.localhost/path',
      'localhost',
      'refused: localhost names are not allowed ("api.localhost")',
    );
  });

  it('refuses credentialed authorities without echoing credential values', () => {
    assertRefused(
      'https://user:secret@example.com/path',
      'credentials',
      'refused: credentials or "@" in the URL authority are not allowed',
    );
    assertRefused(
      'https://example.com@public.example.net',
      'credentials',
      'refused: credentials or "@" in the URL authority are not allowed',
    );
  });

  it('refuses shell metacharacters before URL parsing', () => {
    assertRefused(
      'example.com; touch marker',
      'shell-metacharacter',
      'refused: shell metacharacters are not allowed',
    );
    assertRefused(
      'https://example.com/$(touch marker)',
      'shell-metacharacter',
      'refused: shell metacharacters are not allowed',
    );
  });

  it('refuses non-HTTP schemes', () => {
    assertRefused(
      'ftp://example.com/file',
      'unsupported-scheme',
      'refused: only http and https URLs are allowed (got "ftp:")',
    );
  });

  it('refuses textual private and reserved aliases without DNS access', () => {
    for (const hostname of [
      'metadata.google.internal',
      'instance-data',
      'router.local',
      'service.test',
    ]) {
      assertRefused(
        hostname,
        'private-or-reserved-hostname',
        `refused: private or reserved hostname is not allowed ("${hostname}")`,
      );
    }
  });

  it('refuses invalid DNS hostnames', () => {
    for (const hostname of ['bad_host.example.com', '-bad.example.com', 'bad-.example.com', 'example..com', 'com']) {
      assertRefused(
        hostname,
        'invalid-hostname',
        `refused: invalid hostname ("${hostname}")`,
      );
    }
  });
});

describe('assertCanonicalPublicOrigin', () => {
  it('returns an already-canonical public HTTPS origin', () => {
    assert.equal(assertCanonicalPublicOrigin('https://docs.example.com'), 'https://docs.example.com');
    assert.equal(assertCanonicalPublicOrigin('https://docs.example.com:8443'), 'https://docs.example.com:8443');
  });

  it('rejects safe inputs that are not already canonical runner arguments', () => {
    assert.throws(
      () => assertCanonicalPublicOrigin('http://example.com/path'),
      (error) => {
        assert.ok(error instanceof SafeOriginError);
        assert.equal(error.code, 'non-canonical-origin');
        assert.equal(
          error.message,
          'refused: expected canonical HTTPS origin "https://example.com"',
        );
        return true;
      },
    );
  });

  it('preserves the precise safety refusal for an unsafe runner argument', () => {
    assert.throws(
      () => assertCanonicalPublicOrigin('https://127.0.0.1'),
      (error) => error instanceof SafeOriginError && error.code === 'ip-literal',
    );
  });
});
