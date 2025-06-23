import { getFullnodeUrl, IotaClient } from '@iota/iota-sdk/client';
import type { Transaction } from '@iota/iota-sdk/transactions';
import type { DryRunTransactionBlockResponse } from '@iota/iota-sdk/client';
import decimal from 'decimal.js';

/**
 * State for the Iota snaps.
 */
export type SnapState = {
  mainnetUrl?: string;
  testnetUrl?: string;
  devnetUrl?: string;
  localnetUrl?: string;
};

/**
 * Balance change type.
 */
export type BalanceChange = {
  symbol: string;
  amount: string;
};

/**
 * Build transaction block result.
 */
export type BuildTransactionBlockResult = {
  isError: boolean;
  transactionBlockBytes?: Uint8Array;
  errorMessage?: string;
  dryRunRes?: DryRunTransactionBlockResponse;
  balanceChanges?: BalanceChange[];
};

/**
 * Default IOTA network URLs.
 */
const DEFAULT_MAINNET_URL = getFullnodeUrl('mainnet');
const DEFAULT_TESTNET_URL = getFullnodeUrl('testnet');
const DEFAULT_DEVNET_URL = getFullnodeUrl('devnet');
const DEFAULT_LOCALNET_URL = getFullnodeUrl('localnet');

/**
 * Assert that the request comes from an admin origin.
 * @param origin - The origin of the request.
 * @throws If the origin is not an admin origin.
 */
export function assertAdminOrigin(origin: string): void {
  if (origin !== 'https://iotasnap.com' && origin !== 'http://localhost:8000') {
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
    case 'iota:mainnet':
      return state.mainnetUrl ?? DEFAULT_MAINNET_URL;
    case 'iota:testnet':
      return state.testnetUrl ?? DEFAULT_TESTNET_URL;
    case 'iota:devnet':
      return state.devnetUrl ?? DEFAULT_DEVNET_URL;
    case 'iota:localnet':
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
    params: { operation: 'update', newState: state as Record<string, any> },
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

  const computationCost = new decimal(
    dryRunRes.effects.gasUsed.computationCost,
  );
  const storageCost = new decimal(dryRunRes.effects.gasUsed.storageCost);
  const storageRebate = new decimal(dryRunRes.effects.gasUsed.storageRebate);

  const totalGasFee = computationCost.plus(storageCost).minus(storageRebate);
  return totalGasFee.div(1e9).toString();
}

/**
 * Build a transaction block.
 * @param params - The parameters for building the transaction block.
 * @param params.chain - The chain to build the transaction block for.
 * @param params.transactionBlock - The transaction block to build.
 * @param params.sender - The sender of the transaction block.
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
    const client = new IotaClient({ url });

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
      const errorMessage = dryRunRes.effects?.status?.error ?? 'Unknown error';
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
          symbol: change.coinType.split('::').pop() ?? 'IOTA',
          amount: new decimal(change.amount).div(1e9).toString(),
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
