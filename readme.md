[![Stories in Ready](https://badge.waffle.io/TrustlabTech/identity-service-wrapper.png?label=ready&title=Ready)](https://waffle.io/TrustlabTech/identity-service-wrapper?utm_source=badge)
# Identity Service Wrapper Library

## Setup

This library uses the `rc` npm package for config.

Suggestion: create `.gethrc` file in root directory with the following contents:

```
{
  "url": "http://miner:8545"
}
```

## Usage

```javascript
let wrapper = require('./wrapper')

// Create DID:
wrapper.spawn(
  '0x<admin address>',  // Address of Consent managed acct
  '0x<owner address>',  // "Owner" of did _wallet_ features
  '<funder privkey>',   // (32 byte, non hex prefixed key)
  (err, tx_hash) => { } // Callback
)

// Update DDO (did value):
wrapper.update(
  '0x<did address>',    // DID address, not admin or owner's
  '<new ddo STRING>',   // JSON stringify and parse as needed
  '<admin privkey>',    // (32 byte, non hex prefixed key)
  (err, tx_hash) => { } // Callback
)

// Verify DID:
wrapper.verify(
  '0x<did address>',    // DID address, not admin or owner's
  (err, ddo_str) => { } // Callback
)

```
## License

Copyright (c) 2017 Trustlab Pty Ltd, under licence from Global Consent Limited
See our [License](https://github.com/TrustlabTech/identity-service-wrapper/blob/master/LICENSE.md).
