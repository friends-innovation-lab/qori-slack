/**
 * Unit tests for streaming multipart parser — DISC-WEB-1
 *
 * Tests boundary conditions, limits, and error handling.
 */

import { Readable } from 'stream';
import {
  parseMultipart,
  AggregateLimitError,
  FileLimitError,
  MULTIPART_LIMITS,
} from '../../../services/extraction/streaming-multipart';

/**
 * Create a mock IncomingMessage from a multipart body.
 */
function createMockRequest(
  boundary: string,
  parts: Array<{ name: string; filename: string; contentType: string; content: Buffer }>,
): { req: Readable; contentType: string } {
  const chunks: Buffer[] = [];

  for (const part of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    chunks.push(
      Buffer.from(
        `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\n`,
      ),
    );
    chunks.push(Buffer.from(`Content-Type: ${part.contentType}\r\n\r\n`));
    chunks.push(part.content);
    chunks.push(Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));

  const body = Buffer.concat(chunks);

  const req = new Readable({
    read() {
      this.push(body);
      this.push(null);
    },
  });

  // Override unpipe to be a no-op for testing
  (req as any).unpipe = () => {};

  return {
    req,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

describe('streaming-multipart', () => {
  describe('MULTIPART_LIMITS', () => {
    it('defines MAX_FILE_SIZE as 10MB', () => {
      expect(MULTIPART_LIMITS.MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
    });

    it('defines MAX_AGGREGATE_SIZE as 50MB', () => {
      expect(MULTIPART_LIMITS.MAX_AGGREGATE_SIZE).toBe(50 * 1024 * 1024);
    });

    it('defines MAX_FILES as 10', () => {
      expect(MULTIPART_LIMITS.MAX_FILES).toBe(10);
    });

    it('defines ALLOWED_MIME_TYPES', () => {
      expect(MULTIPART_LIMITS.ALLOWED_MIME_TYPES).toContain('application/pdf');
      expect(MULTIPART_LIMITS.ALLOWED_MIME_TYPES).toContain(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
      expect(MULTIPART_LIMITS.ALLOWED_MIME_TYPES).toContain('text/plain');
      expect(MULTIPART_LIMITS.ALLOWED_MIME_TYPES).toContain('text/markdown');
    });
  });

  describe('parseMultipart', () => {
    it('parses valid text file', async () => {
      const content = Buffer.from('Hello, world!');
      const { req, contentType } = createMockRequest('test-boundary', [
        { name: 'files', filename: 'test.txt', contentType: 'text/plain', content },
      ]);

      const result = await parseMultipart(req as any, contentType);

      expect(result.files).toHaveLength(1);
      expect(result.rejected).toHaveLength(0);
      expect(result.files[0].filename).toBe('test.txt');
      expect(result.files[0].mimeType).toBe('text/plain');
      expect(result.files[0].buffer.toString()).toBe('Hello, world!');
      expect(result.files[0].fileHash).toMatch(/^[a-f0-9]{64}$/);
      expect(result.files[0].sizeBytes).toBe(content.length);
    });

    it('parses multiple valid files', async () => {
      const { req, contentType } = createMockRequest('test-boundary', [
        { name: 'files', filename: 'file1.txt', contentType: 'text/plain', content: Buffer.from('File 1') },
        { name: 'files', filename: 'file2.md', contentType: 'text/markdown', content: Buffer.from('# File 2') },
      ]);

      const result = await parseMultipart(req as any, contentType);

      expect(result.files).toHaveLength(2);
      expect(result.rejected).toHaveLength(0);
    });

    it('rejects unsupported file types', async () => {
      const { req, contentType } = createMockRequest('test-boundary', [
        { name: 'files', filename: 'image.jpg', contentType: 'image/jpeg', content: Buffer.from('fake image') },
      ]);

      const result = await parseMultipart(req as any, contentType);

      expect(result.files).toHaveLength(0);
      expect(result.rejected).toHaveLength(1);
      expect(result.rejected[0].errorCode).toBe('UNSUPPORTED_FILE_TYPE');
      expect(result.rejected[0].filename).toBe('image.jpg');
    });

    it('mixes valid and rejected files', async () => {
      const { req, contentType } = createMockRequest('test-boundary', [
        { name: 'files', filename: 'valid.txt', contentType: 'text/plain', content: Buffer.from('valid') },
        { name: 'files', filename: 'invalid.exe', contentType: 'application/octet-stream', content: Buffer.from('bad') },
      ]);

      const result = await parseMultipart(req as any, contentType);

      expect(result.files).toHaveLength(1);
      expect(result.files[0].filename).toBe('valid.txt');
      expect(result.rejected).toHaveLength(1);
      expect(result.rejected[0].filename).toBe('invalid.exe');
    });

    it('computes unique file hashes', async () => {
      const { req, contentType } = createMockRequest('test-boundary', [
        { name: 'files', filename: 'a.txt', contentType: 'text/plain', content: Buffer.from('content A') },
        { name: 'files', filename: 'b.txt', contentType: 'text/plain', content: Buffer.from('content B') },
      ]);

      const result = await parseMultipart(req as any, contentType);

      expect(result.files[0].fileHash).not.toBe(result.files[1].fileHash);
    });

    it('handles empty request (no files)', async () => {
      const { req, contentType } = createMockRequest('test-boundary', []);

      const result = await parseMultipart(req as any, contentType);

      expect(result.files).toHaveLength(0);
      expect(result.rejected).toHaveLength(0);
    });
  });

  describe('AggregateLimitError', () => {
    it('has correct code property', () => {
      const error = new AggregateLimitError('test message');

      expect(error.code).toBe('AGGREGATE_LIMIT_EXCEEDED');
      expect(error.message).toBe('test message');
      expect(error.name).toBe('AggregateLimitError');
    });

    it('is instanceof Error', () => {
      const error = new AggregateLimitError('test');

      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('FileLimitError', () => {
    it('has correct code property', () => {
      const error = new FileLimitError('test message');

      expect(error.code).toBe('FILE_LIMIT_EXCEEDED');
      expect(error.message).toBe('test message');
      expect(error.name).toBe('FileLimitError');
    });

    it('is instanceof Error', () => {
      const error = new FileLimitError('test');

      expect(error).toBeInstanceOf(Error);
    });
  });
});
