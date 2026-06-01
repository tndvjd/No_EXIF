# Security Policy

## Supported Versions

No EXIF Pro is currently an early release candidate. Security fixes are handled on the default branch until versioned releases are published.

## Reporting a Vulnerability

Please do not publish secrets, tokens, private images, or sensitive metadata in a public issue.

If you find a security problem, open a GitHub issue with a minimal description and no private data, or contact the maintainer through the GitHub profile associated with this repository.

Useful details to include:

- The affected feature or file path.
- Steps to reproduce with synthetic files only.
- Whether the issue exposes metadata, file paths, tokens, or arbitrary file access.
- Your operating system and app version or commit.

## Sensitive Data Rules

Do not commit:

- Pixiv refresh tokens.
- API keys or OAuth credentials.
- Personal image batches.
- Generated output folders.
- `.env`, `.npmrc`, auth caches, or local config files.

No EXIF Pro should keep image cleanup local by default and avoid sending image metadata to a hosted service.
