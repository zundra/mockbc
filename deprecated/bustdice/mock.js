<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Mock Bustadice Table</title>
  <style>
    body {
      background: #1e2b3a;
      font-family: sans-serif;
      color: #fff;
      padding: 20px;
    }

    ._wagerHistory {
      background: #2c3e50;
      padding: 15px;
      border-radius: 6px;
    }

    ._tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
    }

    ._tabs a {
      padding: 6px 12px;
      border-radius: 4px;
      text-decoration: none;
      color: #ccc;
      background: #34495e;
    }

    ._activeTab {
      background-color: #3d566e;
      color: #fff;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th, td {
      padding: 10px;
      border-bottom: 1px solid #4e5d6c;
    }

    th {
      background: #3d566e;
    }

    tbody tr td {
      background: #2f4154;
    }
  </style>
</head>
<body>

<div class="_wagerHistory">
  <div class="_tabs">
    <a class="_activeTab">Me</a>
    <a class="_inactiveTab">Friends</a>
    <a class="_inactiveTab">High rollers</a>
    <a class="_inactiveTab">All</a>
  </div>

  <table>
    <thead>
      <tr>
        <th>Bet ID</th>
        <th>Wager</th>
        <th>Target</th>
        <th>Outcome</th> <!-- This is the important column -->
        <th>Profit/Loss</th>
      </tr>
    </thead>
    <tbody id="bustadice-table-body">
      <!-- New rows will be prepended here -->
    </tbody>
  </table>
</div>

<script>
class MockBustadice {
    constructor() {
        this.intervalID = null;
        this.clientSeed = null;
        this.serverSeed = null;
        this.nonce = 0;
    }

    setResult() {
        const hash = this.hmac_sha256(
            this.getClientSeed() + ":" + this.getNonce(),
            this.getServerSeed()
        );

        const result = this.gameResult(String(hash)).toFixed(2) + "x";
        const betId = Math.random().toString(36).substring(2, 10);
        const row = document.createElement("tr");

        row.className = "_row_1bzg1_1 _win_1g6gg_1";
        row.innerHTML = `
          <td class="_cell_1bzg1_1"><a class="_link_1bzg1_4" href="#">${betId}</a></td>
          <td class="_cell_1bzg1_1 text-right"><a class="_link_1bzg1_4" href="#">1 bit</a></td>
          <td class="_cell_1bzg1_1 text-right"><a class="_link_1bzg1_4" href="#">1.50x</a></td>
          <td class="_cell_1bzg1_1 text-right"><a class="_link_1bzg1_4" href="#">${result}</a></td>
          <td class="_cell_1bzg1_1 text-right"><a class="_link_1bzg1_4" href="#">0.5 bits</a></td>
        `;

        const tbody = document.getElementById("bustadice-table-body");
        tbody.prepend(row); // Latest result at the top

        this.incrementNonce();
    }

    incrementNonce() {
        this.nonce++;
    }

    stop() {
        if (this.intervalID) clearInterval(this.intervalID);
    }

    start() {
        this.stop();
        this.intervalID = setInterval(this.setResult.bind(this), 1000);
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

    gameResult(hash) {
        let seed = hash.slice(0, 13); // 52 bits / 4 = 13 hex chars
        const r = parseInt(seed, 16);
        let X = r / Math.pow(2, 52);
        X = 99 / (1 - X);
        const result = Math.floor(X);
        return Math.max(1, result / 100);
    }

    hmac_sha256(msg, salt) {
        function simpleHash(input) {
            let hash = 2166136261;
            for (let i = 0; i < input.length; i++) {
                hash ^= input.charCodeAt(i);
                hash = (hash * 16777619) & 0xffffffff;
            }
            return hash;
        }

        const combined = msg + salt;
        let hashValue = simpleHash(combined);
        hashValue ^= hashValue >>> 16;
        hashValue = Math.abs(hashValue).toString(16);

        const randomPrefix = Math.floor(Math.random() * 0xffffff)
            .toString(16)
            .padStart(6, "0");

        return randomPrefix + hashValue;
    }
}

const mock = new MockBustadice();
//mock.start();
</script>
</body>
</html>
