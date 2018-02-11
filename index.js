'use strict';

const initialPeers = process.env.PEERS ? process.env.PEERS.split(',') : [];

const BlockChain = require('./lib/blockChain');
const Socket = require('./lib/websocket');

const blockChain = new BlockChain();

const webSocket = new Socket(blockChain, initialPeers);
const server = require('./lib/server')(blockChain, webSocket);

server();
