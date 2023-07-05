import { derived } from 'svelte/store';
import { wallet } from './wallet';
import { WsElectrumChainSource } from '../port/electrum-chain-source';
import { ElectrumWS } from 'ws-electrumx-client';
import { address, networks } from 'liquidjs-lib';

export type Transactions = Array<{
  txID: string;
  hex: string;
}>;

export const transactions = derived<typeof wallet, Transactions>(
  wallet,
  ($wallet, set) => {
    if (!$wallet.address) {
      set([]);
      return;
    }

    const txIDs = new Set<string>();
    const transactions: Transactions = [];

    const update = async () => {
      if (!$wallet.address) return;
      const chainSource = new WsElectrumChainSource(
        new ElectrumWS($wallet.wsURL)
      );
      const script = address.toOutputScript($wallet.address, networks[$wallet.network]);

      const [history] = await chainSource.fetchHistories([script]);
      const allTxIDs = history.map((h) => h.tx_hash);
      const newTxIDs = allTxIDs.filter((ID) => !txIDs.has(ID));
      newTxIDs.forEach((ID) => txIDs.add(ID));
      if (newTxIDs.length === 0) return;

      const newTransactions = await chainSource.fetchTransactions(newTxIDs);
      transactions.push(...newTransactions);
      set(transactions);
      await chainSource.close();
    };

    update();
  },
  []
);
