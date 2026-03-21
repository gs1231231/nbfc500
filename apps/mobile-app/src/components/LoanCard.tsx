import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Loan } from '../lib/api';

interface Props {
  loan: Loan;
  onPress: () => void;
}

export default function LoanCard({ loan, onPress }: Props) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const dpdBadgeStyle = () => {
    if (loan.dpd === 0) return styles.dpdGreen;
    if (loan.dpd <= 30) return styles.dpdYellow;
    return styles.dpdRed;
  };

  const progressPct = Math.max(
    0,
    Math.min(100, ((loan.principalAmount - loan.outstandingAmount) / loan.principalAmount) * 100)
  );

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.loanInfo}>
          <Text style={styles.loanNumber}>{loan.loanNumber}</Text>
          <Text style={styles.product}>{loan.product}</Text>
        </View>
        <View style={[styles.dpdBadge, dpdBadgeStyle()]}>
          <Text style={styles.dpdText}>
            {loan.dpd === 0 ? 'CURRENT' : `${loan.dpd}+ DPD`}
          </Text>
        </View>
      </View>

      {/* Amount Row */}
      <View style={styles.amountRow}>
        <View style={styles.amountItem}>
          <Text style={styles.amountLabel}>Outstanding</Text>
          <Text style={styles.amountValue}>{fmt(loan.outstandingAmount)}</Text>
        </View>
        <View style={styles.amountItem}>
          <Text style={styles.amountLabel}>Next EMI</Text>
          <Text style={styles.emiValue}>{fmt(loan.nextEmiAmount)}</Text>
        </View>
        <View style={styles.amountItem}>
          <Text style={styles.amountLabel}>Due Date</Text>
          <Text style={styles.amountValue}>{fmtDate(loan.nextEmiDate)}</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progressPct}%` as any }]} />
        </View>
        <Text style={styles.progressLabel}>{progressPct.toFixed(0)}% repaid</Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Tap to view details & schedule</Text>
        <Text style={styles.arrow}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  loanInfo: {},
  loanNumber: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  product: { fontSize: 13, color: '#6b7280', marginTop: 2 },

  dpdBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dpdGreen: { backgroundColor: '#dcfce7' },
  dpdYellow: { backgroundColor: '#fef9c3' },
  dpdRed: { backgroundColor: '#fee2e2' },
  dpdText: { fontSize: 11, fontWeight: '700', color: '#374151' },

  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  amountItem: {},
  amountLabel: { fontSize: 11, color: '#9ca3af', marginBottom: 3 },
  amountValue: { fontSize: 13, fontWeight: '600', color: '#111827' },
  emiValue: { fontSize: 13, fontWeight: '700', color: '#1a56db' },

  progressContainer: {
    marginBottom: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#22c55e',
    borderRadius: 3,
  },
  progressLabel: { fontSize: 11, color: '#9ca3af', textAlign: 'right' },

  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 10,
  },
  footerText: { fontSize: 12, color: '#9ca3af' },
  arrow: { fontSize: 20, color: '#9ca3af' },
});
