'use strict';


const ws = require('ws');
const MessageType = {
  QUERY_LATEST: 0,
  QUERY_ALL: 1,
  RESPONSE_BLOCKCHAIN: 2
};
const { p2pPort } = require('../config');
const { sortBlocks } = require('../utils');

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
  }

  broadcast (message){
    this.sockets.forEach(socket => this.write(socket, message));
  }

  write (socket, message){
    socket.send(JSON.stringify(message));
  }

  initMessageHandler (socket){
    socket.on('message', (data) => {
      const message = JSON.parse(data);
      console.log('Received message' + JSON.stringify(message));
      switch (message.type) {
      case MessageType.QUERY_LATEST:
        this.write(socket, this.responseLatestMsg());
        break;
      case MessageType.QUERY_ALL:
        this.write(socket, this.responseChainMsg());
        break;
      case MessageType.RESPONSE_BLOCKCHAIN:
        this.handleBlockchainResponse(message);
        break;
      }
    });
  }

  handleBlockchainResponse (message){
    const receivedBlocks = sortBlocks(JSON.parse(message.data));
    const latestBlockReceived = receivedBlocks[Reflect.ownKeys(receivedBlocks).pop()];
    const latestBlockHeld = this.blockChain.getLatestBlock();
    if (latestBlockReceived.index > latestBlockHeld.index){
      console.log('blockchain possibly behind. We got: ' + latestBlockHeld.index + ' Peer got: ' + latestBlockReceived.index);
      if (latestBlockHeld.hash === latestBlockReceived.previousHash){
        console.log('We can append the received block to our chain');
        this.blockChain.addBlock(latestBlockReceived);
        this.broadcast(this.responseLatestMsg());
      } else if (receivedBlocks.length === 1){
        console.log('We have to query the chain from our peer');
        this.broadcast(this.queryAllMsg());
      } else {
        console.log('Received blockchain is longer than current blockchain');
        this.blockChain.replaceChain(receivedBlocks);
      }
    } else {
      console.log('received blockchain is not longer than current blockchain. Do nothing');
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
    return { 'type': MessageType.QUERY_LATEST };
  }

  queryAllMsg (){
    return { 'type': MessageType.QUERY_ALL };
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
}

module.exports = WebSocket;
