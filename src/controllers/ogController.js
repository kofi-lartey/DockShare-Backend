import { File } from '../models/File.js';
import { User } from '../models/User.js';
import { fetchOgMetadata } from '../services/ogScraperService.js';
import { FRONTEND_URL } from '../config/env.js';

const CRAWLER_UA_PATTERNS = [
  /facebookexternalhit/i, /facebookcatalog/i, /whatsapp/i, /telegrambot/i,
  /twitterbot/i, /linkedinbot/i, /slackbot/i, /slack-imgproxy/i, /discordbot/i,
  /pinterest/i, /redditbot/i, /googlebot/i, /bingbot/i, /embedly/i, /quora link preview/i,
  /showyoubot/i, /outbrain/i, /pocket/i, /skypeuripreview/i, /vkshare/i, /w3c_validator/i
];

export const isCrawler = (userAgent = '') => CRAWLER_UA_PATTERNS.some((p) => p.test(userAgent));

/**
 * Extracts Open Graph metadata from an arbitrary external URL (SSRF-guarded
 * in the service). Used by the share modal link-preview card.
 */
export const getOgPreview = async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ success: false, message: 'url query parameter is required' });
    }

    const metadata = await fetchOgMetadata(url);
    res.json({
      success: true,
      data: {
        url,
        ...metadata
      },
      message: 'OG metadata retrieved'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to fetch link preview',
      code: 'OG_FETCH_FAILED'
    });
  }
};

const escapeHtml = (str) => String(str || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const buildOgHtml = ({ title, description, image, shareableUrl }) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(image)}" />
  <meta property="og:url" content="${escapeHtml(shareableUrl)}" />
  <meta property="og:site_name" content="DocShare Pro" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(image)}" />
  <link rel="canonical" href="${escapeHtml(shareableUrl)}" />
  <meta http-equiv="refresh" content="0; url=${escapeHtml(shareableUrl)}" />
</head>
<body>
  <p>Loading document preview…</p>
</body>
</html>`;
};

/**
 * Serves crawler-friendly HTML with Open Graph meta tags for a shared file
 * link. Non-crawler user agents are redirected to the SPA.
 */
export const serveOgTags = async (req, res) => {
  const { shareableLink } = req.params;
  const userAgent = req.headers['user-agent'] || '';

  const file = await File.findOne({ shareableLink }).select('name qrCode userId status').lean();
  const shareableUrl = `${FRONTEND_URL}/view/${shareableLink}`;

  if (!isCrawler(userAgent)) {
    return res.redirect(302, shareableUrl);
  }

  if (!file || file.status === 'deleted' || file.status === 'expired') {
    return res.status(404).send('<html><head><title>Not found</title></head><body>Not found</body></html>');
  }

  let ownerName = 'DocShare Pro';
  try {
    const owner = await User.findById(file.userId).select('fullName').lean();
    if (owner?.fullName) ownerName = owner.fullName;
  } catch { /* ignore */ }

  const title = `${file.name} — Shared on DocShare Pro`;
  const description = `View "${file.name}" shared by ${ownerName} on DocShare Pro.`;
  const image = file.qrCode || '';

  res.set('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(buildOgHtml({ title, description, image, shareableUrl }));
};

export const ogController = { getOgPreview, serveOgTags, isCrawler };
