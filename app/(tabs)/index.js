import React from 'react';
import { ScrollView, View, Text, useWindowDimensions } from 'react-native';
import { PieChart, LineChart } from 'react-native-chart-kit';
import { Card } from '../../components/ui';
import DataButtons from '../../components/DataButtons';
import { useStore, childrenOf, descendants, unallocated } from '../../lib/store';
import { C, PAL, money } from '../../lib/theme';

const chartCfg = {
  backgroundGradientFrom: '#fff', backgroundGradientTo: '#fff', decimalPlaces: 0,
  color: (o = 1) => `rgba(255,140,26,${o})`, labelColor: () => C.navy,
  propsForDots: { r: '4', strokeWidth: '2', stroke: C.navy },
};

const Stat = ({ label, value, color }) => (
  <Card style={{ flexBasis: '47%', flexGrow: 1, borderColor: color }}>
    <Text style={{ color: C.muted, fontWeight: '700', fontSize: 12 }}>{label}</Text>
    <Text style={{ color: C.navy, fontWeight: '900', fontSize: 20, marginTop: 4 }}>{value}</Text>
  </Card>
);

export default function Home() {
  const { data } = useStore();
  const { width } = useWindowDimensions();
  const w = width - 32 - 28;
  const origin = data.nodes.find((n) => !n.parentId);
  const expenses = data.tx.filter((t) => t.type === 'expense');
  const spentOf = (ids) => expenses.filter((t) => ids.includes(t.walletId)).reduce((s, t) => s + t.amount, 0);
  const totalSpent = expenses.reduce((s, t) => s + t.amount, 0);
  const lvl1 = origin ? childrenOf(data.nodes, origin.id) : [];

  const pie = [...lvl1.map((n, i) => ({ name: n.name, population: n.balance, color: PAL[i % PAL.length] })),
    ...(origin && unallocated(data.nodes, origin.id) > 0
      ? [{ name: 'Unallocated', population: unallocated(data.nodes, origin.id), color: '#C9D3DD' }] : [])]
    .filter((p) => p.population > 0).map((p) => ({ ...p, legendFontColor: C.navy, legendFontSize: 12 }));

  const byDay = {};
  expenses.forEach((t) => { const d = t.date.slice(0, 10); byDay[d] = (byDay[d] || 0) + t.amount; });
  const days = Object.keys(byDay).sort().slice(-7);

  const groups = lvl1.map((wl) => ({
    name: wl.name,
    bars: [{ label: 'own', val: spentOf([wl.id]) },
      ...childrenOf(data.nodes, wl.id).map((c) => ({ label: c.name, val: spentOf(descendants(data.nodes, c.id)) }))],
  }));
  const max = Math.max(1, ...groups.flatMap((g) => g.bars.map((b) => b.val)));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Stat label="TOTAL BUDGET" value={money(origin ? origin.balance + totalSpent : 0)} color={C.orange} />
        <Stat label="REMAINING" value={money(origin?.balance)} color={C.green} />
        <Stat label="TOTAL SPENT" value={money(totalSpent)} color={C.red} />
        <Stat label="WALLETS" value={String(Math.max(0, data.nodes.length - 1))} color={C.sky} />
      </View>

      <Card>
        <Text style={{ fontWeight: '900', color: C.navy, marginBottom: 6 }}>Wallet Distribution</Text>
        {pie.length ? (
          <PieChart data={pie} width={w} height={170} accessor="population" backgroundColor="transparent"
            paddingLeft="10" chartConfig={chartCfg} />
        ) : <Text style={{ color: C.muted }}>Create wallets in the Budget tab to see the split.</Text>}
      </Card>

      <Card>
        <Text style={{ fontWeight: '900', color: C.navy, marginBottom: 6 }}>Daily Spending</Text>
        {days.length ? (
          <LineChart data={{ labels: days.map((d) => d.slice(5)), datasets: [{ data: days.map((d) => byDay[d]) }] }}
            width={w} height={190} chartConfig={chartCfg} bezier fromZero style={{ borderRadius: 12 }} />
        ) : <Text style={{ color: C.muted }}>No expenses yet.</Text>}
      </Card>

      <Card>
        <Text style={{ fontWeight: '900', color: C.navy, marginBottom: 10 }}>Expenses by Wallet & Sub-wallet</Text>
        {groups.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 22 }}>
              {groups.map((g) => (
                <View key={g.name} style={{ alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: 4, borderBottomWidth: 2, borderColor: C.navy }}>
                    {g.bars.map((b, i) => (
                      <View key={i} style={{ alignItems: 'center', justifyContent: 'flex-end' }}>
                        <Text style={{ fontSize: 9, color: C.navy }}>{b.val ? Math.round(b.val) : ''}</Text>
                        <View style={{ width: 22, height: Math.max(2, (b.val / max) * 110), backgroundColor: PAL[i % PAL.length], borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
                      </View>
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {g.bars.map((b, i) => (
                      <Text key={i} numberOfLines={1} style={{ width: 26, fontSize: 8, color: C.muted, textAlign: 'center' }}>{b.label}</Text>
                    ))}
                  </View>
                  <Text style={{ fontWeight: '800', color: C.navy, marginTop: 4 }}>{g.name}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        ) : <Text style={{ color: C.muted }}>Add wallets to compare spending.</Text>}
        <Text style={{ color: C.muted, fontSize: 11, marginTop: 8 }}>First bar = the wallet's own expenses; the others are its sub-wallets.</Text>
      </Card>

      <DataButtons />
    </ScrollView>
  );
}
