import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../../lib/theme';

const icon = (name) => ({ color, size }) => <Ionicons name={name} color={color} size={size} />;

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: C.orange }, headerTintColor: C.navy,
      headerTitleStyle: { fontWeight: '900' },
      tabBarStyle: { backgroundColor: C.navy, borderTopColor: C.orange },
      tabBarActiveTintColor: C.orange, tabBarInactiveTintColor: '#9FB3C8',
    }}>
      <Tabs.Screen name="index" options={{ title: 'Nami Budget', tabBarLabel: 'Home', tabBarIcon: icon('compass') }} />
      <Tabs.Screen name="budget" options={{ title: 'Budget Tree', tabBarLabel: 'Budget', tabBarIcon: icon('wallet') }} />
      <Tabs.Screen name="calculator" options={{ title: 'Calculator', tabBarIcon: icon('calculator') }} />
      <Tabs.Screen name="history" options={{ title: 'Transaction History', tabBarLabel: 'History', tabBarIcon: icon('receipt') }} />
    </Tabs>
  );
}
