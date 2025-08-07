import type { Transaction } from '@iota/iota-sdk/transactions';

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
export type SerializedIotaSignPersonalMessageInput = {
  message: string;
};

/**
 * Input parameters for signing a transaction block.
 */
export type SerializedIotaSignTransactionBlockInput = {
  transaction: Transaction;
  chain: string;
};

/**
 * Input parameters for signing and executing a transaction block.
 */
export type SerializedIotaSignAndExecuteTransactionBlockInput = {
  transactionBlock: Transaction;
  chain: string;
  requestType?: 'WaitForEffectsCert' | 'WaitForLocalExecution';
  options?: {
    showBalanceChanges?: boolean;
    showObjectChanges?: boolean;
    showEvents?: boolean;
  };
};

/**
 * Input parameters for admin setting the fullnode URL.
 */
export type SerializedAdminSetFullnodeUrl = {
  network: 'mainnet' | 'testnet' | 'devnet' | 'localnet';
  url: string;
};

/**
 * Deserialize an Iota sign message input.
 * @param serialized - The serialized input.
 * @returns The deserialized input.
 */
export function deserializeIotaSignMessageInput(
  serialized: SerializedIotaSignPersonalMessageInput,
): { message: Uint8Array } {
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
): { transaction: Transaction; chain: string } {
  return {
    transaction: serialized.transaction,
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
): {
  transactionBlock: Transaction;
  chain: string;
  requestType?: 'WaitForEffectsCert' | 'WaitForLocalExecution';
  options?: {
    showBalanceChanges?: boolean;
    showObjectChanges?: boolean;
    showEvents?: boolean;
  };
} {
  const result: {
    transactionBlock: Transaction;
    chain: string;
    requestType?: 'WaitForEffectsCert' | 'WaitForLocalExecution';
    options?: {
      showBalanceChanges?: boolean;
      showObjectChanges?: boolean;
      showEvents?: boolean;
    };
  } = {
    transactionBlock: serialized.transactionBlock,
    chain: serialized.chain,
  };

  if (serialized.requestType !== undefined) {
    result.requestType = serialized.requestType;
  }

  if (serialized.options !== undefined) {
    result.options = serialized.options;
  }

  return result;
}

/**
 * Validate input parameters against a schema.
 * @param params - The parameters to validate.
 * @param schema - The schema to validate against.
 * @returns A tuple with the validation error (if any) and the validated params.
 */
export function validate<TData>(
  params: unknown,
  schema: (params: unknown) => TData,
): [Error | undefined, TData] {
  try {
    const result = schema(params);
    return [undefined, result];
  } catch (error) {
    return [
      error instanceof Error ? error : new Error('Validation failed'),
      {} as TData,
    ];
  }
}

/**
 * Validate SerializedIotaSignPersonalMessageInput with strict type checking.
 */
export const SerializedIotaSignPersonalMessageInput = (
  params: unknown,
): SerializedIotaSignPersonalMessageInput => {
  if (!params || typeof params !== 'object') {
    throw new Error('Invalid params: must be an object');
  }

  const obj = params as Record<string, unknown>;

  if (!obj.message || typeof obj.message !== 'string') {
    throw new Error('Invalid message: must be a base64 string');
  }

  // Validate base64 format
  try {
    Buffer.from(obj.message, 'base64');
  } catch {
    throw new Error('Invalid message: must be valid base64');
  }

  return { message: obj.message };
};

/**
 * Validate SerializedIotaSignTransactionBlockInput with strict type checking.
 */
export const SerializedIotaSignTransactionBlockInput = (
  params: unknown,
): SerializedIotaSignTransactionBlockInput => {
  if (!params || typeof params !== 'object') {
    throw new Error('Invalid params: must be an object');
  }

  const obj = params as Record<string, unknown>;

  if (!obj.transaction) {
    throw new Error('Invalid transaction: transaction is required');
  }

  if (!obj.chain || typeof obj.chain !== 'string') {
    throw new Error('Invalid chain: must be a string');
  }

  // Validate chain format
  const validChains = ['iota:mainnet', 'iota:testnet', 'iota:devnet', 'iota:localnet'];
  if (!validChains.includes(obj.chain)) {
    throw new Error(`Invalid chain: must be one of ${validChains.join(', ')}`);
  }

  return {
    transaction: obj.transaction as Transaction,
    chain: obj.chain,
  };
};

/**
 * Validate SerializedIotaSignAndExecuteTransactionBlockInput with strict type checking.
 */
export const SerializedIotaSignAndExecuteTransactionBlockInput = (
  params: unknown,
): SerializedIotaSignAndExecuteTransactionBlockInput => {
  if (!params || typeof params !== 'object') {
    throw new Error('Invalid params: must be an object');
  }

  const obj = params as Record<string, unknown>;

  if (!obj.transactionBlock) {
    throw new Error('Invalid transactionBlock: transactionBlock is required');
  }

  if (!obj.chain || typeof obj.chain !== 'string') {
    throw new Error('Invalid chain: must be a string');
  }

  // Validate chain format
  const validChains = ['iota:mainnet', 'iota:testnet', 'iota:devnet', 'iota:localnet'];
  if (!validChains.includes(obj.chain)) {
    throw new Error(`Invalid chain: must be one of ${validChains.join(', ')}`);
  }

  // Validate requestType if provided
  if (obj.requestType && typeof obj.requestType === 'string') {
    const validRequestTypes = ['WaitForEffectsCert', 'WaitForLocalExecution'];
    if (!validRequestTypes.includes(obj.requestType)) {
      throw new Error(`Invalid requestType: must be one of ${validRequestTypes.join(', ')}`);
    }
  }

  // Validate options if provided
  if (obj.options && typeof obj.options === 'object') {
    const options = obj.options as Record<string, unknown>;
    if (options.showBalanceChanges !== undefined && typeof options.showBalanceChanges !== 'boolean') {
      throw new Error('Invalid options.showBalanceChanges: must be boolean');
    }
    if (options.showObjectChanges !== undefined && typeof options.showObjectChanges !== 'boolean') {
      throw new Error('Invalid options.showObjectChanges: must be boolean');
    }
    if (options.showEvents !== undefined && typeof options.showEvents !== 'boolean') {
      throw new Error('Invalid options.showEvents: must be boolean');
    }
  }

  const result: SerializedIotaSignAndExecuteTransactionBlockInput = {
    transactionBlock: obj.transactionBlock as Transaction,
    chain: obj.chain,
  };

  if (obj.requestType !== undefined) {
    result.requestType = obj.requestType as 'WaitForEffectsCert' | 'WaitForLocalExecution';
  }

  if (obj.options !== undefined) {
    result.options = obj.options as {
      showBalanceChanges?: boolean;
      showObjectChanges?: boolean;
      showEvents?: boolean;
    };
  }

  return result;
};

/**
 * Validate SerializedAdminSetFullnodeUrl with strict type checking.
 */
export const SerializedAdminSetFullnodeUrl = (
  params: unknown,
): SerializedAdminSetFullnodeUrl => {
  if (!params || typeof params !== 'object') {
    throw new Error('Invalid params: must be an object');
  }

  const obj = params as Record<string, unknown>;

  if (!obj.network || typeof obj.network !== 'string') {
    throw new Error('Invalid network: must be a string');
  }

  const validNetworks = ['mainnet', 'testnet', 'devnet', 'localnet'];
  if (!validNetworks.includes(obj.network)) {
    throw new Error(`Invalid network: must be one of ${validNetworks.join(', ')}`);
  }

  if (!obj.url || typeof obj.url !== 'string') {
    throw new Error('Invalid url: must be a string');
  }

  // Basic URL format validation
  try {
    new URL(obj.url);
  } catch {
    throw new Error('Invalid url: must be a valid URL');
  }

  return {
    network: obj.network as 'mainnet' | 'testnet' | 'devnet' | 'localnet',
    url: obj.url,
  };
};
