import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile, execSync } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// Locate a LibreOffice / OpenOffice headless binary on the host.
function findLibreOffice() {
  const candidates = [
    'libreoffice',
    'soffice',
    'libreoffice7.6',
    'soffice.bin',
    'loffice',
  ];
  for (const cmd of candidates) {
    try {
      // Synchronous best-effort: `where` on Windows, `command -v` on *nix.
      const shell = process.platform === 'win32'
        ? `where ${cmd}`
        : `command -v ${cmd}`;
      const out = execSync(shell, { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim()
        .split(/\r?\n/)[0];
      if (out) return out;
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

let cachedBinary = undefined; // undefined = not yet probed

export function getLibreOfficeBinary() {
  if (cachedBinary === undefined) cachedBinary = findLibreOffice();
  return cachedBinary;
}

export function isLibreOfficeAvailable() {
  return !!getLibreOfficeBinary();
}

/**
 * Convert an Office document (buffer) to a PDF buffer using LibreOffice headless.
 * Throws an error with `code: 'LO_NOT_AVAILABLE'` when LibreOffice is not
 * installed, so callers can gracefully fall back to client-side rendering.
 */
export async function convertOfficeToPdf(buffer, ext = 'docx') {
  const bin = getLibreOfficeBinary();
  if (!bin) {
    const err = new Error('LibreOffice is not installed on the server (required to convert this document).');
    err.code = 'LO_NOT_AVAILABLE';
    throw err;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docshare-convert-'));
  const safeExt = String(ext).replace(/[^a-z0-9.]/gi, '').replace(/^\./, '') || 'docx';
  const inFile = path.join(tmpDir, `input.${safeExt}`);
  const outFile = path.join(tmpDir, 'input.pdf');

  fs.writeFileSync(inFile, buffer);

  try {
    await execFileAsync(
      bin,
      ['--headless', '--convert-to', 'pdf', '--outdir', tmpDir, inFile],
      { timeout: 120000, windowsHide: true }
    );

    if (!fs.existsSync(outFile)) {
      throw new Error('Document conversion produced no output.');
    }
    return fs.readFileSync(outFile);
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
  }
}
