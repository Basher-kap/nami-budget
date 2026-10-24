import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { C } from '../lib/theme';

export const Card = ({ children, style }) => <View style={[s.card, style]}>{children}</View>;

export function Btn({ title, onPress, kind = 'primary', style }) {
  const bg = kind === 'primary' ? C.orange : kind === 'navy' ? C.navy : kind === 'danger' ? C.red : 'transparent';
  const color = kind === 'ghost' ? C.navy : '#fff';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: pressed ? 0.8 : 1 },
      kind === 'ghost' && { borderWidth: 2, borderColor: C.navy }, style]}>
      <Text style={{ color, fontWeight: '800' }}>{title}</Text>
    </Pressable>
  );
}

// fields: [{key,label,numeric}]; onSubmit(values) -> {ok,error?}
export function FormModal({ visible, title, subtitle, fields, onSubmit, onClose }) {
  const [vals, setVals] = useState({});
  const [err, setErr] = useState('');
  useEffect(() => { if (visible) { setVals({}); setErr(''); } }, [visible]);
  const go = () => {
    const parsed = {};
    fields.forEach((f) => { parsed[f.key] = f.numeric ? Number(vals[f.key] || 0) : vals[f.key]; });
    const r = onSubmit(parsed);
    if (r && !r.ok) setErr(r.error); else onClose();
  };
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.backdrop}>
        <View style={s.sheet}>
          <Text style={s.title}>{title}</Text>
          {!!subtitle && <Text style={{ color: C.muted, marginBottom: 8 }}>{subtitle}</Text>}
          {fields.map((f) => (
            <View key={f.key} style={{ marginTop: 8 }}>
              <Text style={s.label}>{f.label}</Text>
              <TextInput style={s.input} value={vals[f.key] || ''} autoFocus={f === fields[0]}
                keyboardType={f.numeric ? 'decimal-pad' : 'default'}
                onChangeText={(t) => setVals({ ...vals, [f.key]: t })} />
            </View>
          ))}
          {!!err && <Text style={{ color: C.red, marginTop: 8, fontWeight: '600' }}>{err}</Text>}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <Btn title="Cancel" kind="ghost" onPress={onClose} style={{ flex: 1 }} />
            <Btn title="Confirm" onPress={go} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 16, padding: 14, borderWidth: 2, borderColor: C.line },
  btn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center' },
  backdrop: { flex: 1, backgroundColor: '#10304Eaa', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: C.bg, borderRadius: 20, padding: 18, borderWidth: 3, borderColor: C.orange },
  title: { fontSize: 20, fontWeight: '900', color: C.navy },
  label: { fontSize: 12, fontWeight: '700', color: C.navy, marginBottom: 4 },
  input: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 2, borderColor: C.line, padding: 10, fontSize: 16 },
});
