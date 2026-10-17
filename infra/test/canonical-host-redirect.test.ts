import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { createContext, runInContext } from 'node:vm';
import { canonicalHostRedirectSource } from '../lib/canonical-host-redirect';

type Field = { value: string; multiValue?: { value: string }[] };
type Request = {
  uri: string;
  querystring: Record<string, Field>;
  headers: Record<string, Field>;
};
type Redirect = {
  statusCode: number;
  statusDescription: string;
  headers: { location: { value: string } };
};
type Handler = (event: { request: Request }) => Request | Redirect;

const CANONICAL = 'dev.livingwithkrishna.com';

/** Runs the generated source the way CloudFront Functions does: a script defining `handler`. */
function loadHandler(canonicalHostName: string): Handler {
  const context = createContext({});
  runInContext(canonicalHostRedirectSource(canonicalHostName), context);
  return context.handler as Handler;
}

const handler = loadHandler(CANONICAL);

function request(
  host: string | undefined,
  uri: string,
  querystring: Record<string, Field> = {},
): { request: Request } {
  const headers: Record<string, Field> = host === undefined ? {} : { host: { value: host } };
  return { request: { uri, querystring, headers } };
}

function location(result: Request | Redirect): string {
  assert.ok('statusCode' in result, 'expected a redirect');
  assert.equal(result.statusCode, 301);
  return result.headers.location.value;
}

describe('canonical host redirect', () => {
  it('passes requests for the canonical host through unchanged', () => {
    const event = request(CANONICAL, '/courses', { q: { value: 'gita' } });
    assert.equal(handler(event), event.request);
  });

  it('ignores the case of the Host header', () => {
    const event = request('DEV.LivingWithKrishna.com', '/');
    assert.equal(handler(event), event.request);
  });

  it('redirects other hosts to the same path, without a query mark when there is no query', () => {
    const result = handler(request('d1uih31m6ki5c2.cloudfront.net', '/help'));
    assert.equal(location(result), `https://${CANONICAL}/help`);
  });

  it('redirects when the Host header is missing', () => {
    assert.equal(location(handler(request(undefined, '/'))), `https://${CANONICAL}/`);
  });

  it('keeps encoded, repeated and empty query values exactly as received', () => {
    const result = handler(
      request('d1uih31m6ki5c2.cloudfront.net', '/courses', {
        q: { value: 'a%20b+c%26d' },
        tag: { value: '1', multiValue: [{ value: '1' }, { value: '2' }] },
        flag: { value: '' },
      }),
    );
    assert.equal(location(result), `https://${CANONICAL}/courses?q=a%20b+c%26d&tag=1&tag=2&flag=`);
  });

  it('keeps the code and state of a sign-in callback', () => {
    const result = handler(
      request('d1uih31m6ki5c2.cloudfront.net', '/auth/callback', {
        code: { value: 'abc-123' },
        state: { value: 'eyJ4IjoxfQ' },
      }),
    );
    assert.equal(
      location(result),
      `https://${CANONICAL}/auth/callback?code=abc-123&state=eyJ4IjoxfQ`,
    );
  });

  it('redirects www to the apex for the main address', () => {
    const apex = loadHandler('livingwithkrishna.com');
    const result = apex(request('www.livingwithkrishna.com', '/'));
    assert.equal(location(result), 'https://livingwithkrishna.com/');
  });

  it('stays within the 10 KB size limit of CloudFront Functions', () => {
    assert.ok(Buffer.byteLength(canonicalHostRedirectSource(CANONICAL)) < 10 * 1024);
  });

  for (const invalid of [
    'https://dev.livingwithkrishna.com',
    'Dev.LivingWithKrishna.com',
    'dev.livingwithkrishna.com.',
    'localhost',
    "dev.livingwithkrishna.com'; throw 1; '",
    '${Token[TOKEN.123]}',
  ]) {
    it(`rejects ${JSON.stringify(invalid)} as a canonical host name`, () => {
      assert.throws(() => canonicalHostRedirectSource(invalid), /bare lowercase host name/);
    });
  }
});
