import jwt from 'jsonwebtoken';

const blacklist = new Map();

export const jwtBlacklist = {
  add(token) {
    try {
      const decoded = jwt.decode(token);
      if (!decoded?.jti) return;

      const expiresAt = decoded.exp
        ? decoded.exp * 1000
        : Date.now() + 86400000;

      blacklist.set(decoded.jti, expiresAt);

      setTimeout(() => {
        blacklist.delete(decoded.jti);
      }, Math.max(expiresAt - Date.now(), 0));
    } catch {
      // Invalid token format, ignore
    }
  },

  has(token) {
    try {
      const decoded = jwt.decode(token);
      if (!decoded?.jti) return false;

      const expiresAt = blacklist.get(decoded.jti);
      if (!expiresAt) return false;

      if (Date.now() > expiresAt) {
        blacklist.delete(decoded.jti);
        return false;
      }

      return true;
    } catch {
      return false;
    }
  },

  cleanup() {
    const now = Date.now();
    for (const [jti, expiresAt] of blacklist.entries()) {
      if (now > expiresAt) {
        blacklist.delete(jti);
      }
    }
  }
};

setInterval(() => jwtBlacklist.cleanup(), 3600000);
