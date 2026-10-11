const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const viem = require('viem');

function load(file, dependencies = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function('require', 'module', 'exports', code)(name => dependencies[name] ?? require(name), module, module.exports);
  return module.exports;
}
const artifact = load('lib/generated/garc.ts');
const garc = load('lib/garc.ts', { './generated/garc': artifact });
const address = '0x1111111111111111111111111111111111111111';
const contract = '0x2222222222222222222222222222222222222222';
const hash = `0x${'a'.repeat(64)}`;
const client = () => ({ getChainId: async () => 5042, getCode: async () => artifact.garcRuntimeBytecode, estimateGas: async () => 80000n });
const eventLog = () => ({ address: contract,
  topics: viem.encodeEventTopics({ abi: artifact.garcAbi, eventName: 'Garc', args: { wallet: address } }),
  data: viem.encodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }, { type: 'string' }], [1n, 1n, 123n, garc.GARC_MESSAGE]) });

test('zero-value greet call targets the verified contract on Arc Mainnet', async () => {
  const request = await garc.prepareGarc(address, contract, client());
  assert.equal(request.chainId, 5042);
  assert.equal(request.to, contract);
  assert.equal(request.account, address);
  assert.equal(request.value, 0n);
  assert.equal(viem.decodeFunctionData({ abi: artifact.garcAbi, data: request.data }).functionName, 'greet');
  assert.equal(request.gas, 96000n);
});

test('wrong RPC network and unverified target code cannot reach estimation', async () => {
  const rpc = client(); let estimated = false;
  rpc.estimateGas = async () => { estimated = true; return 1n; };
  rpc.getChainId = async () => 5042002;
  await assert.rejects(garc.prepareGarc(address, contract, rpc), /network mismatch/);
  rpc.getChainId = async () => 5042; rpc.getCode = async () => '0xef0100';
  await assert.rejects(garc.prepareGarc(address, contract, rpc), /verified ArcScope/);
  rpc.getCode = async () => '0x';
  await assert.rejects(garc.prepareGarc(address, contract, rpc), /verified ArcScope/);
  assert.equal(estimated, false);
});

test('gas estimation failure is surfaced before requesting a signature', async () => {
  await assert.rejects(garc.prepareGarc(address, contract, { ...client(), estimateGas: async () => { throw Error('insufficient funds'); } }), /insufficient funds/);
});

test('Remix metadata may differ but executable contract code must match', async () => {
  const runtime = artifact.garcRuntimeBytecode;
  const changedMetadata = runtime.slice(0, -12) + '11' + runtime.slice(-10);
  await garc.verifyGarcContract(contract, { ...client(), getCode: async () => changedMetadata });
  const changedCode = '0x00' + runtime.slice(4);
  await assert.rejects(garc.verifyGarcContract(contract, { ...client(), getCode: async () => changedCode }), /verified ArcScope/);
});

test('owner Remix runtime is accepted while modified executable code is rejected', async () => {
  const runtime = artifact.garcRemixRuntimeBytecode;
  await garc.verifyGarcContract(contract, { ...client(), getCode: async () => runtime });
  await garc.verifyGarcContract(contract, { ...client(), getCode: async () => runtime.slice(0, -12) + '11' + runtime.slice(-10) });
  await assert.rejects(garc.verifyGarcContract(contract, { ...client(), getCode: async () => '0x00' + runtime.slice(4) }), /verified ArcScope/);
});

test('cancelled/replaced transactions cannot count as confirmed gARC', () => {
  const greeting = { from: address, to: contract, value: 0n, input: garc.garcTransaction(address, contract).data };
  assert.equal(garc.isGarcTransaction(greeting, address, contract), true);
  for (const modified of [{ input: '0x' }, { to: null }, { from: contract }, { value: 1n }]) {
    assert.equal(garc.isGarcTransaction({ ...greeting, ...modified }, address, contract), false);
  }
});

function harness(options = {}) {
  const states = []; const refs = []; let cursor = 0, refCursor = 0;
  const events = []; let receiptOptions;
  const Component = load('components/shared/GarcButton.tsx', {
    react: {
      useState: initial => { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = value; }]; },
      useRef: initial => { const index = refCursor++; return refs[index] ??= { current: initial }; },
      useEffect: (effect, deps) => { if (deps.length === 0) effect(); },
    },
    '@rainbow-me/rainbowkit': { useConnectModal: () => ({ openConnectModal: () => events.push('connect') }) },
    wagmi: {
      useAccount: () => ({ address, isConnected: true, chainId: options.chainId ?? 5042 }),
      usePublicClient: () => options.client ?? client(),
      useSwitchChain: () => ({ switchChainAsync: async args => { events.push(['switch', args]); if (options.rejectSwitch) throw Error('User rejected switch'); } }),
      useSendTransaction: () => ({ sendTransactionAsync: async request => { events.push(['send', request]); if (options.rejectSend) throw Error('User rejected transaction'); return hash; } }),
      useWaitForTransactionReceipt: args => { receiptOptions = args; return { data: args.hash ? options.receipt : undefined, isError: !!args.hash && !!options.receiptError, refetch: async () => events.push('refetch') }; },
    },
    '@/lib/garc': { ...garc, GARC_CONTRACT_ADDRESS: options.useMainnetContract ? garc.GARC_MAINNET_CONTRACT_ADDRESS : contract },
    '@/lib/generated/garc': artifact,
    '@/stores/useGarcStore': { useGarcStore: selector => selector({ contract }) },
    '@/lib/chains': { arcMainnet: { id: 5042, blockExplorers: { default: { url: 'https://explorer.arc.io' } } } },
    '@/components/ui/button': { Button: 'button' },
    '@/components/ui/dialog': Object.fromEntries(['Dialog', 'DialogContent', 'DialogDescription', 'DialogHeader', 'DialogTitle'].map(name => [name, 'section'])),
  }).GarcButton;
  function nodes(element) { if (!element || typeof element !== 'object') return []; return [element, ...[element.props?.children].flat(Infinity).flatMap(nodes)]; }
  function render() { cursor = refCursor = 0; Component(); cursor = refCursor = 0; return nodes(Component()); }
  return { events, render, get receiptOptions() { return receiptOptions; } };
}

test('switches wrong wallet network before sending; locks repeated submissions', async () => {
  const h = harness({ chainId: 1 });
  const send = h.render().find(node => node.type === 'button' && node.props.children === 'Send gARC · network fee only').props.onClick;
  send(); send();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(h.events.map(event => event[0]), ['switch', 'send']);
  assert.equal(h.events[1][1].chainId, 5042);
  const rendered = h.render();
  assert.equal(h.receiptOptions.chainId, 5042);
  assert.equal(h.receiptOptions.hash, hash);
  assert.ok(rendered.some(node => node.props?.children === 'Submitted. Waiting for Arc confirmation…'));
  assert.ok(!rendered.some(node => node.props?.children === 'gARC confirmed on Arc Mainnet.'));
});

test('shared owner contract wins over a previously saved browser address', async () => {
  const h = harness({ useMainnetContract: true });
  h.render().find(node => node.type === 'button' && node.props.children === 'Send gARC · network fee only').props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(garc.GARC_MAINNET_CONTRACT_ADDRESS, '0x582d4b53f1b261f73a343fcc9137ba9772e6eb50');
  assert.equal(h.events.find(event => event[0] === 'send')[1].to, garc.GARC_MAINNET_CONTRACT_ADDRESS);
});

test('wallet rejection keeps confirmation absent and allows retry', async () => {
  const h = harness({ rejectSend: true });
  h.render().find(node => node.type === 'button' && node.props.children === 'Send gARC · network fee only').props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  const rendered = h.render();
  assert.ok(rendered.some(node => node.props?.role === 'alert' && node.props.children === 'User rejected transaction'));
  assert.equal(h.receiptOptions.hash, undefined);
  assert.ok(rendered.some(node => node.type === 'button' && node.props.children === 'Send gARC · network fee only' && !node.props.disabled));
});

test('network switch rejection prevents the transaction request', async () => {
  const h = harness({ chainId: 1, rejectSwitch: true });
  h.render().find(node => node.type === 'button' && node.props.children === 'Send gARC · network fee only').props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(h.events.map(event => event[0]), ['switch']);
});

test('confirmation uses the mined receipt and excludes a cancelled replacement', async () => {
  const replacementHash = `0x${'b'.repeat(64)}`;
  const options = { receipt: { status: 'success', transactionHash: replacementHash, logs: [eventLog()] } };
  const h = harness(options);
  h.render().find(node => node.type === 'button' && node.props.children === 'Send gARC · network fee only').props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(h.render().some(node => node.props?.children === 'gARC confirmed on Arc Mainnet.'));
  assert.ok(h.render().some(node => node.type === 'a' && node.props.href.endsWith(replacementHash)));
  options.receipt.logs = [];
  assert.ok(!h.render().some(node => node.props?.children === 'gARC confirmed on Arc Mainnet.'));
  options.receipt.logs = [eventLog()];
  h.receiptOptions.onReplaced({ transaction: { from: address, to: address, value: 0n, input: '0x' } });
  const cancelled = h.render();
  assert.ok(!cancelled.some(node => node.props?.children === 'gARC confirmed on Arc Mainnet.'));
  assert.ok(cancelled.some(node => node.props?.role === 'alert' && node.props.children.includes('cancelled')));
  cancelled.find(node => node.type === 'button' && node.props.children === 'New gARC').props.onClick();
  assert.ok(!h.render().some(node => node.props?.role === 'alert'));
});

test('receipt proof checks the emitting contract, wallet, and fixed message', () => {
  assert.equal(garc.hasGarcEvent([eventLog()], address, contract), true);
  assert.equal(garc.hasGarcEvent([eventLog()], contract, contract), false);
  assert.equal(garc.hasGarcEvent([{ ...eventLog(), address }], address, contract), false);
  assert.equal(garc.hasGarcEvent([{ ...eventLog(), data: '0x' }], address, contract), false);
});

test('confirmation failure keeps the submitted hash and prevents another send', async () => {
  const h = harness({ receiptError: true });
  h.render().find(node => node.type === 'button' && node.props.children === 'Send gARC · network fee only').props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  const rendered = h.render();
  assert.equal(h.receiptOptions.hash, hash);
  assert.ok(rendered.some(node => node.props?.role === 'alert' && node.props.children.includes('Confirmation is unavailable')));
  assert.ok(rendered.some(node => node.type === 'button' && node.props.children === 'Transaction submitted' && node.props.disabled));
  assert.ok(!rendered.some(node => node.props?.children === 'gARC confirmed on Arc Mainnet.'));
});
