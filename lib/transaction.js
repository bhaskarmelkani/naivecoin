'use strict';

const Crypto = require('crypto-js');
const COINBASE_AMOUNT = 50;   // Also called as block reward.  //TODO: This also changes after some blocks BTC = 4years

const ecdsa = require('elliptic');
const ec = new ecdsa.ec('secp256k1');

const { countBy } = require('lodash');


class UnspentTxOut {
  constructor (txOutId, txOutIndex, address, amount){
    this.txOutId = txOutId;
    this.txOutIndex = txOutIndex;
    this.address = address;
    this.amount = amount;
  }
}


class TxIn {
  constructor (txOutId, txOutIndex, signature){
    this.txOutId = txOutId;
    this.txOutIndex = txOutIndex;
    this.signature = signature;
  }
}


class TxOut {
  constructor (amount, address){
    this.amount = amount;
    this.address = address;
  }
}


class Transaction{
  constructor (id, txIns, txOuts){
    this.id = id;
    this.txIns = txIns;
    this.txOuts = txOuts;
  }
}


const getTransactionId = (transaction) => {
  const txInContent = transaction
    .txIns
    .map(txIn => txIn.txOutId + txIn.txOutIndex)
    .reduce((acc, curr) => acc + curr, '');

  const txOutContent = transaction
    .txOuts
    .map(txOut => txOut.address + txOut.amount)
    .reduce((acc, curr) => acc + curr, '');

  return Crypto.SHA256(txInContent + txOutContent).toString();
};


const validateTransaction = (transaction, unspentTxOuts) => {

  if (!isValidTransactionStructure(transaction)){
    return false;
  }

  // Invalid transaction id
  if (getTransactionId(transaction) !== transaction.id){
    return false;
  }

  // Check if transaction contains valid txIns
  const hasValidTxIns = transaction
    .txIns
    .map(txIn => validateTxIn(txIn, transaction, unspentTxOuts))
    .reduce((acc, curr) => acc + curr, '');

  if (!hasValidTxIns){
    return false;
  }

  const totalTxInValues = transaction
    .txIns
    .map(txIn => getTxInAmount(txIn, unspentTxOuts))
    .reduce((acc, curr) => acc + curr, 0);

  const totalTxOutValues = transaction
    .txOuts
    .map(txOut => txOut.amount)
    .reduce((acc, curr) => acc + curr, 0);

  if (totalTxInValues !== totalTxOutValues){
    return false;
  }

  return true;
};


const validateBlockTransactions = (transactions, unspentTxOuts, blockIndex) => {
  const coinbaseTx = transactions[0];

  if (!validateCoinbaseTx(coinbaseTx, blockIndex)){
    return false;
  }

  // Flattn txIns from transactions
  const txIns = transactions
    .map(tx => tx.txIns)
    .reduce((acc, curr) => (curr.forEach(txIn => acc.push(txIn)),acc) , []);

  if (hasDuplicates(txIns)){
    return false;
  }

  // CoinbaseTx already validated, validate rest
  const normalTxs = transactions.slice(1);

  return normalTxs
    .map(tx => validateTransaction(tx, unspentTxOuts))
    .reduce((acc, curr) => (acc && curr), true);
};


const hasDuplicates = (txIns) => {
  const groups = countBy(txIns, txIn => txIn.txOutId +  txIn.txOutIndex);

  return Reflect
    .ownKeys(groups)
    .map((key) => !!(groups[key] - 1))
    .includes(true);
};


const validateCoinbaseTx = (transaction, blockIndex) => {

  if (transaction === null){
    return false;   // the first transaction in the block must be coinbase transaction
  }

  if (getTransactionId(transaction) !== transaction.id){
    return false;   // invalid transaction id
  }

  if (transaction.txIns.length !== 1){
    return false;   // one txIn must be specified in conibase tx
  }

  if (transaction.txIns[0].txOutIndex !== blockIndex){
    return false;   // the txIn signature in coinbase tx must be the block height
  }

  if (transaction.txOuts.length !== 1){
    return false;   // invalid number of txOuts in coinbase transaction
  }

  if (transaction.txOuts[0].amount !== COINBASE_AMOUNT){
    return false;   // Invalid coinbase amount in coinbase txn
  }

  return true;
};


const validateTxIn = (txIn, transaction, unspentTxOuts) => {

  const referencedUTxOut = unspentTxOuts
    .find(uTxO => uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex);

  if (referencedUTxOut === null){
    return false;   // referenced txOut not found
  }

  const address = referencedUTxOut.address;
  const key = ec.keyFromPublic(address, 'hex');
  const validSignature = key.verify(transaction.id, txIn.signature);
  if (!validSignature){
    return false;
  }
  return true;
};


const getTxInAmount = (txIn, unspentTxOuts) => findUnspentTxOut(txIn.txOutId, txIn.txOutIndex, unspentTxOuts).amount;


const findUnspentTxOut = (txId, index, unspentTxOuts) => unspentTxOuts.find(uTxO =>  uTxO.txOutId === txId && uTxO.txOutIndex === index);


const getCoinbaseTransaction = (address, blockIndex) => {
  const txIn = new TxIn('', blockIndex, '');

  const txIns = [txIn];
  const txOuts = [new TxOut(address, COINBASE_AMOUNT)];
  const tx = new Transaction(null, txIns, txOuts);
  tx.id = getTransactionId(tx);
  return tx;
};


const signTxIn = (transaction, txInIndex, privateKey, unspentTxOuts) => {
  const txIn = transaction.txIns[txInIndex];
  const dataToSign = transaction.id;
  const referencedUnspentTxOut = findUnspentTxOut(txIn.txOutId, txIn.txOutIndex, unspentTxOuts);

  if (referencedUnspentTxOut === null){
    throw new Error('Could not find referenced txOut');
  }

  const referencedAddress = referencedUnspentTxOut.address;
  if (getPublicKey(privateKey) !== referencedAddress ){
    throw new Error('Trying to sign an input with private key that does not match the address that is referenced in txIn');
  }

  const key = ec.keyFromPrivate(privateKey, 'hex');
  const signature = toHexString(key.sign(dataToSign).toDER());

  return signature;
};


const updateUnspentTxOuts = (transactions, unspentTxOuts) => {
  const newUnspentTxOuts = transactions
    .map(tx => tx.txOuts.map((txOut, index) => new UnspentTxOut(tx.id, index, txOut.address, txOut.amount)));

  const consumedTxOuts = transactions
    .map(tx => tx.txIns)
    .reduce((acc, curr) => [...curr, ...acc], [])
    .map(txIn => new UnspentTxOut(txIn.txOutId, txIn.txOutIndex, '', 0));

  const resultingUnspentTxOuts = [...unspentTxOuts, ...newUnspentTxOuts]
    .filter(uTxO => !findUnspentTxOut(uTxO.txOutId, uTxO.txOutIndex, consumedTxOuts));

  return resultingUnspentTxOuts;
};


const processTransactions = (transactions, unspentTxOuts, blockIndex) => {
  console.log(transactions);
  if (!validateBlockTransactions(transactions, unspentTxOuts, blockIndex)){
    return null;
  }
  return updateUnspentTxOuts(transactions, unspentTxOuts);
};



const getPublicKey = (privateKey) => ec.keyFromPrivate(privateKey, 'hex').getPublic().encode('hex');


const isValidTxInStructure = (txIn) => {
  if (txIn === null){
    return false;   // txIn is null
  } else if ( typeof txIn.signature !== 'string'){
    return false;   // invalid signature type in txIn
  } else if ( typeof txIn.txOutId !== 'string' ){
    return false;     // invalid txOutId in txIn
  } else if ( typeof txIn.txOutIndex !== 'number' ){
    return false;   // invalid txOutIndex in txIn
  } else {
    return true;
  }
};


const isValidTxOutStructure = (txOut) => {
  if (txOut === null){
    return false;   // txOut is null
  } else if (typeof txOut.address !== 'string'){
    return false;   // invalid address type in txOut
  } else if (!isValidAddress(txOut.address)){
    return false;   // invalid address in txOut
  } else if (typeof txOut.amount !== 'number' ){
    return false;   // invalid amount in txOut
  } else {
    return true;
  }
};


const isValidTransactionStructure = (transaction) => {
  if (typeof transaction.id !== 'string'){
    return false;   // transactionId missing
  }
  if (!(transaction.txnIns instanceof Array)){
    return false;   // Invalid txIns type
  }
  if (! transaction.txnIns.map(isValidTxInStructure).reduce((acc, curr) => (acc && curr), true) ){
    return false;   // Invalid txIn type in txIns
  }
  if (!(transaction.txnOuts instanceof Array)){
    return false;   // Invalid txOuts type
  }
  if (! transaction.txnOuts.map(isValidTxOutStructure).reduce((acc, curr) => (acc && curr), true) ){
    return false;   // Invalid txOut type in txOuts
  }


};

const toHexString = (byteArray) => Array.from(
  byteArray,
  byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)
).join('');

const isValidAddress = (address) => {
  if (address.length !== 130){
    return false;   // invalid public key length
  } else if (address.match('^[a-fA-F0-9]+$') === null) {
    return false;   // public key must contain only hex characters
  }
  else if (!address.startsWith('04')) {
    return false;   // public key must start with 04
  }
  return true;
};

module.exports = {
  processTransactions,
  signTxIn,
  getTransactionId,
  isValidAddress,
  validateTransaction,
  UnspentTxOut,
  TxIn,
  TxOut,
  getCoinbaseTransaction,
  getPublicKey,
  hasDuplicates,
  Transaction
};
