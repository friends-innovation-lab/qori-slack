# Privacy & Data Governance

CivicMind is committed to upholding privacy, especially in public-sector research contexts.

We follow best practices aligned with **FedRAMP Moderate** and **NIST 800-53** guidance.

## 🔐 Data Principles

1. **Minimal Retention**
   - No data is stored beyond session unless explicitly saved.
   - Transcripts, summaries, and documents are deleted after use unless saved by user.

2. **PII/PHI Protection**
   - PII redaction (beta) auto-removes names, SSNs, contact info.
   - Medical or benefits-related data is flagged for review.

3. **Encryption**
   - All storage is encrypted at rest (AES-256) and in transit (TLS 1.2+).
   - Files are stored in secure GDrive or S3 buckets with role-based access.

4. **Audit Logs**
   - Logs track document access, summary creation, AI edits, and approvals.
   - Admins can download logs on request.

## 🔄 Sharing & Permissions

- Projects can be shared with collaborators across orgs, with view or edit permissions.
- Access control follows role-based tiers: Viewer, Contributor, Admin.

## ✅ Coming Soon

- FedRAMP-tailored data hosting environments (optional)
- SOC 2-aligned internal security practices
- DLP scanning and alerting
