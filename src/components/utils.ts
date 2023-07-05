export function formatAsset(assetID: string) {
  return (assetID.slice(0, 4) + '...' + assetID.slice(-4)).toLocaleUpperCase();
}
