<script lang="ts">
  import secp256k1 from '@vulpemventures/secp256k1-zkp';
  import classnames from 'classnames';
  import { form, field } from 'svelte-forms';
  import { required, min, pattern } from 'svelte-forms/validators';

  import DropdownAsset from './DropdownAsset.svelte';
  import { PsetBuilder } from '../application/pset';
  import { wallet } from '../stores/wallet';
  import { unblindedUtxos } from '../stores/utxos';
  import { AlbyLiquidProvider } from '../port/alby-provider';
  import { ElectrumWS } from 'ws-electrumx-client';
  import { WsElectrumChainSource } from '../port/electrum-chain-source';
  import type { Field } from 'svelte-forms/types';
  import { baseWebURL } from '../application/explorer';
  import { networks } from 'liquidjs-lib';

  let stepText = '';
  let isLoading = false;

  let lastBroadcastedTx = '';

  const amount = field('amount', '', [
    required(),
    pattern(new RegExp('')),
    min(0),
  ]);
  const address = field('address', '', [required()]);
  const asset = field('asset', '', [required()]);

  const makeInputClassnames = (field: Field<any>) =>
    classnames('input is-rounded', {
      'is-primary': !(isLoading || !$asset.value) && field.valid,
      'is-danger':
        !(isLoading || !$asset.value) &&
        (!field.valid || field.errors.length > 0),
    });

  const sendForm = form(amount, asset, address);

  const doSubmit = async () => {
    if (!$sendForm.valid) return;

    stepText = 'Creating transaction...';
    const psetBuilder = new PsetBuilder($wallet, await secp256k1());

    const { pset, selectedUtxos } = psetBuilder.createPset(
      parseInt($amount.value),
      $asset.value,
      $address.value,
      $unblindedUtxos,
      networks[$wallet.network].assetHash
    );

    stepText = 'Blinding transaction...';
    const blinded = psetBuilder.blindPset(pset, selectedUtxos);

    stepText = 'Signing transaction with Alby...';
    const alby = await AlbyLiquidProvider.enable();
    const transaction = await psetBuilder.signPset(blinded, alby);

    stepText = 'Broadcasting transaction...';
    const chainSource = new WsElectrumChainSource(
      new ElectrumWS($wallet.wsURL)
    );

    await chainSource.broadcastTransaction(transaction.toHex());

    stepText = 'Transaction sent! 🎉';
    lastBroadcastedTx = transaction.getId();
    sendForm.reset();
  };
</script>

<section>
  <h2 class="title">Send</h2>

  <div class="field is-horizontal">
    <div class="field-label is-normal">
      <label for="asset-input" class="label">Asset</label>
    </div>
    <div class="field-body">
      <div class="field">
        <p id="asset-input" class="control">
          <DropdownAsset bind:selectedAsset={$asset} />
        </p>
      </div>
    </div>
  </div>

  <div class="field is-horizontal">
    <div class="field-label is-normal">
      <label for="amount-input" class="label">Amount</label>
    </div>
    <div class="field-body">
      <div class="field">
        <p class={classnames('control', { 'is-loading': isLoading })}>
          <input
            id="amount-input"
            bind:value={$amount.value}
            class={makeInputClassnames($amount)}
            type="text"
            placeholder="amount in satoshis..."
            disabled={isLoading || !$asset.value}
          />
        </p>
      </div>
    </div>
  </div>

  <div class="field is-horizontal">
    <div class="field-label is-normal">
      <label for="address-input" class="label">To</label>
    </div>
    <div class="field-body">
      <div class="field">
        <p class={classnames('control', { 'is-loading': isLoading })}>
          <input
            id="address-input"
            bind:value={$address.value}
            class={makeInputClassnames($address)}
            type="text"
            placeholder="a valid Liquid address..."
            disabled={isLoading || !$asset.value}
          />
        </p>
      </div>
    </div>
  </div>

  <div class="is-flex is-flex-direction-row-reverse	is-justify-content-end">
    <div>
      <button
        disabled={!$sendForm.valid || isLoading || !$asset.value}
        on:click={() => {
          isLoading = true;
          doSubmit().finally(() => {
            isLoading = false;
            setTimeout(() => {
              stepText = '';
            }, 2000);
          });
        }}
        class="button is-primary">SIGN</button
      >
    </div>

    <div class="m-2">
      <p class="is-size-6">
        {stepText}
      </p>
    </div>
  </div>

  <div class="block">
    <p class="is-size-7">
      {#if lastBroadcastedTx}
        <a href={`${baseWebURL($wallet.network)}/tx/${lastBroadcastedTx}`}>
          {lastBroadcastedTx}
        </a>
      {/if}
    </p>
  </div>
</section>
