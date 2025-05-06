import type { Transaction } from '@mysten/sui/transactions';
import type { z } from 'zod';

/**
 * Serialized wallet account type for the snap.
 */
export interface SerializedWalletAccount {
  address: string;
  publicKey: string;
  chains: string[];
  features: string[];
}

/**
 * Input parameters for signing a personal message.
 */
export interface SerializedSuiSignPersonalMessageInput {
  message: string;
}

/**
 * Input parameters for signing a transaction block.
 */
export interface SerializedSuiSignTransactionBlockInput {
  transactionBlock: Transaction;
  chain: string;
}

/**
 * Input parameters for signing and executing a transaction block.
 */
export interface SerializedSuiSignAndExecuteTransactionBlockInput {
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
 * Deserialize a Sui sign message input.
 * @param serialized - The serialized input.
 * @returns The deserialized input.
 */
export function deserializeSuiSignMessageInput(
  serialized: SerializedSuiSignPersonalMessageInput,
) {
  return {
    message: new Uint8Array(Buffer.from(serialized.message, 'base64')),
  };
}

/**
 * Deserialize a Sui sign transaction block input.
 * @param serialized - The serialized input.
 * @returns The deserialized input.
 */
export function deserializeSuiSignTransactionBlockInput(
  serialized: SerializedSuiSignTransactionBlockInput,
) {
  return {
    transactionBlock: serialized.transactionBlock,
    chain: serialized.chain,
  };
}

/**
 * Deserialize a Sui sign and execute transaction block input.
 * @param serialized - The serialized input.
 * @returns The deserialized input.
 */
export function deserializeSuiSignAndExecuteTransactionBlockInput(
  serialized: SerializedSuiSignAndExecuteTransactionBlockInput,
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
export const SerializedSuiSignPersonalMessageInput = (
  params: unknown,
): SerializedSuiSignPersonalMessageInput =>
  params as SerializedSuiSignPersonalMessageInput;

export const SerializedSuiSignTransactionBlockInput = (
  params: unknown,
): SerializedSuiSignTransactionBlockInput =>
  params as SerializedSuiSignTransactionBlockInput;

export const SerializedSuiSignAndExecuteTransactionBlockInput = (
  params: unknown,
): SerializedSuiSignAndExecuteTransactionBlockInput =>
  params as SerializedSuiSignAndExecuteTransactionBlockInput;

export const SerializedAdminSetFullnodeUrl = (
  params: unknown,
): SerializedAdminSetFullnodeUrl => params as SerializedAdminSetFullnodeUrl;
