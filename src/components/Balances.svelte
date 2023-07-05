<script lang="ts">
  import { baseWebURL } from '../application/explorer';
  import { balances } from '../stores/balances';
  import { wallet } from '../stores/wallet';
  import { formatAsset } from './utils';

  function makeLink(assetID: string) {
    const baseURL = baseWebURL($wallet.network) + '/assets/asset';
    return `${baseURL}/${assetID}`;
  }
</script>

<section>
  {#each Object.entries($balances) as [asset, amount]}
    <div class="is-flex">
      <div class=""><a href={makeLink(asset)}>{formatAsset(asset)}</a></div>
      <div class="ml-3">{amount} sats</div>
    </div>
  {/each}
</section>
