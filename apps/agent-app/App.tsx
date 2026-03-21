import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import LoginScreen from './src/screens/LoginScreen';
import TaskListScreen from './src/screens/TaskListScreen';
import TaskDetailScreen from './src/screens/TaskDetailScreen';
import DispositionScreen from './src/screens/DispositionScreen';

export interface AgentSession {
  agentId: string;
  name: string;
  employeeCode: string;
  token: string;
}

export type RootStackParamList = {
  Login: undefined;
  TaskList: { session: AgentSession };
  TaskDetail: { taskId: string; session: AgentSession };
  Disposition: { taskId: string; customerName: string; loanNumber: string; session: AgentSession };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerStyle: { backgroundColor: '#0f172a' },
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
          name="TaskList"
          component={TaskListScreen}
          options={({ route }) => ({
            title: `Tasks — ${route.params.session.name}`,
            headerBackVisible: false,
          })}
        />
        <Stack.Screen
          name="TaskDetail"
          component={TaskDetailScreen}
          options={{ title: 'Task Details' }}
        />
        <Stack.Screen
          name="Disposition"
          component={DispositionScreen}
          options={{ title: 'Record Disposition' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
