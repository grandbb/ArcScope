const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const ganache = require('ganache');
const { createPublicClient, createWalletClient, custom, defineChain, decodeEventLog, encodeFunctionData } = require('viem');

const generated = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/generated/garc.ts'), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText)(generated, generated.exports);
const { garcAbi, garcBytecode, garcRuntimeBytecode } = generated.exports;

test('compiled contract deploys, records real EVM events and per-wallet counts, and rejects value', async () => {
  const provider = ganache.provider({ logging: { quiet: true }, chain: { chainId: 5042, hardfork: 'shanghai' }, wallet: { totalAccounts: 2 } });
  try {
    const chain = defineChain({ id: 5042, name: 'Local Arc contract test', nativeCurrency: { name: 'Test', symbol: 'TEST', decimals: 18 }, rpcUrls: { default: { http: ['http://localhost'] } } });
    const publicClient = createPublicClient({ chain, transport: custom(provider) });
    const wallet = createWalletClient({ chain, transport: custom(provider) });
    const [first, second] = await wallet.getAddresses();
    const deployGas = await publicClient.estimateGas({ account: first, data: garcBytecode });
    const hash = await wallet.deployContract({ account: first, abi: garcAbi, bytecode: garcBytecode, gas: deployGas + deployGas / 5n });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    assert.equal(receipt.status, 'success');
    const address = receipt.contractAddress;
    assert.ok(address);
    assert.equal((await publicClient.getCode({ address })).toLowerCase(), garcRuntimeBytecode.toLowerCase());
    const read = (functionName, args) => publicClient.readContract({ address, abi: garcAbi, functionName, args });
    assert.equal((await read('deployer')).toLowerCase(), first.toLowerCase());
    assert.equal(await read('totalGreetings'), 0n);
    for (const account of [first, first, second]) {
      const gas = await publicClient.estimateContractGas({ account, address, abi: garcAbi, functionName: 'greet' });
      const txHash = await wallet.writeContract({ account, address, abi: garcAbi, functionName: 'greet', gas: gas + gas / 5n });
      const mined = await publicClient.waitForTransactionReceipt({ hash: txHash });
      assert.equal(mined.status, 'success');
      const event = decodeEventLog({ abi: garcAbi, eventName: 'Garc', ...mined.logs[0] });
      assert.equal(event.args.wallet.toLowerCase(), account.toLowerCase());
      assert.equal(event.args.message, 'gARC | AScope');
      assert.equal(event.args.walletCount, await read('greetings', [account]));
      assert.equal(event.args.totalCount, await read('totalGreetings'));
      assert.equal(event.args.timestamp, await read('lastGreetingAt', [account]));
    }
    assert.equal(await read('greetings', [first]), 2n);
    assert.equal(await read('greetings', [second]), 1n);
    assert.equal(await read('totalGreetings'), 3n);
    await assert.rejects(publicClient.estimateGas({ account: first, to: address, value: 1n, data: encodeFunctionData({ abi: garcAbi, functionName: 'greet' }) }));
    assert.equal(await publicClient.getBalance({ address }), 0n);
  } finally { await provider.disconnect(); }
});

test('constructor rejects deployment outside Arc Mainnet chain ID', async () => {
  const provider = ganache.provider({ logging: { quiet: true }, chain: { chainId: 1 } });
  try {
    const publicClient = createPublicClient({ transport: custom(provider) });
    const [account] = await provider.request({ method: 'eth_accounts', params: [] });
    await assert.rejects(publicClient.estimateGas({ account, data: garcBytecode }));
  } finally { await provider.disconnect(); }
});
