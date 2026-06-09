import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { container } from '../../state/container';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateWallet'>;

export function CreateWalletScreen({ navigation }: Props) {
  const [walletRef, setWalletRef] = useState('');
  const [words, setWords] = useState<string[]>([]);
  const [acked, setAcked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    container.keyring.createWallet().then(({ walletRef, mnemonic }) => {
      if (!active) return;
      setWalletRef(walletRef);
      setWords(mnemonic.trim().split(/\s+/));
    });
    return () => { active = false; };
  }, []);

  const onContinue = async () => {
    if (!walletRef) return;
    setBusy(true);
    await container.keyring.finalizeWallet(walletRef);
    navigation.replace('WalletHome');
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Your Recovery Phrase</Text>
      <Text style={styles.warn}>Write these 12 words down in order and keep them somewhere safe. Anyone with this phrase can access your wallet.</Text>
      <View style={styles.grid}>
        {words.map((w, i) => (
          <View key={i} style={styles.cell}>
            <Text style={styles.cellIdx}>{i + 1}</Text>
            <Text style={styles.cellWord}>{w}</Text>
          </View>
        ))}
      </View>
      <Pressable style={styles.ackRow} onPress={() => setAcked(a => !a)}>
        <View style={[styles.checkbox, acked && styles.checkboxOn]}>
          {acked ? <Text style={styles.check}>✓</Text> : null}
        </View>
        <Text style={styles.ackText}>I have written down my recovery phrase</Text>
      </Pressable>
      <Pressable
        style={[styles.btn, (!acked || !walletRef || busy) && styles.btnDisabled]}
        disabled={!acked || !walletRef || busy}
        onPress={onContinue}>
        <Text style={styles.btnText}>Continue</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF', padding: 20, paddingTop: 80 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1A212B' },
  warn: { fontSize: 13, color: '#9BA4B6', marginTop: 8, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 20, gap: 10 },
  cell: { width: '47%', flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAFAFB', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 12, gap: 8 },
  cellIdx: { fontSize: 13, color: '#9BA4B6', width: 20 },
  cellWord: { fontSize: 15, color: '#1A212B', fontWeight: '600' },
  ackRow: { flexDirection: 'row', alignItems: 'center', marginTop: 28, gap: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: '#9BA4B6', alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: '#1A212B', borderColor: '#1A212B' },
  check: { color: '#FFFFFF', fontSize: 13 },
  ackText: { fontSize: 14, color: '#1A212B', flex: 1 },
  btn: { height: 54, borderRadius: 10, backgroundColor: '#1A212B', alignItems: 'center', justifyContent: 'center', marginTop: 'auto' },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 16, fontWeight: 'bold', color: '#FFFFFF' },
});
