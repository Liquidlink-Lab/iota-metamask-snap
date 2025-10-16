import { SLIP10Node } from '@metamask/key-tree';
import { Ed25519Keypair } from '@iota/iota-sdk/keypairs/ed25519';
import { IotaClient } from '@iota/iota-sdk/client';

async function getKeypair() {
  const res = await snap.request({
    method: 'snap_getBip32Entropy',
    params: { path: ['m', "44'", "4218'"], curve: 'ed25519' },
  });
  let node = await SLIP10Node.fromJSON(res);
  node = await node.derive(["slip10:0'", "slip10:0'", "slip10:0'"]);
  if (!node.privateKeyBytes) throw new Error('No private key found.');
  return Ed25519Keypair.fromSecretKey(node.privateKeyBytes);
}

export async function signPersonalMessage(message: Uint8Array) {
  const keypair = await getKeypair();
  return await keypair.signPersonalMessage(message);
}

export async function signTxBlock(transactionBlockBytes: Uint8Array) {
  const keypair = await getKeypair();
  return await keypair.signTransaction(transactionBlockBytes);
}

export async function getAccountInfo() {
  const keypair = await getKeypair();
  const publicKey = keypair.getPublicKey();
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

export async function signAndExecuteTransaction(client: IotaClient, transactionBlock: any, requestType: any, options: any) {
  const keypair = await getKeypair();
  return await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: transactionBlock,
    requestType,
    options,
  });
}