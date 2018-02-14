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

const getBlockAtIndex = (chain, index, inverted) => {
  const hashList = Reflect.ownKeys(chain);
  let hashAtIndex;
  if (!inverted){
    hashAtIndex = hashList[index];
  } else {
    hashAtIndex = hashList[hashList.length - index];
  }
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

const getCurrentTimestamp = () => Math.round(new Date().getTime() / 1000);

const JSONToObject = (data) => {
  try {
    return JSON.parse(data);
  } catch (e){
    return null;
  }
};

const hexToBinary = (s) => {
  let ret = '';
  const lookupTable = {
    '0': '0000', '1': '0001', '2': '0010', '3': '0011', '4': '0100',
    '5': '0101', '6': '0110', '7': '0111', '8': '1000', '9': '1001',
    'a': '1010', 'b': '1011', 'c': '1100', 'd': '1101',
    'e': '1110', 'f': '1111'
  };
  for (let i = 0; i < s.length; i = i + 1) {
    if (lookupTable[s[i]]) {
      ret += lookupTable[s[i]];
    } else {
      return null;
    }
  }
  return ret;
};

module.exports = {
  calcHash,
  calcHashForBlock,
  getBlockAtIndex,
  sortBlocks,
  getCurrentTimestamp,
  JSONToObject,
  hexToBinary
};

