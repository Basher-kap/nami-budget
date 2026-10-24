import React, { useState } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, useWindowDimensions } from 'react-native';
import Svg, { Path, Polygon } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { Card, Btn, FormModal } from '../../components/ui';
import { useStore, childrenOf } from '../../lib/store';
import { C, money } from '../../lib/theme';

const BW = 136, BH = 92, GX = 18, GY = 58; // box width/height, horizontal/vertical gaps

// Org-chart layout: each parent is centered above its children
function layout(nodes, rootId) {
  const pos = {};
  let maxDepth = 0;
  const span = (id) => {
    const k = childrenOf(nodes, id);
    return k.length ? k.reduce((s, c) => s + span(c.id), 0) + GX * (k.length - 1) : 0;
  };
  const width = (id) => Math.max(BW, span(id));
  const place = (id, left, depth) => {
    maxDepth = Math.max(maxDepth, depth);
    const w = width(id);
    pos[id] = { x: left + w / 2 - BW / 2, y: depth * (BH + GY), depth };
    const k = childrenOf(nodes, id);
    let cl = left + (w - span(id)) / 2;
    k.forEach((c) => { place(c.id, cl, depth + 1); cl += width(c.id) + GX; });
  };
  place(rootId, 0, 0);
  return { pos, w: width(rootId), h: (maxDepth + 1) * (BH + GY) - GY };
}

function Box({ n, p, onPress, onMinus }) {
  const origin = !n.parentId;
  const label = origin ? 'Origin Parent Node' : p.depth === 1 ? 'Child Node' : 'Sub-Child Node';
  return (
    <Pressable onPress={onPress} style={{
      position: 'absolute', left: p.x, top: p.y, width: BW, height: BH, borderRadius: 18, padding: 8,
      backgroundColor: origin ? C.navy : '#fff', borderWidth: 2.5, borderColor: origin ? C.orange : C.navy,
      borderStyle: origin ? 'solid' : 'dashed', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 9, fontStyle: 'italic', color: origin ? '#9FB3C8' : C.muted }}>{label}</Text>
      <Text numberOfLines={1} style={{ fontWeight: '900', color: origin ? C.gold : C.navy, marginTop: 2 }}>{n.name}</Text>
      <Text style={{ fontWeight: '900', fontSize: 18, color: origin ? '#fff' : C.navy }}>{money(n.balance)}</Text>
      {!origin && (
        <Pressable onPress={onMinus} hitSlop={8} style={{ position: 'absolute', right: -10, bottom: -10, width: 28, height: 28,
          borderRadius: 14, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' }}>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18, marginTop: -2 }}>−</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

export default function Budget() {
  const router = useRouter();
  const store = useStore();
  const { width: screenW } = useWindowDimensions();
  const { data } = store;
  const origin = data.nodes.find((n) => !n.parentId);
  const [total, setTotal] = useState('');
  const [err, setErr] = useState('');
  const [sel, setSel] = useState(null);   // node id with action sheet open
  const [form, setForm] = useState(null); // 'wallet' | 'allocate' | 'deposit' | 'expense'
  const node = data.nodes.find((n) => n.id === sel);

  if (!origin) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, padding: 20, justifyContent: 'center' }}>
        <Card>
          <Text style={{ fontSize: 22, fontWeight: '900', color: C.navy }}>Set your Total Budget</Text>
          <Text style={{ color: C.muted, marginVertical: 8 }}>This becomes the Origin Parent Node every wallet branches from.</Text>
          <TextInput value={total} onChangeText={setTotal} keyboardType="decimal-pad" placeholder="0.00"
            style={{ backgroundColor: '#fff', borderWidth: 2, borderColor: C.line, borderRadius: 10, padding: 12, fontSize: 18 }} />
          {!!err && <Text style={{ color: C.red, marginTop: 6 }}>{err}</Text>}
          <Btn title="Set Sail" onPress={() => { const r = store.createOrigin(Number(total)); setErr(r.ok ? '' : r.error); }} style={{ marginTop: 12 }} />
        </Card>
      </View>
    );
  }

  const { pos, w, h } = layout(data.nodes, origin.id);
  const pad = 24;
  const canvasW = Math.max(w + pad * 2, screenW);
  const offX = (canvasW - w) / 2;
  const canvasH = h + pad * 2;

  const forms = {
    wallet: { title: 'Add Wallet', fields: [{ key: 'name', label: 'Wallet name' }, { key: 'amount', label: 'Amount from parent', numeric: true }],
      submit: (v) => store.addWallet(sel, v.name, v.amount) },
    allocate: { title: 'Allocate Money', fields: [{ key: 'amount', label: 'Amount from parent', numeric: true }],
      submit: (v) => store.allocate(sel, v.amount) },
    deposit: { title: node && !node.parentId ? 'Add to Total Budget' : 'Deposit Money', fields: [{ key: 'amount', label: 'Amount', numeric: true }],
      submit: (v) => store.deposit(sel, v.amount) },
    expense: { title: 'Expense', fields: [{ key: 'description', label: 'Expense Name (e.g. Dinner)' }, { key: 'amount', label: 'Expense Amount', numeric: true }],
      submit: (v) => store.expense(sel, v.description, v.amount) },
  };
  const f = form && forms[form];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <Btn title="History Page" kind="navy" onPress={() => router.push('/history')} />
      </View>
      <ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ width: canvasW, height: canvasH }}>
            <Svg width={canvasW} height={canvasH} style={{ position: 'absolute' }}>
              {data.nodes.filter((n) => childrenOf(data.nodes, n.id).length).map((n) => {
                const p = pos[n.id];
                const px = offX + p.x + BW / 2, py = pad + p.y + BH, midY = py + GY / 2;
                return childrenOf(data.nodes, n.id).map((c) => {
                  const cx = offX + pos[c.id].x + BW / 2, cy = pad + pos[c.id].y;
                  return (
                    <React.Fragment key={c.id}>
                      <Path d={`M${px} ${py} V${midY} H${cx} V${cy - 6}`} stroke={C.navy} strokeWidth={2} fill="none" />
                      <Polygon points={`${cx - 5},${cy - 9} ${cx + 5},${cy - 9} ${cx},${cy}`} fill={C.navy} />
                    </React.Fragment>
                  );
                });
              })}
            </Svg>
            <View style={{ position: 'absolute', left: offX, top: pad, width: w, height: h }}>
              {data.nodes.map((n) => (
                <Box key={n.id} n={n} p={pos[n.id]} onPress={() => setSel(n.id)}
                  onMinus={() => { setSel(n.id); setForm('expense'); }} />
              ))}
            </View>
          </View>
        </ScrollView>
        <Text style={{ color: C.muted, textAlign: 'center', fontSize: 12, marginBottom: 20 }}>
          Tap a node for actions · tap − to record an expense
        </Text>
      </ScrollView>

      <FormModal visible={!!f} title={f?.title || ''} subtitle={node ? `Wallet Name: ${node.name}` : ''} fields={f?.fields || []}
        onSubmit={f?.submit || (() => ({ ok: true }))} onClose={() => { setForm(null); setSel(null); }} />
      {node && !form && (
        <Pressable onPress={() => setSel(null)} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: '#10304Eaa', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.bg, padding: 18, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 10, borderTopWidth: 3, borderColor: C.orange }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: C.navy }}>{node.name} · {money(node.balance)}</Text>
            <Btn title="＋ Add Wallet" onPress={() => setForm('wallet')} />
            {node.parentId && <Btn title="Allocate from parent" kind="navy" onPress={() => setForm('allocate')} />}
            <Btn title={node.parentId ? 'Deposit (new money)' : 'Add to Total Budget'} kind="navy" onPress={() => setForm('deposit')} />
            {node.parentId && <Btn title="− Add Expense" kind="danger" onPress={() => setForm('expense')} />}
            <Btn title="Close" kind="ghost" onPress={() => setSel(null)} />
          </View>
        </Pressable>
      )}
    </View>
  );
}
