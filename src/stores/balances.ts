import { derived } from 'svelte/store';
import { UnblindedOutpoint, unblindedUtxos } from './utxos';
import { AssetHash } from 'liquidjs-lib';

type Balances = Record<string, number>; // { asset: amount (in sats) }

function computeBalances(utxos: UnblindedOutpoint[]): Balances {
  const balances = {};

  for (const utxo of utxos) {
    const asset = AssetHash.fromBytes(utxo.blindingData.asset).hex;
    const value = parseInt(utxo.blindingData.value, 10);

    if (balances[asset] === undefined) {
      balances[asset] = 0;
    }

    balances[asset] += value;
  }

  return balances;
}

export const balances = derived<typeof unblindedUtxos, Balances>(
  unblindedUtxos,
  ($unblindedUtxos) => computeBalances($unblindedUtxos),
  {}
);
