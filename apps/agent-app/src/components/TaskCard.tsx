import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CollectionTask, Priority, TaskStatus } from '../lib/api';

interface Props {
  task: CollectionTask;
  onPress: () => void;
}

const DPD_BADGE: Record<string, { bg: string; text: string }> = {
  CRITICAL: { bg: '#7f1d1d', text: '#fca5a5' },
  HIGH: { bg: '#7c2d12', text: '#fdba74' },
  MEDIUM: { bg: '#78350f', text: '#fcd34d' },
  LOW: { bg: '#14532d', text: '#86efac' },
};

const STATUS_CHIP: Record<TaskStatus, { bg: string; text: string; label: string }> = {
  PENDING: { bg: '#1e3a5f', text: '#60a5fa', label: 'PENDING' },
  IN_PROGRESS: { bg: '#1c2a1e', text: '#4ade80', label: 'IN PROGRESS' },
  COMPLETED: { bg: '#14532d', text: '#86efac', label: 'DONE' },
  SKIPPED: { bg: '#374151', text: '#9ca3af', label: 'SKIPPED' },
};

export default function TaskCard({ task, onPress }: Props) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const dpdStyle = DPD_BADGE[task.priority] ?? DPD_BADGE.LOW;
  const statusStyle = STATUS_CHIP[task.status];

  const dpdLabel = () => {
    if (task.dpd >= 90) return `${task.dpd}+ DPD`;
    if (task.dpd >= 60) return `${task.dpd}D DPD`;
    return `${task.dpd}D`;
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.customerName}>{task.customerName}</Text>
          <Text style={styles.loanNumber}>{task.loanNumber}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.dpdBadge, { backgroundColor: dpdStyle.bg }]}>
            <Text style={[styles.dpdText, { color: dpdStyle.text }]}>{dpdLabel()}</Text>
          </View>
          <View style={[styles.statusChip, { backgroundColor: statusStyle.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>{statusStyle.label}</Text>
          </View>
        </View>
      </View>

      {/* Details Row */}
      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Amount Due</Text>
          <Text style={[styles.detailValue, { color: '#f87171' }]}>{fmt(task.amountDue)}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Priority</Text>
          <Text style={[styles.detailValue, { color: dpdStyle.text }]}>{task.priority}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Visits</Text>
          <Text style={styles.detailValue}>{task.visitCount}</Text>
        </View>
      </View>

      {/* Address + Last Disposition */}
      <Text style={styles.address} numberOfLines={1} ellipsizeMode="tail">
        {task.address}
      </Text>

      {task.lastDisposition && (
        <View style={styles.lastDispRow}>
          <Text style={styles.lastDispLabel}>Last: </Text>
          <Text style={styles.lastDispValue}>{task.lastDisposition}</Text>
          {task.lastContactDate && (
            <Text style={styles.lastDispDate}>
              {' '}· {new Date(task.lastContactDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
            </Text>
          )}
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.tapHint}>Tap to open task</Text>
        <Text style={styles.arrow}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerLeft: { flex: 1, marginRight: 8 },
  customerName: { fontSize: 15, fontWeight: 'bold', color: '#f1f5f9' },
  loanNumber: { fontSize: 12, color: '#64748b', marginTop: 2 },
  headerRight: { alignItems: 'flex-end', gap: 4 },

  dpdBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 4,
  },
  dpdText: { fontSize: 11, fontWeight: '700' },

  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: { fontSize: 10, fontWeight: '600' },

  detailsRow: {
    flexDirection: 'row',
    marginBottom: 10,
    gap: 16,
  },
  detailItem: {},
  detailLabel: { fontSize: 10, color: '#475569', marginBottom: 2 },
  detailValue: { fontSize: 13, fontWeight: '600', color: '#cbd5e1' },

  address: {
    fontSize: 12,
    color: '#475569',
    marginBottom: 6,
  },

  lastDispRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  lastDispLabel: { fontSize: 11, color: '#475569' },
  lastDispValue: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  lastDispDate: { fontSize: 11, color: '#475569' },

  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#0f172a',
    paddingTop: 8,
    marginTop: 2,
  },
  tapHint: { fontSize: 11, color: '#334155' },
  arrow: { fontSize: 18, color: '#475569' },
});
