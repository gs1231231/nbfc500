/**
 * PDF Generation Utility
 * Generates downloadable HTML documents styled for print/PDF output.
 * Uses a pure HTML/CSS approach — no Puppeteer dependency required,
 * making it compatible with Alpine Linux and lightweight Docker images.
 *
 * Usage:
 *   const html = generatePdfHtml('Loan Statement', 'Growth Finance Ltd', content);
 *   // Serve with Content-Type: text/html and Content-Disposition: attachment; filename="statement.html"
 */

/**
 * Wrap content in a fully-styled, print-ready HTML document.
 *
 * @param title      - Browser/print title (shown in tab and print dialog)
 * @param orgName    - Organisation name displayed in the document header
 * @param content    - Raw HTML body content (tables, paragraphs, etc.)
 * @param styles     - Optional additional CSS injected after the base stylesheet
 * @returns Complete HTML string ready to be served or saved as a file
 */
export function generatePdfHtml(
  title: string,
  orgName: string,
  content: string,
  styles?: string,
): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  @page { size: A4; margin: 20mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; line-height: 1.6; color: #333; }
  .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
  .header h1 { font-size: 18px; margin: 0; }
  .header p { font-size: 10px; color: #666; margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; font-size: 11px; }
  th { background: #f5f5f5; font-weight: 600; }
  .amount { text-align: right; font-family: monospace; }
  .footer { margin-top: 30px; border-top: 1px solid #ccc; padding-top: 10px; font-size: 9px; color: #888; }
  .signature { margin-top: 40px; }
  ${styles || ''}
</style>
</head>
<body>
<div class="header">
  <h1>${orgName}</h1>
</div>
${content}
<div class="footer">
  <p>Generated on ${new Date().toLocaleDateString('en-IN')} | This is a computer-generated document</p>
</div>
</body>
</html>`;
}
