import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import { Loan, getMyLoans } from '../lib/api';
import LoanCard from '../components/LoanCard';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Dashboard'>;
  route: RouteProp<RootStackParamList, 'Dashboard'>;
};

export default function DashboardScreen({ navigation, route }: Props) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLoans = useCallback(async () => {
    try {
      const data = await getMyLoans();
      setLoans(data);
    } catch (err) {
      // silent — mock data covers this
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLoans();
  };

  // Summary stats
  const totalOutstanding = loans.reduce((s, l) => s + l.outstandingAmount, 0);
  const overdueLoans = loans.filter(l => l.dpd > 0);
  const nextDue = loans
    .filter(l => l.status === 'ACTIVE')
    .sort((a, b) => new Date(a.nextEmiDate).getTime() - new Date(b.nextEmiDate).getTime())[0];

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a56db" />
        <Text style={styles.loadingText}>Loading your loans...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Summary Banner */}
      <View style={styles.summaryBanner}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total Outstanding</Text>
          <Text style={styles.summaryValue}>{fmt(totalOutstanding)}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Active Loans</Text>
          <Text style={styles.summaryValue}>{loans.filter(l => l.status === 'ACTIVE').length}</Text>
        </View>
        {overdueLoans.length > 0 && (
          <>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Overdue</Text>
              <Text style={[styles.summaryValue, { color: '#ef4444' }]}>{overdueLoans.length}</Text>
            </View>
          </>
        )}
      </View>

      {/* Next EMI Due */}
      {nextDue && (
        <View style={styles.nextEmiCard}>
          <View style={styles.nextEmiLeft}>
            <Text style={styles.nextEmiLabel}>Next EMI Due</Text>
            <Text style={styles.nextEmiDate}>{fmtDate(nextDue.nextEmiDate)}</Text>
            <Text style={styles.nextEmiLoan}>{nextDue.loanNumber}</Text>
          </View>
          <View style={styles.nextEmiRight}>
            <Text style={styles.nextEmiAmount}>{fmt(nextDue.nextEmiAmount)}</Text>
            <TouchableOpacity
              style={styles.payNowButton}
              onPress={() =>
                navigation.navigate('Payment', {
                  loanId: nextDue.loanId,
                  loanNumber: nextDue.loanNumber,
                  emiAmount: nextDue.nextEmiAmount,
                  dueDate: nextDue.nextEmiDate,
                })
              }
            >
              <Text style={styles.payNowText}>Pay Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Loan list */}
      <Text style={styles.sectionTitle}>Your Loans</Text>
      <FlatList
        data={loans}
        keyExtractor={item => item.loanId}
        renderItem={({ item }) => (
          <LoanCard
            loan={item}
            onPress={() =>
              navigation.navigate('LoanDetail', {
                loanId: item.loanId,
                loanNumber: item.loanNumber,
              })
            }
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No active loans found.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: '#6b7280', fontSize: 14 },

  summaryBanner: {
    backgroundColor: '#1a56db',
    flexDirection: 'row',
    paddingVertical: 20,
    paddingHorizontal: 24,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { color: '#bfdbfe', fontSize: 12, marginBottom: 4 },
  summaryValue: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  summaryDivider: { width: 1, backgroundColor: '#3b82f6', marginVertical: 4 },

  nextEmiCard: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
  nextEmiLeft: { flex: 1 },
  nextEmiLabel: { fontSize: 12, color: '#6b7280', marginBottom: 2 },
  nextEmiDate: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  nextEmiLoan: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  nextEmiRight: { alignItems: 'flex-end' },
  nextEmiAmount: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  payNowButton: {
    backgroundColor: '#1a56db',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  payNowText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  listContent: { paddingBottom: 24 },
  empty: { alignItems: 'center', marginTop: 48 },
  emptyText: { color: '#6b7280', fontSize: 16 },
});
