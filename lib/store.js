import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'nami-budget-v1';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const ok = { ok: true };
const fail = (error) => ({ ok: false, error });
const Ctx = createContext(null);
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

export function StoreProvider({ children }) {
  const [data, setData] = useState({ nodes: [], tx: [] });
  const [ready, setReady] = useState(false);
  const ref = useRef(data);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((raw) => {
      if (raw) { ref.current = JSON.parse(raw); setData(ref.current); }
      setReady(true);
    });
  }, []);

  const commit = (d) => { ref.current = d; setData(d); AsyncStorage.setItem(KEY, JSON.stringify(d)); };
  const now = () => new Date().toISOString();

  const actions = {
    createOrigin(amount) {
      if (!(amount > 0)) return fail('Enter a Total Budget greater than 0');
      const id = uid();
      commit({ nodes: [{ id, name: 'Total Budget', parentId: null, balance: amount }],
        tx: [{ id: uid(), type: 'deposit', walletId: id, walletName: 'Total Budget', description: '', amount, date: now() }] });
      return ok;
    },
    addWallet(parentId, name, amount) {
      const { nodes } = ref.current;
      if (!name || !name.trim()) return fail('Give the wallet a name');
      if (!(amount >= 0)) return fail('Invalid amount');
      if (amount > unallocated(nodes, parentId)) return fail('Not enough unallocated money in the parent node');
      commit({ ...ref.current, nodes: [...nodes, { id: uid(), name: name.trim(), parentId, balance: amount }] });
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
    replaceAll(d) { commit(d); },
    reset() { commit({ nodes: [], tx: [] }); },
  };

  if (!ready) return null;
  return <Ctx.Provider value={{ data, ...actions }}>{children}</Ctx.Provider>;
}
