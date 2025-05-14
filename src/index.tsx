import { SLIP10Node } from '@metamask/key-tree';
import { Box, Divider, Heading, Text } from '@metamask/snaps-sdk/jsx';
import type { OnRpcRequestHandler } from '@metamask/snaps-sdk';
import { blake2b } from '@noble/hashes/blake2b';
import { IotaClient } from '@iota/iota-sdk/client';
import {
  messageWithIntent,
  toSerializedSignature,
} from '@iota/iota-sdk/cryptography';
import {
  Ed25519Keypair,
  Ed25519PublicKey,
} from '@iota/iota-sdk/keypairs/ed25519';
import type { Keypair, SignatureWithBytes } from '@iota/iota-sdk/cryptography';
import { Transaction } from '@iota/iota-sdk/transactions';
import { toB64 } from '@iota/iota-sdk/utils';
import type {
  IotaSignAndExecuteTransactionOutput,
  IotaSignTransactionOutput,
} from '@iota/wallet-standard';

import {
  DryRunFailedError,
  InvalidParamsError,
  InvalidRequestMethodError,
  UserRejectionError,
} from './errors';
import {
  SerializedIotaSignAndExecuteTransactionBlockInput,
  SerializedIotaSignPersonalMessageInput,
  SerializedIotaSignTransactionBlockInput,
  SerializedAdminSetFullnodeUrl,
  deserializeIotaSignAndExecuteTransactionBlockInput,
  deserializeIotaSignMessageInput,
  deserializeIotaSignTransactionBlockInput,
  validate,
} from './types';
import type { SerializedIotaWalletAccount } from './types';
import {
  assertAdminOrigin,
  buildTransactionBlock as buildIotaTransactionBlock,
  calcTotalGasFeesDec as calcTotalIotaGasFeesDec,
  getFullnodeUrlForChain as getIotaFullnodeUrlForChain,
  getStoredState as getIotaStoredState,
  updateState as updateIotaState,
} from './util';
import type { BalanceChange as IotaBalanceChange } from './util';

/**
 * Derive the Ed25519 keypair from user's MetaMask seed phrase.
 * @returns The keypair.
 */
async function deriveKeypair() {
  const res = await snap.request({
    method: 'snap_getBip32Entropy',
    params: {
      path: ['m', "44'", "4218'"],
      curve: 'ed25519',
    },
  });

  let node = await SLIP10Node.fromJSON(res);
  node = await node.derive(["slip10:0'", "slip10:0'", "slip10:0'"]);

  if (!node.privateKeyBytes) {
    throw new Error('No private key found.');
  }

  return Ed25519Keypair.fromSecretKey(node.privateKeyBytes);
}

/**
 * Creates a serialized wallet account from a public key.
 * @param publicKey - The public key to create the account from.
 * @returns A serialized wallet account.
 */
function serializedWalletAccountForPublicKey(
  publicKey: Ed25519PublicKey,
): SerializedIotaWalletAccount {
  return {
    address: publicKey.toIotaAddress(),
    publicKey: publicKey.toBase64(),
    chains: ['iota:mainnet', 'iota:testnet', 'iota:devnet', 'iota:localnet'],
    features: [
      'iota:signAndExecuteTransactionBlock',
      'iota:signTransactionBlock',
      'iota:signPersonalMessage',
      'iota:signMessage',
    ],
  };
}

/**
 * Sign a message using the keypair with the `PersonalMessage` intent.
 * @param keypair - The keypair to sign with.
 * @param message - The message to sign.
 * @returns The signature with bytes.
 */
async function signMessage(
  keypair: Keypair,
  message: Uint8Array,
): Promise<SignatureWithBytes> {
  const data = messageWithIntent('PersonalMessage', message);
  const pubkey = keypair.getPublicKey();
  const digest = blake2b(data, { dkLen: 32 });
  const signature = await keypair.sign(digest);
  const signatureScheme = keypair.getKeyScheme();

  const serializedSignature = toSerializedSignature({
    signatureScheme,
    signature,
    publicKey: pubkey,
  });

  return {
    bytes: toB64(message),
    signature: serializedSignature,
  };
}

/**
 * Generate transaction block text descriptions.
 * @param txb - The transaction block.
 * @returns Array of transaction descriptions.
 */
function genTxBlockTransactionsText(txb: Transaction): string[] {
  const txStrings = [];

  try {
    // Try to use toJSON() to get a safe representation of the transaction
    const json = JSON.parse(JSON.stringify(txb));
    const commands = json?.data?.commands || [];

    commands.forEach((command: any) => {
      if (!command || !command.$kind) {
        txStrings.push('**Unknown** operation');
        return;
      }

      switch (command.$kind) {
        case 'MoveCall': {
          const target = `${command.package || ''}::${command.module || ''}::${command.function || ''}`;
          const parts = target.split('::');
          txStrings.push(`**Call** ${parts[0]}::${parts[1]}::**${parts[2]}**`);
          break;
        }
        case 'MergeCoins': {
          const sourceCount = command.sources?.length || 0;
          txStrings.push(`**Merge** (${sourceCount + 1}) coin objects`);
          break;
        }
        case 'SplitCoins': {
          const amountCount = command.amounts?.length || 0;
          txStrings.push(`**Split** a coin into (${amountCount}) objects`);
          break;
        }
        case 'TransferObjects': {
          const objectCount = command.objects?.length || 0;
          txStrings.push(`**Transfer** (${objectCount}) objects`);
          break;
        }
        case 'Publish':
          txStrings.push('**Publish** package');
          break;
        case 'MakeMoveVec':
          txStrings.push('**Make** Move vector');
          break;
        case 'Upgrade':
          txStrings.push('**Upgrade** package');
          break;
        default:
          txStrings.push(`**${command.$kind}** operation`);
      }
    });
  } catch (error) {
    // Fallback in case of any parsing errors
    txStrings.push('**Transaction** with multiple operations');
  }

  // If no operations were found, add a default message
  if (txStrings.length === 0) {
    txStrings.push('**Transaction** with operations');
  }

  return txStrings;
}

/**
 * Generate balance changes section for UI.
 * @param balanceChanges - Array of balance changes.
 * @returns UI elements for the balance changes section.
 */
function genBalanceChangesSection(
  balanceChanges: IotaBalanceChange[] | undefined,
) {
  if (!balanceChanges || balanceChanges.length === 0) {
    return [];
  }

  return [
    <Divider />,
    <Text>**Balance Changes:**</Text>,
    ...balanceChanges.map((change) => (
      <Text>{`${change.amount} ${change.symbol}`}</Text>
    )),
  ];
}

/**
 * Generate operations section for UI.
 * @param transaction - The transaction.
 * @returns UI elements for the operations section.
 */
function genOperationsSection(transaction: Transaction) {
  return [
    <Divider />,
    <Text>**Operations:**</Text>,
    ...genTxBlockTransactionsText(transaction).map((str, index) => (
      <Text>{`[${index + 1}] ${str}`}</Text>
    )),
  ];
}

/**
 * Handle incoming JSON-RPC requests sent through `wallet_invokeSnap`.
 * @param args - The request handler args as object.
 * @param args.origin - The origin of the request e.g. the website that
 * invoked the snap.
 * @param args.request - A validated JSON-RPC request object.
 * @returns The result of `snap_dialog`.
 * @throws If the request method is not valid for this snap.
 */
export const onRpcRequest: OnRpcRequestHandler = async ({
  origin,
  request,
}) => {
  switch (request.method) {
    case 'signPersonalMessage': {
      const [validationError, serialized] = validate(
        request.params,
        SerializedIotaSignPersonalMessageInput,
      );
      if (validationError !== undefined) {
        throw InvalidParamsError.asSimpleError(validationError.message);
      }
      const input = deserializeIotaSignMessageInput(serialized);

      const keypair = await deriveKeypair();

      let decodedMessage = new TextDecoder().decode(input.message);
      let info = `**${origin}** is requesting to sign the following message:`;
      /* eslint-disable-next-line no-control-regex */
      if (/[\x00-\x09\x0E-\x1F]/u.test(decodedMessage)) {
        decodedMessage = toB64(input.message);
        info = `**${origin}** is requesting to sign the following message (base64 encoded):`;
      }

      const response = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: (
            <Box>
              <Heading>Sign Message</Heading>
              <Text>{info}</Text>
              <Divider />
              <Text>{decodedMessage}</Text>
              <Divider />
            </Box>
          ),
        },
      });

      if (response !== true) {
        throw UserRejectionError.asSimpleError();
      }

      const signed = await signMessage(keypair, input.message);

      return signed;
    }

    case 'getAccounts': {
      const keypair = await deriveKeypair();
      return [serializedWalletAccountForPublicKey(keypair.getPublicKey())];
    }

    case 'signTransaction': {
      const [validationError, serialized] = validate(
        request.params,
        SerializedIotaSignTransactionBlockInput,
      );
      if (validationError !== undefined) {
        throw InvalidParamsError.asSimpleError(validationError.message);
      }
      const input = deserializeIotaSignTransactionBlockInput(serialized);

      const keypair = await deriveKeypair();
      const sender = keypair.getPublicKey().toIotaAddress();

      const result = await buildIotaTransactionBlock({
        chain: input.chain,
        transactionBlock: Transaction.from(input.transaction), // Type compatibility fix
        sender,
      });

      const balanceChangesSection = genBalanceChangesSection(
        result.balanceChanges,
      );
      const operationsSection = genOperationsSection(input.transaction as any); // Type compatibility fix

      if (result.isError) {
        let resultText = 'Dry run failed.';
        if (result.errorMessage) {
          resultText = `Dry run failed with the following error: **${result.errorMessage}**`;
        }

        await snap.request({
          method: 'snap_dialog',
          params: {
            type: 'alert',
            content: (
              <Box>
                <Heading>Transaction failed.</Heading>
                <Text>
                  **{origin}** is requesting to **sign** a transaction block for
                  **{input.chain}** but the **dry run failed**.
                </Text>
                {balanceChangesSection}
                {operationsSection}
                <Divider />
                <Text>{resultText}</Text>
              </Box>
            ),
          },
        });

        throw DryRunFailedError.asSimpleError(result.errorMessage);
      }

      const response = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: (
            <Box>
              <Heading>Sign a Transaction</Heading>
              <Text>
                **{origin}** is requesting to **sign** a transaction block for
                **{input.chain}**.
              </Text>
              <Text>
                Hint: you can manage your wallet at https://iotasnap.com/
              </Text>
              {balanceChangesSection}
              {operationsSection}
              <Divider />
              <Text>
                Estimated gas fees: **
                {calcTotalIotaGasFeesDec(result.dryRunRes as any)} IOTA**
              </Text>
            </Box>
          ),
        },
      });

      if (response !== true) {
        throw UserRejectionError.asSimpleError();
      }

      const signed = await keypair.signTransaction(
        result.transactionBlockBytes ?? new Uint8Array(),
      );

      const res: IotaSignTransactionOutput = {
        bytes: signed.bytes,
        signature: signed.signature,
      };

      return res;
    }

    case 'signAndExecuteTransaction': {
      const [validationError, serialized] = validate(
        request.params,
        SerializedIotaSignAndExecuteTransactionBlockInput,
      );
      if (validationError !== undefined) {
        throw InvalidParamsError.asSimpleError(validationError.message);
      }

      const input =
        deserializeIotaSignAndExecuteTransactionBlockInput(serialized);

      const url = await getIotaFullnodeUrlForChain(input.chain);
      const client = new IotaClient({ url });

      const keypair = await deriveKeypair();
      const sender = keypair.getPublicKey().toIotaAddress();
      const result = await buildIotaTransactionBlock({
        chain: input.chain,
        transactionBlock: input.transactionBlock as any, // Type compatibility fix
        sender,
      });

      const balanceChangesSection = genBalanceChangesSection(
        result.balanceChanges,
      );
      const operationsSection = genOperationsSection(
        input.transactionBlock as any,
      ); // Type compatibility fix

      if (result.isError) {
        let resultText = 'Dry run failed.';
        if (result.errorMessage) {
          resultText = `Dry run failed with the following error: **${result.errorMessage}**`;
        }

        await snap.request({
          method: 'snap_dialog',
          params: {
            type: 'alert',
            content: (
              <Box>
                <Heading>Transaction failed.</Heading>
                <Text>
                  **{origin}** is requesting to **execute** a transaction block
                  on **{input.chain}** but the **dry run failed**.
                </Text>
                {balanceChangesSection}
                {operationsSection}
                <Divider />
                <Text>{resultText}</Text>
              </Box>
            ),
          },
        });

        throw DryRunFailedError.asSimpleError(result.errorMessage);
      }

      const response = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: (
            <Box>
              <Heading>Approve a Transaction</Heading>
              <Text>
                **{origin}** is requesting to **execute** a transaction block on
                **{input.chain}**.
              </Text>
              <Text>
                Hint: you can manage your wallet at https://iotasnap.com/
              </Text>
              {balanceChangesSection}
              {operationsSection}
              <Divider />
              <Text>
                Estimated gas fees: **
                {calcTotalIotaGasFeesDec(result.dryRunRes as any)} IOTA**
              </Text>
            </Box>
          ),
        },
      });

      if (response !== true) {
        throw UserRejectionError.asSimpleError();
      }

      // Type casting to fix compatibility issues
      const res = await client.signAndExecuteTransaction({
        signer: keypair,
        transaction: input.transactionBlock as any,
        requestType: input.requestType,
        options: input.options,
      });
      // Use as any to bypass type checking for now since the SDK types have changed
      const ret = res as any as IotaSignAndExecuteTransactionOutput;

      return ret;
    }

    case 'admin_getStoredState': {
      assertAdminOrigin(origin);

      const ret = await getIotaStoredState();
      return ret;
    }

    case 'admin_setFullnodeUrl': {
      assertAdminOrigin(origin);

      const [validationError, params] = validate(
        request.params,
        SerializedAdminSetFullnodeUrl,
      );
      if (validationError !== undefined) {
        throw InvalidParamsError.asSimpleError(validationError.message);
      }

      const state = await getIotaStoredState();
      switch (params.network) {
        case 'mainnet':
          state.mainnetUrl = params.url;
          break;
        case 'testnet':
          state.testnetUrl = params.url;
          break;
        case 'devnet':
          state.devnetUrl = params.url;
          break;
        case 'localnet':
          state.localnetUrl = params.url;
          break;
        default:
          // No default action needed
          break;
      }
      await updateIotaState(state);

      return;
    }

    default:
      throw InvalidRequestMethodError.asSimpleError(request.method);
  }
};
