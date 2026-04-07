export const translations = {
  en: {
    emi_reminder: "Dear {{name}}, your EMI of Rs {{amount}} is due on {{date}}",
    payment_received: "Dear {{name}}, payment of Rs {{amount}} received. Thank you.",
    loan_sanctioned: "Congratulations {{name}}! Your loan of Rs {{amount}} has been sanctioned.",
    overdue_notice: "Dear {{name}}, your EMI is overdue by {{days}} days. Please pay Rs {{amount}} immediately.",
    noc_generated: "Dear {{name}}, your NOC for loan {{loanNumber}} is ready for download.",
  },
  hi: {
    emi_reminder: "प्रिय {{name}}, आपकी EMI ₹{{amount}} {{date}} को देय है",
    payment_received: "प्रिय {{name}}, ₹{{amount}} का भुगतान प्राप्त हुआ। धन्यवाद।",
    loan_sanctioned: "बधाई {{name}}! आपका ₹{{amount}} का ऋण स्वीकृत हो गया है।",
    overdue_notice: "प्रिय {{name}}, आपकी EMI {{days}} दिनों से बकाया है। कृपया तुरंत ₹{{amount}} का भुगतान करें।",
    noc_generated: "प्रिय {{name}}, ऋण {{loanNumber}} के लिए NOC डाउनलोड के लिए तैयार है।",
  },
};

export function translate(
  key: string,
  lang: string = 'en',
  vars: Record<string, string> = {},
): string {
  const dict = translations[lang as keyof typeof translations] || translations.en;
  let text = (dict as any)[key] || key;
  for (const [k, v] of Object.entries(vars)) {
    text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v);
  }
  return text;
}
