/**
 * FraudShield AI — Synthetic Demonstration Data Service
 * 
 * NOTICE:
 * All data in this file is SYNTHETIC and strictly intended for UI workflow evaluation.
 * Real transaction aggregation, PostgreSQL persistence, and live ML fraud detection
 * will be integrated in Milestones 4, 5, 6, and 11.
 */

export const SYNTHETIC_DISCLAIMER =
  'SYNTHETIC DEMO DATA — Illustrative sample for UI design review. Real transaction aggregation and fraud metrics activate in Milestones 4-6 & 11.';

/**
 * Synthetic transactions for Personal Dashboard sample preview.
 */
export const SYNTHETIC_PERSONAL_TRANSACTIONS = [
  {
    id: 'tx_syn_001',
    date: '2026-11-04T10:14:00Z',
    merchant: 'FreshGrocer Mart',
    category: 'Groceries',
    amount: 64.5,
    currency: 'USD',
    channel: 'Card POS',
    riskStatus: 'low',
    riskScore: 0.02,
  },
  {
    id: 'tx_syn_002',
    date: '2026-11-03T18:42:00Z',
    merchant: 'Metropolis Metro Transit',
    category: 'Transportation',
    amount: 3.25,
    currency: 'USD',
    channel: 'Contactless NFC',
    riskStatus: 'low',
    riskScore: 0.01,
  },
  {
    id: 'tx_syn_003',
    date: '2026-11-02T13:05:00Z',
    merchant: 'StreamPulse Digital',
    category: 'Entertainment',
    amount: 14.99,
    currency: 'USD',
    channel: 'Recurring Web',
    riskStatus: 'low',
    riskScore: 0.03,
  },
  {
    id: 'tx_syn_004',
    date: '2026-11-01T09:20:00Z',
    merchant: 'CloudCoffee Roasters',
    category: 'Food & Dining',
    amount: 8.75,
    currency: 'USD',
    channel: 'Mobile Wallet',
    riskStatus: 'low',
    riskScore: 0.01,
  },
];

/**
 * Synthetic queue items for Financial Analyst Triage.
 */
export const SYNTHETIC_ANALYST_QUEUE = [
  {
    id: 'CASE-SYN-1042',
    timestamp: '2026-11-04T13:45:10Z',
    accountId: 'acc_88921_usr',
    amount: 4850.0,
    currency: 'USD',
    category: 'Cross-Border Wire Transfer',
    riskScore: 92,
    severity: 'critical',
    indicators: [
      'Burst Velocity: 4 outbound attempts in 90 seconds',
      'Geo-IP Mismatch: Account IP (Bangalore) vs Proxy Exit (Lagos)',
      'New Payee added under 5 minutes prior to transfer',
    ],
    status: 'PENDING_REVIEW',
    simulatedTelemetry: {
      clientIp: '198.51.100.44',
      deviceFingerprint: 'FP-CHROME-WIN-77B41',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0',
      anomalyConfidence: '94.2%',
    },
  },
  {
    id: 'CASE-SYN-1039',
    timestamp: '2026-11-04T12:20:04Z',
    accountId: 'acc_31409_usr',
    amount: 72.0,
    currency: 'USD',
    category: 'E-Commerce Micro-Charges',
    riskScore: 78,
    severity: 'elevated',
    indicators: [
      'Card testing signature: Repeated incremental CVV retries',
      'Velocity: 6 distinct digital merchants within 12 minutes',
    ],
    status: 'PENDING_REVIEW',
    simulatedTelemetry: {
      clientIp: '203.0.113.89',
      deviceFingerprint: 'FP-SAFARI-IOS-99C12',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)',
      anomalyConfidence: '81.0%',
    },
  },
  {
    id: 'CASE-SYN-1035',
    timestamp: '2026-11-04T08:11:55Z',
    accountId: 'acc_55102_usr',
    amount: 1200.0,
    currency: 'USD',
    category: 'Peer-to-Peer UPI Payment',
    riskScore: 68,
    severity: 'elevated',
    indicators: [
      'Unusual midnight activity outside 90-day circadian profile',
      'Beneficiary flagged in community phishing repository',
    ],
    status: 'PENDING_REVIEW',
    simulatedTelemetry: {
      clientIp: '192.0.2.115',
      deviceFingerprint: 'FP-ANDROID-APP-33D80',
      userAgent: 'FraudShield Mobile/2.1 (Android 15)',
      anomalyConfidence: '72.5%',
    },
  },
  {
    id: 'CASE-SYN-1028',
    timestamp: '2026-11-03T21:40:12Z',
    accountId: 'acc_10928_usr',
    amount: 340.0,
    currency: 'USD',
    category: 'ATM Cash Withdrawal',
    riskScore: 42,
    severity: 'moderate',
    indicators: [
      'Terminal distance: 280 km from last known mobile device beacon',
    ],
    status: 'REVIEWED_IN_DEMO',
    simulatedTelemetry: {
      clientIp: 'Terminal ATM-8812',
      deviceFingerprint: 'HARDWARE-ATM-NCR-4',
      userAgent: 'NCR SelfServ Firmware 4.8',
      anomalyConfidence: '46.1%',
    },
  },
];

/**
 * Synthetic risk band distribution for Analyst Chart.
 */
export const SYNTHETIC_RISK_DISTRIBUTION = [
  { band: 'Low Risk (0-30)', count: 842, fill: '#10B981' },
  { band: 'Moderate (31-60)', count: 118, fill: '#F59E0B' },
  { band: 'Elevated (61-80)', count: 43, fill: '#F97316' },
  { band: 'Critical (81-100)', count: 14, fill: '#EF4444' },
];

/**
 * Synthetic 7-day trend for Analyst Chart.
 */
export const SYNTHETIC_7DAY_TREND = [
  { day: 'Day 1', totalVolume: 1240, flaggedAlerts: 18 },
  { day: 'Day 2', totalVolume: 1390, flaggedAlerts: 22 },
  { day: 'Day 3', totalVolume: 1180, flaggedAlerts: 15 },
  { day: 'Day 4', totalVolume: 1520, flaggedAlerts: 31 },
  { day: 'Day 5', totalVolume: 1460, flaggedAlerts: 24 },
  { day: 'Day 6', totalVolume: 1610, flaggedAlerts: 29 },
  { day: 'Day 7', totalVolume: 1730, flaggedAlerts: 20 },
];

