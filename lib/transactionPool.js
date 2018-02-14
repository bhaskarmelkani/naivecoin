'use strict';

const { cloneDeep, without, find } = require('lodash');

const { validateTransaction } = require('./transaction');

class TransactionPool {
  constructor (unspentTxOuts){
    this.pool = [];
    this.unspentTxOuts = unspentTxOuts;
  }

  getPool (){
    return cloneDeep(this.pool);
  }

  addToPool (tx){
    if (!validateTransaction(tx, this.unspentTxOuts)) {
      throw Error('Trying to add invalid tx to pool');
    }

    if (!this.isValidTxForPool(tx, this.pool)) {
      throw Error('Trying to add invalid tx to pool');
    }
    console.log('adding to txPool: %s', JSON.stringify(tx));
    this.pool.push(tx);
  }

  hasTxIn (txIn) {
    const foundTxIn = this.unspentTxOuts.find((uTxO) => {
      return uTxO.txOutId === txIn.txOutId && uTxO.txOutIndex === txIn.txOutIndex;
    });
    return !!foundTxIn;
  }

  updateTransactionPool () {
    const invalidTxs = [];
    for (const tx of this.pool) {
      for (const txIn of tx.txIns) {
        if (!this.hasTxIn(txIn, this.unspentTxOuts)) {
          invalidTxs.push(tx);
          break;
        }
      }
    }
    if (invalidTxs.length > 0) {
      console.log('removing the following transactions from txPool: %s', JSON.stringify(invalidTxs));
      this.pool = without(this.pool, ...invalidTxs);
    }
  }

  getTxPoolIns (transactionPool){
    return transactionPool
      .map(tx => tx.txIns)
      .reduce((acc, curr) => (curr.forEach(txIn => acc.push(txIn)),acc) , []); // 1 level flattning
  }

  isValidTxForPool (tx) {
    const txPoolIns = this.getTxPoolIns(this.pool);

    const containsTxIn = (txIns, txIn) => {
      return find(txPoolIns, ((txPoolIn) => {
        return txIn.txOutIndex === txPoolIn.txOutIndex && txIn.txOutId === txPoolIn.txOutId;
      }));
    };

    for (const txIn of tx.txIns) {
      if (containsTxIn(txPoolIns, txIn)) {
        console.log('txIn already found in the txPool');
        return false;
      }
    }
    return true;
  }

}

module.exports = TransactionPool;
