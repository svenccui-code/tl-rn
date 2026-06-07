import React, { useRef } from 'react';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { buildEthereumProviderScript } from '../evm/provider-inject';
import { handleEvmRequest, EvmDappContext } from './evmRequestRouter';
import type { ProviderResponse } from '../evm/providerProtocol';

export function EvmDappWebView({ uri, ctx }: { uri: string; ctx: EvmDappContext }) {
  const ref = useRef<WebView>(null);
  const injected = buildEthereumProviderScript({ address: ctx.address, chainIdHex: ctx.chainIdHex });

  const onMessage = async (e: WebViewMessageEvent) => {
    let req: { id: number; method: string; params: any[] };
    try { req = JSON.parse(e.nativeEvent.data); } catch { return; }
    const resp: ProviderResponse = { id: req.id };
    try { resp.result = await handleEvmRequest(req.method, req.params || [], ctx); }
    catch (err: any) { resp.error = { code: err?.code ?? -32603, message: err?.message ?? 'error' }; }
    ref.current?.injectJavaScript(`window.__tlOnResponse(${JSON.stringify(resp)}); true;`);
  };

  return (
    <WebView
      ref={ref}
      source={{ uri }}
      injectedJavaScriptBeforeContentLoaded={injected}
      onMessage={onMessage}
    />
  );
}
