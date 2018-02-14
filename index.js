'use strict';


const BlockChain = require('./lib/blockChain');

const blockChain = new BlockChain();

const server = require('./lib/server')(blockChain);

const {initWallet} = require('./lib/wallet');

initWallet();
server();

