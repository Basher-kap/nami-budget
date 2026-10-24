import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { C } from '../../lib/theme';

const rows = [['C', '⌫', '%', '÷'], ['7', '8', '9', '×'], ['4', '5', '6', '−'], ['1', '2', '3', '+'], ['0', '.', '=']];
const calc = (a, b, op) => {
  const r = op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : b === 0 ? NaN : a / b;
  return Number.isFinite(r) ? String(+r.toFixed(10)) : 'Error';
};

export default function Calculator() {
  const [cur, setCur] = useState('0');
  const [prev, setPrev] = useState(null);
  const [op, setOp] = useState(null);
  const [fresh, setFresh] = useState(false);

  const press = (k) => {
    if (cur === 'Error' && k !== 'C') return;
    if (/\d/.test(k)) { setCur(fresh || cur === '0' ? k : cur + k); setFresh(false); }
    else if (k === '.') { if (fresh) { setCur('0.'); setFresh(false); } else if (!cur.includes('.')) setCur(cur + '.'); }
    else if (k === 'C') { setCur('0'); setPrev(null); setOp(null); setFresh(false); }
    else if (k === '⌫') setCur(cur.length > 1 ? cur.slice(0, -1) : '0');
    else if (k === '%') setCur(String(parseFloat(cur) / 100));
    else if (k === '=') { if (op !== null) { setCur(calc(prev, parseFloat(cur), op)); setPrev(null); setOp(null); setFresh(true); } }
    else {
      let p = parseFloat(cur);
      if (op !== null && !fresh) { const r = calc(prev, p, op); setCur(r); p = parseFloat(r); }
      setPrev(p); setOp(k); setFresh(true);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, padding: 16, justifyContent: 'flex-end' }}>
      <View style={{ backgroundColor: C.navy, borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 3, borderColor: C.orange }}>
        <Text style={{ color: '#9FB3C8', textAlign: 'right', height: 20 }}>{prev !== null ? `${prev} ${op}` : ''}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: '#fff', fontSize: 52, fontWeight: '900', textAlign: 'right' }}>{cur}</Text>
      </View>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          {r.map((k) => {
            const isOp = '÷×−+='.includes(k);
            return (
              <Pressable key={k} onPress={() => press(k)}
                style={({ pressed }) => ({ flex: k === '0' ? 2 : 1, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: isOp ? C.orange : 'CE⌫%'.includes(k) ? C.gold : '#fff', borderWidth: 2, borderColor: C.line, opacity: pressed ? 0.7 : 1 })}>
                <Text style={{ fontSize: 24, fontWeight: '900', color: isOp ? '#fff' : C.navy }}>{k}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
