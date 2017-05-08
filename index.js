'use strict'

const Web3 = require('web3')
const ut = require('ethereumjs-util')
const Tx = require('ethereumjs-tx')

const registry_abi = require('./contracts/registry.abi')
const did_abi = require('./contracts/did.abi')
const registry_addr = require('./contracts/registry.addr')

module.exports = function(provider) {

  var tasks = {}
  var task_timer = setInterval(function() {
    var tx_hashes = Object.keys(tasks)
    for (var i = tx_hashes.length - 1; i >= 0; i--) {
      tasks[tx_hashes[i]].task()
    }
  }, 10 * 1000)

  const web3 = typeof provider === 'string' ? new Web3(new Web3.providers.HttpProvider(provider)) : provider

  var didm = web3.eth.contract(registry_abi)
  var did = web3.eth.contract(did_abi)
  var registry = didm.at(registry_addr)

  function new_task(hash, callback) {
    tasks[hash] = {
      ttl: 100,
      callback: callback
    }
    tasks[hash].task = function(tx) {
      web3.eth.getTransactionReceipt(tx, function(err, receipt) {
        var removeflag = false
        if (err || this.ttl < 0) {
          removeflag = true
          this.callback(err || new Error('ran out of retries waiting for tx confirmation'))
        }
        if (!removeflag &&
            receipt &&
            ((web3.eth.blockNumber - receipt.blockNumber) > 0) &&
            Array.isArray(receipt.logs) &&
            receipt.logs.length
        ) {
          removeflag = true
          this.callback(null, `0x${receipt.logs[0].data.slice(26)}`)
        }
        if (removeflag) delete tasks[tx]
        else this.ttl -= 1
      }.bind(this))
    }.bind(tasks[hash], hash)
  }

  return {
    spawn: function(admin_addr, owner_addr, signer_key, on_spawned) {
      let calldata = registry.create.getData(owner_addr, admin_addr, admin_addr, "")
      let signer_buf = Buffer.from(signer_key, 'hex')
      let signer_addr = `0x${ut.privateToAddress(signer_buf).toString('hex')}`

      web3.eth.getTransactionCount(signer_addr, (err, nonce) => {

        if (err) return on_spawned(err)

        // TODO (stephanIOA): Import gasLimit
        let transaction = new Tx({
          to: registry_addr,
          gasLimit: 3000000,
          gasPrice: +web3.toWei(20, 'gwei'),
          nonce: nonce,
          data: calldata
        })

        transaction.sign(signer_buf)

        let raw = `0x${transaction.serialize().toString('hex')}`

        return web3.eth.sendRawTransaction(raw, function(err, txhash) {
          if (err) return on_spawned(err)
          else return new_task(txhash, on_spawned)
        })

      })
    },

    verify: function(did_address, cb) {
      return registry.verify(did_address, (err, data) => {
        return cb(err, data)
      })
    },

    update: function(did_addr, new_ddo, admin_key, on_updated) {
      let did_instance = did.at(did_addr)
      let calldata = did_instance.updateDidContent.getData(new_ddo)
      let signer_buf = Buffer.from(admin_key, 'hex')
      let signer_adr = `0x${ut.privateToAddress(signer_buf).toString('hex')}`

      return web3.eth.getTransactionCount(signer_adr, (err, nonce) => {
        if (err) return on_updated(err)
        // TODO (stephanIOA): Make gasLimit dynamic
        let transaction = new Tx({
          to: did_addr,
          gasLimit: 3000000,
          gasPrice: +web3.toWei(20, 'gwei'),
          nonce: nonce,
          data: calldata
        })

        transaction.sign(signer_buf)

        let raw = `0x${transaction.serialize().toString('hex')}`

        return web3.eth.sendRawTransaction(raw, function(err, txhash) {
          if (err) return on_updated(err)
          else new_task(txhash, on_updated)
        })

      })
    }
  }

}
