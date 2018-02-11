'use strict';

const sockets = [];
const initialPeers = process.env.PEERS ? process.env.PEERS.split(',') : [];

const BlockChain = require('./blockChain');
const Socket = require('./websocket');
const blockChain = new BlockChain();

const webSocket = new Socket(blockChain, initialPeers);
const server = require('./server')(blockChain, webSocket)();


