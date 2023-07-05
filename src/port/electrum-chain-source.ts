import { address, crypto } from 'liquidjs-lib';
import type { ElectrumWS } from 'ws-electrumx-client';
import type { ChainSource, TransactionHistory } from './chainsource';
import axios from 'axios';

const BroadcastTransaction = 'blockchain.transaction.broadcast'; // returns txid
const GetHistoryMethod = 'blockchain.scripthash.get_history';
const GetTransactionMethod = 'blockchain.transaction.get'; // returns hex string
const SubscribeStatusMethod = 'blockchain.scripthash'; // ElectrumWS automatically adds '.subscribe'
const GetRelayFeeMethod = 'blockchain.relayfee';

const MISSING_TRANSACTION = 'missingtransaction';
const MAX_FETCH_TRANSACTIONS_ATTEMPTS = 5;

function extractErrorMessage(
  error: unknown,
  defaultMsg = 'Unknown error'
): string {
  // if is already a string, return it
  if (typeof error === 'string') return error;

  // since AxiosError is an instance of Error, this should come first
  if (axios.isAxiosError(error)) {
    if (error.response) return error.response.data;
    if (error.request) return error.request.data;
  }

  // this should be last
  if (error instanceof Error) return error.message;

  return defaultMsg;
}

export class WsElectrumChainSource implements ChainSource {
  constructor(private ws: ElectrumWS) {}

  async fetchTransactions(txids: string[]): Promise<{ txID: string; hex: string }[]> {
    const requests = txids.map((txid) => ({ method: GetTransactionMethod, params: [txid] }));
    for (let i = 0; i < MAX_FETCH_TRANSACTIONS_ATTEMPTS; i++) {
      try {
        const responses = await this.ws.batchRequest<string[]>(...requests);
        return responses.map((hex, i) => ({ txID: txids[i], hex }));
      } catch (e) {
        if (extractErrorMessage(e).includes(MISSING_TRANSACTION)) {
          console.warn('missing transaction error, retrying');
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        throw e;
      }
    }
    throw new Error('Unable to fetch transactions: ' + txids);
  }

  async subscribeScriptStatus(
    script: Buffer,
    callback: (scripthash: string, status: string | null) => void
  ) {
    const scriptHash = toScriptHash(script);
    await this.ws.subscribe(
      SubscribeStatusMethod,
      (scripthash: unknown, status: unknown) => {
        if (scripthash === scriptHash) {
          callback(scripthash, status as string | null);
        }
      },
      scriptHash
    );
  }

  async fetchHistories(scripts: Buffer[]): Promise<TransactionHistory[]> {
    const scriptsHashes = scripts.map((s) => toScriptHash(s));
    const responses = await this.ws.batchRequest<TransactionHistory[]>(
      ...scriptsHashes.map((s) => ({ method: GetHistoryMethod, params: [s] }))
    );
    return responses;
  }

  async broadcastTransaction(hex: string): Promise<string> {
    return this.ws.request<string>(BroadcastTransaction, hex);
  }

  async getRelayFee(): Promise<number> {
    return this.ws.request<number>(GetRelayFeeMethod);
  }

  async close() {
    try {
      await this.ws.close('close');
    } catch (e) {
      console.debug('error closing ws:', e);
    }
  }

  async waitForAddressReceivesTx(addr: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.subscribeScriptStatus(address.toOutputScript(addr), (_, status) => {
        if (status !== null) {
          resolve();
        }
      }).catch(reject);
    });
  }
}

function toScriptHash(script: Buffer): string {
  return crypto.sha256(script).reverse().toString('hex');
}
