import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'nami-budget-v1';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const ok = { ok: true };
const fail = (error) => ({ ok: false, error });
const Ctx = createContext(null);

// ---- canvas geometry (world coordinates) ----
export const BOX = { W: 136, H: 92, GX: 18, GY: 58 };
export const WORLD = 3200;
const TOP = 160;
const clampN = (v, a, b) => Math.min(b, Math.max(a, v));

// Tidy tree layout, centered in the world. Returns {id: {x, y}}
export function autoLayout(nodes) {
  const { W, H, GX, GY } = BOX;
  const pos = {};
  const kids = (id) => nodes.filter((n) => n.parentId === id);
  const span = (id) => { const k = kids(id); return k.length ? k.reduce((s, c) => s + width(c.id), 0) + GX * (k.length - 1) : 0; };
  const width = (id) => Math.max(W, span(id));
  const place = (id, left, d) => {
    const w = width(id);
    pos[id] = { x: left + w / 2 - W / 2, y: d * (H + GY) };
    let cl = left + (w - span(id)) / 2;
    kids(id).forEach((c) => { place(c.id, cl, d + 1); cl += width(c.id) + GX; });
  };
  const root = nodes.find((n) => !n.parentId);
  if (!root) return pos;
  place(root.id, 0, 0);
  const w = width(root.id);
  Object.values(pos).forEach((p) => { p.x += WORLD / 2 - w / 2; p.y += TOP; });
  return pos;
}
// Give every node a saved position (older saves / imported files may lack them)
export const withPos = (d) => {
  if (d.nodes.every((n) => Number.isFinite(n.px) && Number.isFinite(n.py))) return d;
  const pos = autoLayout(d.nodes);
  return { ...d, nodes: d.nodes.map((n) => ({ ...n, px: pos[n.id]?.x ?? WORLD / 2, py: pos[n.id]?.y ?? TOP })) };
};
export const useStore = () => useContext(Ctx);

export const childrenOf = (nodes, id) => nodes.filter((n) => n.parentId === id);
export const descendants = (nodes, id) => [id, ...childrenOf(nodes, id).flatMap((c) => descendants(nodes, c.id))];
// Money in a node not yet handed down to its wallets
export const unallocated = (nodes, id) => {
  const n = nodes.find((x) => x.id === id);
  return n ? n.balance - childrenOf(nodes, id).reduce((s, c) => s + c.balance, 0) : 0;
};
// node -> parent -> ... -> origin
const chain = (nodes, id) => {
  const out = [];
  let cur = nodes.find((n) => n.id === id);
  while (cur) { out.push(cur.id); const pid = cur.parentId; cur = nodes.find((n) => n.id === pid); }
  return out;
};

export const depthOf = (nodes, id) => chain(nodes, id).length - 1;

export function StoreProvider({ children }) {
  const [data, setData] = useState({ nodes: [], tx: [] });
  const [ready, setReady] = useState(false);
  const ref = useRef(data);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((raw) => {
      if (raw) { ref.current = withPos(JSON.parse(raw)); setData(ref.current); }
      setReady(true);
    });
  }, []);

  const commit = (d) => { ref.current = d; setData(d); AsyncStorage.setItem(KEY, JSON.stringify(d)); };
  const now = () => new Date().toISOString();

  const actions = {
    createOrigin(amount) {
      if (!(amount > 0)) return fail('Enter a Total Budget greater than 0');
      const id = uid();
      commit({ nodes: [{ id, name: 'Total Budget', parentId: null, balance: amount, px: WORLD / 2 - BOX.W / 2, py: TOP }],
        tx: [{ id: uid(), type: 'deposit', walletId: id, walletName: 'Total Budget', description: '', amount, date: now() }] });
      return ok;
    },
    addWallet(parentId, name, amount) {
      const { nodes } = ref.current;
      if (!name || !name.trim()) return fail('Give the wallet a name');
      if (!(amount >= 0)) return fail('Invalid amount');
      if (amount > unallocated(nodes, parentId)) return fail('Not enough unallocated money in the parent node');
      const par = nodes.find((x) => x.id === parentId);
      const sibs = childrenOf(nodes, parentId);
      let x = sibs.length ? Math.max(...sibs.map((c) => c.px)) + BOX.W + BOX.GX : par.px;
      const y = clampN(par.py + BOX.H + BOX.GY, 0, WORLD - BOX.H);
      while (nodes.some((o) => Math.abs(o.px - x) < BOX.W + 8 && Math.abs(o.py - y) < BOX.H + 8)) x += BOX.W + BOX.GX;
      x = clampN(x, 0, WORLD - BOX.W);
      commit({ ...ref.current, nodes: [...nodes, { id: uid(), name: name.trim(), parentId, balance: amount, px: x, py: y }] });
      return ok;
    },
    // Move money already inside the parent down into this wallet (no change to ancestors)
    allocate(id, amount) {
      const { nodes } = ref.current;
      const n = nodes.find((x) => x.id === id);
      if (!n || !n.parentId) return fail('Nothing to allocate to');
      if (!(amount > 0)) return fail('Enter an amount greater than 0');
      if (amount > unallocated(nodes, n.parentId)) return fail('Parent node does not have that much unallocated');
      commit({ ...ref.current, nodes: nodes.map((x) => (x.id === id ? { ...x, balance: x.balance + amount } : x)) });
      return ok;
    },
    // New money: adds to this wallet and every node above it, up to Total Budget
    deposit(id, amount) {
      const { nodes, tx } = ref.current;
      const n = nodes.find((x) => x.id === id);
      if (!n) return fail('Wallet not found');
      if (!(amount > 0)) return fail('Enter an amount greater than 0');
      const ids = chain(nodes, id);
      commit({ nodes: nodes.map((x) => (ids.includes(x.id) ? { ...x, balance: x.balance + amount } : x)),
        tx: [...tx, { id: uid(), type: 'deposit', walletId: id, walletName: n.name, description: '', amount, date: now() }] });
      return ok;
    },
    // Spend: deducts from this wallet and every node above it
    expense(id, description, amount) {
      const { nodes, tx } = ref.current;
      const n = nodes.find((x) => x.id === id);
      if (!n) return fail('Wallet not found');
      if (!description || !description.trim()) return fail('Describe what you spent on');
      if (!(amount > 0)) return fail('Enter an amount greater than 0');
      if (amount > n.balance) return fail('Not enough money in this wallet');
      const ids = chain(nodes, id);
      commit({ nodes: nodes.map((x) => (ids.includes(x.id) ? { ...x, balance: x.balance - amount } : x)),
        tx: [...tx, { id: uid(), type: 'expense', walletId: id, walletName: n.name, description: description.trim(), amount, date: now() }] });
      return ok;
    },
    moveNode(id, x, y) {
      const { nodes } = ref.current;
      commit({ ...ref.current, nodes: nodes.map((n) => (n.id === id
        ? { ...n, px: clampN(x, 0, WORLD - BOX.W), py: clampN(y, 0, WORLD - BOX.H) } : n)) });
    },
    arrange() {
      const pos = autoLayout(ref.current.nodes);
      commit({ ...ref.current, nodes: ref.current.nodes.map((n) => ({ ...n, px: pos[n.id].x, py: pos[n.id].y })) });
    },
    // Remove a wallet that has no sub-wallets. Its money simply returns to the parent's
    // unallocated pool, so no balance above it changes. History is kept.
    deleteWallet(id) {
      const { nodes } = ref.current;
      const n = nodes.find((x) => x.id === id);
      if (!n || !n.parentId) return fail('The Total Budget cannot be deleted');
      if (childrenOf(nodes, id).length) return fail('Delete its sub-wallets first');
      commit({ ...ref.current, nodes: nodes.filter((x) => x.id !== id) });
      return ok;
    },
    replaceAll(d) { commit(withPos(d)); },
    reset() { commit({ nodes: [], tx: [] }); },
  };

  if (!ready) return null;
  return <Ctx.Provider value={{ data, ...actions }}>{children}</Ctx.Provider>;
}