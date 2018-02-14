'use strict';


const elliptic = require('elliptic');
const { existsSync, readFileSync, unlinkSync, writeFileSync } = require('fs');
const { without } = require('lodash');

const { TxIn, TxOut, Transaction, getPublicKey, getTransactionId, signTxIn  } = require('./transaction');

const EC = new elliptic.ec('secp256k1');

const privateKeyLocation = process.env.PRIVATE_KEY || 'node/wallet/private_key';

const getPrivateFromWallet = () => {
  const buffer = readFileSync(privateKeyLocation, 'utf8');
  return buffer.toString();
};

const getPublicFromWallet = () => {
  const privateKey = getPrivateFromWallet();
  const key = EC.keyFromPrivate(privateKey, 'hex');
  return key.getPublic().encode('hex');
};

const generatePrivateKey = () => {
  const keyPair = EC.genKeyPair();
  const privateKey = keyPair.getPrivate();
  return privateKey.toString(16);
};

const initWallet = () => {
  // let's not override existing private keys
  if (existsSync(privateKeyLocation)) {
    return;
  }
  const newPrivateKey = generatePrivateKey();

  writeFileSync(privateKeyLocation, newPrivateKey);
  console.log('new wallet with private key created to : %s', privateKeyLocation);
};

const deleteWallet = () => {
  if (existsSync(privateKeyLocation)) {
    unlinkSync(privateKeyLocation);
  }
};

const getBalance = (address, unspentTxOuts) => {
  return findUnspentTxOuts(address, unspentTxOuts)
    .map(uTxO => uTxO.amount)
    .reduce((acc, curr) => acc + curr, 0);
};

const findUnspentTxOuts = (ownerAddress, unspentTxOuts) => unspentTxOuts.filter(uTxO => uTxO.address === ownerAddress);

const findTxOutsForAmount = (amount, myUnspentTxOuts) => {
  let currentAmount = 0;
  const includedUnspentTxOuts = [];
  for (const myUnspentTxOut of myUnspentTxOuts) {
    includedUnspentTxOuts.push(myUnspentTxOut);
    currentAmount = currentAmount + myUnspentTxOut.amount;
    if (currentAmount >= amount) {
      const leftOverAmount = currentAmount - amount;
      return { includedUnspentTxOuts, leftOverAmount };
    }
  }

  const eMsg = 'Cannot create transaction from the available unspent transaction outputs.' + ' Required amount:' + amount + '. Available unspentTxOuts:' + JSON.stringify(myUnspentTxOuts);
  throw Error(eMsg);
};

const createTxOuts = (receiverAddress, myAddress, amount, leftOverAmount) => {
  const txOut1 = new TxOut(receiverAddress, amount);
  if (leftOverAmount === 0) {
    return [txOut1];
  } else {
    const leftOverTx = new TxOut(myAddress, leftOverAmount);
    return [txOut1, leftOverTx];
  }
};

const filterTxPoolTxs = (unspentTxOuts, transactionPool) => {

  const txIns = transactionPool
    .map(tx => tx.txIns)
    .reduce((acc, curr) => (curr.forEach(txIn => acc.push(txIn)),acc) , []);


  const removable = [];
  for (const unspentTxOut of unspentTxOuts) {
    const txIn = txIns
      .find(txIn => txIn.txOutIndex === unspentTxOut.txOutIndex && txIn.txOutId === unspentTxOut.txOutId);

    txIn && removable.push(unspentTxOut);
  }

  return without(unspentTxOuts, ...removable);
};

const createTransaction = (receiverAddress, amount, privateKey,
  unspentTxOuts, txPool) => {

  console.log('txPool: %s', JSON.stringify(txPool));
  const myAddress = getPublicKey(privateKey);
  const myUnspentTxOutsA = unspentTxOuts.filter(uTxO => uTxO.address === myAddress);

  const myUnspentTxOuts = filterTxPoolTxs(myUnspentTxOutsA, txPool);

  // filter from unspentOutputs such inputs that are referenced in pool
  const { includedUnspentTxOuts, leftOverAmount } = findTxOutsForAmount(amount, myUnspentTxOuts);

  const toUnsignedTxIn = (unspentTxOut) => {
    const txIn = new TxIn();
    txIn.txOutId = unspentTxOut.txOutId;
    txIn.txOutIndex = unspentTxOut.txOutIndex;
    return txIn;
  };

  const unsignedTxIns = includedUnspentTxOuts.map(toUnsignedTxIn);

  const tx = new Transaction();
  tx.txIns = unsignedTxIns;
  tx.txOuts = createTxOuts(receiverAddress, myAddress, amount, leftOverAmount);
  tx.id = getTransactionId(tx);

  tx.txIns = tx.txIns.map((txIn, index) => {
    txIn.signature = signTxIn(tx, index, privateKey, unspentTxOuts);
    return txIn;
  });

  return tx;
};

module.exports = { createTransaction, getPublicFromWallet, getPrivateFromWallet, getBalance, generatePrivateKey, initWallet, deleteWallet, findUnspentTxOuts };
