'use strict';

const Router = require('koa-router');
const router = new Router();

module.exports = (blockChain, webSocket) => {

  return router
    .get('/blocks', async (ctx) => {
      ctx.body = JSON.stringify(blockChain);
    })
    .post('/mineBlock', async (ctx) => {
      const newBlock = blockChain.generateNextBlock(ctx.request.body.data);
      blockChain.addBlock(newBlock);
      webSocket.broadcast(webSocket.responseLatestMsg());
      console.log('block added: ' + JSON.stringify(newBlock));
      ctx.body = 'ok';
    })
    .get('/peers', async (ctx) => {
      ctx.body = webSocket.sockets.map(s => s._socket.remoteAddress + ':' + s._socket.remotePort);
    })
    .post('/addPeer', async (ctx) => {
      webSocket.connectToPeers([ctx.request.body.peer]);
      ctx.body = 'ok';
    });
};
