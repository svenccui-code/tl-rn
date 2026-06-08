export interface TronUnsignedTx {
  txID: string;
  raw_data: any;
  raw_data_hex: string;
  visible: boolean;
}

export interface TronSignedTx extends TronUnsignedTx {
  signature: string[];
}

export interface Endpoints {
  primary: string;
  fallback: string[];
}
