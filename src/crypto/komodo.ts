import Bitcoin from './bitcoin';

class Komodo extends Bitcoin {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor({ network }: { network: any }) {
    super({ network });
    this.network.bip32.public = 0xf9eee48d;
    this.network.pubKeyHash = 0x3c;
    this.network.scriptHash = 0x55;
  }
}

export default Komodo;