    class BankRoll {
      constructor(startBalance, lossLimit) {
        this.startBalance = startBalance;
        this.currentBalance = startBalance;
        this.lossLimit = -lossLimit;
        this.drawDown = 0;
        this.haltMessage = null
      }

      getBalance = () => this.currentBalance;
      getPL = () => this.currentBalance - this.startBalance;
      increment = (profit) => (this.currentBalance += profit);
      shouldHalt = () => this.haltMessage != null
      decrement(loss) {
        this.currentBalance -= loss;
        this.drawDown = Math.min(this.drawDown, this.currentBalance)
        
        if (this.getPL() <= this.lossLimit) {
          this.haltMessage = `[HALT] Loss limit ${this.lossLimit} exceeded ${this.getPL()}`
        }
      }
    }