import BigNumber from 'bignumber.js';
import { DerivationModes } from '../types';
import WalletLedger from '../wallet';
import { Account } from '../account';
import { Merge } from '../pickingstrategies/Merge';
import MockBtc from './mocks/Btc';

describe('testing wallet', () => {
  const wallet = new WalletLedger();
  let account: Account;
  it('should generate an account', async () => {
    account = await wallet.generateAccount({
      btc: new MockBtc(),
      path: "44'/0'",
      index: 0,
      currency: 'bitcoin',
      network: 'mainnet',
      derivationMode: DerivationModes.LEGACY,
      explorer: 'ledgerv3',
      explorerURI: 'https://explorers.api.vault.ledger.com/blockchain/v3/btc',
      storage: 'mock',
      storageParams: [],
    });

    expect(account.xpub.xpub).toEqual(
      'xpub6CV2NfQJYxHn7MbSQjQip3JMjTZGUbeoKz5xqkBftSZZPc7ssVPdjKrgh6N8U1zoQDxtSo6jLarYAQahpd35SJoUKokfqf1DZgdJWZhSMqP'
    );
  });

  it('should sync an account', async () => {
    await wallet.syncAccount(account);
    const balance = await wallet.getAccountBalance(account);

    expect(balance.toNumber()).toEqual(109088);
  }, 60000);

  it('should allow to store and load an account', async () => {
    const serializedAccount = await wallet.exportToSerializedAccount(account);
    const unserializedAccount = await wallet.importFromSerializedAccount(serializedAccount);
    const balance = await wallet.getAccountBalance(unserializedAccount);
    expect(balance.toNumber()).toEqual(109088);
  });

  it('should allow to build a transaction', async () => {
    const receiveAddress = await wallet.getAccountNewReceiveAddress(account);
    const utxoPickingStrategy = new Merge(account.xpub.crypto, account.xpub.derivationMode, []);
    const txInfo = await wallet.buildAccountTx({
      fromAccount: account,
      dest: receiveAddress.address,
      amount: new BigNumber(100000),
      feePerByte: 5,
      utxoPickingStrategy,
    });
    const tx = await wallet.signAccountTx({
      btc: new MockBtc(),
      fromAccount: account,
      txInfo,
    });
    expect(tx).toEqual('a1e3e67bfc06cc1ae259474beebc423b2890a19a');
  });

  it('should allow to build a transaction splitting outputs', async () => {
    const receiveAddress = await wallet.getAccountNewReceiveAddress(account);
    account.xpub.OUTPUT_VALUE_MAX = 60000;
    const utxoPickingStrategy = new Merge(account.xpub.crypto, account.xpub.derivationMode, []);
    const txInfo = await wallet.buildAccountTx({
      fromAccount: account,
      dest: receiveAddress.address,
      amount: new BigNumber(100000),
      feePerByte: 5,
      utxoPickingStrategy,
    });
    const tx = await wallet.signAccountTx({
      btc: new MockBtc(),
      fromAccount: account,
      txInfo,
    });
    expect(tx).toEqual('637a8cb808fa1cd8b81a97e27b6bab94d87b899f');
  });
});
