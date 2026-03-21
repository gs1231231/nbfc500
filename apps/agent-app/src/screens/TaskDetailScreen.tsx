import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import { CollectionTask, getTaskById, getMapsUrl } from '../lib/api';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'TaskDetail'>;
  route: RouteProp<RootStackParamList, 'TaskDetail'>;
};

interface GpsLocation {
  lat: number;
  lng: number;
  accuracy: number;
  capturedAt: string;
}

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  CRITICAL: { bg: '#450a0a', text: '#f87171' },
  HIGH: { bg: '#431407', text: '#fb923c' },
  MEDIUM: { bg: '#422006', text: '#fbbf24' },
  LOW: { bg: '#052e16', text: '#4ade80' },
};

export default function TaskDetailScreen({ navigation, route }: Props) {
  const { taskId, session } = route.params;
  const [task, setTask] = useState<CollectionTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [gpsLocation, setGpsLocation] = useState<GpsLocation | null>(null);
  const [capturingGps, setCapturingGps] = useState(false);

  useEffect(() => {
    getTaskById(taskId)
      .then(setTask)
      .finally(() => setLoading(false));
  }, [taskId]);

  const handleNavigate = async () => {
    if (!task) return;
    const url = getMapsUrl(task.address, task.lat, task.lng);
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Cannot Open Maps', 'Please install Google Maps to navigate.');
    }
  };

  const handleCaptureGps = async () => {
    setCapturingGps(true);
    try {
      // In a real app: use expo-location
      // import * as Location from 'expo-location';
      // const { status } = await Location.requestForegroundPermissionsAsync();
      // const loc = await Location.getCurrentPositionAsync({});
      // Mock GPS capture
      await new Promise(r => setTimeout(r, 1500));
      const mockLoc: GpsLocation = {
        lat: (task?.lat ?? 28.6) + (Math.random() - 0.5) * 0.001,
        lng: (task?.lng ?? 77.2) + (Math.random() - 0.5) * 0.001,
        accuracy: Math.round(5 + Math.random() * 10),
        capturedAt: new Date().toISOString(),
      };
      setGpsLocation(mockLoc);
      Alert.alert('GPS Captured', `Location captured with ${mockLoc.accuracy}m accuracy.`);
    } catch (err) {
      Alert.alert('GPS Error', 'Failed to capture location. Please allow location access.');
    } finally {
      setCapturingGps(false);
    }
  };

  const handleCapturePhoto = () => {
    Alert.alert(
      'Photo Capture',
      'Camera integration requires expo-camera. In production, this opens the camera to capture proof of visit.',
      [{ text: 'OK' }]
    );
  };

  const handleRecordDisposition = () => {
    if (!task) return;
    if (!gpsLocation) {
      Alert.alert(
        'GPS Required',
        'Please capture your GPS location before recording a disposition.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Capture GPS', onPress: handleCaptureGps },
        ]
      );
      return;
    }
    navigation.navigate('Disposition', {
      taskId: task.taskId,
      customerName: task.customerName,
      loanNumber: task.loanNumber,
      session,
    });
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (!task) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Task not found.</Text>
      </View>
    );
  }

  const priorityStyle = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.LOW;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Customer Info Card */}
      <View style={styles.customerCard}>
        <View style={styles.customerHeader}>
          <View>
            <Text style={styles.customerName}>{task.customerName}</Text>
            <Text style={styles.loanNumber}>{task.loanNumber}</Text>
          </View>
          <View style={[styles.priorityBadge, { backgroundColor: priorityStyle.bg }]}>
            <Text style={[styles.priorityText, { color: priorityStyle.text }]}>{task.priority}</Text>
          </View>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Amount Due</Text>
            <Text style={[styles.infoValue, { color: '#ef4444' }]}>{fmt(task.amountDue)}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>DPD</Text>
            <Text style={[styles.infoValue, { color: task.dpd > 60 ? '#ef4444' : '#f59e0b' }]}>
              {task.dpd} days
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Phone</Text>
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${task.customerPhone}`)}>
              <Text style={[styles.infoValue, styles.phoneLink]}>{task.customerPhone}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Visits</Text>
            <Text style={styles.infoValue}>{task.visitCount} prior visits</Text>
          </View>
        </View>

        {task.lastDisposition && (
          <View style={styles.lastDisp}>
            <Text style={styles.lastDispLabel}>Last Disposition</Text>
            <Text style={styles.lastDispValue}>
              {task.lastDisposition} on{' '}
              {task.lastContactDate
                ? new Date(task.lastContactDate).toLocaleDateString('en-IN')
                : 'N/A'}
            </Text>
          </View>
        )}
      </View>

      {/* Address Card */}
      <View style={styles.addressCard}>
        <Text style={styles.sectionLabel}>Address</Text>
        <Text style={styles.addressText}>{task.address}</Text>
        <TouchableOpacity style={styles.navigateButton} onPress={handleNavigate}>
          <Text style={styles.navigateButtonText}>Navigate in Maps</Text>
        </TouchableOpacity>
      </View>

      {/* GPS Location */}
      <View style={styles.actionCard}>
        <Text style={styles.sectionLabel}>GPS Location</Text>
        {gpsLocation ? (
          <View style={styles.gpsResult}>
            <Text style={styles.gpsText}>
              {gpsLocation.lat.toFixed(6)}, {gpsLocation.lng.toFixed(6)}
            </Text>
            <Text style={styles.gpsAccuracy}>Accuracy: ±{gpsLocation.accuracy}m</Text>
            <Text style={styles.gpsCapturedAt}>
              Captured at: {new Date(gpsLocation.capturedAt).toLocaleTimeString('en-IN')}
            </Text>
          </View>
        ) : (
          <Text style={styles.gpsNotCaptured}>Not captured yet</Text>
        )}
        <TouchableOpacity
          style={[styles.actionButton, styles.gpsButton, capturingGps && styles.actionButtonDisabled]}
          onPress={handleCaptureGps}
          disabled={capturingGps}
        >
          {capturingGps ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.actionButtonText}>
              {gpsLocation ? 'Recapture GPS' : 'Capture GPS Location'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Photo Capture */}
      <View style={styles.actionCard}>
        <Text style={styles.sectionLabel}>Proof of Visit</Text>
        <Text style={styles.photoHint}>Capture a photo as proof of visit (optional).</Text>
        <TouchableOpacity style={[styles.actionButton, styles.photoButton]} onPress={handleCapturePhoto}>
          <Text style={styles.actionButtonText}>Capture Photo</Text>
        </TouchableOpacity>
      </View>

      {/* Record Disposition CTA */}
      <TouchableOpacity style={styles.dispositionCta} onPress={handleRecordDisposition}>
        <Text style={styles.dispositionCtaText}>Record Disposition</Text>
      </TouchableOpacity>

      {!gpsLocation && (
        <Text style={styles.gpsWarning}>
          Capture GPS location before recording disposition.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  errorText: { color: '#ef4444', fontSize: 16 },

  customerCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  customerName: { fontSize: 20, fontWeight: 'bold', color: '#f1f5f9' },
  loanNumber: { fontSize: 13, color: '#64748b', marginTop: 2 },

  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priorityText: { fontSize: 11, fontWeight: '700' },

  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 12 },
  infoItem: { width: '45%' },
  infoLabel: { fontSize: 11, color: '#475569', marginBottom: 2 },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#f1f5f9' },
  phoneLink: { color: '#3b82f6', textDecorationLine: 'underline' },

  lastDisp: {
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  lastDispLabel: { fontSize: 12, color: '#475569' },
  lastDispValue: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },

  addressCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  addressText: { fontSize: 14, color: '#cbd5e1', lineHeight: 20, marginBottom: 12 },
  navigateButton: {
    backgroundColor: '#1d4ed8',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  navigateButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  actionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  gpsResult: { marginBottom: 12 },
  gpsText: { fontSize: 13, color: '#22c55e', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  gpsAccuracy: { fontSize: 12, color: '#64748b', marginTop: 2 },
  gpsCapturedAt: { fontSize: 12, color: '#64748b', marginTop: 1 },
  gpsNotCaptured: { fontSize: 13, color: '#475569', marginBottom: 12 },

  actionButton: {
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionButtonDisabled: { opacity: 0.5 },
  gpsButton: { backgroundColor: '#0369a1' },
  photoButton: { backgroundColor: '#6d28d9' },
  actionButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },

  photoHint: { fontSize: 12, color: '#475569', marginBottom: 10 },

  dispositionCta: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  dispositionCtaText: { color: '#fff', fontWeight: '700', fontSize: 17 },

  gpsWarning: {
    textAlign: 'center',
    color: '#f59e0b',
    fontSize: 12,
    marginTop: 8,
  },
});
