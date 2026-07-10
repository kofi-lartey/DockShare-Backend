import dns from 'dns/promises';
import net from 'net';
import { URL } from 'url';

const FETCH_TIMEOUT_MS = 8000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

const PRIVATE_RANGES = [
  '10.', '127.', '169.254.', '172.16.', '172.17.', '172.18.', '172.19.',
  '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.',
  '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.', '192.168.'
];

const isPrivateIp = (ip) => {
  if (ip === '::1' || ip === '0.0.0.0') return true;
  if (net.isIPv6(ip)) return ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80');
  return PRIVATE_RANGES.some((range) => ip.startsWith(range));
};

/**
 * Resolves all IPs for a hostname and rejects requests that resolve to
 * private/loopback/link-local addresses (SSRF protection).
 */
const assertPublicHost = async (hostname) => {
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error('Blocked private address');
    return;
  }
  const addresses = await dns.lookup(hostname, { all: true });
  if (!addresses.length) throw new Error('DNS resolution failed');
  for (const { address } of addresses) {
    if (isPrivateIp(address)) throw new Error('Blocked private address');
  }
};

const parseOgTags = (html) => {
  const result = { title: null, description: null, image: null, url: null, siteName: null, type: null };

  const metaRegex = /<meta[^>]+property=["']([^"']+)["'][^>]*content=["']([^"']*)["']/gi;
  let match;
  while ((match = metaRegex.exec(html)) !== null) {
    const prop = match[1].toLowerCase();
    const content = match[2];
    if (prop === 'og:title' && !result.title) result.title = content;
    else if (prop === 'og:description' && !result.description) result.description = content;
    else if (prop === 'og:image' && !result.image) result.image = content;
    else if (prop === 'og:url' && !result.url) result.url = content;
    else if (prop === 'og:site_name' && !result.siteName) result.siteName = content;
    else if (prop === 'og:type' && !result.type) result.type = content;
  }

  if (!result.title) {
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch) result.title = titleMatch[1].trim();
  }
  if (!result.description) {
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i);
    if (descMatch) result.description = descMatch[1];
  }

  return result;
};

/**
 * Fetches a URL and extracts Open Graph metadata. Includes SSRF guards:
 * only http/https, public host resolution, size + timeout caps.
 */
export const fetchOgMetadata = async (rawUrl) => {
  let target;
  try {
    target = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }

  if (!ALLOWED_PROTOCOLS.has(target.protocol)) {
    throw new Error('Unsupported protocol');
  }

  await assertPublicHost(target.hostname);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(target.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'DocShareBot/1.0 (+og-preview)' }
    });

    if (!response.ok) throw new Error(`Fetch failed with status ${response.status}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let html = '';
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        break;
      }
      html += decoder.decode(value, { stream: true });
      // Stop early once we've likely captured the <head> section.
      if (html.length > 20000) {
        await reader.cancel();
        break;
      }
    }

    return parseOgTags(html);
  } finally {
    clearTimeout(timeout);
  }
};

export const ogScraperService = { fetchOgMetadata };
