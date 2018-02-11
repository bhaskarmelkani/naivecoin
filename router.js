'use strict';

var Router = require('koa-router');
var router = new Router();

module.exports = (blockChain) => {

  router
    .get('/blocks', async (ctx, next) =>
      // ctx.body(JSON.stringify(blockchain))
    )
    .post('/mineBlock', async (ctx, next) => {
        var newBlock = generateNextBlock(req.body.data);
        addBlock(newBlock);
        broadcast(responseLatestMsg());
        console.log('block added: ' + JSON.stringify(newBlock));
        res.body('ok');
    })
    .get('/peers', async (ctx, next) => {
        res.body(sockets.map(s => s._socket.remoteAddress + ':' + s._socket.remotePort));
    })
    .post('/addPeer', async (ctx, next) => {
        connectToPeers([req.body.peer]);
        res.body('ok');
    });
};
