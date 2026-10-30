import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const integrity = file => `sha256-${createHash('sha256').update(readFileSync(new URL(`../${file}`, import.meta.url))).digest('base64')}`;
export const scriptIntegrity = integrity('assets/app.js');

// Inline map coordinates and CSSOM numeric positioning require style attributes.
// JavaScript is restricted to the exact shipped script; no inline code or network APIs.
export const cspPolicy = () => [
  "default-src 'none'",
  `script-src '${scriptIntegrity}'`,
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "style-src-elem 'self'",
  "img-src 'self'",
  "font-src 'none'",
  "connect-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ');
