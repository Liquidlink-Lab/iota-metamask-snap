import { Divider, Text } from '@metamask/snaps-sdk/jsx';
import { Transaction } from '@iota/iota-sdk/transactions';

export function genTxBlockTransactionsText(txb: Transaction): string[] {
  const txStrings: string[] = [];
  try {
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
    txStrings.push('**Transaction** with multiple operations');
  }
  if (txStrings.length === 0) {
    txStrings.push('**Transaction** with operations');
  }
  return txStrings;
}

export function genBalanceChangesSection(balanceChanges: any[] | undefined) {
  if (!balanceChanges || balanceChanges.length === 0) return [];
  return [
    <Divider />,
    <Text>Balance Changes:</Text>,
    ...balanceChanges.map((change) => (
      <Text>{`${change.amount} ${change.symbol}`}</Text>
    )),
  ];
}

export function genOperationsSection(transaction: Transaction) {
  return [
    <Divider />,
    <Text>**Operations:**</Text>,
    ...genTxBlockTransactionsText(transaction).map((str, index) => (
      <Text>{`[${index + 1}] ${str}`}</Text>
    )),
  ];
}