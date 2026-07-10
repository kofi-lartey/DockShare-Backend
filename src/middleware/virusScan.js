import { scanBuffer, isEnabled } from '../services/virusScanService.js';

/**
 * Express middleware that virus-scans the uploaded file buffer before it
 * reaches the upload controller. Must run after multer's upload.single().
 * Rejects infected files with 422 and, in closed fail-mode, when the scanner
 * is unavailable. When scanning is disabled it passes the request through.
 */
export const virusScan = async (req, res, next) => {
  if (!isEnabled()) {
    return next();
  }

  if (!req.file || !req.file.buffer) {
    return next();
  }

  try {
    const result = await scanBuffer(req.file.buffer);

    if (result.infected) {
      return res.status(422).json({
        success: false,
        message: 'Upload rejected: file failed the virus scan.',
        viruses: result.viruses
      });
    }

    req.virusScan = result;
    next();
  } catch (err) {
    if (err.code === 'SCANNER_UNAVAILABLE') {
      return res.status(503).json({
        success: false,
        message: 'Upload rejected: virus scanner is temporarily unavailable. Please try again later.'
      });
    }
    console.error('[ClamAV] Scan error:', err.message);
    return res.status(503).json({
      success: false,
      message: 'Upload rejected: virus scan could not be completed.'
    });
  }
};

export default virusScan;
