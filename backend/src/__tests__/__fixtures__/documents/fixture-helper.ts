/**
 * Document Fixture Helper — DISC-WEB-1B-2c
 *
 * Provides reproducible synthetic document fixtures for extraction testing.
 * All fixtures are deterministic and require no external tools.
 */

import * as fs from 'fs';
import * as path from 'path';

const FIXTURES_DIR = path.join(__dirname);

// ─── Text Constants ─────────────────────────────────────────────────────────

/** Minimum text length required for extraction (from extraction-worker.ts) */
export const MIN_TEXT_LENGTH = 50;

/** Maximum text length allowed (from extraction-worker.ts) */
export const MAX_TEXT_LENGTH = 2_000_000;

/** Standard test content that exceeds minimum threshold */
export const STANDARD_TEXT = 'This is sample content for extraction testing. It contains enough characters to pass the minimum threshold validation of fifty characters.';

/** Exactly 50 characters (minimum threshold) */
export const MINIMUM_TEXT = 'abcdefghij'.repeat(5); // Exactly 50 chars

/** 49 characters (below minimum threshold) */
export const BELOW_MINIMUM_TEXT = 'abcdefghij'.repeat(4) + 'abcdefghi'; // Exactly 49 chars

// ─── TXT/MD Fixtures (Inline) ───────────────────────────────────────────────

export function createTxtBuffer(content: string = STANDARD_TEXT): Buffer {
  return Buffer.from(content, 'utf-8');
}

export function createMdBuffer(content: string = `# Test Document\n\n${STANDARD_TEXT}`): Buffer {
  return Buffer.from(content, 'utf-8');
}

// ─── Minimal Valid PDF ──────────────────────────────────────────────────────

/**
 * Creates a minimal valid PDF with extractable text.
 * This is a hand-crafted PDF that pdf-parse can read.
 */
export function createValidPdfBuffer(text: string = STANDARD_TEXT): Buffer {
  // Minimal PDF structure with text content
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${text.length + 50} >>
stream
BT
/F1 12 Tf
100 700 Td
(${text}) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
0000000${(text.length + 350).toString().padStart(3, '0')} 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${text.length + 420}
%%EOF`;

  return Buffer.from(pdfContent, 'utf-8');
}

/**
 * Creates a corrupt PDF with invalid header.
 * pdf-parse will throw an error trying to parse this.
 */
export function createCorruptPdfBuffer(): Buffer {
  return Buffer.from('%PDF-CORRUPT\nThis is not a valid PDF structure at all.', 'utf-8');
}

/**
 * Creates a PDF that simulates encrypted content.
 * The error message from pdf-parse will contain "encrypted".
 *
 * Note: This uses a known pattern that triggers pdf-parse's encryption detection.
 */
export function createEncryptedPdfBuffer(): Buffer {
  // PDF with /Encrypt dictionary triggers encryption error in pdf-parse
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer
<< /Size 4 /Root 1 0 R /Encrypt << /Filter /Standard /V 2 /R 3 /O (encrypted) /U (password) /P -1 >> >>
startxref
200
%%EOF`;

  return Buffer.from(pdfContent, 'utf-8');
}

/**
 * Creates a minimal PDF with no text content (simulates scanned PDF).
 * pdf-parse will return empty text, triggering SCANNED_PDF error.
 */
export function createScannedPdfBuffer(): Buffer {
  // PDF with a page but no text stream
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> >>
endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer
<< /Size 4 /Root 1 0 R >>
startxref
180
%%EOF`;

  return Buffer.from(pdfContent, 'utf-8');
}

/**
 * Creates a zero-page PDF.
 * pdf-parse will report numpages === 0, triggering EMPTY_CONTENT error.
 */
export function createZeroPagePdfBuffer(): Buffer {
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [] /Count 0 >>
endobj
xref
0 3
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
trailer
<< /Size 3 /Root 1 0 R >>
startxref
105
%%EOF`;

  return Buffer.from(pdfContent, 'utf-8');
}

// ─── Minimal Valid DOCX ─────────────────────────────────────────────────────

/**
 * Creates a minimal valid DOCX file.
 * DOCX is a ZIP archive with specific XML structure.
 *
 * Note: We use a pre-built base64-encoded minimal DOCX and inject text.
 */

// Base64-encoded minimal DOCX template (created via docx package, then base64'd)
// This is a valid DOCX with placeholder text "PLACEHOLDER_TEXT"
const MINIMAL_DOCX_BASE64 = `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`;

/**
 * Creates a minimal valid DOCX with the specified text content.
 */
export function createValidDocxBuffer(text: string = STANDARD_TEXT): Buffer {
  // For simplicity, we use a pre-built DOCX that mammoth can parse
  // The actual text extraction will return whatever is in the document.xml
  // We create a simple DOCX structure manually

  // This is a more robust approach: create DOCX from scratch
  const JSZip = require('jszip');

  const zip = new JSZip();

  // [Content_Types].xml
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );

  // _rels/.rels
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );

  // word/document.xml with actual text
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>${escapeXml(text)}</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`,
  );

  // word/_rels/document.xml.rels
  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`,
  );

  // Generate synchronously
  return zip.generateNodeStream({ type: 'nodebuffer', compression: 'DEFLATE' });
}

/**
 * Creates a valid DOCX buffer synchronously using pre-generated template.
 */
export async function createValidDocxBufferAsync(text: string = STANDARD_TEXT): Promise<Buffer> {
  const JSZip = require('jszip');
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );

  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>${escapeXml(text)}</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`,
  );

  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`,
  );

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

/**
 * Creates a corrupt DOCX (invalid ZIP structure).
 */
export function createCorruptDocxBuffer(): Buffer {
  // Not a valid ZIP file
  return Buffer.from('PK\x03\x04CORRUPT_DOCX_NOT_VALID_ZIP_STRUCTURE', 'utf-8');
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ─── File Hash Verification ─────────────────────────────────────────────────

import { createHash } from 'crypto';

export function computeExpectedFileHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function computeExpectedContentHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}
