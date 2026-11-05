/**
 * FraudShield AI — Suspicious Link PDF Security Report Generator
 *
 * Generates a clean, professional, enterprise-grade cybersecurity PDF report
 * using static scan result data.
 *
 * Security & Design Invariants:
 * 1. Zero External Requests: Uses only in-memory scan result data already present on the client.
 * 2. Defanged Non-Clickable URL: Scanned URL is rendered strictly as defanged text; NEVER hyperlinked.
 * 3. Secret Protection: Never includes tokens, API keys, or private session information.
 * 4. Deterministic Score & Level: Renders verified risk score, heuristics, facts, and AI explanation.
 * 5. Clear Disclaimer: Includes explicit static-analysis safety advisory.
 */

import { jsPDF } from 'jspdf';

/**
 * Maps risk levels to RGB color tuples for PDF styling.
 *
 * @param {string} level
 * @returns {{ primary: [number, number, number], background: [number, number, number], text: [number, number, number] }}
 */
function getRiskColors(level) {
  switch (level) {
    case 'critical':
      return {
        primary: [225, 29, 72], // Rose 600
        background: [255, 241, 242], // Rose 50
        text: [159, 18, 57], // Rose 900
      };
    case 'high':
      return {
        primary: [234, 88, 12], // Orange 600
        background: [255, 247, 237], // Orange 50
        text: [154, 52, 18], // Orange 900
      };
    case 'medium':
      return {
        primary: [217, 119, 6], // Amber 600
        background: [254, 243, 199], // Amber 50
        text: [146, 64, 14], // Amber 900
      };
    case 'low':
    default:
      return {
        primary: [5, 150, 105], // Emerald 600
        background: [236, 253, 245], // Emerald 50
        text: [6, 95, 70], // Emerald 900
      };
  }
}

/**
 * Builds a structured jsPDF document representing the Link Security Assessment Report.
 *
 * @param {Object} result - Scan result object from backend /api/v1/links/scan
 * @returns {jsPDF} Configured jsPDF instance
 */
export function createLinkSecurityReportDoc(result) {
  if (!result || typeof result !== 'object') {
    throw new Error('Valid scan result object is required to generate report.');
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 16;
  const contentWidth = pageWidth - margin * 2; // 178mm
  let y = margin;

  const checkPageBreak = (neededHeight) => {
    if (y + neededHeight > pageHeight - margin - 10) {
      doc.addPage();
      y = margin;
      drawHeaderWatermark();
    }
  };

  const drawHeaderWatermark = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text('FRAUDSHIELD AI — CYBERSECURITY THREAT ASSESSMENT REPORT', margin, y);
    y += 5;
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.setLineWidth(0.3);
    doc.line(margin, y, margin + contentWidth, y);
    y += 6;
  };

  // --- 1. Top Header Banner ---
  // Top Accent Bar (Brand Blue)
  doc.setFillColor(37, 99, 235); // Brand Blue (#2563eb)
  doc.rect(margin, y, contentWidth, 3, 'F');
  y += 7;

  // Title & Brand
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text('FRAUDSHIELD AI', margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text('DEFENSIVE FINANCIAL SAFETY & WEB THREAT INTELLIGENCE', margin, y + 4.5);
  y += 11;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59); // Slate 800
  doc.text('Suspicious Link Security Assessment Report', margin, y);
  y += 6;

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, y, margin + contentWidth, y);
  y += 5;

  // --- 2. Metadata Grid ---
  const scanDate = result.analyzed_at
    ? new Date(result.analyzed_at).toLocaleString()
    : new Date().toLocaleString();
  const providerLabel =
    result.provider === 'gemini'
      ? `Google Gemini AI (${result.model || 'active model'})`
      : 'Deterministic Static Heuristic Engine';

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105); // Slate 600
  doc.text('Scan Timestamp:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(scanDate, margin + 28, y);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Analysis Engine:', margin + 92, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(providerLabel, margin + 118, y);
  y += 4.5;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Inspection Mode:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text('Zero-Fetch Static Lexical & Structural Analysis (SSRF-Immune)', margin + 28, y);
  y += 7;

  // --- 3. Defanged Target URL Box (Strictly Non-Clickable) ---
  const defangedUrl = result.defanged_url || '[No defanged URL provided]';
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.setLineWidth(0.3);

  const defangedLines = doc.splitTextToSize(`Target: ${defangedUrl}`, contentWidth - 8);
  const defangedBoxHeight = Math.max(12, defangedLines.length * 4 + 7);

  doc.roundedRect(margin, y, contentWidth, defangedBoxHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('DEFANGED TARGET URL (NON-CLICKABLE):', margin + 4, y + 4.5);

  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(defangedLines, margin + 4, y + 9);
  y += defangedBoxHeight + 5;

  // --- 4. Risk Evaluation Badge & Summary Box ---
  const riskLevel = (result.risk_level || 'low').toLowerCase();
  const riskScore = typeof result.risk_score === 'number' ? result.risk_score : 0;
  const colors = getRiskColors(riskLevel);

  // Risk Score Banner
  doc.setFillColor(...colors.background);
  doc.setDrawColor(...colors.primary);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'FD');

  // Left Color Accent Stripe
  doc.setFillColor(...colors.primary);
  doc.rect(margin, y, 3.5, 14, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...colors.text);
  doc.text(`${riskLevel.toUpperCase()} RISK EVALUATION`, margin + 7, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Deterministic Threat Index:', margin + 7, y + 10.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...colors.text);
  doc.text(`${riskScore}/100`, margin + 46, y + 10.7);
  y += 18;

  // Plain-English Summary Text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Plain-English Security Assessment', margin, y);
  y += 4.5;

  const summary = result.summary || 'No summary text available.';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85); // Slate 700
  const summaryLines = doc.splitTextToSize(summary, contentWidth);
  checkPageBreak(summaryLines.length * 4.2 + 6);
  doc.text(summaryLines, margin, y);
  y += summaryLines.length * 4.2 + 5;

  // --- 5. Confirmed Structural Facts ---
  checkPageBreak(25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Confirmed Structural Facts', margin, y);
  y += 4.5;

  const facts = Array.isArray(result.facts) && result.facts.length > 0
    ? result.facts
    : ['No structural facts extracted.'];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  for (const fact of facts) {
    const factLines = doc.splitTextToSize(`•  ${fact}`, contentWidth - 4);
    checkPageBreak(factLines.length * 3.8 + 2);
    doc.text(factLines, margin + 2, y);
    y += factLines.length * 3.8 + 1.2;
  }
  y += 4;

  // --- 6. Observed Heuristic Indicators ---
  checkPageBreak(25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Observed Threat Indicators', margin, y);
  y += 4.5;

  const indicators = Array.isArray(result.indicators) && result.indicators.length > 0
    ? result.indicators
    : ['No threat indicators detected by static rules.'];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  for (const ind of indicators) {
    const indLines = doc.splitTextToSize(`•  ${ind}`, contentWidth - 4);
    checkPageBreak(indLines.length * 3.8 + 2);
    doc.text(indLines, margin + 2, y);
    y += indLines.length * 3.8 + 1.2;
  }
  y += 4;

  // --- 7. Practical Safety Recommendations ---
  checkPageBreak(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Practical Safety Recommendations', margin, y);
  y += 4.5;

  const recs = Array.isArray(result.recommendations) && result.recommendations.length > 0
    ? result.recommendations
    : [
        'Confirm official domain details before visiting.',
        'Never submit sensitive credentials on unverified pages.',
        'Use multi-factor authentication across all accounts.',
      ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  recs.forEach((rec, idx) => {
    const recLines = doc.splitTextToSize(`${idx + 1}.  ${rec}`, contentWidth - 4);
    checkPageBreak(recLines.length * 3.8 + 2);
    doc.text(recLines, margin + 2, y);
    y += recLines.length * 3.8 + 1.2;
  });
  y += 6;

  // --- 8. Disclaimer Banner ---
  const disclaimerText =
    result.disclaimer ||
    'Static heuristic analysis is advisory and does NOT guarantee safety or constitute definitive forensic proof. The analyzed link was never visited, executed, or fetched over the network.';

  const disclaimerLines = doc.splitTextToSize(`DISCLAIMER: ${disclaimerText}`, contentWidth - 6);
  const disclaimerBoxHeight = disclaimerLines.length * 3.6 + 6;
  checkPageBreak(disclaimerBoxHeight + 5);

  doc.setFillColor(254, 243, 199); // Amber 50
  doc.setDrawColor(245, 158, 11); // Amber 500
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, disclaimerBoxHeight, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(146, 64, 14); // Amber 900
  doc.text(disclaimerLines, margin + 3, y + 4.5);
  y += disclaimerBoxHeight + 5;

  // Add Page Numbers to all pages
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text(
      `FraudShield AI Security Intelligence  |  Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  return doc;
}

/**
 * Generates and triggers browser download of the PDF Security Report.
 *
 * @param {Object} result - Scan result object
 * @returns {void}
 */
export function downloadLinkSecurityReportPdf(result) {
  const doc = createLinkSecurityReportDoc(result);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `FraudShield_Link_Report_${timestamp}.pdf`;
  doc.save(filename);
}

