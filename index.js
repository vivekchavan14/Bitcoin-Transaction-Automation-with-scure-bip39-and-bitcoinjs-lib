const bip39 = require('@scure/bip39');
const bitcoinjs = require('bitcoinjs-lib');
const axios = require('axios');

// Configuration
const networkConfig = {
  chain: 'pepe',
  rpcport: 18801,
  rpcuser: 'username',
  rpcpassword: 'password',
  connect: 'localhost:170.187.197.153:18801',
};


const network = bitcoinjs.networks[networkConfig.chain];

function generateMnemonic() {
  return bip39.generateMnemonic();
}


async function generateReceivingAddress() {
  const mnemonic = generateMnemonic();
  const seed = await bip39.mnemonicToSeed(mnemonic);


  const root = bitcoinjs.bip32.fromSeed(seed, network);
  const keyPair = root.derivePath("m/0'/0/0").keyPair;

 
  const { address } = bitcoinjs.payments.p2pkh({ pubkey: keyPair.publicKey, network });

  return { mnemonic, address };
}


async function sendBitcoin(fromPrivateKey, toAddress) {
  const keyPair = bitcoinjs.ECPair.fromPrivateKey(Buffer.from(fromPrivateKey, 'hex'));
  const txb = new bitcoinjs.TransactionBuilder(network);

  const utxos = await fetchUTXOs(keyPair.getAddress());


  utxos.forEach((utxo) => {
    txb.addInput(utxo.txid, utxo.vout);
  });

  txb.addOutput(toAddress, 1000000); // 0.01 BTC in satoshis


  utxos.forEach((utxo, index) => {
    txb.sign(index, keyPair);
  });


  const tx = txb.build();


  const broadcastResult = await broadcastTransaction(tx.toHex());
  console.log('Transaction Broadcast Result:', broadcastResult);

  return tx.toHex();
}


async function fetchUTXOs(address) {
  const response = await axios.post(`http://${networkConfig.rpcuser}:${networkConfig.rpcpassword}@${networkConfig.connect}/`, {
    jsonrpc: '2.0',
    id: 1,
    method: 'listunspent',
    params: [0, 9999999, [address]],
  });
  return response.data.result;
}

async function broadcastTransaction(txHex) {
  const response = await axios.post(`http://${networkConfig.rpcuser}:${networkConfig.rpcpassword}@${networkConfig.connect}/`, {
    jsonrpc: '2.0',
    id: 1,
    method: 'sendrawtransaction',
    params: [txHex],
  });
  return response.data.result;
}

