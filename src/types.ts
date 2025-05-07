import type { Transaction } from '@mysten/sui/transactions';

/**
 * Serialized wallet account type for the snap.
 */
export interface SerializedIotaWalletAccount {
  address: string;
  publicKey: string;
  chains: string[];
  features: string[];
}

/**
 * Input parameters for signing a personal message.
 */
export interface SerializedIotaSignPersonalMessageInput {
  message: string;
}

/**
 * Input parameters for signing a transaction block.
 */
export interface SerializedIotaSignTransactionBlockInput {
  transactionBlock: Transaction;
  chain: string;
}

/**
 * Input parameters for signing and executing a transaction block.
 */
export interface SerializedIotaSignAndExecuteTransactionBlockInput {
  transactionBlock: Transaction;
  chain: string;
  requestType?: 'WaitForEffectsCert' | 'WaitForLocalExecution';
  options?: {
    showBalanceChanges?: boolean;
    showObjectChanges?: boolean;
    showEvents?: boolean;
  };
}

/**
 * Input parameters for admin setting the fullnode URL.
 */
export interface SerializedAdminSetFullnodeUrl {
  network: 'mainnet' | 'testnet' | 'devnet' | 'localnet';
  url: string;
}

/**
 * Deserialize an Iota sign message input.
 * @param serialized - The serialized input.
 * @returns The deserialized input.
 */
export function deserializeIotaSignMessageInput(
  serialized: SerializedIotaSignPersonalMessageInput,
) {
  return {
    message: new Uint8Array(Buffer.from(serialized.message, 'base64')),
  };
}

/**
 * Deserialize an Iota sign transaction block input.
 * @param serialized - The serialized input.
 * @returns The deserialized input.
 */
export function deserializeIotaSignTransactionBlockInput(
  serialized: SerializedIotaSignTransactionBlockInput,
) {
  return {
    transactionBlock: serialized.transactionBlock,
    chain: serialized.chain,
  };
}

/**
 * Deserialize an Iota sign and execute transaction block input.
 * @param serialized - The serialized input.
 * @returns The deserialized input.
 */
export function deserializeIotaSignAndExecuteTransactionBlockInput(
  serialized: SerializedIotaSignAndExecuteTransactionBlockInput,
) {
  return {
    transactionBlock: serialized.transactionBlock,
    chain: serialized.chain,
    requestType: serialized.requestType,
    options: serialized.options,
  };
}

/**
 * Validate input parameters against a schema.
 * @param params - The parameters to validate.
 * @param schema - The schema to validate against.
 * @returns A tuple with the validation error (if any) and the validated params.
 */
export function validate<T>(
  params: unknown,
  schema: any,
): [Error | undefined, T] {
  try {
    // This is a simplified version since we don't know the exact validation library
    // you might be using. If you're using zod, you would use schema.parse(params)
    const result = schema(params) as T;
    return [undefined, result];
  } catch (error) {
    return [
      error instanceof Error ? error : new Error('Validation failed'),
      {} as T,
    ];
  }
}

// Add mock validator functions for the schema types
// Replace these with your actual validation logic
export const SerializedIotaSignPersonalMessageInput = (
  params: unknown,
): SerializedIotaSignPersonalMessageInput =>
  params as SerializedIotaSignPersonalMessageInput;

export const SerializedIotaSignTransactionBlockInput = (
  params: unknown,
): SerializedIotaSignTransactionBlockInput =>
  params as SerializedIotaSignTransactionBlockInput;

export const SerializedIotaSignAndExecuteTransactionBlockInput = (
  params: unknown,
): SerializedIotaSignAndExecuteTransactionBlockInput =>
  params as SerializedIotaSignAndExecuteTransactionBlockInput;

export const SerializedAdminSetFullnodeUrl = (
  params: unknown,
): SerializedAdminSetFullnodeUrl => params as SerializedAdminSetFullnodeUrl;
