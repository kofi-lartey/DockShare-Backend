import net from 'net';

// GeoIP lookups resolve an IP to an approximate location. We use geoip-lite,
// which ships with a free MaxMind GeoLite2 database. If the package or its
// data file is unavailable the service degrades gracefully to null values
// (no geo is recorded), which is the privacy-safe default.
let geoip = null;
try {
  // eslint-disable-next-line global-require
  geoip = require('geoip-lite');
} catch {
  geoip = null;
}

/**
 * Resolves geolocation for an IP. Returns null fields when unavailable or
 * for private/loopback addresses (which should never be geolocated).
 */
export const lookupGeo = (ip) => {
  if (!ip || ip === 'unknown' || net.isIP(ip) === 0) {
    return { country: null, region: null, city: null };
  }
  if (ip === '::1' || ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('127.')) {
    return { country: null, region: null, city: null };
  }

  if (!geoip) {
    return { country: null, region: null, city: null };
  }

  try {
    const geo = geoip.lookup(ip);
    if (!geo) return { country: null, region: null, city: null };
    return {
      country: geo.country || null,
      region: geo.region || null,
      city: geo.city || null
    };
  } catch {
    return { country: null, region: null, city: null };
  }
};

export const geoService = { lookupGeo, isAvailable: () => !!geoip };
