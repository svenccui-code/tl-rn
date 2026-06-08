export type AppEvents = {
  'wallet/added': { walletRef: string };
  'wallet/locked': undefined;
  'account/selected': { caip10: string };
  'chain/switched': { caip2: string };
  'tx/submitted': { caip2: string; hash: string };
  'tx/confirmed': { caip2: string; hash: string; success: boolean };
};
