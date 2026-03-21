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
import { agentLogin, setAuthToken } from '../lib/api';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

export default function LoginScreen({ navigation }: Props) {
  const [employeeCode, setEmployeeCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isValid = employeeCode.trim().length >= 3 && password.length >= 6;

  const handleLogin = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      const res = await agentLogin(employeeCode.trim().toUpperCase(), password);
      setAuthToken(res.token);
      navigation.replace('TaskList', {
        session: {
          agentId: res.agentId,
          name: res.name,
          employeeCode: res.employeeCode,
          token: res.token,
        },
      });
    } catch (err: any) {
      Alert.alert('Login Failed', err.message || 'Please check your credentials.');
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
          <View style={styles.logoRow}>
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>B</Text>
            </View>
            <View>
              <Text style={styles.appName}>BankOS Agent</Text>
              <Text style={styles.appTag}>Field Collection App</Text>
            </View>
          </View>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Agent Login</Text>
          <Text style={styles.cardSubtitle}>
            Enter your employee credentials to access today's collection tasks.
          </Text>

          <Text style={styles.label}>Employee Code</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. EMP001"
            value={employeeCode}
            onChangeText={setEmployeeCode}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword(p => !p)}
            >
              <Text style={styles.eyeText}>{showPassword ? 'HIDE' : 'SHOW'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.hint}>Demo: any employee code, password = agent123</Text>

          <TouchableOpacity
            style={[styles.button, (!isValid || loading) && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={!isValid || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>BankOS Field Collection v1.0</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },

  header: { marginBottom: 32 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  appName: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  appTag: { fontSize: 14, color: '#64748b', marginTop: 2 },

  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: { fontSize: 20, fontWeight: 'bold', color: '#f1f5f9', marginBottom: 6 },
  cardSubtitle: { fontSize: 13, color: '#94a3b8', marginBottom: 24, lineHeight: 18 },

  label: { fontSize: 13, fontWeight: '600', color: '#94a3b8', marginBottom: 8 },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f1f5f9',
    fontSize: 16,
    marginBottom: 16,
  },
  passwordRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  passwordInput: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f1f5f9',
    fontSize: 16,
  },
  eyeButton: {
    marginLeft: 8,
    backgroundColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  eyeText: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },

  hint: { fontSize: 12, color: '#475569', marginBottom: 20 },

  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: '#1d4ed8', opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  footer: { textAlign: 'center', color: '#334155', fontSize: 12, marginTop: 32 },
});
