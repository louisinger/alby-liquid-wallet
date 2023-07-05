export type TransactionHistory = Array<{
  tx_hash: string;
  height: number;
}>;

export interface ChainSource {
  fetchHistories(scripts: Buffer[]): Promise<TransactionHistory[]>;
  fetchTransactions(txids: string[]): Promise<{ txID: string; hex: string }[]>;
  broadcastTransaction(hex: string): Promise<string>;
  getRelayFee(): Promise<number>;
  waitForAddressReceivesTx(addr: string): Promise<void>;
  close(): Promise<void>;
}
