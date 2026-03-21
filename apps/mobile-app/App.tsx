import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import LoanDetailScreen from './src/screens/LoanDetailScreen';
import PaymentScreen from './src/screens/PaymentScreen';

export type RootStackParamList = {
  Login: undefined;
  Dashboard: { userId: string; phone: string };
  LoanDetail: { loanId: string; loanNumber: string };
  Payment: { loanId: string; loanNumber: string; emiAmount: number; dueDate: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerStyle: { backgroundColor: '#1a56db' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{ title: 'My Loans', headerBackVisible: false }}
        />
        <Stack.Screen
          name="LoanDetail"
          component={LoanDetailScreen}
          options={({ route }) => ({ title: route.params.loanNumber })}
        />
        <Stack.Screen
          name="Payment"
          component={PaymentScreen}
          options={{ title: 'Pay EMI' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
