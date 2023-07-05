import {
  AssetHash,
  Blinder,
  Creator,
  Extractor,
  Finalizer,
  OwnedInput,
  Pset,
  Transaction,
  Updater,
  ZKPGenerator,
  ZKPValidator,
  address,
  confidential,
} from 'liquidjs-lib';
import type { Wallet } from '../stores/wallet';
import type { UnblindedOutpoint } from '../stores/utxos';
import type { LiquidProvider } from '../port/alby-provider';

function getValue(utxo: UnblindedOutpoint): number {
  return parseInt(utxo.blindingData.value, 10);
}

function getAsset(utxo: UnblindedOutpoint): string {
  return AssetHash.fromBytes(utxo.blindingData.asset).hex;
}

export class PsetBuilder {
  static FEE_AMOUNT = (factor = 1) => factor * 260; // TODO fee estimation

  private zkpValidator: ZKPValidator;

  constructor(
    private wallet: Wallet,
    private zkpLib: confidential.Confidential['zkp']
  ) {
    this.zkpValidator = new ZKPValidator(zkpLib);
  }

  createPset(
    amount: number,
    asset: string,
    toAddress: string,
    utxos: UnblindedOutpoint[],
    feeAssetID: string
  ): {
    pset: Pset;
    selectedUtxos: UnblindedOutpoint[];
  } {
    const pset = Creator.newPset();
    const fee = PsetBuilder.FEE_AMOUNT(
      1 + (asset === feeAssetID ? 0 : 0.7)
    );

    // coin selection for amount
    let selected = 0;
    const toSelectAmount =
      asset === feeAssetID ? amount + fee : amount;

    const selectedUtxos = utxos.reduce((acc, utxo) => {
      if (getAsset(utxo) !== asset) return acc;
      if (selected < toSelectAmount) {
        selected += getValue(utxo);
        acc.push(utxo);
      }
      return acc;
    }, [] as UnblindedOutpoint[]);

    if (selected < toSelectAmount)
      throw new Error(
        `Insuficient funds, need ${toSelectAmount} sats has ${selected} sats`
      );

    const change = selected - toSelectAmount;

    let changeForFee = 0;

    if (asset !== feeAssetID) {
      // coin selection for fee
      selected = 0;
      const selectedFeeUtxos = utxos.reduce((acc, utxo) => {
        if (getAsset(utxo) !== feeAssetID) return acc;
        if (selected < fee) {
          selected += getValue(utxo);
          acc.push(utxo);
        }
        return acc;
      }, [] as UnblindedOutpoint[]);

      if (selected < fee)
        throw new Error(
          `Insuficient funds, need ${fee} sats has ${selected} sats`
        );

      selectedUtxos.push(...selectedFeeUtxos);

      changeForFee = selected - fee;
    }

    const updater = new Updater(pset);

    // add inputs
    updater.addInputs(
      selectedUtxos.map((utxo) => ({
        txid: utxo.txID,
        txIndex: utxo.vout,
        explicitAsset: AssetHash.fromBytes(utxo.blindingData.asset).bytes,
        explicitAssetProof: utxo.output.rangeProof,
        explicitValue: getValue(utxo),
        explicitValueProof: utxo.output.surjectionProof,
        witnessUtxo: utxo.output,
        sighashType: Transaction.SIGHASH_DEFAULT,
      }))
    );

    const isConfidential = address.isConfidential(toAddress);
    // add outputs
    updater.addOutputs([
      {
        asset,
        amount,
        script: address.toOutputScript(toAddress),
        blinderIndex: isConfidential ? 0 : undefined,
        blindingPublicKey: isConfidential
          ? address.fromConfidential(toAddress).blindingKey
          : undefined,
      },
    ]);

    if (change > 0) {
      updater.addOutputs([
        {
          asset,
          amount: change,
          script: address.toOutputScript(this.wallet.address),
          blinderIndex: 0,
          blindingPublicKey: address.fromConfidential(this.wallet.address)
            .blindingKey,
        },
      ]);
    }

    if (changeForFee > 0) {
      updater.addOutputs([
        {
          asset: feeAssetID,
          amount: changeForFee,
          script: address.toOutputScript(this.wallet.address),
          blinderIndex: 0,
          blindingPublicKey: address.fromConfidential(this.wallet.address)
            .blindingKey,
        },
      ]);
    }

    // add fee output
    updater.addOutputs([
      {
        asset: feeAssetID,
        amount: fee,
      },
    ]);

    return {
      pset: updater.pset,
      selectedUtxos,
    };
  }

  blindPset(pset: Pset, selectedUtxos: UnblindedOutpoint[]): Pset {
    const ownedInputs: OwnedInput[] = selectedUtxos.map((utxo, index) => ({
      index,
      ...utxo.blindingData,
    }));

    const zkpGenerator = new ZKPGenerator(
      this.zkpLib,
      ZKPGenerator.WithOwnedInputs(ownedInputs)
    );

    const outputBlindingArgs = zkpGenerator.blindOutputs(
      pset,
      Pset.ECCKeysGenerator(this.zkpLib.ecc),
    );

    const blinder = new Blinder(
      pset,
      ownedInputs,
      this.zkpValidator,
      zkpGenerator
    );

    blinder.blindLast({ outputBlindingArgs });

    return blinder.pset;
  }

  async signPset(pset: Pset, provider: LiquidProvider): Promise<Transaction> {
    if (!this.wallet.address || !this.wallet.publicKey)
      throw new Error('Wallet not initialized');
    // add internal key to input owned by the wallet in order to "signal" LiquidProvider to sign it

    const updater = new Updater(pset);

    const walletScript = address.toOutputScript(this.wallet.address);
    const xOnlyPubKey = Buffer.from(this.wallet.publicKey, 'hex').subarray(1);

    for (const [index, input] of pset.inputs.entries()) {
      if (!input.witnessUtxo) continue;
      const script = input.witnessUtxo.script;
      if (script.equals(walletScript)) {
        updater.addInTapInternalKey(index, xOnlyPubKey);
      }
    }

    const signedPset = await provider.signPset(updater.pset.toBase64());
    const signed = Pset.fromBase64(signedPset);
    const finalizer = new Finalizer(signed);
    finalizer.finalize();

    return Extractor.extract(finalizer.pset);
  }
}
