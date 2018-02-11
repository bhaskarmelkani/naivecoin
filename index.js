'use strict';

const sockets = [];

const BlockChain = require('./blockChain');
const blockChain = new BlockChain();
const genesisBlock = blockChain.getGenesisBlock();
blockChain.addBlock(genesisBlock);

const server = require('./server')(blockChain);

const Socket = require('./websocket');

const webSocket = new Socket(blockChain);
