'use strict';

var Router = require('koa-router');
var router = new Router();

module.exports = (blockChain, webSocket) => {

  return router
    .get('/blocks', async (ctx, next) =>{
      ctx.body = JSON.stringify(blockChain)
    })
    .post('/mineBlock', async (ctx, next) => {
        var newBlock = blockChain.generateNextBlock(ctx.request.body.data);
        blockChain.addBlock(newBlock);
        webSocket.broadcast(webSocket.responseLatestMsg());
        console.log('block added: ' + JSON.stringify(newBlock));
        ctx.body = 'ok';
    })
    .get('/peers', async (ctx, next) => {
        ctx.body = webSocket.sockets.map(s => s._socket.remoteAddress + ':' + s._socket.remotePort);
    })
    .post('/addPeer', async (ctx, next) => {
        webSocket.connectToPeers([ctx.request.body.peer]);
        ctx.body = 'ok';
    });
};
