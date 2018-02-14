'use strict';


const ws = require('ws');
const MessageType = {
  QUERY_LATEST: 0,
  QUERY_ALL: 1,
  RESPONSE_BLOCKCHAIN: 2,
  QUERY_TRANSACTION_POOL: 3,
  RESPONSE_TRANSACTION_POOL: 4
};
const { p2pPort } = require('../config');

const { JSONToObject } = require('../utils');


class WebSocket{
  constructor (blockChain, initialPeers = []){
    const port = process.env.P2P_PORT || p2pPort;
    const that = this;

    this.sockets = [];
    this.server = new ws.Server({ port });
    this.server.on('connection', socket => that.initConnection(socket));
    this.blockChain = blockChain;
    this.connectToPeers(initialPeers);
  }

  initConnection (socket){
    this.sockets.push(socket);
    this.initMessageHandler(socket);
    this.initErrorHandler(socket);
    this.write(socket, this.queryChainLengthMsg());
    const that = this;

    setTimeout(() => {
      that.boradcast(that.queryTransactionPoolMsg());
    }, 500);
  }

  broadcast (message){
    this.sockets.forEach(socket => this.write(socket, message));
  }

  write (socket, message){
    socket.send(JSON.stringify(message));
  }

  initMessageHandler (socket){
    socket.on('message', (data) => {
      const message = JSONToObject(data); // TODO:// this can throw exception
      if (message === null) {
        return;   // could not parse received JSON message
      }
      console.log('Received message' + JSON.stringify(message));
      switch (message.type) {
      case MessageType.QUERY_LATEST:
        this.write(socket, this.responseLatestMsg());
        break;
      case MessageType.QUERY_ALL:
        this.write(socket, this.responseChainMsg());
        break;
      case MessageType.RESPONSE_BLOCKCHAIN:
        const receivedBlocks = JSONToObject(message.data);
        if (receivedBlocks === null) {
          break;    // invalid blocks received
        }
        this.handleBlockchainResponse(receivedBlocks);
        break;
      case MessageType.QUERY_TRANSACTION_POOL:
        this.write(ws, this.responseTransactionPoolMsg());
        break;
      case MessageType.RESPONSE_TRANSACTION_POOL:
        const receivedTransactions = JSONToObject(message.data);
        if (receivedTransactions === null) {
          break;    // invalid transaction received
        }
        receivedTransactions
          .forEach((transaction) => {
            try {
              this.handleReceivedTransaction(transaction);
              // if no error is thrown, transaction was indeed added to the pool
              // let's broadcast transaction pool
              this.broadcastTransactionPool();
            } catch (e) {
              console.log(e.message);
            }
          });
        break;
      }
    });
  }

  handleBlockchainResponse (receivedBlocks){
    if (receivedBlocks.length === 0) {
      return;   // received block chain size of 0
    }
    const latestBlockReceived = receivedBlocks[receivedBlocks.length - 1];
    if (!this.blockChain.isValidBlockStructure(latestBlockReceived)) {
      return;   // block structuture not valid
    }
    const latestBlockHeld = this.getLatestBlock();
    if (latestBlockReceived.index > latestBlockHeld.index) {
      console.log('blockchain possibly behind. We got: ' + latestBlockHeld.index + ' Peer got: ' + latestBlockReceived.index);
      if (latestBlockHeld.hash === latestBlockReceived.previousHash) {
        if (this.blockChain.addBlockToChain(latestBlockReceived)) {
          this.broadcast(this.responseLatestMsg());
        }
      } else if (receivedBlocks.length === 1) {
        console.log('We have to query the chain from our peer');
        this.broadcast(this.queryAllMsg());
      } else {
        console.log('Received blockchain is longer than current blockchain');
        this.replaceChain(receivedBlocks);
      }
    } else {
      console.log('received blockchain is not longer than received blockchain. Do nothing');
    }
  }

  initErrorHandler (socket){
    const closeConnection = (socket) => {
      console.log('connection failed to peer: ' + socket.url);
      this.sockets.splice(this.sockets.indexOf(socket), 1);
    };
    socket.on('close', () => closeConnection(socket));
    socket.on('error', () => closeConnection(socket));
  }

  connectToPeers (newPeers){
    const that = this;
    newPeers.forEach((peer) => {
      const socket = new socket(peer);
      socket.on('open', () => that.initConnection(socket));
      socket.on('error', () => {
        console.log('connection failed');
      });
    });
  }

  queryChainLengthMsg (){
    return { 'type': MessageType.QUERY_LATEST, 'data': null };
  }

  queryAllMsg (){
    return { 'type': MessageType.QUERY_ALL, 'data': null };
  }

  responseLatestMsg (){
    return {
      'type': MessageType.RESPONSE_BLOCKCHAIN,
      'data': JSON.stringify([this.blockChain.getLatestBlock()])
    };
  }

  responseChainMsg (){
    return {
      'type': MessageType.RESPONSE_BLOCKCHAIN,
      'data': JSON.stringify(this.blockChain)
    };
  }

  queryTransactionPoolMsg (){
    return {
      'type': MessageType.QUERY_TRANSACTION_POOL,
      'data': null
    };
  }

  responseTransactionPoolMsg (){
    return {
      'type': MessageType.RESPONSE_TRANSACTION_POOL,
      'data': JSON.stringify(this.blockChain.transactionPool)
    };
  }

  broadcastLatest () {
    this.broadcast(this.responseLatestMsg());
  }

  broadcastTransactionPool (){
    this.broadcast(this.responseTransactionPoolMsg());
  }

}

module.exports = WebSocket;
