import zkpLib from '@vulpemventures/secp256k1-zkp';

import { derived } from 'svelte/store';
import { Transactions, transactions } from './transactions';
import { wallet } from './wallet';
import {
  AssetHash,
  ElementsValue,
  Transaction,
  TxOutput,
  address,
  confidential,
  networks,
} from 'liquidjs-lib';

type Outpoint = {
  txID: string;
  vout: number;
  output: TxOutput;
};

export type UnblindedOutpoint = Outpoint & {
  blindingData: confidential.UnblindOutputResult;
};

function computeUtxos(walletScripts: Buffer[], txs: Transactions): Outpoint[] {
  const outpointsInInputs = new Set<string>();
  const walletOutputs = new Set<string>();

  const outputsMap = new Map<string, TxOutput>();

  const transactions = txs.map((tx) => Transaction.fromHex(tx.hex));
  for (const tx of transactions) {
    for (const input of tx.ins) {
      outpointsInInputs.add(
        `${Buffer.from(input.hash).reverse().toString('hex')}:${input.index}`
      );
    }
    for (let i = 0; i < tx.outs.length; i++) {
      if (!walletScripts.find((script) => script.equals(tx.outs[i].script)))
        continue;
      const id = `${tx.getId()}:${i}`;
      walletOutputs.add(id);
      outputsMap.set(id, tx.outs[i]);
    }
  }

  const utxosOutpoints = Array.from(walletOutputs)
    .filter((outpoint) => !outpointsInInputs.has(outpoint))
    .map((outpoint) => {
      const [txid, vout] = outpoint.split(':');
      return {
        txID: txid,
        vout: Number(vout),
        output: outputsMap.get(outpoint),
      };
    });

  return utxosOutpoints;
}

export const utxos = derived(
  [transactions, wallet],
  ([$transactions, $wallet]) => {
    if (!$wallet.address) return [];

    const walletScripts = [$wallet.address].map((addr) => {
      return address.toOutputScript(addr, networks[$wallet.network]);
    });

    return computeUtxos(walletScripts, $transactions);
  },
  []
);

function createConfLib(tinysecp256k1: confidential.Confidential['zkp']) {
  return new confidential.Confidential(tinysecp256k1);
}

const ZERO = Buffer.alloc(32).fill(0);

export const unblindedUtxos = derived<
  [typeof utxos, typeof wallet],
  UnblindedOutpoint[]
>([utxos, wallet], ([$utxos, $wallet], set) => {
  if (!$utxos || $utxos.length === 0 || !$wallet.blindingPrivateKey) {
    set([]);
    return;
  }

  const blindKey = Buffer.from($wallet.blindingPrivateKey, 'hex');

  zkpLib()
    .then(createConfLib)
    .then((confLib) => {
      return $utxos.map((utxo) => {
        if (!ElementsValue.fromBytes(utxo.output.value).isConfidential) {
          return {
            ...utxo,
            blindingData: {
              assetBlindingFactor: ZERO,
              valueBlindingFactor: ZERO,
              asset: AssetHash.fromBytes(utxo.output.asset).bytesWithoutPrefix,
              value: ElementsValue.fromBytes(
                utxo.output.value
              ).number.toString(),
            },
          };
        }

        const blindingData = confLib.unblindOutputWithKey(
          utxo.output,
          blindKey
        );
        return { ...utxo, blindingData };
      });
    })
    .then(set);
});
