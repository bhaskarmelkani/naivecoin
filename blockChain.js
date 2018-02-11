'use strict';

const Block = require('./block');
const {calcHashForBlock, getBlockAtIndex} = require('./utils');

class BlockChain {

  constructor(){
    this.chain = Object.create(null);
  }

  addBlock(newBlock){
    if(this.isNewBlockValid(newBlock)){
      this.chain[newBlock.hash] = newBlock;
    }
  }

  getLatestHash(){
    return Reflect.ownKeys(this.chain).pop();
  }

  getLatestBlock(){
    const latestHash = this.getLatestHash();
    return this.chain[latestHash];
  }

  generateNextBlock(blockData){
    const previousBlock = this.getLatestBlock();
    const nextIndex = previousBlock.index + 1;
    const timestamp = new Date().getTime();

    return new Block(nextIndex, previousHash, timestamp, blockData);
  }

  isNewBlockValid(newBlock){
    const previousBlock = this.getLatestBlock();
    if( previousBlock.index + 1 !== newBlock.index ){
      console.log('invalid index');
      return false;
    }else if( previousHash !== newBlock.hash){
      console.log('invalid previousHash');
      return false;
    }else if(calcHashForBlock(newBlock) === newBlock.hash){
      console.log('Invalid hash for new block')
      return false;
    }

    return true;
  }

  getGenesisBlock(){
    const index = 0;
    const previousHash = null;
    const timestamp = 652831200000;     //hardcoding '09/09/1990'
    const blockData = 'The Genesis Block';

    return new Block(index, previousHash, timestamp, blockData);
  }

  isChainValid(chain){
    //Check security with toString method, it can be overwritten and hacked
    if(getBlockAtIndex(chain, 0).toString() !== this.getGenesisBlock().toString()){
      console.log('Genesis block not same for the chain.')
      return false;
    }

    const hashes = Reflect.ownKeys(chain);

    let currentHash;
    let currentBlock;
    let isValid = true;
    let previousHash = hashes[hashes.length-1]; //instantiate previousHash

    while(currentHash = hashes.pop()){
      currentBlock = chain[currentHash];

      if(currentHash !== previousHash){
        console.log('Previous hash of last block should point the hash of current block');
        isValid = false;
        break;
      }
      //Check its hash
      if( currentHash === currentBlock.hash === calcHashForBlock(currentBlock)){
        previousHash = currentBlock.previousHash;
      }else{
        isValid = false;
        break;
      }
    }

    return isValid;
  }

  replaceChain(newBlocks){
    if(this.isChainValid(newBlocks) && Reflect.ownKeys(newBlocks).length > Reflect.ownKeys(this.chain).length){
      console.log('Received chain is valid.');
      this.chain = newBlocks;
    }else{
      console.log('Received chain is invalid.')
    }
  }

}

module.exports = BlockChain;
