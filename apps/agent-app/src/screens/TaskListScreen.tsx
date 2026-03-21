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
import { CollectionTask, Priority, TaskStatus, getTodayTasks } from '../lib/api';
import TaskCard from '../components/TaskCard';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'TaskList'>;
  route: RouteProp<RootStackParamList, 'TaskList'>;
};

type FilterTab = 'ALL' | 'PENDING' | 'COMPLETED';

export default function TaskListScreen({ navigation, route }: Props) {
  const { session } = route.params;
  const [tasks, setTasks] = useState<CollectionTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('ALL');

  const fetchTasks = useCallback(async () => {
    try {
      const data = await getTodayTasks(session.agentId);
      setTasks(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session.agentId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTasks();
  };

  const filteredTasks = tasks.filter(t => {
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'PENDING') return t.status === 'PENDING' || t.status === 'IN_PROGRESS';
    if (activeFilter === 'COMPLETED') return t.status === 'COMPLETED' || t.status === 'SKIPPED';
    return true;
  });

  // Summary counts
  const pending = tasks.filter(t => t.status === 'PENDING' || t.status === 'IN_PROGRESS').length;
  const completed = tasks.filter(t => t.status === 'COMPLETED').length;
  const criticalCount = tasks.filter(t => t.priority === 'CRITICAL' && t.status === 'PENDING').length;
  const totalAmount = filteredTasks.reduce((s, t) => s + t.amountDue, 0);

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading today's tasks...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Summary Header */}
      <View style={styles.summaryHeader}>
        <Text style={styles.dateText}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long' })}
        </Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{tasks.length}</Text>
            <Text style={styles.statLbl}>Total</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: '#f59e0b' }]}>{pending}</Text>
            <Text style={styles.statLbl}>Pending</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: '#22c55e' }]}>{completed}</Text>
            <Text style={styles.statLbl}>Done</Text>
          </View>
          {criticalCount > 0 && (
            <View style={styles.statBox}>
              <Text style={[styles.statNum, { color: '#ef4444' }]}>{criticalCount}</Text>
              <Text style={styles.statLbl}>Critical</Text>
            </View>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['ALL', 'PENDING', 'COMPLETED'] as FilterTab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, activeFilter === tab && styles.filterTabActive]}
            onPress={() => setActiveFilter(tab)}
          >
            <Text style={[styles.filterTabText, activeFilter === tab && styles.filterTabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Task List */}
      <FlatList
        data={filteredTasks}
        keyExtractor={item => item.taskId}
        renderItem={({ item }) => (
          <TaskCard
            task={item}
            onPress={() =>
              navigation.navigate('TaskDetail', { taskId: item.taskId, session })
            }
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3b82f6"
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No tasks found.</Text>
          </View>
        }
        ListFooterComponent={
          filteredTasks.length > 0 ? (
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Total amount due: {fmt(totalAmount)} across {filteredTasks.length} accounts
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  loadingText: { color: '#94a3b8', marginTop: 12, fontSize: 14 },

  summaryHeader: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  dateText: { color: '#94a3b8', fontSize: 13, marginBottom: 12 },
  statsRow: { flexDirection: 'row', gap: 24 },
  statBox: { alignItems: 'center' },
  statNum: { fontSize: 24, fontWeight: 'bold', color: '#f1f5f9' },
  statLbl: { fontSize: 11, color: '#64748b', marginTop: 2 },

  filterRow: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    padding: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  filterTabActive: { backgroundColor: '#3b82f6' },
  filterTabText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  filterTabTextActive: { color: '#fff' },

  listContent: { padding: 12, paddingBottom: 24 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#475569', fontSize: 16 },

  footer: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    marginTop: 8,
  },
  footerText: { color: '#475569', fontSize: 12, textAlign: 'center' },
});
