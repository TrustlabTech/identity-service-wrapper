'use strict'

const Web3 = require('web3'),
      Tx = require('ethereumjs-tx'),
      ut = require('ethereumjs-util')

const did_abi = require('./contracts/did.abi'),
      registry_abi = require('./contracts/registry.abi'),
      registry_addr = require('./contracts/registry.addr')

let intervalIDs = {}

function watchExecution(txhash, web3) {
  return new Promise(function(resolve, reject) {
    let ttl = 60 // 60 tries, once every 5 seconds === 5 minutes
    intervalIDs[txhash] = setInterval(function() {
      web3.eth.getTransactionReceipt(txhash, function(error, receipt) {
        if (error || ttl < 0) {
          reject(error || new Error('ran out of retries waiting for tx confirmation'))
          clearInterval(intervalIDs[txhash])
          return
        }
        
        if (receipt && Array.isArray(receipt.logs) && receipt.logs.length) {
          resolve(`0x${receipt.logs[0].data.slice(26)}`)
          clearInterval(intervalIDs[txhash])
          return
        }
        
        ttl--
      })
    }, 5 * 1000)
  })
}

module.exports = function(provider) {

  const web3 = typeof provider === 'string' ? new Web3(new Web3.providers.HttpProvider(provider)) : provider

  const didm = web3.eth.contract(registry_abi),
        did = web3.eth.contract(did_abi),
        registry = didm.at(registry_addr)

  return {
    spawn: function(admin_addr, owner_addr, signer_key) {
      return new Promise(function(parentResolve, parentReject) {
        const calldata = registry.create.getData(owner_addr, admin_addr, admin_addr, "")

        const signer_buf = Buffer.from(signer_key, 'hex'),
              signer_addr = `0x${ut.privateToAddress(signer_buf).toString('hex')}`

        web3.eth.getTransactionCount(signer_addr, (err, nonce) => {

          if (err) {
            parentReject(err)
            return
          }

          // TODO (stephanIOA): Import gasLimit
          const transaction = new Tx({
            to: registry_addr,
            gasLimit: 3000000,
            gasPrice: +web3.toWei(20, 'gwei'),
            nonce: nonce,
            data: calldata
          })

          transaction.sign(signer_buf)

          const raw = `0x${transaction.serialize().toString('hex')}`

          return web3.eth.sendRawTransaction(raw, function(error, txhash) {
            if (error) {
              parentReject(error)
              return
            }

            watchExecution(txhash, web3).then(parentResolve).catch(parentReject)
          })
        })
      })
    },

    verify: function(did_address, cb) {
      return registry.verify(did_address, (err, data) => {
        return cb(err, data)
      })
    },

    update: function(did_addr, new_ddo, admin_key, on_updated) {
      return new Promise(function(parentResolve, parentReject) {
        const did_instance = did.at(did_addr),
              calldata = did_instance.updateDidContent.getData(new_ddo)
        
        const signer_buf = Buffer.from(admin_key, 'hex'),
              signer_adr = `0x${ut.privateToAddress(signer_buf).toString('hex')}`

        web3.eth.getTransactionCount(signer_adr, (err, nonce) => {
          if (err) {
            parentReject(err)
            return
          }

          // TODO (stephanIOA): Make gasLimit dynamic
          const transaction = new Tx({
            to: did_addr,
            gasLimit: 3000000,
            gasPrice: +web3.toWei(20, 'gwei'),
            nonce: nonce,
            data: calldata
          })

          transaction.sign(signer_buf)

          const raw = `0x${transaction.serialize().toString('hex')}`

          return web3.eth.sendRawTransaction(raw, function(error, txhash) {
            if (error) {
              parentReject(error)
              return
            } 
            
            watchExecution(txhash, web3).then(parentResolve).catch(parentReject)
          })
        })
      })
    }
  }

}
