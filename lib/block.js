'use strict';

const { calcHashForBlock } = require('../utils');

class Block{
  constructor (index, previousHash, timestamp, data, difficulty, nonce){
    this.index = index;
    this.previousHash = previousHash;
    this.timestamp = timestamp;
    this.data = data;
    this.difficulty = difficulty;
    this.nonce = nonce;
    this.hash = calcHashForBlock(this);
  }
}

module.exports = Block;
