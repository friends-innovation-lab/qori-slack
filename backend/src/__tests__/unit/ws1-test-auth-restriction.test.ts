/**
 * WS-1: Test Auth Adapter Restriction Tests
 *
 * Proves localTestAdapter cannot activate in production or remote deployments.
 */

describe('localTestAdapter restriction', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  function loadAdapter() {
    return require('../../middleware/auth/localTestAdapter').localTestAdapter;
  }

  function mockRequest(headers: Record<string, string> = {}) {
    return { headers } as any;
  }

  // ─── Production blocks ────────────────────────────────────────

  it('returns null in NODE_ENV=production even with X-Test-Actor-PublicId', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_TEST_AUTH;
    const adapter = loadAdapter();
    const result = await adapter.extractIdentity(
      mockRequest({ 'x-test-actor-publicid': 'actor-uuid-123' }),
    );
    expect(result).toBeNull();
  });

  it('returns null in NODE_ENV=production even with ALLOW_TEST_AUTH=true', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_TEST_AUTH = 'true';
    const adapter = loadAdapter();
    const result = await adapter.extractIdentity(
      mockRequest({ 'x-test-actor-publicid': 'actor-uuid-123' }),
    );
    expect(result).toBeNull();
  });

  // ─── No NODE_ENV blocks ───────────────────────────────────────

  it('returns null when NODE_ENV is unset', async () => {
    delete process.env.NODE_ENV;
    delete process.env.ALLOW_TEST_AUTH;
    const adapter = loadAdapter();
    const result = await adapter.extractIdentity(
      mockRequest({ 'x-test-actor-publicid': 'actor-uuid-123' }),
    );
    expect(result).toBeNull();
  });

  it('returns null when NODE_ENV is unset even with ALLOW_TEST_AUTH', async () => {
    delete process.env.NODE_ENV;
    process.env.ALLOW_TEST_AUTH = 'true';
    const adapter = loadAdapter();
    const result = await adapter.extractIdentity(
      mockRequest({ 'x-test-actor-publicid': 'actor-uuid-123' }),
    );
    expect(result).toBeNull();
  });

  // ─── Test environment works ───────────────────────────────────

  it('returns identity in NODE_ENV=test with header', async () => {
    process.env.NODE_ENV = 'test';
    const adapter = loadAdapter();
    const result = await adapter.extractIdentity(
      mockRequest({ 'x-test-actor-publicid': 'actor-uuid-123' }),
    );
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('local_test');
    expect(result!.providerSubject).toBe('actor-uuid-123');
  });

  it('returns null in NODE_ENV=test without header', async () => {
    process.env.NODE_ENV = 'test';
    const adapter = loadAdapter();
    const result = await adapter.extractIdentity(mockRequest({}));
    expect(result).toBeNull();
  });

  // ─── Development explicit opt-in ──────────────────────────────

  it('returns identity in NODE_ENV=development with ALLOW_TEST_AUTH=true', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_TEST_AUTH = 'true';
    const adapter = loadAdapter();
    const result = await adapter.extractIdentity(
      mockRequest({ 'x-test-actor-publicid': 'actor-uuid-456' }),
    );
    expect(result).not.toBeNull();
    expect(result!.providerSubject).toBe('actor-uuid-456');
  });

  it('returns null in NODE_ENV=development without ALLOW_TEST_AUTH', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ALLOW_TEST_AUTH;
    const adapter = loadAdapter();
    const result = await adapter.extractIdentity(
      mockRequest({ 'x-test-actor-publicid': 'actor-uuid-456' }),
    );
    expect(result).toBeNull();
  });

  it('returns null in NODE_ENV=development with ALLOW_TEST_AUTH=false', async () => {
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_TEST_AUTH = 'false';
    const adapter = loadAdapter();
    const result = await adapter.extractIdentity(
      mockRequest({ 'x-test-actor-publicid': 'actor-uuid-456' }),
    );
    expect(result).toBeNull();
  });

  // ─── Railway simulation ───────────────────────────────────────

  it('blocks test auth under Railway production config', async () => {
    // Railway runs NODE_ENV=production and should never set ALLOW_TEST_AUTH
    process.env.NODE_ENV = 'production';
    process.env.RAILWAY_ENVIRONMENT = 'production';
    delete process.env.ALLOW_TEST_AUTH;
    const adapter = loadAdapter();
    const result = await adapter.extractIdentity(
      mockRequest({ 'x-test-actor-publicid': 'actor-uuid-789' }),
    );
    expect(result).toBeNull();
  });

  it('blocks test auth under Railway dev config', async () => {
    // Railway dev also runs NODE_ENV=production
    process.env.NODE_ENV = 'production';
    process.env.RAILWAY_ENVIRONMENT = 'development';
    delete process.env.ALLOW_TEST_AUTH;
    const adapter = loadAdapter();
    const result = await adapter.extractIdentity(
      mockRequest({ 'x-test-actor-publicid': 'actor-uuid-789' }),
    );
    expect(result).toBeNull();
  });
});
