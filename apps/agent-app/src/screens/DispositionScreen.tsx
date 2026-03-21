import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import {
  DispositionType,
  DISPOSITION_OPTIONS,
  submitDisposition,
} from '../lib/api';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Disposition'>;
  route: RouteProp<RootStackParamList, 'Disposition'>;
};

const PTP_TYPES: DispositionType[] = ['PTP', 'PARTIAL_PAYMENT'];

export default function DispositionScreen({ navigation, route }: Props) {
  const { taskId, customerName, loanNumber } = route.params;

  const [selectedType, setSelectedType] = useState<DispositionType | ''>('');
  const [ptpDate, setPtpDate] = useState('');
  const [ptpAmount, setPtpAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const isPtp = selectedType && PTP_TYPES.includes(selectedType as DispositionType);
  const selectedLabel = DISPOSITION_OPTIONS.find(o => o.value === selectedType)?.label ?? 'Select disposition type';

  const isValid =
    selectedType !== '' &&
    remarks.trim().length >= 10 &&
    (!isPtp || (ptpDate.trim().length > 0 && parseFloat(ptpAmount) > 0));

  const handleSubmit = async () => {
    if (!isValid || !selectedType) return;
    setSubmitting(true);
    try {
      const payload = {
        taskId,
        loanId: '', // populated from taskId in real impl
        type: selectedType as DispositionType,
        ptpDate: isPtp ? ptpDate : undefined,
        ptpAmount: isPtp ? parseFloat(ptpAmount) : undefined,
        remarks: remarks.trim(),
        visitedAt: new Date().toISOString(),
      };
      const res = await submitDisposition(payload);
      Alert.alert(
        'Disposition Recorded',
        `${res.message}\nID: ${res.dispositionId}`,
        [
          {
            text: 'Done',
            onPress: () => navigation.pop(2), // back to TaskList
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit disposition.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Header */}
      <View style={styles.headerCard}>
        <Text style={styles.customerName}>{customerName}</Text>
        <Text style={styles.loanNumber}>{loanNumber}</Text>
        <Text style={styles.visitTime}>
          Visit time: {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>

      {/* Disposition Type */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Disposition Type *</Text>
        <TouchableOpacity style={styles.dropdownTrigger} onPress={() => setShowDropdown(true)}>
          <Text style={[styles.dropdownText, !selectedType && styles.dropdownPlaceholder]}>
            {selectedLabel}
          </Text>
          <Text style={styles.dropdownArrow}>▾</Text>
        </TouchableOpacity>
      </View>

      {/* Dropdown Modal */}
      <Modal
        visible={showDropdown}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDropdown(false)}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select Disposition</Text>
            {DISPOSITION_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.modalOption,
                  selectedType === opt.value && styles.modalOptionSelected,
                ]}
                onPress={() => {
                  setSelectedType(opt.value);
                  setShowDropdown(false);
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    selectedType === opt.value && styles.modalOptionTextSelected,
                  ]}
                >
                  {opt.label}
                </Text>
                {selectedType === opt.value && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* PTP Fields */}
      {isPtp && (
        <View style={styles.ptpSection}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>PTP Date * (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 2026-04-01"
              placeholderTextColor="#475569"
              value={ptpDate}
              onChangeText={setPtpDate}
              keyboardType="numbers-and-punctuation"
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>PTP Amount (INR) *</Text>
            <TextInput
              style={styles.input}
              placeholder="Amount customer promised to pay"
              placeholderTextColor="#475569"
              value={ptpAmount}
              onChangeText={setPtpAmount}
              keyboardType="decimal-pad"
            />
          </View>
        </View>
      )}

      {/* Remarks */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Remarks * (min 10 characters)</Text>
        <TextInput
          style={[styles.input, styles.remarksInput]}
          placeholder="Describe what happened during the visit..."
          placeholderTextColor="#475569"
          value={remarks}
          onChangeText={setRemarks}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />
        <Text style={[styles.charCount, remarks.length < 10 && styles.charCountWarn]}>
          {remarks.length} chars {remarks.length < 10 ? `(need ${10 - remarks.length} more)` : ''}
        </Text>
      </View>

      {/* Summary Preview */}
      {selectedType && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Submission Preview</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Type</Text>
            <Text style={styles.summaryValue}>{selectedType}</Text>
          </View>
          {isPtp && ptpDate && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>PTP Date</Text>
              <Text style={styles.summaryValue}>{ptpDate}</Text>
            </View>
          )}
          {isPtp && ptpAmount && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>PTP Amount</Text>
              <Text style={styles.summaryValue}>
                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(parseFloat(ptpAmount) || 0)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitButton, (!isValid || submitting) && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={!isValid || submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Submit Disposition</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 16, paddingBottom: 40 },

  headerCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  customerName: { fontSize: 18, fontWeight: 'bold', color: '#f1f5f9' },
  loanNumber: { fontSize: 13, color: '#64748b', marginTop: 2 },
  visitTime: { fontSize: 12, color: '#475569', marginTop: 8 },

  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#94a3b8', marginBottom: 8 },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f1f5f9',
    fontSize: 15,
  },
  remarksInput: {
    minHeight: 100,
    paddingTop: 12,
  },
  charCount: { fontSize: 11, color: '#475569', textAlign: 'right', marginTop: 4 },
  charCountWarn: { color: '#f59e0b' },

  dropdownTrigger: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: { fontSize: 15, color: '#f1f5f9', flex: 1 },
  dropdownPlaceholder: { color: '#475569' },
  dropdownArrow: { color: '#64748b', fontSize: 16, marginLeft: 8 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f1f5f9',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalOption: {
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#0f172a',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalOptionSelected: { backgroundColor: '#1d4ed820' },
  modalOptionText: { fontSize: 15, color: '#cbd5e1' },
  modalOptionTextSelected: { color: '#60a5fa', fontWeight: '600' },
  checkmark: { color: '#22c55e', fontSize: 18, fontWeight: 'bold' },

  ptpSection: {
    backgroundColor: '#172554',
    borderRadius: 10,
    padding: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#1e40af',
  },

  summaryCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  summaryTitle: { fontSize: 13, fontWeight: '700', color: '#64748b', marginBottom: 10, textTransform: 'uppercase' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryLabel: { fontSize: 13, color: '#64748b' },
  summaryValue: { fontSize: 13, color: '#f1f5f9', fontWeight: '600' },

  submitButton: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: { backgroundColor: '#166534', opacity: 0.5 },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
