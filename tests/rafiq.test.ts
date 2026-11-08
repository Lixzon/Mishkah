import assert from 'node:assert/strict';
import test from 'node:test';
import { searchRafiqOnline } from '../src/services/rafiq';

test('Rafiq online answer validation', async (t) => {
  await t.test('returns a validated answer and at most five secure source links', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({
      answer: 'A current answer.',
      sources: Array.from({ length: 6 }, (_, index) => ({
        title: `Source ${index + 1}`,
        url: `https://example.com/${index + 1}`,
      })),
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    try {
      const result = await searchRafiqOnline('https://api.example.com/rafiq', '  a question  ');
      assert.equal(result.answer, 'A current answer.');
      assert.equal(result.sources.length, 5);
      assert.equal(result.sources[0]?.url, 'https://example.com/1');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await t.test('rejects insecure online endpoints', async () => {
    await assert.rejects(
      searchRafiqOnline('http://api.example.com/rafiq', 'a question'),
      /secure HTTPS endpoint/,
    );
  });

  await t.test('rejects answers without a secure source link', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({
      answer: 'An answer without a secure source.',
      sources: [{ title: 'Insecure', url: 'http://example.com' }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    try {
      await assert.rejects(
        searchRafiqOnline('https://api.example.com/rafiq', 'a question'),
        /verified HTTPS source links/,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
