export interface ProviderInit { address: string; chainIdHex: string; }

// Returns a JS string injected into the WebView before page load. It defines an
// EIP-1193 window.ethereum that proxies request() to the RN host via postMessage,
// and resolves responses delivered back through window.__tlOnResponse.
export function buildEthereumProviderScript(init: ProviderInit): string {
  return `(function(){
  var ADDRESS = ${JSON.stringify(init.address)};
  var CHAIN_ID = ${JSON.stringify(init.chainIdHex)};
  var pending = {}; var nextId = 1;
  var listeners = {};
  function emit(ev, data){ (listeners[ev]||[]).forEach(function(f){ try{ f(data);}catch(e){} }); }
  window.__tlOnResponse = function(resp){
    var p = pending[resp.id]; if(!p) return; delete pending[resp.id];
    if(resp.error){ var e = new Error(resp.error.message); e.code = resp.error.code; p.reject(e); }
    else p.resolve(resp.result);
  };
  window.__tlEmit = function(ev, data){
    if(ev==='chainChanged'){ CHAIN_ID = data; }
    if(ev==='accountsChanged'){ ADDRESS = (data&&data[0])||ADDRESS; }
    emit(ev, data);
  };
  var provider = {
    isMetaMask: true,
    isTronLink: true,
    chainId: CHAIN_ID,
    selectedAddress: ADDRESS,
    request: function(args){
      var id = nextId++;
      return new Promise(function(resolve, reject){
        pending[id] = { resolve: resolve, reject: reject };
        window.ReactNativeWebView.postMessage(JSON.stringify({ id: id, method: args.method, params: args.params||[] }));
      });
    },
    on: function(ev, cb){ (listeners[ev]=listeners[ev]||[]).push(cb); return provider; },
    removeListener: function(ev, cb){ listeners[ev]=(listeners[ev]||[]).filter(function(f){return f!==cb;}); return provider; },
    enable: function(){ return provider.request({ method: 'eth_requestAccounts' }); }
  };
  provider.send = function(m, p){ return provider.request({ method: m, params: p }); };
  provider.sendAsync = function(payload, cb){
    provider.request(payload).then(function(r){ cb(null,{ id: payload.id, jsonrpc:'2.0', result: r }); })
      .catch(function(e){ cb(e); });
  };
  window.ethereum = provider;
  function announce(){
    window.dispatchEvent(new CustomEvent('eip6963:announceProvider', {
      detail: Object.freeze({ info: { uuid: '6e1f2d2a-tlrn', name: 'TronLink', icon: 'data:image/svg+xml,', rdns: 'org.tronlink' }, provider: provider })
    }));
  }
  window.addEventListener('eip6963:requestProvider', announce); announce();
  window.dispatchEvent(new Event('ethereum#initialized'));
})(); true;`;
}
