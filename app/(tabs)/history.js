import React, { useState } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { Card } from '../../components/ui';
import DataButtons from '../../components/DataButtons';
import { useStore } from '../../lib/store';
import { C, money } from '../../lib/theme';

const Seg = ({ label, active, onPress }) => (
  <Pressable onPress={onPress} style={{ flex: 1, padding: 10, alignItems: 'center', borderRadius: 10, backgroundColor: active ? C.orange : 'transparent' }}>
    <Text style={{ fontWeight: '800', color: active ? '#fff' : C.navy }}>{label}</Text>
  </Pressable>
);

export default function History() {
  const { data } = useStore();
  const [mode, setMode] = useState('expense');
  const list = data.tx.filter((t) => t.type === mode).sort((a, b) => b.date.localeCompare(a.date));
  const cols = mode === 'expense'
    ? [['Wallet', 2, (t) => t.walletName], ['Expense', 2.5, (t) => t.description], ['Amount', 1.5, (t) => money(t.amount)], ['Date', 1.6, (t) => t.date.slice(0, 10)]]
    : [['Wallet', 2.5, (t) => t.walletName], ['Amount', 2, (t) => money(t.amount)], ['Date', 2, (t) => t.date.slice(0, 10)]];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 4, borderWidth: 2, borderColor: C.line }}>
        <Seg label="Expenses History" active={mode === 'expense'} onPress={() => setMode('expense')} />
        <Seg label="Deposit History" active={mode === 'deposit'} onPress={() => setMode('deposit')} />
      </View>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', backgroundColor: C.navy, padding: 10 }}>
          {cols.map(([h, flex]) => <Text key={h} style={{ flex, color: C.gold, fontWeight: '900', fontSize: 12 }}>{h}</Text>)}
        </View>
        {list.length === 0 && <Text style={{ padding: 16, color: C.muted }}>Nothing here yet.</Text>}
        {list.map((t, i) => (
          <View key={t.id} style={{ flexDirection: 'row', padding: 10, backgroundColor: i % 2 ? '#FFF9EE' : '#fff' }}>
            {cols.map(([h, flex, get]) => <Text key={h} style={{ flex, color: C.navy, fontSize: 12 }}>{get(t)}</Text>)}
          </View>
        ))}
      </Card>
      <DataButtons />
    </ScrollView>
  );
}
