// from https://github.com/LedgerHQ/xpub-scan/blob/master/src/actions/deriveAddresses.ts

import * as bjs from 'bitcoinjs-lib';
// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
import { bech32, bech32m } from 'bech32';
import Base from './base';

/**
 * Temporarily copied from bitcoinjs-lib master branch (as of 2021-09-02,
 * commit 7b753caad6a5bf13d40ffb6ae28c2b00f7f5f585) so that we can make use of the
 * updated bech32 lib version 2.0.0 that supports bech32m. bitcoinjs-lib version 5.2.0
 * as currently used by wallet-btc uses an older version of bech32 that lacks bech32m support.
 *
 * When a new version of bitcoinjs-lib that supports bech32m is released this function can
 * be removed and calls should be directed to bitcoinjs-lib instead. Our direct dependency
 * on bech32 lib should also be removed.
 *
 * TODO: Replace with bitcoinjs-lib call
 */
/* eslint-disable */
function fromBech32(address: string): { version: number, prefix: string, data: Buffer} {
  let result;
  let version;
  try {
    result = bech32.decode(address);
  } catch (e) {}

  if (result) {
    version = result.words[0];
    if (version !== 0) throw new TypeError(address + ' uses wrong encoding');
  } else {
    result = bech32m.decode(address);
    version = result.words[0];
    if (version === 0) throw new TypeError(address + ' uses wrong encoding');
  }

  const data = bech32.fromWords(result.words.slice(1));

  return {
    version,
    prefix: result.prefix,
    data: Buffer.from(data),
  };
}
/* eslint-enable */

// This function expects a valid base58check address or a valid
// bech32/bech32m address.
function toOutputScriptTemporary(validAddress: string, network: bjs.Network): Buffer {
  try {
    const decodeBase58 = bjs.address.fromBase58Check(validAddress);
    if (decodeBase58.version === network.pubKeyHash)
      return bjs.payments.p2pkh({ hash: decodeBase58.hash }).output as Buffer;
    if (decodeBase58.version === network.scriptHash)
      return bjs.payments.p2sh({ hash: decodeBase58.hash }).output as Buffer;
  } catch (e) {
    // It's not a base58 address, so it's a segwit address
  }
  const decodeBech32 = fromBech32(validAddress);
  return bjs.script.compile([
    // OP_0 is encoded as 0x00, but OP_1 through OP_16 are encoded as 0x51 though 0x60, see BIP173
    decodeBech32.version + (decodeBech32.version > 0 ? 0x50 : 0),
    decodeBech32.data,
  ]);
}

class Bitcoin extends Base {
  toOutputScript(address: string) {
    // Make sure the address is valid on this network
    // otherwise we can't call toOutputScriptTemporary.
    if (!this.validateAddress(address)) {
      throw new Error('Invalid address');
    }
    // bitcoinjs-lib/src/address doesn't yet have released support for bech32m,
    // so we'll implement our own version of toOutputScript while waiting.
    // This implementation is highly inspired (stolen) from bitcoinjs-lib's
    // master branch.
    // One major difference is that our function requires an already
    // valid address, whereas to bitcoinjs-lib version doesn't.
    // TODO: Replace with bitcoinjs-lib call
    return toOutputScriptTemporary(address, this.network);
  }

  validateAddress(address: string): boolean {
    try {
      const result = bjs.address.fromBase58Check(address);
      if (this.network.pubKeyHash === result.version || this.network.scriptHash === result.version) {
        return true;
      }
      // Can a valid base58check string (but an invalid address) be a valid bech32 address? If so we should throw
      // here and try bech32 decoding as well. If not, we should return false immediately.
      // Also it'd probably make sense to first try bech32, then base58check, because bech32 checksums are
      // stronger.
      // throw new TypeError(`${address} uses wrong version ${result.version}. Expected ${network.pubKeyHash} or ${network.scriptHash}.`)
      return false;
    } catch {
      // Not a valid base58check string
      let result;
      try {
        result = fromBech32(address);
      } catch {
        // Not a valid Bech32 address either
        return false;
      }

      if (this.network.bech32 !== result.prefix) {
        // Address doesn't use the expected human-readable part ${network.bech32}
        return false;
      }
      if (result.version > 16 || result.version < 0) {
        // Address has invalid version
        return false;
      }
      if (result.data.length < 2 || result.data.length > 40) {
        // Address has invalid data length
        return false;
      }
      if (result.version === 0 && result.data.length !== 20 && result.data.length !== 32) {
        // Version 0 address uses an invalid witness program length
        return false;
      }
    }
    return true;
  }
}

export default Bitcoin;
