export function baseWebURL(network: 'liquid' | 'testnet') {
  return network === 'liquid'
    ? 'https://liquid.network'
    : 'https://liquid.network/testnet';
}
