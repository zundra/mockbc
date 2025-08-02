/* Mock BC */
class MockBC {
  constructor() {
    this.results = [];
    this.intervalID = null;
    this.clientSeed = null;
    this.serverSeed = null;
    this.nonce = 23228;
  }

  setResult(results) {
    if (this.results.length === 10) {
      this.results.shift();
    }

    this.results.push(
      this.gameResult(
        String(
          this.hmac_sha256(
            this.getClientSeed() + ":" + this.getNonce(),
            this.getServerSeed()
          )
        )
      )
    );

    $(".grid.grid-auto-flow-column").empty();

    for (let i = 0; i < this.results.length; i++) {
      $(".grid.grid-auto-flow-column").append(
        `<div><span>${this.results[i]}</span></div>`
      );
    }

    this.incrementNonce();
  }

  incrementNonce() {
    this.nonce++;
  }

  stop() {
    const intervalID = this.getIntervalID();

    if (intervalID) {
      clearInterval(intervalID);
    }
  }

  start() {
    this.stop();
    this.intervalID = setInterval(
      this.setResult.bind(this),
      Number($("#poll-interval").val())
    );
  }

/* 
Nonce 23228 (2.1x, 6.32x, 1.49x, 2.55x, 1.02x, 2.75x, 1.21x, 1.03x)
Client Seed: Y83TpC2hj2SnjiNEDJwN
Server Seed: 9b98254e8986dd95349fc754b4b087b5d0ddf9771026d68fe4ed661c869420b4
Server Seed Hash: d7e30e322c0ec13033dd8b598a9261f7aa91b008ea9596c45a2f50f179b1a98a


*/
  getClientSeed() {
    return "Y83TpC2hj2SnjiNEDJwN";
  }

  getServerSeed() {
    return "9b98254e8986dd95349fc754b4b087b5d0ddf9771026d68fe4ed661c869420b4";
  }

  getNonce() {
    return this.nonce;
  }

  getIntervalID() {
    return this.intervalID;
  }

  getResults() {
    return this.results;
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  hmac_sha256(msg, salt) {
    return CryptoJS.HmacSHA256(msg, salt);
  }

  gameResult(hash_list) {
    let seed = hash_list;
    const nBits = 52;
    seed = seed.slice(0, nBits / 4);
    const r = parseInt(seed, 16);
    let X = r / Math.pow(2, nBits);
    X = 96 / (1 - X);
    const result = Math.floor(X);
    return Math.max(1, result / 100);
  }
}

const mbc = new MockBC();
