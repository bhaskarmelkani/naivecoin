'use strict';

const Router = require('koa-router');
const router = new Router();

const _ = require('lodash');

const wallet = require('./wallet');

module.exports = (blockChain) => {
  const webSocket = blockChain.webSocket;

  return router
    .get('/blocks', (ctx) => {
      ctx.body = blockChain.chain;
    })
    .get('/block/:hash', (ctx) => {
      const block = _.find(blockChain.getBlockchain(), { 'hash': ctx.params.hash });
      ctx.body = block;
    })
    .get('/transaction/:id', (ctx) => {
      const tx = _(blockChain.getBlockchain())
        .map((blocks) => blocks.data)
        .flatten()
        .find({ 'id': ctx.params.id });
      ctx.body = tx;
    })
    .get('/address/:address', (ctx) => {
      const unspentTxOuts = _.filter(blockChain.getUnspentTxOuts(), (uTxO) => uTxO.address === ctx.params.address);
      ctx.body = { 'unspentTxOuts': unspentTxOuts };
    })
    .get('/unspentTransactionOutputs', (ctx) => {
      ctx.body = blockChain.getUnspentTxOuts();
    })
    .get('/myUnspentTransactionOutputs', (ctx) => {
      ctx.body = blockChain.getMyUnspentTransactionOutputs();
    })
    .post('/mineRawBlock', (ctx) => {
      if (ctx.request.body.data === null) {
        ctx.body = 'data parameter is missing';
        return;
      }
      const newBlock = blockChain.generateRawNextBlock(ctx.request.body.data);
      if (newBlock === null) {
        ctx.body = 'could not generate block';
        // TODO: set status = 4000
      }
      else {
        ctx.body = newBlock;
      }
    })
    .post('/mineBlock', (ctx) => {
      const newBlock = blockChain.generateNextBlock();
      if (newBlock === null) {
        ctx.body = 'could not generate block';
        // TODO: set status = 4000
      }
      else {
        ctx.body = newBlock;
      }
    })
    .get('/balance', (ctx) => {
      const balance = blockChain.getAccountBalance();
      ctx.body = { 'balance': balance };
    })
    .get('/address', (ctx) => {
      const address = wallet.getPublicFromWallet();
      ctx.body = { 'address': address };
    })
    .post('/mineTransaction', (ctx) => {
      const address = ctx.request.body.address;
      const amount = ctx.request.body.amount;
      try {
        const resp = blockChain.generatenextBlockWithTransaction(address, amount);
        ctx.body = resp;
      }
      catch (e) {
        console.log(e.message);
        // TODO: set status = 4000
        ctx.body = e.message;
      }
    })
    .post('/sendTransaction', (ctx) => {
      try {
        const address = ctx.request.body.address;
        const amount = ctx.request.body.amount;
        if (address === undefined || amount === undefined) {
          throw Error('invalid address or amount');
        }
        const resp = blockChain.sendTransaction(address, amount);
        ctx.body = resp;
      }
      catch (e) {
        console.log(e.message);
        ctx.body = e.message;
      }
    })
    .get('/transactionPool', (ctx) => {
      ctx.body = blockChain.transactionPool.getPool();
    })
    .get('/peers', (ctx) => {
      ctx.body = webSocket.getSockets().map((s) => s._socket.remoteAddress + ':' + s._socket.remotePort);
    })
    .post('/addPeer', (ctx) => {
      webSocket.connectToPeers(ctx.request.body.peer);
      ctx.body = '';
    })
    .post('/stop', (ctx) => {
      ctx.body = { 'msg': 'stopping server' };
      process.exit();
    });
};
