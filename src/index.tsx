import { Box, Divider, Heading, Text } from '@metamask/snaps-sdk/jsx';
import type { OnRpcRequestHandler } from '@metamask/snaps-sdk';
import { IotaClient } from '@iota/iota-sdk/client';
import { Transaction } from '@iota/iota-sdk/transactions';
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
import {
  buildTransactionBlock,
  calcTotalGasFeesDec,
  getFullnodeUrlForChain,
  getStoredState,
  updateState,
} from './util';
import { signPersonalMessage, signTxBlock, getAccountInfo, signAndExecuteTransaction } from './keypair-ops';
import { genBalanceChangesSection, genOperationsSection } from './iota-utils';

export const onRpcRequest: OnRpcRequestHandler = async ({ origin, request }) => {
  switch (request.method) {
    case 'signPersonalMessage': {
      const [validationError, serialized] = validate(request.params, SerializedIotaSignPersonalMessageInput);
      if (validationError !== undefined) {
        throw InvalidParamsError.asSimpleError(validationError.message);
      }
      const input = deserializeIotaSignMessageInput(serialized);
      let decodedMessage = new TextDecoder().decode(input.message);
      let info = `**${origin}** is requesting to sign the following message:`;
      if (/[\p{Cc}\p{Cf}]/u.test(decodedMessage)) {
        decodedMessage = Buffer.from(input.message).toString('base64');
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
      const signed = await signPersonalMessage(input.message);
      return signed;
    }

    case 'getAccounts': {
      return [await getAccountInfo()];
    }

    case 'signTransaction': {
      const [validationError, serialized] = validate(request.params, SerializedIotaSignTransactionBlockInput);
      if (validationError !== undefined) {
        throw InvalidParamsError.asSimpleError(validationError.message);
      }
      const input = deserializeIotaSignTransactionBlockInput(serialized);
      const account = await getAccountInfo();
      const sender = account.address;
      const result = await buildTransactionBlock({
        chain: input.chain,
        transactionBlock: Transaction.from(input.transaction),
        sender,
      });
      const balanceChangesSection = genBalanceChangesSection(result.balanceChanges);
      const operationsSection = genOperationsSection(input.transaction as any);
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
                <Text>**{origin}** is requesting to **sign** a transaction block for **{input.chain}** but the **dry run failed**.</Text>
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
      const gasFeeText = result.dryRunRes ? calcTotalGasFeesDec(result.dryRunRes as any) : 'Unable to estimate';
      const gasFeeDisplay = gasFeeText === '0' ? '0 IOTA (free transaction)' : gasFeeText === 'Unable to estimate' ? 'Unable to estimate gas fees' : `${gasFeeText} IOTA`;
      const response = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: (
            <Box>
              <Heading>Sign a Transaction</Heading>
              <Text>**{origin}** is requesting to **sign** a transaction block for **{input.chain}**.</Text>
              <Text>Hint: you can manage your wallet through your dApp interface</Text>
              {balanceChangesSection}
              {operationsSection}
              <Divider />
              <Text>Estimated gas fees: **{gasFeeDisplay}**</Text>
            </Box>
          ),
        },
      });
      if (response !== true) {
        throw UserRejectionError.asSimpleError();
      }
      const signed = await signTxBlock(result.transactionBlockBytes ?? new Uint8Array());
      const res: IotaSignTransactionOutput = {
        bytes: signed.bytes,
        signature: signed.signature,
      };
      return res;
    }

    case 'signAndExecuteTransaction': {
      const [validationError, serialized] = validate(request.params, SerializedIotaSignAndExecuteTransactionBlockInput);
      if (validationError !== undefined) {
        throw InvalidParamsError.asSimpleError(validationError.message);
      }
      const input = deserializeIotaSignAndExecuteTransactionBlockInput(serialized);
      const url = await getFullnodeUrlForChain(input.chain);
      const client = new IotaClient({ url });
      const result = await buildTransactionBlock({
        chain: input.chain,
        transactionBlock: input.transactionBlock as any,
        sender: (await getAccountInfo()).address,
      });
      const balanceChangesSection = genBalanceChangesSection(result.balanceChanges);
      const operationsSection = genOperationsSection(input.transactionBlock as any);
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
                <Text>**{origin}** is requesting to **execute** a transaction block on **{input.chain}** but the **dry run failed**.</Text>
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
      const gasFeeText = result.dryRunRes ? calcTotalGasFeesDec(result.dryRunRes as any) : 'Unable to estimate';
      const gasFeeDisplay = gasFeeText === '0' ? '0 IOTA (free transaction)' : gasFeeText === 'Unable to estimate' ? 'Unable to estimate gas fees' : `${gasFeeText} IOTA`;
      const response = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: (
            <Box>
              <Heading>Approve a Transaction</Heading>
              <Text>**{origin}** is requesting to **execute** a transaction block on **{input.chain}**.</Text>
              <Text>Hint: you can manage your wallet through your dApp interface</Text>
              {balanceChangesSection}
              {operationsSection}
              <Divider />
              <Text>Estimated gas fees: **{gasFeeDisplay}**</Text>
            </Box>
          ),
        },
      });
      if (response !== true) {
        throw UserRejectionError.asSimpleError();
      }
      const res = await signAndExecuteTransaction(
        client,
        Transaction.from(result.transactionBlockBytes ?? new Uint8Array()),
        input.requestType,
        input.options,
      );
      const ret = res as any as IotaSignAndExecuteTransactionOutput;
      return ret;
    }

    default:
      throw InvalidRequestMethodError.asSimpleError(request.method);
  }
};