import { readable } from 'svelte/store';
import { AlbyLiquidProvider } from '../port/alby-provider';

export type Wallet = {
  address?: string;
  publicKey?: string;
  blindingPrivateKey?: string;
  network: 'liquid' | 'testnet';
  wsURL: string;
};

function wsURLfromNetwork(n: 'liquid' | 'testnet'): string {
  switch (n) {
  case 'liquid':
    return 'wss://blockstream.info/liquid/electrum-websocket/api';
  case 'testnet':
    return 'wss://blockstream.info/liquidtestnet/electrum-websocket/api';
  default:
    throw new Error('invalid network');
  }
}

const initial: Wallet = {
  network: 'liquid',
  wsURL: wsURLfromNetwork('liquid'),
};

export const wallet = readable<Wallet>(initial, (set) => {
  AlbyLiquidProvider.enable().then((provider) => {
    provider.getAddress().then(({ address, blindingPrivateKey, publicKey }) => {
      if (!address || !blindingPrivateKey) return;
      const network = (address ?? '').startsWith('lq') ? 'liquid' : 'testnet';

      set({
        address,
        publicKey,
        blindingPrivateKey,
        network,
        wsURL: wsURLfromNetwork(network),
      });
    });
  });
});