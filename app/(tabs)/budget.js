import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, PanResponder, Alert } from 'react-native';
import Svg, { Path, Polygon, G } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { Card, Btn, FormModal } from '../../components/ui';
import { useStore, childrenOf, depthOf, BOX, WORLD } from '../../lib/store';
import { C, money } from '../../lib/theme';

const { W: BW, H: BH } = BOX;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// A draggable node box. Drag moves it (lines follow); tap opens actions.
function Box({ n, p, view, active, onPress, onMinus, onDrag, onDrop }) {
  const L = useRef({});
  L.current = { n, p, view, onDrag, onDrop };
  const st = useRef({});
  const pr = useRef(PanResponder.create({
    // single finger + real movement = drag this node; two fingers fall through to the canvas (pinch)
    onMoveShouldSetPanResponder: (e, g) => e.nativeEvent.touches.length === 1 && (Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6),
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (e, g) => { st.current = { x: L.current.p.x, y: L.current.p.y, gx: g.dx, gy: g.dy, last: null }; },
    onPanResponderMove: (e, g) => {
      const s = L.current.view.current.s;
      const x = clamp(st.current.x + (g.dx - st.current.gx) / s, 0, WORLD - BW);
      const y = clamp(st.current.y + (g.dy - st.current.gy) / s, 0, WORLD - BH);
      st.current.last = { x, y };
      L.current.onDrag(L.current.n.id, x, y);
    },
    onPanResponderRelease: () => { const l = st.current.last; if (l) L.current.onDrop(L.current.n.id, l.x, l.y); },
    onPanResponderTerminate: () => { const l = st.current.last; if (l) L.current.onDrop(L.current.n.id, l.x, l.y); },
  })).current;

  const origin = !n.parentId;
  const label = origin ? 'Origin Parent Node' : p.depth === 1 ? 'Child Node' : 'Sub-Child Node';
  return (
    <View {...pr.panHandlers} style={{
      position: 'absolute', left: p.x, top: p.y, width: BW, height: BH, borderRadius: 18,
      backgroundColor: origin ? C.navy : '#fff', borderWidth: 2.5, borderColor: origin ? C.orange : active ? C.orange : C.navy,
      borderStyle: origin ? 'solid' : 'dashed', zIndex: active ? 10 : 1, elevation: active ? 8 : 0, opacity: active ? 0.92 : 1 }}>
      <Pressable onPress={onPress} style={{ flex: 1, padding: 8, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 9, fontStyle: 'italic', color: origin ? '#9FB3C8' : C.muted }}>{label}</Text>
        <Text numberOfLines={1} style={{ fontWeight: '900', color: origin ? C.gold : C.navy, marginTop: 2 }}>{n.name}</Text>
        <Text style={{ fontWeight: '900', fontSize: 18, color: origin ? '#fff' : C.navy }}>{money(n.balance)}</Text>
      </Pressable>
      {!origin && (
        <Pressable onPress={onMinus} hitSlop={8} style={{ position: 'absolute', right: -10, bottom: -10, width: 28, height: 28,
          borderRadius: 14, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' }}>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18, marginTop: -2 }}>−</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function Budget() {
  const router = useRouter();
  const store = useStore();
  const { data } = store;
  const origin = data.nodes.find((n) => !n.parentId);
  const [total, setTotal] = useState('');
  const [err, setErr] = useState('');
  const [sel, setSel] = useState(null);   // node id with action sheet open
  const [form, setForm] = useState(null); // 'wallet' | 'allocate' | 'deposit' | 'expense'
  const [drag, setDrag] = useState(null); // {id,x,y} while a node is being dragged
  const node = data.nodes.find((n) => n.id === sel);

  // node positions (world coords); the dragged node follows the finger live
  const pos = {};
  data.nodes.forEach((n) => { pos[n.id] = { x: n.px, y: n.py, depth: depthOf(data.nodes, n.id) }; });
  if (drag && pos[drag.id]) pos[drag.id] = { ...pos[drag.id], x: drag.x, y: drag.y };
  const ps = Object.values(pos);
  const bounds = ps.length ? {
    minX: Math.min(...ps.map((p) => p.x)), minY: Math.min(...ps.map((p) => p.y)),
    maxX: Math.max(...ps.map((p) => p.x)) + BW, maxY: Math.max(...ps.map((p) => p.y)) + BH,
  } : null;
  const boundsRef = useRef(null);
  boundsRef.current = bounds;

  // ---- pan / pinch-zoom camera ----
  const vp = useRef({ w: 0, h: 0 });
  const view = useRef({ s: 1, x: 0, y: 0 });
  const [v, setV] = useState(view.current);
  const set = (nv) => { view.current = nv; setV(nv); };
  const fit = () => {
    const b = boundsRef.current; const { w, h } = vp.current;
    if (!b || !w) return;
    const bw = b.maxX - b.minX + 80, bh = b.maxY - b.minY + 80;
    const s = clamp(Math.min(w / bw, h / bh, 1), 0.3, 1);
    set({ s, x: w / 2 - ((b.minX + b.maxX) / 2) * s, y: 40 * s - b.minY * s + 8 });
  };
  const zoomBy = (f) => {
    const { w, h } = vp.current; const c = view.current;
    const s = clamp(c.s * f, 0.3, 2.5);
    const wx = (w / 2 - c.x) / c.s, wy = (h / 2 - c.y) / c.s;
    set({ s, x: w / 2 - wx * s, y: h / 2 - wy * s });
  };
  // re-fit when wallets are added or removed (not while dragging)
  useEffect(() => { fit(); }, [data.nodes.length]);

  const g = useRef({});
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (e, gs) => e.nativeEvent.touches.length >= 2 || Math.abs(gs.dx) > 6 || Math.abs(gs.dy) > 6,
    onPanResponderGrant: () => { g.current = { start: { ...view.current }, base: { dx: 0, dy: 0 }, pinch: null }; },
    onPanResponderMove: (e, gs) => {
      const t = e.nativeEvent.touches; const G = g.current;
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

  const confirmDelete = () => {
    if (childrenOf(data.nodes, node.id).length) {
      Alert.alert("Can't delete yet", `"${node.name}" still has sub-wallets. Delete those first.`);
      return;
    }
    Alert.alert('Delete wallet', `Delete "${node.name}"? Its ${money(node.balance)} goes back to the parent's unallocated money, so the Total Budget doesn't change. Transaction history is kept.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { const id = node.id; setSel(null); store.deleteWallet(id); } },
    ]);
  };

  const forms = {
    wallet: { title: 'Add Wallet', fields: [{ key: 'name', label: 'Wallet name' }, { key: 'amount', label: 'Amount from parent', numeric: true }],
      submit: (x) => store.addWallet(sel, x.name, x.amount) },
    allocate: { title: 'Allocate Money', fields: [{ key: 'amount', label: 'Amount from parent', numeric: true }],
      submit: (x) => store.allocate(sel, x.amount) },
    deposit: { title: node && !node.parentId ? 'Add to Total Budget' : 'Deposit Money', fields: [{ key: 'amount', label: 'Amount', numeric: true }],
      submit: (x) => store.deposit(sel, x.amount) },
    expense: { title: 'Expense', fields: [{ key: 'description', label: 'Expense Name (e.g. Dinner)' }, { key: 'amount', label: 'Expense Amount', numeric: true }],
      submit: (x) => store.expense(sel, x.description, x.amount) },
  };
  const f = form && forms[form];

  // svg only covers the nodes' bounding box (keeps it light)
  const bx = bounds.minX - 30, by = bounds.minY - 30;
  const bw = bounds.maxX - bounds.minX + 60, bh = bounds.maxY - bounds.minY + 60;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <Btn title="History Page" kind="navy" onPress={() => router.push('/history')} />
      </View>
      <View style={{ flex: 1, overflow: 'hidden' }} {...pan.panHandlers}
        onLayout={(e) => { vp.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height }; fit(); }}>
        <View style={{ position: 'absolute', left: 0, top: 0, width: WORLD, height: WORLD, transformOrigin: 'top left',
          transform: [{ translateX: v.x }, { translateY: v.y }, { scale: v.s }] }}>
          <Svg width={bw} height={bh} style={{ position: 'absolute', left: bx, top: by }}>
            <G translateX={-bx} translateY={-by}>
              {data.nodes.filter((n) => n.parentId).map((c) => {
                const a = pos[c.parentId], b = pos[c.id];
                const px = a.x + BW / 2, py = a.y + BH, cx = b.x + BW / 2, cy = b.y, mid = (py + cy) / 2;
                return (
                  <React.Fragment key={c.id}>
                    <Path d={`M${px} ${py} V${mid} H${cx} V${cy - 6}`} stroke={C.navy} strokeWidth={2} fill="none" />
                    <Polygon points={`${cx - 5},${cy - 9} ${cx + 5},${cy - 9} ${cx},${cy}`} fill={C.navy} />
                  </React.Fragment>
                );
              })}
            </G>
          </Svg>
          {data.nodes.map((n) => (
            <Box key={n.id} n={n} p={pos[n.id]} view={view} active={drag?.id === n.id}
              onPress={() => setSel(n.id)}
              onMinus={() => { setSel(n.id); setForm('expense'); }}
              onDrag={(id, x, y) => setDrag({ id, x, y })}
              onDrop={(id, x, y) => { store.moveNode(id, x, y); setDrag(null); }} />
          ))}
        </View>

        <View style={{ position: 'absolute', right: 12, bottom: 12, gap: 8 }}>
          {[['＋', () => zoomBy(1.25)], ['－', () => zoomBy(0.8)], ['⤢', fit], ['▤', store.arrange]].map(([t, fn]) => (
            <Pressable key={t} onPress={fn} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.navy,
              alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.orange }}>
              <Text style={{ color: C.gold, fontSize: 20, fontWeight: '900' }}>{t}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={{ position: 'absolute', left: 12, bottom: 12, right: 72, color: C.muted, fontSize: 11 }}>
          Drag a node to move it · drag empty space to pan · pinch/＋/－ zoom · ⤢ fit · ▤ auto-arrange
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
            {node.parentId && <Btn title="Delete Wallet" kind="ghost" onPress={confirmDelete} />}
            <Btn title="Close" kind="ghost" onPress={() => setSel(null)} />
          </View>
        </Pressable>
      )}
    </View>
  );
}