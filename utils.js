'use strict';

const Crypto = require('crypto-js');

const calcHash = (index, previousHash, timestamp, data) => {
  const blockString = `${index}|${previousHash}|${timestamp}|${data}`;
  return Crypto.SHA256(blockString).toString() ;
};

const calcHashForBlock = (block) => {
  const args = [block.index, block.previousHash, block.timeStamp, block.data];
  return Reflect.apply(calcHash, null, args);
};

const getBlockAtIndex = (chain, index) => {
  const hashList = Reflect.ownKeys(chain);
  const hashAtIndex = hashList[index];
  return chain[hashAtIndex];
};

const sortBlocks = (blocks) => {
  const sortedBlocks = {};
  const tmpArray = [];

  Reflect
    .ownKeys(blocks)
    .forEach((hash) => {
      const block = blocks[hash];
      tmpArray[block.index] = hash;
    });

  tmpArray
    .forEach((hash) => {
      if (hash){
        sortedBlocks[hash] = blocks[hash];
      }
    });

  return sortedBlocks;
};

module.exports = {
  calcHash,
  calcHashForBlock,
  getBlockAtIndex,
  sortBlocks
};

