/* Mock BC */
class MockBC {
  constructor() {
    this.results = [];
    this.intervalID = null;
    this.clientSeed = null;
    this.serverSeed = null;
    this.nonce = 0;
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

  getClientSeed() {
    return "bb6be8686341274e68915c96f01a4f3294a4155c4b1cdfaf14d86b84a976d55";
  }

  getServerSeed() {
    return "aaa6be8686341274e68915c96f01a4f3294a4155c4b1cdfaf14d86b84a976d55";
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
    X = 99 / (1 - X);
    const result = Math.floor(X);
    return Math.max(1, result / 100);
  }
}

const mbc = new MockBC();
