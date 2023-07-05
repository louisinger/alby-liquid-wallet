<script lang="ts">
  import classNames from 'classnames';

  import { balances } from '../stores/balances';
  import { formatAsset } from './utils';
  import type { Field } from 'svelte-forms/types';

  export let selectedAsset: Field<string>;

  let isActive = false;
  let assets = [];

  balances.subscribe((value) => {
    assets = Object.keys(value);
  });
</script>

<div
  class={classNames('dropdown is-primary', {
    'is-active': isActive,
  })}
>
  <div class="dropdown-trigger">
    <button
      on:click={() => (isActive = !isActive)}
      disabled={assets.length === 0}
      class="button"
      aria-haspopup="true"
      aria-controls="dropdown-menu"
    >
      <span
        >{assets.length > 0
          ? selectedAsset.value
            ? formatAsset(selectedAsset.value)
            : 'select an asset'
          : 'no coins to spend'}</span
      >
      <span class="icon is-small">
        <i class="fas fa-angle-down" aria-hidden="true" />
      </span>
    </button>
  </div>
  <div class="dropdown-menu" id="dropdown-menu" role="menu">
    {#if Object.keys($balances).length > 0}
      <div class="dropdown-content">
        {#each Object.keys($balances) as balanceAsset}
          <!-- svelte-ignore a11y-invalid-attribute -->
          <a
            href="#"
            class="is-size-7 dropdown-item"
            on:click={() => {
              selectedAsset.valid = true;
              selectedAsset.value = balanceAsset;
              isActive = false;
            }}
          >
            {balanceAsset} ({$balances[balanceAsset]} satoshis)
          </a>
        {/each}
      </div>
    {/if}
  </div>
</div>
