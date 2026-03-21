import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { EmiScheduleEntry } from '../lib/api';

interface Props {
  schedule: EmiScheduleEntry[];
}

const STATUS_COLORS: Record<EmiScheduleEntry['status'], { bg: string; text: string; label: string }> = {
  PAID: { bg: '#dcfce7', text: '#166534', label: 'PAID' },
  PARTIAL: { bg: '#fef9c3', text: '#854d0e', label: 'PARTIAL' },
  OVERDUE: { bg: '#fee2e2', text: '#991b1b', label: 'OVERDUE' },
  PENDING: { bg: '#f3f4f6', text: '#6b7280', label: 'PENDING' },
};

export default function ScheduleTable({ schedule }: Props) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <View style={styles.container}>
      {/* Table Header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.headerCell, styles.colNo]}>#</Text>
        <Text style={[styles.headerCell, styles.colDate]}>Due Date</Text>
        <Text style={[styles.headerCell, styles.colAmount]}>Total</Text>
        <Text style={[styles.headerCell, styles.colPaid]}>Paid</Text>
        <Text style={[styles.headerCell, styles.colStatus]}>Status</Text>
      </View>

      {schedule.map((entry, idx) => {
        const statusStyle = STATUS_COLORS[entry.status];
        const isLast = idx === schedule.length - 1;
        return (
          <View
            key={entry.installmentNumber}
            style={[styles.tableRow, isLast && styles.lastRow, entry.status === 'OVERDUE' && styles.overdueRow]}
          >
            <Text style={[styles.cell, styles.colNo, styles.cellNo]}>{entry.installmentNumber}</Text>
            <View style={styles.colDate}>
              <Text style={styles.cell}>{fmtDate(entry.dueDate)}</Text>
              {entry.paidDate && (
                <Text style={styles.cellSub}>Paid: {fmtDate(entry.paidDate)}</Text>
              )}
            </View>
            <Text style={[styles.cell, styles.colAmount]}>{fmt(entry.totalAmount)}</Text>
            <Text style={[styles.cell, styles.colPaid]}>
              {entry.paidAmount > 0 ? fmt(entry.paidAmount) : '—'}
            </Text>
            <View style={styles.colStatus}>
              <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                <Text style={[styles.statusText, { color: statusStyle.text }]}>
                  {statusStyle.label}
                </Text>
              </View>
            </View>
          </View>
        );
      })}

      {/* Legend */}
      <View style={styles.legend}>
        {Object.entries(STATUS_COLORS).map(([key, val]) => (
          <View key={key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: val.bg, borderColor: val.text }]} />
            <Text style={styles.legendText}>{val.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },

  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1a56db',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  headerCell: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase',
  },

  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    alignItems: 'center',
  },
  lastRow: { borderBottomWidth: 0 },
  overdueRow: { backgroundColor: '#fff5f5' },

  cell: { fontSize: 12, color: '#111827' },
  cellNo: { fontWeight: '600', color: '#6b7280' },
  cellSub: { fontSize: 10, color: '#9ca3af', marginTop: 1 },

  colNo: { width: 28 },
  colDate: { flex: 1 },
  colAmount: { width: 68, textAlign: 'right' },
  colPaid: { width: 64, textAlign: 'right' },
  colStatus: { width: 66, alignItems: 'flex-end' },

  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: { fontSize: 9, fontWeight: '700' },

  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 12,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
  },
  legendText: { fontSize: 11, color: '#6b7280' },
});
