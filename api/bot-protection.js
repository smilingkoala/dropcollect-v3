// api/bot-protection.js
// Multi-layer bot protection:
// 1. Rate limiting per IP (in-memory, resets on cold start — use Redis for prod scale)
// 2. Request header fingerprinting (bots often miss standard browser headers)
// 3. Submission token validation (widget generates a time-based token, API verifies it)
// 4. Honeypot field check (bots fill hidden fields, humans don't)

// ── In-memory rate store ─────────────────────────────────────
// Structure: { ip_collectorId: { count, firstSeen, blocked } }
const rateLimitStore = new Map();

const RATE_LIMIT = {
  maxPerWindow: 5,          // max submissions per IP per collector per window
  windowMs: 60 * 1000,     // 1 minute window
  blockDurationMs: 10 * 60 * 1000, // block for 10 minutes after limit hit
};

function getRateLimitKey(ip, collectorId) {
  return `${ip}__${collectorId}`;
}

function checkRateLimit(ip, collectorId) {
  const key = getRateLimitKey(ip, collectorId);
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record) {
    rateLimitStore.set(key, { count: 1, firstSeen: now, blocked: false });
    return { allowed: true };
  }

  // Still in block period
  if (record.blocked) {
    const unblockAt = record.blockedAt + RATE_LIMIT.blockDurationMs;
    if (now < unblockAt) {
      return {
        allowed: false,
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((unblockAt - now) / 1000),
      };
    }
    // Block expired — reset
    rateLimitStore.set(key, { count: 1, firstSeen: now, blocked: false });
    return { allowed: true };
  }

  // Reset window if expired
  if (now - record.firstSeen > RATE_LIMIT.windowMs) {
    rateLimitStore.set(key, { count: 1, firstSeen: now, blocked: false });
    return { allowed: true };
  }

  // Increment count
  record.count++;

  if (record.count > RATE_LIMIT.maxPerWindow) {
    record.blocked = true;
    record.blockedAt = now;
    rateLimitStore.set(key, record);
    console.warn(`[BotProtection] IP ${ip} rate-limited on collector ${collectorId}`);
    return {
      allowed: false,
      error: 'Too many requests. Please try again in a few minutes.',
      retryAfter: Math.ceil(RATE_LIMIT.blockDurationMs / 1000),
    };
  }

  rateLimitStore.set(key, record);
  return { allowed: true };
}

// ── Submission token validation ──────────────────────────────
// Widget generates a token = base64(collectorId:timestamp:nonce)
// Server verifies: token is recent (< 2 hours), hasn't been reused
// This prevents replay attacks and direct API hammering without the widget

const usedTokens = new Set(); // in prod, use Redis with TTL
const TOKEN_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

function generateToken(collectorId) {
  const ts = Date.now();
  const nonce = Math.random().toString(36).slice(2, 10);
  const raw = `${collectorId}:${ts}:${nonce}`;
  return Buffer.from(raw).toString('base64url');
}

function verifyToken(token, collectorId) {
  if (!token || typeof token !== 'string') return false;
  try {
    const raw = Buffer.from(token, 'base64url').toString();
    const parts = raw.split(':');
    if (parts.length !== 3) return false;
    const [tokenCollectorId, ts] = parts;
    if (tokenCollectorId !== collectorId) return false;
    const age = Date.now() - parseInt(ts, 10);
    if (age > TOKEN_MAX_AGE_MS || age < 0) return false;
    if (usedTokens.has(token)) return false; // replay attack
    usedTokens.add(token);
    // Clean up old tokens (keep set from growing unbounded)
    if (usedTokens.size > 10000) {
      const arr = [...usedTokens];
      arr.slice(0, 5000).forEach(t => usedTokens.delete(t));
    }
    return true;
  } catch {
    return false;
  }
}

// ── Header fingerprinting ────────────────────────────────────
// Legitimate browser requests always include these headers.
// Direct API calls (curl, Python scripts) often don't.
function checkHeaders(req) {
  const ua = req.headers['user-agent'] || '';
  const contentType = req.headers['content-type'] || '';

  // Must have a user-agent
  if (!ua || ua.length < 8) {
    return { allowed: false, reason: 'missing_ua' };
  }

  // Block known bot/script user agents
  const botUAPatterns = [
    /curl\//i, /python-requests/i, /python\/\d/i, /go-http-client/i,
    /java\/\d/i, /libwww-perl/i, /scrapy/i, /bot\b/i, /crawler/i,
    /spider/i, /headless/i, /phantomjs/i, /wget\//i, /httpie/i,
    /axios\/\d/i, /node-fetch/i, /got\//i, /undici/i,
  ];
  for (const pattern of botUAPatterns) {
    if (pattern.test(ua)) {
      return { allowed: false, reason: 'bot_ua' };
    }
  }

  // Must be JSON content type for POST
  if (req.method === 'POST' && !contentType.includes('application/json')) {
    return { allowed: false, reason: 'invalid_content_type' };
  }

  return { allowed: true };
}

// ── Honeypot field check ─────────────────────────────────────
// Widget includes a hidden field called 'website' that's invisible to humans.
// Bots that auto-fill forms will populate it. Humans won't.
function checkHoneypot(body) {
  // If 'website' or 'phone' or 'name' fields are present and non-empty = bot
  const honeypotFields = ['website', 'url', 'phone', 'name', 'company'];
  for (const field of honeypotFields) {
    if (body[field] && String(body[field]).trim().length > 0) {
      console.warn('[BotProtection] Honeypot field filled:', field);
      return false;
    }
  }
  return true;
}

// ── Get real IP ──────────────────────────────────────────────
function getIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || '0.0.0.0';
}

// ── Main middleware function ─────────────────────────────────
/**
 * runBotProtection(req, collectorId)
 * Returns { allowed: bool, error: string|null, statusCode: number }
 */
function runBotProtection(req, collectorId) {
  const ip = getIP(req);

  // 1. Header check
  const headerCheck = checkHeaders(req);
  if (!headerCheck.allowed) {
    console.warn(`[BotProtection] Blocked by header check (${headerCheck.reason}) from ${ip}`);
    return { allowed: false, error: 'Request not allowed.', statusCode: 403 };
  }

  // 2. Honeypot check
  if (!checkHoneypot(req.body || {})) {
    // Return 200 to fool bots — don't let them know they were caught
    return { allowed: false, error: null, statusCode: 200, silent: true };
  }

  // 3. Rate limit
  const rateCheck = checkRateLimit(ip, collectorId);
  if (!rateCheck.allowed) {
    return {
      allowed: false,
      error: rateCheck.error,
      statusCode: 429,
      retryAfter: rateCheck.retryAfter,
    };
  }

  // 4. Token validation (optional — only enforced if token is present)
  // Token is soft-enforced: missing token is allowed, invalid token is blocked
  // This lets direct embeds work while blocking replay attacks
  const token = req.body?.token;
  if (token && !verifyToken(token, collectorId)) {
    console.warn(`[BotProtection] Invalid token from ${ip} for collector ${collectorId}`);
    return { allowed: false, error: 'Invalid request token.', statusCode: 403 };
  }

  return { allowed: true, error: null, statusCode: 200 };
}

module.exports = { runBotProtection, generateToken, getIP };
