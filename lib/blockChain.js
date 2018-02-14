'use strict';

const Block = require('./block');
const { cloneDeep } = require('lodash');
const { calcHashForBlock, getBlockAtIndex, getCurrentTimestamp, hexToBinary } = require('../utils');
const { processTransactions, isValidAddress, getCoinbaseTransaction } = require('./transaction');
const { createTransaction, getPublicFromWallet, getPrivateFromWallet, getBalance, findUnspentTxOuts } = require('./wallet');
const TransactionPool = require('./transactionPool');
const CryptoJS = require('crypto-js');

// in seconds
const BLOCK_GENERATION_INTERVAL = 10;  // In bitcoin its called blocklatency and is 10 minutes or 600 seconds

// in blocks
const DIFFICULTY_ADJUSTMENT_INTERVAL = 10;   // In bitcoin 2016 blocks (~ 2 weeks )

const genesisTransaction = {
  'txIns': [
    { 'signature': '', 'txOutId': '', 'txOutIndex': 0 }
  ],
  'txOuts': [{
    'address': '04bfcab8722991ae774db48f934ca79cfb7dd991229153b9f732ba5334aafcd8e7266e47076996b55a14bf9913ee3145ce0cfc1372ada8ada74bd287450313534a',
    'amount': 50
  }],
  'id': 'e655f6a5f26dc9b4cac6e46f52336428287759cf81ef5ff10854f69d68f43fa3'
};

const initialPeers = process.env.PEERS ? process.env.PEERS.split(',') : [];

const Socket = require('./webSocket');


class BlockChain {

  constructor (){
    this.chain = Object.create(null);
    const genesisBlock = this.getGenesisBlock();
    this.chain[genesisBlock.hash] = genesisBlock;
    this.blockLatency = BLOCK_GENERATION_INTERVAL;
    this.adjustmentInterval = DIFFICULTY_ADJUSTMENT_INTERVAL;
    this.webSocket = new Socket(this, initialPeers);
    this.unspentTxOuts = processTransactions(getBlockAtIndex(this.chain, 0).data, [], 0);
    this.transactionPool = new TransactionPool(this.unspentTxOuts);
  }

  setUnspentTxOut (newUnspentTxOuts){
    this.unspentTxOuts = newUnspentTxOuts;
  }


  getLatestHash (){
    return Reflect.ownKeys(this.chain).pop();
  }

  getLatestBlock (){
    const latestHash = this.getLatestHash();
    return this.chain[latestHash];
  }

  generateRawNextBlock (blockData){
    const previousBlock = this.getLatestBlock();
    const difficulty = this.getDifficulty();
    const nextIndex = previousBlock.index + 1;
    const nextTimestamp = getCurrentTimestamp();
    const newBlock = this.findBlock(nextIndex, previousBlock.hash, nextTimestamp, blockData, difficulty);
    if (this.addBlockToChain(newBlock)) {
      this.webSocket.broadcastLatest();
      return newBlock;
    } else {
      return null;
    }
  }

  getUnspentTxOuts (){
    return cloneDeep(this.unspentTxOuts);
  }

  getMyUnspentTransactionOutputs (){
    return findUnspentTxOuts(getPublicFromWallet(), this.getUnspentTxOuts());
  }

  generateNextBlock (){
    const publicKey = getPublicFromWallet();
    const coinbaseTx = getCoinbaseTransaction(publicKey, this.getLatestBlock().index + 1);
    const blockData = [coinbaseTx].concat(this.transactionPool.getPool());
    return this.generateRawNextBlock(blockData);
  }

  generatenextBlockWithTransaction (receiverAddress, amount) {
    if (!isValidAddress(receiverAddress)) {
      throw Error('invalid address');
    }
    if (typeof amount !== 'number') {
      throw Error('invalid amount');
    }
    const coinbaseTx = getCoinbaseTransaction(getPublicFromWallet(), this.getLatestBlock().index + 1);
    const tx = createTransaction(receiverAddress, amount, getPrivateFromWallet(), this.getUnspentTxOuts(), this.transactionPool.getPool());
    const blockData = [coinbaseTx, tx];
    return this.generateRawNextBlock(blockData);
  }

  findBlock (index, previousHash, timestamp, data, difficulty) {
    let nonce = 0;
    const cond = true;
    while (cond) {
      const hash = this.calculateHash(index, previousHash, timestamp, data, difficulty, nonce);
      if (this.hashMatchesDifficulty(hash, difficulty)) {
        return new Block(index, hash, previousHash, timestamp, data, difficulty, nonce);
      }
      nonce++;
    }
  }

  getAccountBalance () {
    return getBalance(getPublicFromWallet(), this.getUnspentTxOuts());
  }

  sendTransaction (address, amount) {
    const tx = createTransaction(address, amount, getPrivateFromWallet(), this.getUnspentTxOuts(), this.transactionPool.getPool());
    this.transactionPool.addToTransactionPool(tx, this.getUnspentTxOuts());
    this.webSocket.broadCastTransactionPool();
    return tx;
  }

  calculateHashForBlock (block){
    this. calculateHash(block.index, block.previousHash, block.timestamp, block.data, block.difficulty, block.nonce);
  }

  calculateHash (index, previousHash, timestamp, data, difficulty, nonce){
    return CryptoJS.SHA256(index + previousHash + timestamp + data + difficulty + nonce).toString();
  }


  isValidBlockStructure (block) {
    return typeof block.index === 'number'
        && typeof block.hash === 'string'
        && typeof block.previousHash === 'string'
        && typeof block.timestamp === 'number'
        && typeof block.data === 'object';
  }

  isValidNewBlock (newBlock, previousBlock) {
    if (!this.isValidBlockStructure(newBlock)) {
      console.log('invalid block structure: %s', JSON.stringify(newBlock));
      return false;
    }
    if (previousBlock.index + 1 !== newBlock.index) {
      console.log('invalid index');
      return false;
    } else if (previousBlock.hash !== newBlock.previousHash) {
      console.log('invalid previoushash');
      return false;
    } else if (!this.isValidTimestamp(newBlock, previousBlock)) {
      console.log('invalid timestamp');
      return false;
    } else if (!this.hasValidHash(newBlock)) {
      return false;
    }
    return true;
  }

  getAccumulatedDifficulty (aBlockchain) {
    return aBlockchain
      .map((block) => block.difficulty)
      .map((difficulty) => Math.pow(2, difficulty))
      .reduce((a, b) => a + b);
  }

  isValidTimestamp (newBlock, previousBlock) {
    return ( previousBlock.timestamp - 60 < newBlock.timestamp )
        && newBlock.timestamp - 60 < getCurrentTimestamp();
  }

  hasValidHash (block) {

    if (!this.hashMatchesBlockContent(block)) {
      console.log('invalid hash, got:' + block.hash);
      return false;
    }

    if (!this.hashMatchesDifficulty(block.hash, block.difficulty)) {
      console.log('block difficulty not satisfied. Expected: ' + block.difficulty + 'got: ' + block.hash);
    }
    return true;
  }

  hashMatchesBlockContent (block) {
    const blockHash = this.calculateHashForBlock(block);
    return blockHash === block.hash;
  }

  hashMatchesDifficulty (hash, difficulty) {
    const hashInBinary = hexToBinary(hash);
    const requiredPrefix = '0'.repeat(difficulty);
    return hashInBinary.startsWith(requiredPrefix);
  }

  isValidChain (blockchainToValidate) {
    const isValidGenesis = (block) => {
      return JSON.stringify(block) === JSON.stringify(this.getGenesisBlock());
    };
    if (!isValidGenesis(blockchainToValidate[0])) {
      return null;
    }
    /*
    Validate each block in the chain. The block is valid if the block structure is valid
      and the transaction are valid
     */
    let aUnspentTxOuts = [];
    for (let i = 0; i < blockchainToValidate.length; i++) {
      const currentBlock = blockchainToValidate[i];
      if (i !== 0 && !this.isValidNewBlock(blockchainToValidate[i], blockchainToValidate[i - 1])) {
        return null;
      }
      aUnspentTxOuts = processTransactions(currentBlock.data, aUnspentTxOuts, currentBlock.index);
      if (aUnspentTxOuts === null) {
        console.log('invalid transactions in blockchain');
        return null;
      }
    }
    return aUnspentTxOuts;
  }

  addBlockToChain (newBlock) {
    if (this.isValidNewBlock(newBlock, this.getLatestBlock())) {
      const retVal = processTransactions(newBlock.data, this.getUnspentTxOuts(), newBlock.index);
      if (retVal === null) {
        console.log('block is not valid in terms of transactions');
        return false;
      }
      else {
        this.chain.push(newBlock);
        this.setUnspentTxOuts(retVal);
        this.transactionPool.updateTransactionPool(this.unspentTxOuts);
        return true;
      }
    }
    return false;
  }

  getGenesisBlock (){
    const index = 0;
    const previousHash = null;
    const timestamp = 652831200;     // hardcoding '09/09/1990'
    const blockData = [genesisTransaction];
    const difficulty = 0;
    const nonce = 0;
    return new Block(index, previousHash, timestamp, blockData, difficulty, nonce);
  }

  isChainValid (chain){
    if (JSON.stringify(getBlockAtIndex(chain, 0)) !== JSON.stringify(this.getGenesisBlock())){
      console.info('Genesis block not same for the chain.');
      return false;
    }

    const hashes = Reflect.ownKeys(chain);

    let currentHash;
    let currentBlock;
    let isValid = true;
    let previousHash = hashes[hashes.length - 1];

    while (currentHash = hashes.pop()){  // eslint-disable-line no-cond-assign
      currentBlock = chain[currentHash];
      if (currentHash !== previousHash){
        console.info('Previous hash of last block should point the hash of current block');
        isValid = false;
        break;
      }
      if ( currentHash === currentBlock.hash === calcHashForBlock(currentBlock)){
        previousHash = currentBlock.previousHash;
      } else {
        isValid = false;
        break;
      }
    }
    return isValid;
  }

  replaceChain (newBlocks) {
    const aUnspentTxOuts = this.isValidChain(newBlocks);
    const validChain = aUnspentTxOuts !== null;
    if (validChain &&
        this.getAccumulatedDifficulty(newBlocks) > this.getAccumulatedDifficulty(this.chain)) {
      console.log('Received blockchain is valid. Replacing current blockchain with received blockchain');
      this.chain = newBlocks;
      this.setUnspentTxOuts(aUnspentTxOuts);
      this.transactionPool.updateTransactionPool(this.unspentTxOuts);
      this.webSocket.broadcastLatest();
    }
    else {
      console.log('Received blockchain invalid');
    }
  }

  handleReceivedTransaction (transaction) {
    this.transactionPool.addToTransactionPool(transaction, this.getUnspentTxOuts());
  }

  getDifficulty (){
    const latestBlock = this.getLatestBlock();
    if (latestBlock.index % this.adjustmentInterval === 0 && latestBlock.index !== 0){
      return this.getAdjustedDifficulty();
    } else {
      return latestBlock.difficulty;
    }
  }

  getAdjustedDifficulty (){
    const latestBlock = this.getLatestBlock();
    const prevAdjustedBlock = getBlockAtIndex(this.chain, this.adjustmentInterval, true);
    const timeExpected = this.blockLatency * this.adjustmentInterval;
    const timeTaken = latestBlock.timestamp - prevAdjustedBlock.timestamp;

    if (timeTaken < timeExpected / 2){
      return prevAdjustedBlock.difficulty + 1;
    } else if (timeTaken > timeExpected / 2){
      return prevAdjustedBlock.difficulty - 1;
    } else {
      return prevAdjustedBlock.difficulty;
    }
  }

}

module.exports = BlockChain;
