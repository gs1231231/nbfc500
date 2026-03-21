import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import { Loan, EmiScheduleEntry, getLoanById, getEmiSchedule } from '../lib/api';
import ScheduleTable from '../components/ScheduleTable';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'LoanDetail'>;
  route: RouteProp<RootStackParamList, 'LoanDetail'>;
};

export default function LoanDetailScreen({ navigation, route }: Props) {
  const { loanId } = route.params;
  const [loan, setLoan] = useState<Loan | null>(null);
  const [schedule, setSchedule] = useState<EmiScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getLoanById(loanId), getEmiSchedule(loanId)])
      .then(([l, s]) => {
        setLoan(l);
        setSchedule(s);
      })
      .finally(() => setLoading(false));
  }, [loanId]);

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const dpdColor = (dpd: number) => {
    if (dpd === 0) return '#22c55e';
    if (dpd <= 30) return '#f59e0b';
    if (dpd <= 60) return '#ef4444';
    return '#7f1d1d';
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a56db" />
      </View>
    );
  }

  if (!loan) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Loan not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Loan Overview */}
      <View style={styles.overviewCard}>
        <View style={styles.overviewHeader}>
          <Text style={styles.loanNumber}>{loan.loanNumber}</Text>
          <View style={[styles.statusBadge, loan.status === 'ACTIVE' ? styles.statusActive : styles.statusClosed]}>
            <Text style={styles.statusText}>{loan.status}</Text>
          </View>
        </View>
        <Text style={styles.productName}>{loan.product}</Text>

        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Principal</Text>
            <Text style={styles.statValue}>{fmt(loan.principalAmount)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Outstanding</Text>
            <Text style={[styles.statValue, { color: '#1a56db' }]}>{fmt(loan.outstandingAmount)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Tenure</Text>
            <Text style={styles.statValue}>{loan.tenure} months</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>DPD</Text>
            <Text style={[styles.statValue, { color: dpdColor(loan.dpd) }]}>
              {loan.dpd === 0 ? 'Current' : `${loan.dpd} days`}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Disbursed On</Text>
            <Text style={styles.statValue}>{fmtDate(loan.disbursedAt)}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Next EMI</Text>
            <Text style={styles.statValue}>{fmtDate(loan.nextEmiDate)}</Text>
          </View>
        </View>
      </View>

      {/* DPD Alert */}
      {loan.dpd > 0 && (
        <View style={styles.dpdAlert}>
          <Text style={styles.dpdAlertText}>
            Your account is {loan.dpd} days past due. Please clear your dues to avoid penalties.
          </Text>
        </View>
      )}

      {/* Pay EMI CTA */}
      {loan.status === 'ACTIVE' && (
        <TouchableOpacity
          style={styles.payButton}
          onPress={() =>
            navigation.navigate('Payment', {
              loanId: loan.loanId,
              loanNumber: loan.loanNumber,
              emiAmount: loan.nextEmiAmount,
              dueDate: loan.nextEmiDate,
            })
          }
        >
          <Text style={styles.payButtonText}>Pay EMI — {fmt(loan.nextEmiAmount)}</Text>
        </TouchableOpacity>
      )}

      {/* EMI Schedule */}
      <Text style={styles.sectionTitle}>EMI Schedule</Text>
      <ScheduleTable schedule={schedule} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#ef4444', fontSize: 16 },

  overviewCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  loanNumber: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusActive: { backgroundColor: '#dcfce7' },
  statusClosed: { backgroundColor: '#f3f4f6' },
  statusText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  productName: { color: '#6b7280', fontSize: 14, marginBottom: 20 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  statItem: { width: '45%' },
  statLabel: { fontSize: 12, color: '#9ca3af', marginBottom: 2 },
  statValue: { fontSize: 15, fontWeight: '600', color: '#111827' },

  dpdAlert: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  dpdAlertText: { color: '#b91c1c', fontSize: 13, lineHeight: 18 },

  payButton: {
    backgroundColor: '#1a56db',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  payButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
  },
});
