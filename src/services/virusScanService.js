import {
  CLAMAV_ENABLED,
  CLAMAV_HOST,
  CLAMAV_PORT,
  CLAMAV_TIMEOUT_MS,
  CLAMAV_FAIL_MODE
} from '../config/env.js';

let clamscanLib = null;
let initPromise = null;

/**
 * Lazily initialises the clamscan client connected to a remote clamd
 * instance over TCP. The dependency is imported dynamically so the app
 * still boots when the package is not installed (and ClamAV is disabled).
 */
const getClamScan = async () => {
  if (!CLAMAV_ENABLED) return null;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const mod = await import('clamscan');
      const NodeClam = mod.default || mod;
      const clamscan = await new NodeClam().init({
        clamdscan: {
          host: CLAMAV_HOST,
          port: CLAMAV_PORT,
          timeout: CLAMAV_TIMEOUT_MS,
          localFallback: false,
          path: undefined,
          socket: false,
          active: true
        },
        debug: false
      });
      return clamscan;
    } catch (err) {
      console.error('[ClamAV] Failed to initialise scanner:', err.message);
      initPromise = null;
      return null;
    }
  })();

  return initPromise;
};

/**
 * Scans a buffer for malware.
 * @returns {Promise<{infected: boolean, viruses: string[], scanned: boolean}>}
 */
export const scanBuffer = async (buffer) => {
  const clamscan = await getClamScan();

  if (!clamscan) {
    if (CLAMAV_FAIL_MODE === 'open') {
      return { infected: false, viruses: [], scanned: false };
    }
    const err = new Error('Virus scanner unavailable');
    err.code = 'SCANNER_UNAVAILABLE';
    throw err;
  }

  const { isInfected, viruses } = await clamscan.scanBuffer(buffer);
  return { infected: !!isInfected, viruses: viruses || [], scanned: true };
};

export const virusScanService = { scanBuffer, isEnabled: () => CLAMAV_ENABLED };
