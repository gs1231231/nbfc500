import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { sendOtp, verifyOtp, setAuthToken } from '../lib/api';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

type Step = 'PHONE' | 'OTP';

export default function LoginScreen({ navigation }: Props) {
  const [step, setStep] = useState<Step>('PHONE');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [requestId, setRequestId] = useState('');

  const handleSendOtp = async () => {
    if (phone.length !== 10) {
      Alert.alert('Invalid Phone', 'Please enter a 10-digit mobile number.');
      return;
    }
    setLoading(true);
    try {
      const res = await sendOtp(phone);
      setRequestId(res.requestId);
      setStep('OTP');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit OTP.');
      return;
    }
    setLoading(true);
    try {
      const res = await verifyOtp(phone, otp);
      setAuthToken(res.token);
      navigation.replace('Dashboard', { userId: res.userId, phone: res.phone });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'OTP verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>B</Text>
          </View>
          <Text style={styles.appName}>BankOS</Text>
          <Text style={styles.tagline}>Your Lending Partner</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          {step === 'PHONE' ? (
            <>
              <Text style={styles.cardTitle}>Login to your account</Text>
              <Text style={styles.cardSubtitle}>
                Enter your registered mobile number to receive an OTP.
              </Text>

              <Text style={styles.label}>Mobile Number</Text>
              <View style={styles.phoneInputRow}>
                <View style={styles.countryCode}>
                  <Text style={styles.countryCodeText}>+91</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="10-digit mobile number"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={phone}
                  onChangeText={setPhone}
                  autoFocus
                />
              </View>

              <TouchableOpacity
                style={[styles.button, (loading || phone.length !== 10) && styles.buttonDisabled]}
                onPress={handleSendOtp}
                disabled={loading || phone.length !== 10}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Send OTP</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.cardTitle}>Enter OTP</Text>
              <Text style={styles.cardSubtitle}>
                We sent a 6-digit OTP to +91 {phone}.{'\n'}
                (Demo: use 123456)
              </Text>

              <Text style={styles.label}>One-Time Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter 6-digit OTP"
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={setOtp}
                autoFocus
              />

              <TouchableOpacity
                style={[styles.button, (loading || otp.length !== 6) && styles.buttonDisabled]}
                onPress={handleVerifyOtp}
                disabled={loading || otp.length !== 6}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Verify OTP</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => {
                  setStep('PHONE');
                  setOtp('');
                }}
              >
                <Text style={styles.linkText}>Change mobile number</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a56db',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  logoText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1a56db',
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  tagline: {
    fontSize: 14,
    color: '#c3d9ff',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
    lineHeight: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  phoneInputRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  countryCode: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
    marginRight: 8,
  },
  countryCodeText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  phoneInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    color: '#111827',
    backgroundColor: '#f9fafb',
    marginBottom: 20,
    letterSpacing: 4,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#1a56db',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#93c5fd',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  linkText: {
    color: '#1a56db',
    fontSize: 14,
    fontWeight: '500',
  },
});
