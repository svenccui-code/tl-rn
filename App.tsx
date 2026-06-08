import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, Text, Button, View } from 'react-native';
import { runBridgeSelfTest, Line } from './src/devtools/BridgeSelfTest';
import { runReadOnlySelfTest } from './src/devtools/ReadOnlySelfTest';
import { runEvmSignSelfTest } from './src/devtools/EvmSignSelfTest';
import { runTronSignSelfTest } from './src/devtools/TronSignSelfTest';

async function runAndLog(tag: string, fn: () => Promise<Line[]>, set: (l: Line[]) => void) {
  try {
    const lines = await fn();
    set(lines);
    const allOk = lines.every(l => l.ok);
    console.log(`${tag}_BEGIN`);
    lines.forEach(l => console.log(`${tag}_LINE ${l.ok ? 'PASS' : 'FAIL'} ${l.name} | ${l.detail}`));
    console.log(`${tag}_RESULT=${allOk ? 'ALL_PASS' : 'FAIL'}`);
    console.log(`${tag}_END`);
  } catch (e) {
    console.log(`${tag}_RESULT=ERROR ${String(e)}`);
  }
}

export default function App() {
  const [bridge, setBridge] = useState<Line[]>([]);
  const [readonly, setReadonly] = useState<Line[]>([]);
  const [evmSign, setEvmSign] = useState<Line[]>([]);
  const [tronSign, setTronSign] = useState<Line[]>([]);
  const runAll = () => {
    runAndLog('SELFTEST', runBridgeSelfTest, setBridge);
    runAndLog('READONLY', runReadOnlySelfTest, setReadonly);
    runAndLog('EVMSIGN', runEvmSignSelfTest, setEvmSign);
    runAndLog('TRONSIGN', runTronSignSelfTest, setTronSign);
  };
  useEffect(() => { runAll(); }, []);
  const render = (title: string, lines: Line[]) => (
    <View>
      <Text style={{ fontSize: 18, marginTop: 12 }}>
        {title}: {lines.length === 0 ? '…' : lines.every(l => l.ok) ? '✅ ALL PASS' : '❌ FAIL'}
      </Text>
      {lines.map((l, i) => (
        <Text key={i}>{l.ok ? '✅' : '❌'} {l.name}: {l.detail}</Text>
      ))}
    </View>
  );
  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <Button title="Re-run" onPress={runAll} />
      <ScrollView>
        {render('SecureKeyring', bridge)}
        {render('Read-only multichain', readonly)}
        {render('EVM sign golden', evmSign)}
        {render('TRON sign golden', tronSign)}
      </ScrollView>
    </SafeAreaView>
  );
}
