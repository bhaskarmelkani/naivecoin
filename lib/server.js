'use strict';

const bodyParser = require('koa-bodyparser');
const app = require('./app');
const { httpPort } = require('../config');

module.exports = (blockChain) => async () => {

  const router = require('./router')(blockChain);
  const port = process.env.HTTP_PORT || httpPort;

  app
    .use(bodyParser())
    .use(router.routes())
    .use(router.allowedMethods());

  await app.listen(port);
};
