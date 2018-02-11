'use strict';

const { calcHashForBlock } = require('./utils');

class Block{
  constructor(index, previousHash, timestamp, data){
    this.index = index;
    this.previousHash = previousHash;
    this.timestamp = timestamp;
    this.data = data;
    this.hash = calcHashForBlock(this);
  }
}

module.exports = Block;
