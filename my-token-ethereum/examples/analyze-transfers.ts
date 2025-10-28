import { request, gql } from 'graphql-request';

type OrderDirection = 'asc' | 'desc';

interface Transfer {
  id: string;
  from: string;
  to: string;
  value: string;
  blockNumber: string;
  blockTimestamp: string;
  transactionHash: string;
}

interface TransfersResponse {
  transfers: Transfer[];
}

const DEFAULT_URL =
  'https://api.studio.thegraph.com/query/YOUR-ID/YOUR-SUBGRAPH/version/latest';

const GET_TRANSFERS = gql`
  query GetTransfers(
    $first: Int
    $skip: Int
    $orderBy: Transfer_orderBy
    $orderDirection: OrderDirection
  ) {
    transfers(
      first: $first
      skip: $skip
      orderBy: $orderBy
      orderDirection: $orderDirection
    ) {
      id
      from
      to
      value
      blockNumber
      blockTimestamp
      transactionHash
    }
  }
`;

const SIX_DECIMALS = 6n;
const DECIMAL_MULTIPLIER = 10n ** SIX_DECIMALS;

interface AddressStats {
  sentCount: number;
  receivedCount: number;
  sentVolume: bigint;
  receivedVolume: bigint;
}

function ensureStats(stats: Map<string, AddressStats>, address: string): AddressStats {
  const lower = address.toLowerCase();
  let value = stats.get(lower);
  if (!value) {
    value = { sentCount: 0, receivedCount: 0, sentVolume: 0n, receivedVolume: 0n };
    stats.set(lower, value);
  }
  return value;
}

function formatUsdc(value: bigint): string {
  const whole = value / DECIMAL_MULTIPLIER;
  const fraction = value % DECIMAL_MULTIPLIER;
  return `${whole}.${fraction.toString().padStart(Number(SIX_DECIMALS), '0')}`;
}

export async function getTransfers(
  subgraphUrl: string,
  first = 20,
  skip = 0,
  orderDirection: OrderDirection = 'desc'
): Promise<Transfer[]> {
  const data = await request<TransfersResponse>(subgraphUrl, GET_TRANSFERS, {
    first,
    skip,
    orderBy: 'blockTimestamp',
    orderDirection,
  });

  return data.transfers;
}

export function analyzeTransfers(transfers: Transfer[]) {
  const addressStats = new Map<string, AddressStats>();
  let totalVolume = 0n;

  for (const transfer of transfers) {
    const amount = BigInt(transfer.value);
    totalVolume += amount;

    const senderStats = ensureStats(addressStats, transfer.from);
    senderStats.sentCount += 1;
    senderStats.sentVolume += amount;

    const receiverStats = ensureStats(addressStats, transfer.to);
    receiverStats.receivedCount += 1;
    receiverStats.receivedVolume += amount;
  }

  const topSenders = [...addressStats.entries()]
    .filter(([, stats]) => stats.sentCount > 0)
    .sort(([, a], [, b]) => {
      if (a.sentVolume === b.sentVolume) return 0;
      return b.sentVolume > a.sentVolume ? 1 : -1;
    })
    .slice(0, 3)
    .map(([address, stats]) => ({
      address,
      transfers: stats.sentCount,
      volume: formatUsdc(stats.sentVolume),
    }));

  const topReceivers = [...addressStats.entries()]
    .filter(([, stats]) => stats.receivedCount > 0)
    .sort(([, a], [, b]) => {
      if (a.receivedVolume === b.receivedVolume) return 0;
      return b.receivedVolume > a.receivedVolume ? 1 : -1;
    })
    .slice(0, 3)
    .map(([address, stats]) => ({
      address,
      transfers: stats.receivedCount,
      volume: formatUsdc(stats.receivedVolume),
    }));

  return {
    totalTransfers: transfers.length,
    totalVolumeUsdc: formatUsdc(totalVolume),
    uniqueAddresses: addressStats.size,
    topSenders,
    topReceivers,
  };
}

async function main() {
  const subgraphUrl =
    process.argv[2] ??
    process.env.SUBGRAPH_URL ??
    DEFAULT_URL;

  if (subgraphUrl.includes('YOUR-ID')) {
    console.error(
      'Please provide a real Subgraph Studio URL via the first CLI argument or SUBGRAPH_URL environment variable.'
    );
    process.exit(1);
  }

  const first = Number(process.env.TRANSFER_COUNT ?? '25');

  try {
    const transfers = await getTransfers(subgraphUrl, first);
    if (transfers.length === 0) {
      console.log('No transfers returned for the current query window.');
      return;
    }

    const summary = analyzeTransfers(transfers);

    console.log(`Analyzed ${summary.totalTransfers} transfers (latest first).`);
    console.log(`Total volume: ${summary.totalVolumeUsdc} USDC`);
    console.log(`Unique addresses involved: ${summary.uniqueAddresses}`);
    console.log('\nTop senders by volume:');
    summary.topSenders.forEach((entry, index) => {
      console.log(
        `${index + 1}. ${entry.address} — ${entry.volume} USDC across ${entry.transfers} transfers`
      );
    });
    console.log('\nTop receivers by volume:');
    summary.topReceivers.forEach((entry, index) => {
      console.log(
        `${index + 1}. ${entry.address} — ${entry.volume} USDC across ${entry.transfers} transfers`
      );
    });
  } catch (error) {
    console.error('Failed to fetch transfers:', error);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}
