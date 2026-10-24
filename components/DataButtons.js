import React from 'react';
import { View, Alert } from 'react-native';
import { Btn } from './ui';
import { useStore } from '../lib/store';
import { exportExcel, importExcel } from '../lib/excel';

export default function DataButtons() {
  const { data, replaceAll } = useStore();
  const doExport = async () => {
    try { await exportExcel(data); } catch (e) { Alert.alert('Export failed', String(e.message || e)); }
  };
  const doImport = () =>
    Alert.alert('Import Excel', 'This replaces all current data on this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Import', style: 'destructive', onPress: async () => {
        try { const d = await importExcel(); if (d) replaceAll(d); }
        catch (e) { Alert.alert('Import failed', String(e.message || e)); }
      } },
    ]);
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Btn title="Export Excel" kind="navy" onPress={doExport} style={{ flex: 1 }} />
      <Btn title="Import Excel" kind="ghost" onPress={doImport} style={{ flex: 1 }} />
    </View>
  );
}
