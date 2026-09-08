export const config = {
  port: parseInt(process.env.PORT || '43216'),
  rpcUrl: process.env.ARC_TESTNET_RPC_URL || 'https://rpc.testnet.arc.network',
  factoryAddress: process.env.FACTORY_ADDRESS as `0x${string}` || '0x0000000000000000000000000000000000000000',
  chainId: 5042002,
  dbPath: process.env.DB_PATH || './data/spark.db',
}

export const FACTORY_ABI = [
  {
    type: 'function',
    name: 'getAllTokens',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getToken',
    inputs: [{ name: 'tokenAddr', type: 'address' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'token', type: 'address' },
          { name: 'curve', type: 'address' },
          { name: 'name', type: 'string' },
          { name: 'symbol', type: 'string' },
          { name: 'metadataURI', type: 'string' },
          { name: 'creator', type: 'address' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'graduated', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'TokenCreated',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'curve', type: 'address', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'symbol', type: 'string', indexed: false },
      { name: 'metadataURI', type: 'string', indexed: false },
    ],
  },
] as const

export const BONDING_CURVE_ABI = [
  {
    type: 'function',
    name: 'state',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'virtualUsdc', type: 'uint256' },
          { name: 'virtualTokens', type: 'uint256' },
          { name: 'realUsdcRaised', type: 'uint256' },
          { name: 'tokensSold', type: 'uint256' },
          { name: 'graduated', type: 'bool' },
          { name: 'pair', type: 'address' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getCurrentPrice',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getProgress',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getBuyQuote',
    inputs: [{ name: 'usdcIn', type: 'uint256' }],
    outputs: [
      { name: 'tokensOut', type: 'uint256' },
      { name: 'fee', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getSellQuote',
    inputs: [{ name: 'tokensIn', type: 'uint256' }],
    outputs: [
      { name: 'usdcOut', type: 'uint256' },
      { name: 'fee', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
] as const
