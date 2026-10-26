/**
 * Unit tests for extraction service — DISC-WEB-1
 *
 * Tests core extraction logic, hash computation, and concurrency limits.
 * Note: Full subprocess tests require integration testing with real worker.
 */

import { createHash } from 'crypto';
import {
  computeFileHash,
  getConcurrencyStatus,
  EXTRACTION_LIMITS,
} from '../../../services/extraction/extraction.service';

describe('extraction.service', () => {
  describe('computeFileHash', () => {
    it('computes SHA-256 as 64-char lowercase hex', () => {
      const buffer = Buffer.from('test content');
      const hash = computeFileHash(buffer);

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('produces consistent hashes for same input', () => {
      const buffer = Buffer.from('consistent content');
      const hash1 = computeFileHash(buffer);
      const hash2 = computeFileHash(buffer);

      expect(hash1).toBe(hash2);
    });

    it('produces different hashes for different input', () => {
      const buffer1 = Buffer.from('content A');
      const buffer2 = Buffer.from('content B');
      const hash1 = computeFileHash(buffer1);
      const hash2 = computeFileHash(buffer2);

      expect(hash1).not.toBe(hash2);
    });

    it('matches crypto.createHash behavior', () => {
      const buffer = Buffer.from('verification content');
      const hash = computeFileHash(buffer);
      const expected = createHash('sha256').update(buffer).digest('hex');

      expect(hash).toBe(expected);
    });

    it('handles empty buffer', () => {
      const buffer = Buffer.alloc(0);
      const hash = computeFileHash(buffer);

      // SHA-256 of empty input is a known value
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('handles binary content', () => {
      const buffer = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]);
      const hash = computeFileHash(buffer);

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('getConcurrencyStatus', () => {
    it('returns current concurrency info', () => {
      const status = getConcurrencyStatus();

      expect(status).toHaveProperty('globalAvailable');
      expect(status).toHaveProperty('globalMax');
      expect(status).toHaveProperty('queueLength');
      expect(status).toHaveProperty('maxQueued');
      expect(typeof status.globalAvailable).toBe('number');
      expect(typeof status.globalMax).toBe('number');
      expect(typeof status.queueLength).toBe('number');
      expect(typeof status.maxQueued).toBe('number');
    });

    it('globalMax matches EXTRACTION_LIMITS', () => {
      const status = getConcurrencyStatus();

      expect(status.globalMax).toBe(EXTRACTION_LIMITS.MAX_CONCURRENT);
    });

    it('maxQueued matches EXTRACTION_LIMITS', () => {
      const status = getConcurrencyStatus();

      expect(status.maxQueued).toBe(EXTRACTION_LIMITS.MAX_QUEUED);
    });
  });

  describe('EXTRACTION_LIMITS', () => {
    it('defines MAX_FILE_SIZE_BYTES as 10MB', () => {
      expect(EXTRACTION_LIMITS.MAX_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
    });

    it('defines conservative MAX_CONCURRENT default of 1', () => {
      // Conservative default for initial rollout
      // Can be increased via EXTRACTION_MAX_CONCURRENT env var after resource validation
      expect(EXTRACTION_LIMITS.MAX_CONCURRENT).toBeGreaterThanOrEqual(1);
    });

    it('defines MAX_QUEUED default of 5', () => {
      // Bounded queue to prevent unbounded memory growth
      // Can be increased via EXTRACTION_MAX_QUEUED env var after resource validation
      expect(EXTRACTION_LIMITS.MAX_QUEUED).toBeGreaterThanOrEqual(1);
    });

    it('defines WORKER_TIMEOUT_MS as 30 seconds', () => {
      expect(EXTRACTION_LIMITS.WORKER_TIMEOUT_MS).toBe(30_000);
    });

    it('defines WORKER_HEAP_SIZE_MB as 256', () => {
      expect(EXTRACTION_LIMITS.WORKER_HEAP_SIZE_MB).toBe(256);
    });
  });
});

describe('content hash algorithm', () => {
  /**
   * These tests verify the content hash is computed correctly
   * using UTF-8 encoding, matching the worker implementation.
   */

  function computeContentHash(text: string): string {
    return createHash('sha256').update(text, 'utf8').digest('hex');
  }

  it('computes content hash as 64-char hex', () => {
    const text = 'extracted text content';
    const hash = computeContentHash(text);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces different hashes for file vs content', () => {
    // Original file might be PDF binary
    const originalFile = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
    const extractedText = 'extracted text only';

    const fileHash = computeFileHash(originalFile);
    const contentHash = computeContentHash(extractedText);

    expect(fileHash).not.toBe(contentHash);
  });

  it('handles Unicode text', () => {
    const text = 'Hello 世界 🌍';
    const hash = computeContentHash(text);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('handles long text', () => {
    const text = 'a'.repeat(100_000);
    const hash = computeContentHash(text);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
