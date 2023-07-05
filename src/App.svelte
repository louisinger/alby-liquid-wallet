<script lang="ts">
  import TransactionsTable from './components/TransactionsTable.svelte';
  import { utxos } from './stores/utxos';
  import { wallet } from './stores/wallet';
  import SendForm from './components/SendForm.svelte';
  import { transactions } from './stores/transactions';
  import Balances from './components/Balances.svelte';
</script>

<div class="container my-2">
  <div class="box">
    <div class="title">Alby Liquid wallet</div>
    {#if $wallet.address === undefined} <p>Connecting Alby...</p> {/if}
    {#if $wallet.address}
      <p class="is-size-7	has-text-primary is-family-code">{$wallet.address}</p>
    {/if}
  </div>

  <div class="box">
    <div class="columns">
      <div class="column is-full-mobile">
        <h2 class="title">Balances</h2>
        {#if $utxos.length === 0}
          <p>You don't own any Liquid asset.</p>
        {:else}
          <Balances />
        {/if}
      </div>

      <div class="column is-full-mobile">
        <SendForm />
      </div>
    </div>
  </div>

  <div class="box">
    <h2 class="title">Transactions</h2>
    {#if $transactions.length === 0}
      <p>Your transactions will appear here.</p>
    {:else}
      <TransactionsTable />
    {/if}
  </div>
</div>

<style src="./scss/main.scss" lang="scss" global>
  :global(html) {
    background-color: hsl(0, 0%, 86%);
  }
</style>
