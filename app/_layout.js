import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StoreProvider } from '../lib/store';

export default function Root() {
  return (
    <StoreProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </StoreProvider>
  );
}
