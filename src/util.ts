import { SuiClient } from '@mysten/sui/client';
import type { Transaction } from '@mysten/sui/transactions';
import type { DryRunTransactionBlockResponse } from '@mysten/sui/client';
import Decimal from 'decimal.js';

/**
 * State for the Sui snaps.
 */
export interface SnapState {
  mainnetUrl?: string;
  testnetUrl?: string;
  devnetUrl?: string;
  localnetUrl?: string;
}

/**
 * Balance change interface.
 */
export interface BalanceChange {
  symbol: string;
  amount: string;
}

/**
 * Build transaction block result.
 */
export interface BuildTransactionBlockResult {
  isError: boolean;
  transactionBlockBytes?: Uint8Array;
  errorMessage?: string;
  dryRunRes?: DryRunTransactionBlockResponse;
  balanceChanges?: BalanceChange[];
}

/**
 * Default Sui network URLs.
 */
const DEFAULT_MAINNET_URL = 'https://fullnode.mainnet.sui.io:443';
const DEFAULT_TESTNET_URL = 'https://fullnode.testnet.sui.io:443';
const DEFAULT_DEVNET_URL = 'https://fullnode.devnet.sui.io:443';
const DEFAULT_LOCALNET_URL = 'http://127.0.0.1:9000';

/**
 * Assert that the request comes from an admin origin.
 * @param origin - The origin of the request.
 * @throws If the origin is not an admin origin.
 */
export function assertAdminOrigin(origin: string): void {
  if (origin !== 'https://suisnap.com' && origin !== 'http://localhost:8000') {
    throw new Error('Unauthorized: Admin-only method');
  }
}

/**
 * Get the fullnode URL for a specific chain.
 * @param chain - The chain to get the URL for.
 * @returns The fullnode URL.
 */
export async function getFullnodeUrlForChain(chain: string): Promise<string> {
  const state = await getStoredState();

  switch (chain) {
    case 'sui:mainnet':
      return state.mainnetUrl ?? DEFAULT_MAINNET_URL;
    case 'sui:testnet':
      return state.testnetUrl ?? DEFAULT_TESTNET_URL;
    case 'sui:devnet':
      return state.devnetUrl ?? DEFAULT_DEVNET_URL;
    case 'sui:localnet':
      return state.localnetUrl ?? DEFAULT_LOCALNET_URL;
    default:
      throw new Error(`Unsupported chain: ${chain}`);
  }
}

/**
 * Get the stored state from the snap.
 * @returns The stored state.
 */
export async function getStoredState(): Promise<SnapState> {
  const state = await snap.request({
    method: 'snap_manageState',
    params: { operation: 'get' },
  });

  return (state as SnapState) ?? {};
}

/**
 * Update the stored state in the snap.
 * @param state - The new state to store.
 */
export async function updateState(state: SnapState): Promise<void> {
  await snap.request({
    method: 'snap_manageState',
    params: { operation: 'update', newState: state },
  });
}

/**
 * Calculate the total gas fees in decimal format.
 * @param dryRunRes - The dry run transaction block response.
 * @returns The total gas fees in decimal format.
 */
export function calcTotalGasFeesDec(
  dryRunRes: DryRunTransactionBlockResponse,
): string {
  if (!dryRunRes?.effects?.gasUsed) {
    return '0';
  }

  const computationCost = new Decimal(
    dryRunRes.effects.gasUsed.computationCost,
  );
  const storageCost = new Decimal(dryRunRes.effects.gasUsed.storageCost);
  const storageRebate = new Decimal(dryRunRes.effects.gasUsed.storageRebate);

  const totalGasFee = computationCost.plus(storageCost).minus(storageRebate);
  return totalGasFee.div(1e9).toString();
}

/**
 * Build a transaction block.
 * @param params - The parameters for building the transaction block.
 * @returns The result of building the transaction block.
 */
export async function buildTransactionBlock(params: {
  chain: string;
  transactionBlock: Transaction;
  sender: string;
}): Promise<BuildTransactionBlockResult> {
  const { chain, transactionBlock, sender } = params;

  try {
    const url = await getFullnodeUrlForChain(chain);
    const client = new SuiClient({ url });

    // Set the sender on the transaction if not already set
    if (!transactionBlock.getData().sender) {
      transactionBlock.setSender(sender);
    }

    // Build the transaction block bytes
    const transactionBlockBytes = await transactionBlock.build({ client });

    // Dry run the transaction block
    const dryRunRes = await client.dryRunTransactionBlock({
      transactionBlock: transactionBlockBytes,
    });

    // Handle error in dry run
    if (dryRunRes.effects?.status?.status !== 'success') {
      const errorMessage = dryRunRes.effects?.status?.error || 'Unknown error';
      return {
        isError: true,
        transactionBlockBytes,
        errorMessage,
        dryRunRes,
      };
    }

    // Extract balance changes
    let balanceChanges: BalanceChange[] = [];
    if (dryRunRes.balanceChanges) {
      balanceChanges = dryRunRes.balanceChanges
        .filter((change) => change.owner === `0x${sender}`)
        .map((change) => ({
          symbol: change.coinType.split('::').pop() || 'SUI',
          amount: new Decimal(change.amount).div(1e9).toString(),
        }));
    }

    return {
      isError: false,
      transactionBlockBytes,
      dryRunRes,
      balanceChanges,
    };
  } catch (error) {
    return {
      isError: true,
      errorMessage: (error as Error).message,
    };
  }
}
