import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, Text, Button, View } from 'react-native';
import { runBridgeSelfTest, Line } from './src/devtools/BridgeSelfTest';

async function runAndLog(setLines: (l: Line[]) => void) {
  try {
    const lines = await runBridgeSelfTest();
    setLines(lines);
    const allOk = lines.every(l => l.ok);
    console.log('SELFTEST_BEGIN');
    lines.forEach(l => console.log(`SELFTEST_LINE ${l.ok ? 'PASS' : 'FAIL'} ${l.name} | ${l.detail}`));
    console.log(`SELFTEST_RESULT=${allOk ? 'ALL_PASS' : 'FAIL'}`);
    console.log('SELFTEST_END');
  } catch (e) {
    console.log(`SELFTEST_RESULT=ERROR ${String(e)}`);
  }
}

export default function App() {
  const [lines, setLines] = useState<Line[]>([]);
  const allOk = lines.length > 0 && lines.every(l => l.ok);
  useEffect(() => { runAndLog(setLines); }, []);
  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <Button title="Run SecureKeyring Self-Test" onPress={() => runAndLog(setLines)} />
      <Text style={{ fontSize: 22, marginVertical: 12 }}>
        {lines.length === 0 ? '…' : allOk ? '✅ ALL PASS' : '❌ FAIL'}
      </Text>
      <ScrollView>
        {lines.map((l, i) => (
          <View key={i} style={{ paddingVertical: 4 }}>
            <Text>{l.ok ? '✅' : '❌'} {l.name}: {l.detail}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
