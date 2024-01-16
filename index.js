const bip39 = require('bip39');
const bitcoinjs = require('bitcoinjs-lib');
const axios = require('axios');
const ecc = require('tiny-secp256k1');
const { BIP32Factory } = require('bip32');

// Wrap tiny-secp256k1 compatible implementation
const bip32 = BIP32Factory(ecc);

// Configuration
const networkConfig = {
  chain: 'pepe',
  rpcport: 18801,
  rpcuser: 'username',
  rpcpassword: 'password',
  connect: 'localhost:170.187.197.153:18801',
};

// Set custom wordlist directly to bip39.wordlists
bip39.wordlists['english'] = generateRandomWordlist();

const network = bitcoinjs.networks[networkConfig.chain];

function generateRandomWordlist() {
  const wordlist = [];
  for (let i = 0; i < 2048; i++) {
    wordlist.push(Math.random().toString(36).substring(2, 15));
  }
  return wordlist;
}

function generateMnemonic() {
  return bip39.generateMnemonic();
}

async function generateReceivingAddress() {
    const mnemonic = generateMnemonic();
    const seed = await bip39.mnemonicToSeedSync(mnemonic);
  
    const root = bip32.fromSeed(seed, network);
    const keyPair = root.derivePath("m/0'/0/0").keyPair;
  
    // Check if keyPair is defined before proceeding
    if (!keyPair) {
      console.error('Failed to derive keyPair');
      return null;
    }
  
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

(async () => {
    // Step 1: Generate a receiving address
    const result = await generateReceivingAddress();
  
    if (!result) {
      console.error('Failed to generate receiving address');
      return;
    }
  
    const { mnemonic, address } = result;
    console.log('Generated Mnemonic:', mnemonic);
    console.log('Receiving Address:', address);
  
    // Step 2: Send 0.01 BTC from a wallet to the generated address
    const senderPrivateKey = '671900d0d1c6cead35ee5e3db8f13bb05c828c757a8a8aa6370644d92196c29e'; // Replace with the private key of the sender's wallet
    const transactionHex = await sendBitcoin(senderPrivateKey, address);
    console.log('Transaction Hex:', transactionHex);
  })();
  