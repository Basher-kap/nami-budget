import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, PanResponder } from 'react-native';
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

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const PAD = 28;

export default function Budget() {
  const router = useRouter();
  const store = useStore();
  const { data } = store;
  const origin = data.nodes.find((n) => !n.parentId);
  const [total, setTotal] = useState('');
  const [err, setErr] = useState('');
  const [sel, setSel] = useState(null);   // node id with action sheet open
  const [form, setForm] = useState(null); // 'wallet' | 'allocate' | 'deposit' | 'expense'
  const node = data.nodes.find((n) => n.id === sel);

  // ---- pan / pinch-zoom canvas ----
  const L = origin ? layout(data.nodes, origin.id) : null;
  const cw = L ? L.w + PAD * 2 : 0;
  const ch = L ? L.h + PAD * 2 : 0;
  const vp = useRef({ w: 0, h: 0 });
  const view = useRef({ s: 1, x: 0, y: 0 });
  const [v, setV] = useState(view.current);
  const set = (n) => { view.current = n; setV(n); };
  const dims = useRef({ cw: 0, ch: 0 });
  dims.current = { cw, ch };

  const fit = () => {
    const { w, h } = vp.current;
    if (!w || !dims.current.cw) return;
    const s = clamp(Math.min(w / dims.current.cw, h / dims.current.ch, 1), 0.3, 1);
    set({ s, x: (w - dims.current.cw * s) / 2, y: Math.max(8, (h - dims.current.ch * s) / 2 * 0.4) });
  };
  const zoomBy = (f) => {
    const { w, h } = vp.current; const c = view.current;
    const s = clamp(c.s * f, 0.3, 2.5);
    const wx = (w / 2 - c.x) / c.s, wy = (h / 2 - c.y) / c.s;
    set({ s, x: w / 2 - wx * s, y: h / 2 - wy * s });
  };
  // Re-fit whenever the tree grows or shrinks
  useEffect(() => { fit(); }, [data.nodes.length, cw, ch]);

  const g = useRef({});
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (e, gs) =>
      e.nativeEvent.touches.length >= 2 || Math.abs(gs.dx) > 6 || Math.abs(gs.dy) > 6,
    onPanResponderGrant: () => { g.current = { start: { ...view.current }, base: { dx: 0, dy: 0 }, pinch: null }; },
    onPanResponderMove: (e, gs) => {
      const t = e.nativeEvent.touches;
      const G = g.current;
      if (t.length >= 2) {
        const dist = Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
        if (!G.pinch) G.pinch = { dist, start: { ...view.current } };
        const { w, h } = vp.current; const st = G.pinch.start;
        const s = clamp(st.s * (dist / G.pinch.dist), 0.3, 2.5);
        const wx = (w / 2 - st.x) / st.s, wy = (h / 2 - st.y) / st.s;
        set({ s, x: w / 2 - wx * s, y: h / 2 - wy * s });
      } else {
        if (G.pinch) { G.pinch = null; G.start = { ...view.current }; G.base = { dx: gs.dx, dy: gs.dy }; }
        set({ s: G.start.s, x: G.start.x + gs.dx - G.base.dx, y: G.start.y + gs.dy - G.base.dy });
      }
    },
  })).current;

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

  const { pos, w, h } = L;

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
      <View style={{ flex: 1, overflow: 'hidden' }} {...pan.panHandlers}
        onLayout={(e) => { vp.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height }; fit(); }}>
        <View style={{ position: 'absolute', left: 0, top: 0, width: cw, height: ch, transformOrigin: 'top left',
          transform: [{ translateX: v.x }, { translateY: v.y }, { scale: v.s }] }}>
          <Svg width={cw} height={ch} style={{ position: 'absolute' }}>
            {data.nodes.filter((n) => childrenOf(data.nodes, n.id).length).map((n) => {
              const p = pos[n.id];
              const px = PAD + p.x + BW / 2, py = PAD + p.y + BH, midY = py + GY / 2;
              return childrenOf(data.nodes, n.id).map((c) => {
                const cx = PAD + pos[c.id].x + BW / 2, cy = PAD + pos[c.id].y;
                return (
                  <React.Fragment key={c.id}>
                    <Path d={`M${px} ${py} V${midY} H${cx} V${cy - 6}`} stroke={C.navy} strokeWidth={2} fill="none" />
                    <Polygon points={`${cx - 5},${cy - 9} ${cx + 5},${cy - 9} ${cx},${cy}`} fill={C.navy} />
                  </React.Fragment>
                );
              });
            })}
          </Svg>
          <View style={{ position: 'absolute', left: PAD, top: PAD, width: w, height: h }}>
            {data.nodes.map((n) => (
              <Box key={n.id} n={n} p={pos[n.id]} onPress={() => setSel(n.id)}
                onMinus={() => { setSel(n.id); setForm('expense'); }} />
            ))}
          </View>
        </View>

        <View style={{ position: 'absolute', right: 12, bottom: 12, gap: 8 }}>
          {[['＋', () => zoomBy(1.25)], ['－', () => zoomBy(0.8)], ['⤢', fit]].map(([t, fn]) => (
            <Pressable key={t} onPress={fn} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.navy,
              alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.orange }}>
              <Text style={{ color: C.gold, fontSize: 20, fontWeight: '900' }}>{t}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={{ position: 'absolute', left: 12, bottom: 12, color: C.muted, fontSize: 11 }}>
          Drag to move · pinch or ＋/－ to zoom · ⤢ fit
        </Text>
      </View>

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