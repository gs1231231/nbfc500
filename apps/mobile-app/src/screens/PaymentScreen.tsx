import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import { generateUpiLink } from '../lib/api';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Payment'>;
  route: RouteProp<RootStackParamList, 'Payment'>;
};

const BANKOS_VPA = 'bankos@upi';
const BANKOS_NAME = 'BankOS Payments';

export default function PaymentScreen({ navigation, route }: Props) {
  const { loanId, loanNumber, emiAmount, dueDate } = route.params;
  const [amount, setAmount] = useState(String(emiAmount));
  const [paying, setPaying] = useState(false);

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const parsedAmount = parseFloat(amount) || 0;

  const handleUpiPay = async () => {
    if (parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount.');
      return;
    }

    const upiLink = generateUpiLink({
      vpa: BANKOS_VPA,
      name: BANKOS_NAME,
      amount: parsedAmount,
      loanNumber,
    });

    const canOpen = await Linking.canOpenURL(upiLink);
    if (canOpen) {
      await Linking.openURL(upiLink);
    } else {
      Alert.alert(
        'UPI App Not Found',
        'No UPI app detected on this device. Please install Google Pay, PhonePe, or any UPI app.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleMockPayment = () => {
    Alert.alert(
      'Payment Initiated',
      `Payment of ${fmt(parsedAmount)} for ${loanNumber} has been initiated.\n\nYou will receive a confirmation once the payment is processed.`,
      [
        {
          text: 'Done',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Payment Summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Payment Summary</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Loan Number</Text>
          <Text style={styles.summaryValue}>{loanNumber}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>EMI Due Date</Text>
          <Text style={styles.summaryValue}>{fmtDate(dueDate)}</Text>
        </View>
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.summaryLabel}>EMI Amount</Text>
          <Text style={styles.totalAmount}>{fmt(emiAmount)}</Text>
        </View>
      </View>

      {/* Amount Input */}
      <View style={styles.amountCard}>
        <Text style={styles.fieldLabel}>Payment Amount (INR)</Text>
        <TextInput
          style={styles.amountInput}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="Enter amount"
        />
        <View style={styles.quickAmounts}>
          {[emiAmount, Math.round(emiAmount * 0.5), Math.round(emiAmount * 2)].map(a => (
            <TouchableOpacity
              key={a}
              style={styles.quickChip}
              onPress={() => setAmount(String(a))}
            >
              <Text style={styles.quickChipText}>{fmt(a)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Payment Methods */}
      <Text style={styles.sectionTitle}>Pay via</Text>

      <TouchableOpacity style={styles.payMethodButton} onPress={handleUpiPay}>
        <View style={styles.payMethodLeft}>
          <View style={[styles.methodIcon, { backgroundColor: '#dbeafe' }]}>
            <Text style={styles.methodIconText}>UPI</Text>
          </View>
          <View>
            <Text style={styles.methodName}>UPI / QR</Text>
            <Text style={styles.methodDesc}>Pay via Google Pay, PhonePe, Paytm</Text>
          </View>
        </View>
        <Text style={styles.methodArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.payMethodButton} onPress={handleMockPayment}>
        <View style={styles.payMethodLeft}>
          <View style={[styles.methodIcon, { backgroundColor: '#d1fae5' }]}>
            <Text style={styles.methodIconText}>NET</Text>
          </View>
          <View>
            <Text style={styles.methodName}>Net Banking</Text>
            <Text style={styles.methodDesc}>Pay directly from your bank account</Text>
          </View>
        </View>
        <Text style={styles.methodArrow}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.payMethodButton} onPress={handleMockPayment}>
        <View style={styles.payMethodLeft}>
          <View style={[styles.methodIcon, { backgroundColor: '#fef3c7' }]}>
            <Text style={styles.methodIconText}>CARD</Text>
          </View>
          <View>
            <Text style={styles.methodName}>Debit / Credit Card</Text>
            <Text style={styles.methodDesc}>Visa, Mastercard, RuPay</Text>
          </View>
        </View>
        <Text style={styles.methodArrow}>›</Text>
      </TouchableOpacity>

      {/* Total */}
      <View style={styles.totalBox}>
        <Text style={styles.totalBoxLabel}>You will pay</Text>
        <Text style={styles.totalBoxAmount}>{fmt(parsedAmount)}</Text>
      </View>

      <Text style={styles.disclaimer}>
        Payments are processed securely. EMI credit will be reflected within 1 business day.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 16, paddingBottom: 40 },

  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  totalRow: { borderTopWidth: 1, borderTopColor: '#f3f4f6', marginTop: 6, paddingTop: 12 },
  summaryLabel: { fontSize: 14, color: '#6b7280' },
  summaryValue: { fontSize: 14, fontWeight: '500', color: '#111827' },
  totalAmount: { fontSize: 18, fontWeight: 'bold', color: '#1a56db' },

  amountCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  amountInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 14,
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    backgroundColor: '#f9fafb',
    marginBottom: 12,
  },
  quickAmounts: { flexDirection: 'row', gap: 8 },
  quickChip: {
    borderWidth: 1,
    borderColor: '#1a56db',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  quickChipText: { color: '#1a56db', fontSize: 12, fontWeight: '500' },

  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#6b7280', marginBottom: 10 },

  payMethodButton: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  payMethodLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  methodIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodIconText: { fontSize: 11, fontWeight: 'bold', color: '#374151' },
  methodName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  methodDesc: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  methodArrow: { fontSize: 24, color: '#9ca3af' },

  totalBox: {
    backgroundColor: '#1a56db',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  totalBoxLabel: { color: '#bfdbfe', fontSize: 13 },
  totalBoxAmount: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginTop: 4 },

  disclaimer: { fontSize: 12, color: '#9ca3af', textAlign: 'center', lineHeight: 18 },
});
