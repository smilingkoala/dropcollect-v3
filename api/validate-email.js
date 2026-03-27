// api/validate-email.js
// Multi-layer email validation:
// 1. Format check (strict regex)
// 2. Disposable/throwaway email domain blocklist
// 3. Common typo detection
// 4. Role-based address warnings (admin@, no-reply@, etc.)

// ── Strict email regex ───────────────────────────────────────
// More strict than the basic one — rejects edge cases that pass simple checks
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

// ── Disposable/throwaway email domains ──────────────────────
// Covers the most common temp email providers
const DISPOSABLE_DOMAINS = new Set([
  '10minutemail.com', '10minutemail.net', '10minutemail.org',
  'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org',
  'guerrillamail.info', 'guerrillamail.biz', 'guerrillamail.de',
  'mailinator.com', 'mailinator.net', 'mailinator.org',
  'throwam.com', 'throwaway.email', 'trashmail.com', 'trashmail.me',
  'trashmail.net', 'trashmail.org', 'trashmail.at', 'trashmail.io',
  'yopmail.com', 'yopmail.fr', 'yopmail.net',
  'tempmail.com', 'tempmail.net', 'tempmail.org', 'temp-mail.org',
  'temp-mail.ru', 'temp-mail.io', 'tempinbox.com',
  'sharklasers.com', 'guerrillamailblock.com', 'grr.la',
  'spam4.me', 'spamgourmet.com', 'spamgourmet.net',
  'spamgourmet.org', 'spamspot.com', 'spamthisplease.com',
  'dispostable.com', 'disposableaddress.com', 'discard.email',
  'getnada.com', 'getairmail.com', 'maildrop.cc',
  'mailnull.com', 'mailnesia.com', 'mailnew.com',
  'fakeinbox.com', 'fakemail.fr', 'fakemailgenerator.com',
  'mailboxy.fun', 'inboxkitten.com', 'spamwc.de',
  'mohmal.com', 'mailexpire.com', 'tempemail.net',
  'tempr.email', 'emailondeck.com', 'burnermail.io',
  'crazymailing.com', 'deadaddress.com', 'despam.it',
  'filzmail.com', 'getonemail.net', 'ghosttexter.de',
  'haltospam.com', 'hatespam.org', 'ieatspam.eu',
  'ieatspam.info', 'jetable.fr.nf', 'jetable.net',
  'jetable.org', 'koszmail.pl', 'lifebyfood.com',
  'mail-temporaire.fr', 'mailbidon.com', 'mailbucket.org',
  'mailblocks.com', 'mailc.net', 'mailcatch.com',
  'maileimer.de', 'mailguard.me', 'mailhazard.com',
  'mailme.ir', 'mailme.lv', 'mailme24.com', 'mailmetrash.com',
  'mailmoat.com', 'mailnewspaper.com', 'mailnow.top',
  'mailpoof.com', 'mailproxsy.com', 'mailquack.com',
  'mailrock.biz', 'mailscrap.com', 'mailshell.com',
  'mailsiphon.com', 'mailslapping.com', 'mailslite.com',
  'mailtemp.info', 'mailtome.de', 'mailtothis.com',
  'mailzilla.org', 'mfsa.ru', 'mierdamail.com',
  'mintemail.com', 'moncourrier.fr.nf', 'monemail.fr.nf',
  'monmail.fr.nf', 'mt2009.com', 'mypartyclip.de',
  'myphantomemail.com', 'mytempemail.com', 'mytrashmail.com',
  'neomailbox.com', 'nospamfor.us', 'nospamthanks.info',
  'notmailinator.com', 'notsharingmy.info', 'nowmymail.com',
  'objectmail.com', 'obobbo.com', 'odnorazovoe.ru',
  'oneoffemail.com', 'onewaymail.com', 'online.ms',
  'oopi.org', 'opayq.com', 'ordinaryamerican.net',
  'owlpic.com', 'pjjkp.com', 'plexolan.de',
  'pookmail.com', 'privacy.net', 'proxymail.eu',
  'rcpt.at', 'reallymymail.com', 'recode.me',
  'recursor.net', 'recyclemail.dk', 'regbypass.com',
  'rklips.com', 'rmqkr.net', 'royal.net',
  'rppkn.com', 's0ny.net', 'safe-mail.net',
  'safetymail.info', 'safetypost.de', 'shiftmail.com',
  'shitware.nl', 'shortmail.net', 'sibmail.com',
  'skeefmail.com', 'slapsfromlastnight.com', 'slippery.email',
  'slopsbox.com', 'smellfear.com', 'snakemail.com',
  'sneakemail.com', 'sneakmail.de', 'spamavert.com',
  'spambob.com', 'spambob.net', 'spambob.org',
  'spambox.info', 'spambox.irishspringrealty.com',
  'spambox.us', 'spamcannon.com', 'spamcannon.net',
  'spamcero.com', 'spamcon.org', 'spamcorptastic.com',
  'spamday.com', 'spamex.com', 'spamfree24.de',
  'spamfree24.eu', 'spamfree24.info', 'spamfree24.net',
  'spamfree24.org', 'spamgoes.in', 'spamgourmet.com',
  'spamherelots.com', 'spamhereplease.com', 'spamhole.com',
  'spamify.com', 'spaminator.de', 'spamkill.info',
  'spaml.com', 'spaml.de', 'spammotel.com',
  'spamoff.de', 'spamslicer.com', 'spamsub.com',
  'spamthis.co.uk', 'spamtroll.net', 'speed.1s.fr',
  'supergreatmail.com', 'supermailer.jp', 'suremail.info',
  'tafmail.com', 'tagyourself.com', 'teewars.org',
  'teleworm.com', 'teleworm.us', 'tempalias.com',
  'tempe-mail.com', 'tempemail.biz', 'tempemail.com',
  'temporaryemail.net', 'temporaryemail.us', 'temporaryforwarding.com',
  'temporaryinbox.com', 'temporarymailaddress.com', 'thanksnospam.info',
  'thisisnotmyrealemail.com', 'throwam.com', 'tittbit.in',
  'tmail.com', 'tmailinator.com', 'toiea.com',
  'tradermail.info', 'trash2009.com', 'trash2010.com',
  'trash2011.com', 'trashdevil.com', 'trashdevil.de',
  'trashemail.de', 'trashimail.com', 'trbvm.com',
  'turboaddress.com', 'twinmail.de', 'tyldd.com',
  'uggsrock.com', 'uroid.com', 'us.af',
  'veryrealemail.com', 'viditag.com', 'viewcastmedia.com',
  'viewcastmedia.net', 'viewcastmedia.org', 'webm4il.info',
  'wegwerfmail.de', 'wegwerfmail.net', 'wegwerfmail.org',
  'wetrainbayarea.com', 'wetrainbayarea.org', 'wh4f.org',
  'whyspam.me', 'willhackforfood.biz', 'willselfdestruct.com',
  'wilemail.com', 'winemaven.info', 'wronghead.com',
  'wuzupmail.net', 'xagloo.com', 'xemaps.com',
  'xents.com', 'xmaily.com', 'xoxy.net',
  'xsmail.com', 'xyzfree.net', 'yapped.net',
  'yeah.net', 'yep.it', 'ypemail.com',
  'yuurok.com', 'z1p.biz', 'za.com',
  'zehnminutenmail.de', 'zippymail.info', 'zoaxe.com',
  'zoemail.net', 'zoemail.org', 'zomg.info',
]);

// ── Common typos in popular domains ─────────────────────────
const DOMAIN_TYPOS = {
  'gmai.com':     'gmail.com',
  'gmial.com':    'gmail.com',
  'gmali.com':    'gmail.com',
  'gnail.com':    'gmail.com',
  'gamil.com':    'gmail.com',
  'gmail.co':     'gmail.com',
  'gmail.cm':     'gmail.com',
  'hotmial.com':  'hotmail.com',
  'hotmal.com':   'hotmail.com',
  'hotmai.com':   'hotmail.com',
  'hotmaill.com': 'hotmail.com',
  'outlok.com':   'outlook.com',
  'outllok.com':  'outlook.com',
  'yaho.com':     'yahoo.com',
  'yahooo.com':   'yahoo.com',
  'yhoo.com':     'yahoo.com',
  'icoud.com':    'icloud.com',
  'iclod.com':    'icloud.com',
  'icould.com':   'icloud.com',
  'protonmai.com':'protonmail.com',
  'prtonmail.com':'protonmail.com',
};

// ── Role-based addresses ─────────────────────────────────────
// These are valid emails but often not personal — flag but don't block
const ROLE_PREFIXES = new Set([
  'admin', 'administrator', 'webmaster', 'postmaster', 'hostmaster',
  'noreply', 'no-reply', 'donotreply', 'do-not-reply',
  'support', 'help', 'info', 'contact', 'sales', 'marketing',
  'abuse', 'security', 'billing', 'accounts', 'team', 'hello',
  'hi', 'mail', 'email', 'office', 'ops', 'dev', 'root',
]);

/**
 * validateEmail(email)
 * Returns: { valid: bool, error: string|null, warning: string|null, suggestion: string|null }
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required.' };
  }

  const cleaned = email.trim().toLowerCase();

  // Length check
  if (cleaned.length > 320) {
    return { valid: false, error: 'Email address is too long.' };
  }
  if (cleaned.length < 5) {
    return { valid: false, error: 'Email address is too short.' };
  }

  // Must have exactly one @
  const atCount = (cleaned.match(/@/g) || []).length;
  if (atCount !== 1) {
    return { valid: false, error: 'Invalid email address format.' };
  }

  // Format check
  if (!EMAIL_RE.test(cleaned)) {
    return { valid: false, error: 'Invalid email address format.' };
  }

  const [localPart, domain] = cleaned.split('@');

  // Local part checks
  if (localPart.length > 64) {
    return { valid: false, error: 'Email address is invalid.' };
  }

  // No consecutive dots
  if (cleaned.includes('..')) {
    return { valid: false, error: 'Invalid email address (consecutive dots).' };
  }

  // No leading/trailing dots in local part
  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    return { valid: false, error: 'Invalid email address format.' };
  }

  // Domain must have at least one dot
  if (!domain.includes('.')) {
    return { valid: false, error: 'Invalid email domain.' };
  }

  // TLD must be at least 2 chars
  const tld = domain.split('.').pop();
  if (tld.length < 2) {
    return { valid: false, error: 'Invalid email domain extension.' };
  }

  // Block all-numeric TLDs (e.g. user@domain.123)
  if (/^\d+$/.test(tld)) {
    return { valid: false, error: 'Invalid email domain.' };
  }

  // Disposable email check
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { valid: false, error: 'Disposable or temporary email addresses are not allowed.' };
  }

  // Typo suggestion
  const suggestion = DOMAIN_TYPOS[domain] ? `${localPart}@${DOMAIN_TYPOS[domain]}` : null;
  if (suggestion) {
    // Return as warning, not error — user can still proceed but we surface it
    return { valid: true, error: null, warning: null, suggestion };
  }

  // Role-based address warning (valid but flag)
  const isRole = ROLE_PREFIXES.has(localPart.split(/[.+_-]/)[0]);
  const warning = isRole ? 'This looks like a shared or role-based address.' : null;

  return { valid: true, error: null, warning, suggestion: null };
}

module.exports = { validateEmail };
