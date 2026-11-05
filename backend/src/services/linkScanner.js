/**
 * FraudShield AI — Suspicious Link Scanner Service
 *
 * Implements defensive, zero-fetch static URL analysis and plain-English AI explanations.
 *
 * Security & Reliability Invariants:
 * 1. Zero-Fetch / Anti-SSRF: NEVER opens, resolves, visits, or fetches arbitrary user-provided URLs.
 * 2. Static Parsing: Evaluates structure, authority, domain, encoding, and path patterns only.
 * 3. Defanged Rendering: Produces a safe, defanged URL representation to avoid accidental client clicks.
 * 4. Deterministic Score Integrity: Risk scores are calculated deterministically; AI cannot mutate them.
 * 5. Facts vs Indicators: Clearly separates verified structural facts from heuristic threat signals.
 * 6. No Guarantees: Explicitly notes that a low score does not guarantee safety.
 */

import { config, isGeminiConfigured } from '../config/environment.js';
import { calculateBackoffDelay } from './geminiExplainer.js';

// Common known URL shortener domains
export const KNOWN_SHORTENERS = new Set([
  'bit.ly',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'ow.ly',
  'is.gd',
  'buff.ly',
  'adf.ly',
  'bit.do',
  'rebrand.ly',
  'cutt.ly',
  'shorte.st',
  'tiny.cc',
  'bc.vc',
  'soo.gd',
  's.id',
  'v.gd',
]);

// Well-known financial, tech, and retail brands targeted by phishing
export const MONITORED_TARGET_BRANDS = [
  'paypal',
  'apple',
  'google',
  'microsoft',
  'amazon',
  'netflix',
  'chase',
  'bankofamerica',
  'wellsfargo',
  'citi',
  'barclays',
  'binance',
  'coinbase',
  'metamask',
  'facebook',
  'instagram',
  'whatsapp',
  'telegram',
];

// High-risk generic top-level domains frequently abused in phishing campaigns
export const HIGH_RISK_TLDS = new Set([
  'xyz',
  'top',
  'work',
  'buzz',
  'click',
  'rest',
  'fit',
  'surf',
  'gq',
  'cf',
  'ml',
  'ga',
  'tk',
  'cam',
  'icu',
  'monster',
]);

// High-risk executable or script extensions
export const DANGEROUS_EXTENSIONS = new Set([
  '.exe',
  '.scr',
  '.bat',
  '.cmd',
  '.apk',
  '.vbs',
  '.ps1',
  '.msi',
  '.iso',
  '.dmg',
  '.jar',
  '.vbe',
  '.hta',
]);

// High-risk phishing action keywords
export const SUSPICIOUS_PATH_KEYWORDS = [
  'login',
  'signin',
  'verify',
  'verification',
  'secure',
  'security',
  'account-update',
  'update-account',
  'banking',
  'wallet',
  'password',
  'credential',
  'confirm-identity',
  '2fa',
  'recover',
];

// In-memory rate limiting store: userId -> array of timestamps
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;

export function resetLinkScannerRateLimits() {
  rateLimitStore.clear();
}

export function enforceLinkScannerRateLimit(
  identifier,
  limit = MAX_REQUESTS_PER_WINDOW,
  windowMs = RATE_LIMIT_WINDOW_MS
) {
  if (!identifier) return;

  const now = Date.now();
  const windowStart = now - windowMs;

  const userRequests = rateLimitStore.get(identifier) || [];
  const recentRequests = userRequests.filter((ts) => ts > windowStart);

  if (recentRequests.length >= limit) {
    const err = new Error(
      'Link scanner rate limit exceeded. Please wait a minute before analyzing another URL.'
    );
    err.statusCode = 429;
    err.code = 'RateLimitExceeded';
    throw err;
  }

  recentRequests.push(now);
  rateLimitStore.set(identifier, recentRequests);
}

/**
 * Defangs a URL string to prevent accidental client execution or automated link preview triggers.
 *
 * @param {string} rawUrl
 * @returns {string} Defanged URL (e.g. hxxps[://]example[.]com)
 */
export function defangUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return '';
  return rawUrl
    .replace(/^https:\/\//i, 'hxxps[://]')
    .replace(/^http:\/\//i, 'hxxp[://]')
    .replace(/\./g, '[.]');
}

/**
 * Checks if a hostname is an IPv4 or IPv6 address.
 *
 * @param {string} hostname
 * @returns {boolean}
 */
export function isIpAddressHostname(hostname) {
  if (!hostname) return false;
  const clean = hostname.replace(/^\[|\]$/g, '').trim();

  // IPv4 standard dot-decimal
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (ipv4Regex.test(clean)) return true;

  // IPv4 hex / octal representation (e.g. 0x7f000001 or 2130706433 or 0177.0.0.1)
  if (/^0x[0-9a-fA-F]+$/.test(clean) || /^\d{8,11}$/.test(clean)) return true;

  // IPv6 notation
  if (clean.includes(':')) {
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$|^([0-9a-fA-F]{1,4}:){1,7}:|^:([0-9a-fA-F]{1,4}:){1,7}/;
    if (ipv6Regex.test(clean)) return true;
  }

  return false;
}

/**
 * Detects common brand homoglyphs, substitutions, and typosquatting.
 *
 * @param {string} text
 * @returns {string|null} Matched brand name or null
 */
export function detectLookalikeBrand(text) {
  if (!text) return null;
  const normalized = text
    .toLowerCase()
    .replace(/[0o]/g, 'o')
    .replace(/[1l!|]/g, 'l')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/8/g, 'b');

  for (const brand of MONITORED_TARGET_BRANDS) {
    if (normalized.includes(brand)) {
      return brand;
    }
  }
  return null;
}

/**
 * Performs comprehensive static heuristic analysis on a submitted URL.
 * Strictly NEVER performs network fetching, DNS lookups, or execution.
 *
 * @param {string} rawInput
 * @returns {Object} Structured static analysis result
 */
export function analyzeUrlStatic(rawInput) {
  if (typeof rawInput !== 'string' || !rawInput.trim()) {
    const err = new Error('URL string is required for scanning');
    err.statusCode = 400;
    err.code = 'ValidationError';
    throw err;
  }

  const trimmed = rawInput.trim();
  if (trimmed.length > 2048) {
    const err = new Error('URL exceeds maximum allowable length of 2048 characters');
    err.statusCode = 400;
    err.code = 'ValidationError';
    throw err;
  }

  // Reject null bytes and binary control characters immediately
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    const err = new Error('URL contains illegal binary or control characters');
    err.statusCode = 400;
    err.code = 'ValidationError';
    throw err;
  }

  // Check for dangerous non-HTTP schemes
  const lowerTrimmed = trimmed.toLowerCase();
  if (
    lowerTrimmed.startsWith('javascript:') ||
    lowerTrimmed.startsWith('data:') ||
    lowerTrimmed.startsWith('file:') ||
    lowerTrimmed.startsWith('blob:') ||
    lowerTrimmed.startsWith('ftp:')
  ) {
    return {
      isValidUrl: false,
      isBlockedScheme: true,
      scheme: lowerTrimmed.split(':')[0],
      riskScore: 100,
      riskLevel: 'critical',
      defanged: defangUrl(trimmed),
      facts: [
        `URL uses prohibited protocol scheme "${lowerTrimmed.split(':')[0]}:".`,
        `Client script execution or local file access vector detected.`,
      ],
      indicators: [
        `RULE_DANGEROUS_SCHEME: Scheme "${lowerTrimmed.split(':')[0]}:" is frequently used for XSS payloads or local file disclosure.`,
      ],
      heuristicCodes: ['RULE_DANGEROUS_SCHEME'],
      parsedUrl: null,
    };
  }

  // Normalize URL with implicit protocol if missing
  let urlToParse = trimmed;
  let addedImplicitProtocol = false;
  if (!/^https?:\/\//i.test(urlToParse)) {
    urlToParse = 'https://' + urlToParse;
    addedImplicitProtocol = true;
  }

  let parsed;
  try {
    parsed = new URL(urlToParse);
  } catch {
    const err = new Error('Invalid URL format. Please provide a well-formed web address.');
    err.statusCode = 400;
    err.code = 'ValidationError';
    throw err;
  }

  const protocol = addedImplicitProtocol ? 'unspecified (defaulted to https)' : parsed.protocol.replace(':', '');
  const hostname = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname;
  const search = parsed.search;
  const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
  const fullDefanged = defangUrl(trimmed);

  const facts = [
    `Canonical Protocol: ${protocol.toUpperCase()}`,
    `Parsed Hostname: ${hostname}`,
    `Path: ${pathname || '/'}`,
  ];
  if (port) facts.push(`Port: ${port}`);
  if (search) facts.push(`Query String: ${search.slice(0, 80)}${search.length > 80 ? '...' : ''}`);

  const indicators = [];
  const heuristicCodes = [];
  let score = 0;

  // 1. Unencrypted HTTP Scheme Check
  if (parsed.protocol === 'http:' && !addedImplicitProtocol) {
    score += 25;
    indicators.push('RULE_HTTP_INSECURE: Connection uses unencrypted plain HTTP. Login credentials and payment data can be intercepted.');
    heuristicCodes.push('RULE_HTTP_INSECURE');
  }

  // 2. IP Address Hostname Check
  const isIp = isIpAddressHostname(hostname);
  if (isIp) {
    score += 50;
    indicators.push(`RULE_IP_HOSTNAME: Hostname "${hostname}" is a raw IP address instead of a registered domain. Attackers use raw IPs to bypass domain reputation blocklists.`);
    heuristicCodes.push('RULE_IP_HOSTNAME');
    facts.push('Host Type: Raw IP Address');
  }

  // 3. Authority / Userinfo Credentials Check (e.g. https://user:pass@google.com)
  if (parsed.username || parsed.password || trimmed.includes('@')) {
    score += 45;
    indicators.push('RULE_EMBEDDED_CREDENTIALS: URL contains "@" authority embedding or credentials. This technique is commonly used to deceive users about the real destination host.');
    heuristicCodes.push('RULE_EMBEDDED_CREDENTIALS');
  }

  // 4. URL Shortener Detection
  if (KNOWN_SHORTENERS.has(hostname)) {
    score += 30;
    indicators.push(`RULE_URL_SHORTENER: Hostname "${hostname}" is a known URL shortening service. Shortened links obscure the final destination website.`);
    heuristicCodes.push('RULE_URL_SHORTENER');
  }

  // 5. Punycode / Internationalized Domain Name (IDN) Homograph Check
  if (hostname.includes('xn--')) {
    score += 45;
    indicators.push(`RULE_PUNYCODE_HOMOGLYPH: Domain "${hostname}" contains Punycode encoding ("xn--"). Homograph attacks use visually identical unicode characters to spoof legitimate brand domains.`);
    heuristicCodes.push('RULE_PUNYCODE_HOMOGLYPH');
  }

  // 6. Subdomain Depth & Misleading Brand Subdomains
  const hostParts = hostname.split('.');
  const tld = hostParts.length > 1 ? hostParts[hostParts.length - 1] : '';
  const secondLevelDomain = hostParts.length > 1 ? hostParts.slice(-2).join('.') : hostname;

  if (hostParts.length > 4) {
    score += 25;
    indicators.push(`RULE_EXCESSIVE_SUBDOMAINS: Host contains ${hostParts.length - 2} subdomains (${hostname}). Excessive subdomain nesting is often used to disguise malicious destinations.`);
    heuristicCodes.push('RULE_EXCESSIVE_SUBDOMAINS');
  }

  // Check if a monitored brand appears in subdomains while NOT being the registered second-level domain
  // e.g. "paypal.com.verify-login.xyz" -> secondLevelDomain is "verify-login.xyz", subdomains contain "paypal"
  for (const brand of MONITORED_TARGET_BRANDS) {
    const brandInHost = hostname.includes(brand);
    const brandInSld = secondLevelDomain.includes(brand);

    if (brandInHost && !brandInSld) {
      score += 60;
      indicators.push(`RULE_DECEPTIVE_BRAND_SUBDOMAIN: The reputable brand "${brand}" appears in a subdomain, but the actual destination domain is "${secondLevelDomain}". This is a strong indicator of phishing.`);
      heuristicCodes.push('RULE_DECEPTIVE_BRAND_SUBDOMAIN');
      break;
    }
  }

  // 7. Typosquatting / Lookalike Brand Detection in the SLD
  const detectedBrand = detectLookalikeBrand(secondLevelDomain);
  if (detectedBrand && !secondLevelDomain.includes(`${detectedBrand}.`)) {
    // Brand keyword found with character substitutions e.g. "paypa1.com" or "g00gle.net"
    score += 45;
    indicators.push(`RULE_BRAND_TYPOSQUAT: Domain "${secondLevelDomain}" mimics target brand "${detectedBrand}" using character substitution or lookalike patterns.`);
    heuristicCodes.push('RULE_BRAND_TYPOSQUAT');
  }

  // 8. High-Risk Phishing TLD Check
  if (HIGH_RISK_TLDS.has(tld)) {
    score += 20;
    indicators.push(`RULE_SUSPICIOUS_TLD: Top-level domain ".${tld}" has an elevated statistical correlation with automated phishing and malware campaigns.`);
    heuristicCodes.push('RULE_SUSPICIOUS_TLD');
  }

  // 9. Dangerous Executable / Script Extensions in Path
  const lowerPath = pathname.toLowerCase();
  for (const ext of DANGEROUS_EXTENSIONS) {
    if (lowerPath.endsWith(ext) || lowerPath.includes(`${ext}?`)) {
      score += 55;
      indicators.push(`RULE_DANGEROUS_DOWNLOAD: URL targets a dangerous executable, script, or package payload ("${ext}"). Opening this link may prompt unauthorized software installation.`);
      heuristicCodes.push('RULE_DANGEROUS_DOWNLOAD');
      break;
    }
  }

  // 10. Phishing Action Keywords Paired with Suspicious Indicators
  let matchedKeyword = null;
  for (const kw of SUSPICIOUS_PATH_KEYWORDS) {
    if (lowerPath.includes(kw) || search.toLowerCase().includes(kw)) {
      matchedKeyword = kw;
      break;
    }
  }
  if (matchedKeyword && (score > 0 || isIp || HIGH_RISK_TLDS.has(tld))) {
    score += 25;
    indicators.push(`RULE_SENSITIVE_KEYWORD: Path or query requests sensitive action ("${matchedKeyword}") on a high-risk or unverified domain structure.`);
    heuristicCodes.push('RULE_SENSITIVE_KEYWORD');
  }

  // 11. Encoded Traversal or Obfuscation Patterns
  if (/%[0-9a-fA-F]{2}/.test(trimmed)) {
    const decodedCount = (trimmed.match(/%[0-9a-fA-F]{2}/g) || []).length;
    if (decodedCount > 5 || trimmed.includes('%2e%2e') || trimmed.includes('%00')) {
      score += 30;
      indicators.push('RULE_OBFUSCATED_ENCODING: URL contains heavy percent-encoding or path traversal sequences (%2e%2e) designed to evade keyword inspection.');
      heuristicCodes.push('RULE_OBFUSCATED_ENCODING');
    }
  }

  // 12. Extreme Length Check
  if (trimmed.length > 250) {
    score += 15;
    indicators.push(`RULE_EXTREME_LENGTH: URL is unusually long (${trimmed.length} characters), commonly used to push malicious domains outside visible browser address bars.`);
    heuristicCodes.push('RULE_EXTREME_LENGTH');
  }

  // If no indicators triggered, assign clean baseline
  if (indicators.length === 0) {
    indicators.push('No anomalous host, protocol, or obfuscation patterns detected by static heuristic rules.');
  }

  // Clamp deterministic risk score to 0–100
  const finalScore = Math.min(Math.max(score, 0), 100);
  const riskLevel =
    finalScore >= 90
      ? 'critical'
      : finalScore >= 70
      ? 'high'
      : finalScore >= 40
      ? 'medium'
      : 'low';

  return {
    isValidUrl: true,
    isBlockedScheme: false,
    scheme: protocol,
    hostname,
    port,
    path: pathname || '/',
    query: search || '',
    riskScore: finalScore,
    riskLevel,
    defanged: fullDefanged,
    facts,
    indicators,
    heuristicCodes,
    parsedUrl: {
      origin: parsed.origin,
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      pathname: parsed.pathname,
      search: parsed.search,
    },
  };
}

/**
 * Builds the plain-English rule-based fallback explanation when Gemini is unconfigured or unavailable.
 *
 * @param {string} rawUrl
 * @param {Object} staticAnalysis
 * @param {string} [reason='Gemini service unconfigured']
 * @returns {Object} Structured explanation payload
 */
export function generateLinkRuleBasedFallback(rawUrl, staticAnalysis, reason = 'Gemini service unconfigured') {
  const { riskScore, riskLevel, facts, indicators, defanged } = staticAnalysis;

  let summary = '';
  if (riskLevel === 'critical' || riskLevel === 'high') {
    summary = `Static heuristic inspection flagged this URL (${defanged}) with ${riskLevel.toUpperCase()} risk (${riskScore}/100). Significant anomaly indicators were detected, including potential brand impersonation, deceptive domain routing, or dangerous payload targets. We strongly advise against visiting this link or entering any credentials.`;
  } else if (riskLevel === 'medium') {
    summary = `This URL (${defanged}) triggered moderate monitoring flags with a risk score of ${riskScore}/100. While it may belong to a legitimate service, the presence of structural anomalies (such as URL shortening, unencrypted HTTP, or unusual domain depth) warrants caution before proceeding.`;
  } else {
    summary = `This URL (${defanged}) exhibits standard web formatting consistent with normal baseline practices (Risk Score: ${riskScore}/100). No deceptive brand homoglyphs, IP hostnames, or obfuscation patterns were detected during static inspection.`;
  }

  let recommendations = [];
  if (riskScore >= 70) {
    recommendations = [
      `Do NOT click, open, or paste this URL into your browser, and never enter account passwords or financial details.`,
      `If this link was received via email, SMS, or direct message, navigate directly to the verified official portal by typing the known official domain manually.`,
      `Report the sender as a suspected phishing attempt through your email client or communication platform to protect other users.`,
    ];
  } else if (riskScore >= 40) {
    recommendations = [
      `Verify the sender's identity through an independent, trusted channel before interacting with any content linked here.`,
      `If this is a shortened link, expand it using an unshortener inspection tool rather than clicking through directly.`,
      `Ensure your browser's phishing and malware protection features (e.g. Google Safe Browsing / Microsoft SmartScreen) are enabled and updated.`,
    ];
  } else {
    recommendations = [
      `Confirm the website displays a valid SSL/TLS lock icon in your browser's address bar upon visiting.`,
      `Always check the address bar to ensure the domain matches the expected company before submitting login credentials.`,
      `Use a password manager with autofill protection, which automatically prevents entering credentials on lookalike phishing domains.`,
    ];
  }

  return {
    success: true,
    provider: 'rule_based_fallback',
    aiAvailable: false,
    model: 'deterministic-link-v1.0',
    fallbackReason: reason,
    summary,
    facts,
    indicators,
    recommendations,
    risk_score: riskScore,
    risk_level: riskLevel,
    defanged_url: defanged,
    disclaimer: 'Static heuristic analysis is advisory and does NOT guarantee safety or constitute definitive forensic proof.',
    analyzed_at: new Date().toISOString(),
  };
}

/**
 * Builds the structured Google Gemini AI prompt for plain-English URL analysis.
 *
 * @param {string} rawUrl
 * @param {Object} staticAnalysis
 * @returns {string} Prompt
 */
function buildLinkGeminiPrompt(rawUrl, staticAnalysis) {
  const { riskScore, riskLevel, facts, indicators, defanged } = staticAnalysis;
  const factsText = facts.join('\n- ');
  const indicatorsText = indicators.join('\n- ');

  return `You are a cybersecurity web threat analyst for FraudShield AI.
Your objective is to provide a plain-English, consumer-friendly explanation of why a submitted web link triggered specific warning signs during static inspection.

STRICT INVARIANTS:
1. Do NOT recalculate or modify the official risk score. The deterministic static engine has verified this URL as Risk Score: ${riskScore}/100 (${riskLevel} risk).
2. Clearly distinguish between CONFIRMED FACTS (verified structural data) and POTENTIAL THREAT INDICATORS (heuristics like brand lookalikes, IP hosts, or shorteners).
3. Do NOT guarantee any website is safe or malicious. AI analysis is advisory and educational.
4. Output exactly THREE practical, actionable safety recommendations for the user.
5. Return ONLY a valid JSON object matching the requested schema. No markdown formatting, backticks, or preamble.

URL UNDER ANALYSIS:
- Defanged URL: ${defanged}
- Official Deterministic Risk Score: ${riskScore}/100 (${riskLevel} risk)
- Confirmed Structural Facts:
- ${factsText}
- Triggered Static Threat Indicators:
- ${indicatorsText}

JSON OUTPUT SCHEMA:
{
  "summary": "2-3 clear, jargon-free sentences explaining the structural findings in plain English.",
  "facts": [
    "Confirmed fact 1",
    "Confirmed fact 2"
  ],
  "indicators": [
    "Potential threat indicator 1 explained simply",
    "Potential threat indicator 2"
  ],
  "recommendations": [
    "Practical safety recommendation 1",
    "Practical safety recommendation 2",
    "Practical safety recommendation 3"
  ]
}`;
}

/**
 * Scans a user-provided URL using static heuristics and generates a plain-English Gemini AI explanation.
 *
 * @param {string} rawUrl
 * @param {Object} [options={}] - Options for testing / dependency injection
 * @returns {Promise<Object>} Formatted scan result
 */
export async function scanLink(rawUrl, options = {}) {
  // 1. Static Heuristic Analysis (Strictly zero-fetch)
  const staticAnalysis = analyzeUrlStatic(rawUrl);

  // 2. Rate Limiting
  const callerId = options.callerId || 'anonymous_user';
  if (!options.skipRateLimit) {
    enforceLinkScannerRateLimit(callerId, options.rateLimitMax, options.rateLimitWindowMs);
  }

  // 3. Configuration Check
  const isConfiguredCheck = options.isConfiguredCheck || isGeminiConfigured;
  const apiKey = (options.apiKey !== undefined ? options.apiKey : config.geminiApiKey)?.trim();

  if (!isConfiguredCheck() || !apiKey) {
    return generateLinkRuleBasedFallback(
      rawUrl,
      staticAnalysis,
      'Google Gemini API key is not configured in backend/.env'
    );
  }

  // 4. Model Selection & Resilient Cascade Configuration
  const primaryModel = options.model || config.geminiModel || 'gemini-3.8-flash';
  const backupModel = options.backupModel || 'gemini-3.1-flash-lite';
  const maxRetries = options.maxRetries !== undefined ? options.maxRetries : 2;
  const baseRetryDelayMs = options.baseRetryDelayMs !== undefined
    ? options.baseRetryDelayMs
    : (options.fetchFn ? 0 : 300);
  const jitterMs = options.jitterMs !== undefined ? options.jitterMs : (options.fetchFn ? 0 : 100);

  const promptText = buildLinkGeminiPrompt(rawUrl, staticAnalysis);
  const requestBody = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: {
      temperature: 0.2,
      topP: 0.8,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
    },
  };

  const timeoutMs = options.timeoutMs || 20000;
  const fetchFn = options.fetchFn || fetch;

  try {
    const executeSingleCall = async (targetModel) => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(targetModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetchFn(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutHandle);
      }
    };

    let activeModel = primaryModel;
    let res = null;
    let primaryError = null;

    try {
      res = await executeSingleCall(primaryModel);
    } catch (err) {
      primaryError = err;
    }

    const canFallback = !options.disableModelFallback && backupModel && backupModel !== primaryModel;
    const primaryFailed = primaryError || (res && (res.status === 503 || res.status === 404));

    if (canFallback && primaryFailed) {
      const failureReason = primaryError ? primaryError.message : `HTTP ${res.status}`;
      console.warn(`[LinkScanner] Primary model ${primaryModel} failed (${failureReason}). Cascading to verified backup model ${backupModel}...`);
      activeModel = backupModel;
      try {
        res = await executeSingleCall(backupModel);
      } catch (backupErr) {
        console.warn(`[LinkScanner] Backup model ${backupModel} initial call failed:`, backupErr.message);
        throw backupErr;
      }
    } else if (primaryError) {
      throw primaryError;
    }

    // Bounded retries for temporary 503 errors
    let retryCount = 0;
    while (res && res.status === 503 && retryCount < maxRetries) {
      const delay = calculateBackoffDelay(retryCount, baseRetryDelayMs, 2000, jitterMs);
      console.warn(`[LinkScanner] Model ${activeModel} returned 503. Retrying (${retryCount + 1}/${maxRetries}) after ${delay}ms...`);
      if (delay > 0) {
        await new Promise((r) => setTimeout(r, delay));
      }
      res = await executeSingleCall(activeModel);
      retryCount++;
    }

    if (!res || !res.ok) {
      const statusText = res ? `status ${res.status}` : 'communication failure';
      console.warn(`[LinkScanner] Gemini API returned ${statusText}. Falling back to rule-based engine.`);
      return generateLinkRuleBasedFallback(
        rawUrl,
        staticAnalysis,
        `Gemini API responded with ${statusText}`
      );
    }

    const data = await res.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      return generateLinkRuleBasedFallback(
        rawUrl,
        staticAnalysis,
        'Empty candidate output from Gemini API'
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(candidateText.trim());
    } catch {
      const match = candidateText.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error('Failed to parse Gemini response as JSON');
      }
    }

    const fallback = generateLinkRuleBasedFallback(rawUrl, staticAnalysis);
    const summary = typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary.trim() : fallback.summary;
    const facts = Array.isArray(parsed.facts) && parsed.facts.length > 0 ? parsed.facts.map(String) : fallback.facts;
    const indicators = Array.isArray(parsed.indicators) && parsed.indicators.length > 0 ? parsed.indicators.map(String) : fallback.indicators;
    let recommendations = Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0
      ? parsed.recommendations.map(String).slice(0, 3)
      : fallback.recommendations;

    if (recommendations.length < 3) {
      recommendations = [...recommendations, ...fallback.recommendations].slice(0, 3);
    }

    return {
      success: true,
      provider: 'gemini',
      aiAvailable: true,
      model: activeModel,
      summary,
      facts,
      indicators,
      recommendations,
      // INVARIANT: Risk score and level are derived strictly from deterministic static engine
      risk_score: staticAnalysis.riskScore,
      risk_level: staticAnalysis.riskLevel,
      defanged_url: staticAnalysis.defanged,
      disclaimer: 'Static heuristic analysis is advisory and does NOT guarantee safety or constitute definitive forensic proof.',
      analyzed_at: new Date().toISOString(),
    };
  } catch (err) {
    const isTimeout = err.name === 'AbortError' || err.code === 20;
    const errorReason = isTimeout
      ? `Gemini API request timed out after ${timeoutMs}ms`
      : 'Gemini API communication failure';

    console.warn(`[LinkScanner] ${errorReason}. Falling back to rule-based assessment.`);
    return generateLinkRuleBasedFallback(rawUrl, staticAnalysis, errorReason);
  }
}

