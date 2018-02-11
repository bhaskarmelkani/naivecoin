'use strict';

const Block = require('./block');
const { calcHashForBlock, getBlockAtIndex } = require('../utils');

class BlockChain {

  constructor (){
    this.chain = Object.create(null);
    const genesisBlock = this.getGenesisBlock();
    this.chain[genesisBlock.hash] = genesisBlock;
  }

  addBlock (newBlock){
    if (this.isNewBlockValid(newBlock)){
      this.chain[newBlock.hash] = newBlock;
    }
  }

  getLatestHash (){
    return Reflect.ownKeys(this.chain).pop();
  }

  getLatestBlock (){
    const latestHash = this.getLatestHash();
    return this.chain[latestHash];
  }

  generateNextBlock (blockData){
    const previousBlock = this.getLatestBlock();
    const nextIndex = previousBlock.index + 1;
    const timestamp = new Date().getTime();
    return new Block(nextIndex, previousBlock.hash, timestamp, blockData);
  }

  isNewBlockValid (newBlock){
    const previousBlock = this.getLatestBlock();
    const previousHash = previousBlock.hash;
    if ( previousBlock.index + 1 !== newBlock.index ){
      console.info('invalid index');
      return false;
    } else if ( previousHash !== newBlock.previousHash){
      console.info('invalid previousHash');
      return false;
    } else if (calcHashForBlock(newBlock) !== newBlock.hash){
      console.info('Invalid hash for new block');
      return false;
    }
    return true;
  }

  getGenesisBlock (){
    const index = 0;
    const previousHash = null;
    const timestamp = 652831200000;     // hardcoding '09/09/1990'
    const blockData = 'The Genesis Block';
    return new Block(index, previousHash, timestamp, blockData);
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

  replaceChain (newBlocks){
    if (this.isChainValid(newBlocks) && Reflect.ownKeys(newBlocks).length > Reflect.ownKeys(this.chain).length){
      console.info('Received chain is valid.');
      this.chain = newBlocks;
    } else {
      console.info('Received chain is invalid.');
    }
  }

}

module.exports = BlockChain;
