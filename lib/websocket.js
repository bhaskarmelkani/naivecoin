'use strict';


const WebSocket = require('ws');
const MessageType = {
  QUERY_LATEST: 0,
  QUERY_ALL: 1,
  RESPONSE_BLOCKCHAIN: 2
};
const { p2pPort } = require('../config');
const { sortBlocks } = require('../utils');

class Socket{
  constructor (blockChain, initialPeers = []){
    this.sockets = [];

    const port = process.env.P2P_PORT || p2pPort;
    this.server = new WebSocket.Server({ port });
    const that = this;
    this.server.on('connection', ws => that.initConnection(ws));
    this.blockChain = blockChain;
    this.connectToPeers(initialPeers);
  }

  initConnection (ws){
    console.log('Initiating Connection');
    this.sockets.push(ws);
    this.initMessageHandler(ws);
    this.initErrorHandler(ws);
    this.write(ws, this.queryChainLengthMsg());
  }

  broadcast (message){
    this.sockets.forEach(socket => this.write(socket, message));
  }

  write (socket, message){
    socket.send(JSON.stringify(message));
  }

  initMessageHandler (ws){
    ws.on('message', (data) => {
      const message = JSON.parse(data);
      console.log('Received message' + JSON.stringify(message));
      switch (message.type) {
      case MessageType.QUERY_LATEST:
        this.write(ws, this.responseLatestMsg());
        break;
      case MessageType.QUERY_ALL:
        this.write(ws, this.responseChainMsg());
        break;
      case MessageType.RESPONSE_BLOCKCHAIN:
        this.handleBlockchainResponse(message);
        break;
      }
    });
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

  initErrorHandler (ws){
    const closeConnection = (ws) => {
      console.log('connection failed to peer: ' + ws.url);
      this.sockets.splice(this.sockets.indexOf(ws), 1);
    };
    ws.on('close', () => closeConnection(ws));
    ws.on('error', () => closeConnection(ws));
  }

  queryChainLengthMsg (){
    return { 'type': MessageType.QUERY_LATEST };
  }

  queryAllMsg (){
    return { 'type': MessageType.QUERY_ALL };
  }

  connectToPeers (newPeers){
    const that = this;
    newPeers.forEach((peer) => {
      const ws = new WebSocket(peer);
      ws.on('open', () => that.initConnection(ws));
      ws.on('error', () => {
        console.log('connection failed');
      });
    });
  }
}

module.exports = Socket;
