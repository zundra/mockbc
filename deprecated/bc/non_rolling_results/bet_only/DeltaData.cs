#region Using declarations
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using System.Xml.Serialization;
using NinjaTrader.Cbi;
using NinjaTrader.Gui;
using NinjaTrader.Gui.Chart;
using NinjaTrader.Gui.SuperDom;
using NinjaTrader.Gui.Tools;
using NinjaTrader.Data;
using NinjaTrader.NinjaScript;
using NinjaTrader.Core.FloatingPoint;
using NinjaTrader.NinjaScript.DrawingTools;
#endregion

//This namespace holds Indicators in this folder and is required. Do not change it. 
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Xml.Serialization;
using NinjaTrader.Data;
using NinjaTrader.Gui.Tools;
using NinjaTrader.NinjaScript;
using NinjaTrader.NinjaScript.DrawingTools;

namespace NinjaTrader.NinjaScript.Indicators
{
    public class DeltaData : Indicator
    {
		private int		activeBar;
		private double	buys;
		private double	sells;
		
		private (double current, double previous) BidVol = (0, 0);
		private (double current, double previous) AskVol = (0, 0);
		
		private double previousBidVol;
		private double currentAskVol;
		private double previousAskVol;
		
        private double currentBid;
        private double currentAsk;
		private double previousLastPrice;
		private int    lastAggressor; // +1 = buy, -1 = sell, 0 = unknown
		
        // Accumulate by absolute PRIMARY bar index
        private Dictionary<int, double> buyByBar;
        private Dictionary<int, double> sellByBar;

        // Optional: prune to avoid unbounded growth
        private int lastPrunedBar = -1;

        protected override void OnStateChange()
        {
            if (State == State.SetDefaults)
            {
                Name                     = "DeltaData";
                Calculate                = Calculate.OnEachTick;
                IsOverlay                = false;
                DrawOnPricePanel         = true;
                IsSuspendedWhileInactive = true;

                UpColor   = Brushes.Lime;
                DownColor = Brushes.Red;

                AddPlot(new Stroke(UpColor, 2), PlotStyle.Bar, "Buy Vol");
                AddPlot(new Stroke(DownColor, 2), PlotStyle.Bar, "Sell Vol");
            }
            else if (State == State.Configure)
            {
                // LAST trades (1-tick)
                AddDataSeries(BarsPeriodType.Tick, 1);

                // BID / ASK for same instrument (1-tick)
                AddDataSeries("ES 03-26", BarsPeriodType.Tick, 1, MarketDataType.Bid);
                AddDataSeries("ES 03-26", BarsPeriodType.Tick, 1, MarketDataType.Ask);
            }
            else if (State == State.DataLoaded)
            {
                buyByBar  = new Dictionary<int, double>(4096);
                sellByBar = new Dictionary<int, double>(4096);
            }
        }

		 protected override void OnBarUpdate() {
		 	if (State == State.Historical) {
//				BackFillDelta();
				return;
			}
			
			
			if (CurrentBar < activeBar)
				return;

			// New Bar has been formed
			// - Assign last volume counted to the prior bar
			// - Reset volume count for new bar
			if (CurrentBar != activeBar)
			{
				SellVol[1] = -sells;
				BuyVol[1] = buys;
				buys = 0;
				sells = 0;
				activeBar = CurrentBar;
			}

			SellVol[0] = -sells;
			BuyVol[0] = buys;
		 }
        
		 
		protected override void OnMarketData(MarketDataEventArgs e)
		{
			if(e.MarketDataType == MarketDataType.Last)
			{
				if(e.Price >= e.Ask)
					buys += Instrument.MasterInstrument.InstrumentType == InstrumentType.CryptoCurrency ? Core.Globals.ToCryptocurrencyVolume(e.Volume) : e.Volume;
				else if (e.Price <= e.Bid)
					sells -= Instrument.MasterInstrument.InstrumentType == InstrumentType.CryptoCurrency ? Core.Globals.ToCryptocurrencyVolume(e.Volume) : e.Volume;
			}
		}
		
		private void BackFillDelta()
        {			
			BidVol = (GetCurrentBidVolume(), BidVol.current);
			AskVol = (GetCurrentAskVolume(), AskVol.current);

			//			BidVol = 
            // -----------------------------
            // BID updates
            // -----------------------------
            if (BarsInProgress == 2)
            {
                if (CurrentBars[2] < 0) return;
                currentBid = Closes[2][0];
                return;
            }

            // -----------------------------
            // ASK updates
            // -----------------------------
            if (BarsInProgress == 3)
            {
                if (CurrentBars[3] < 0) return;
                currentAsk = Closes[3][0];
                return;
            }

            // -----------------------------
            // LAST ticks: accumulate into dictionaries keyed by primary bar index
            // -----------------------------
            if (BarsInProgress == 1)
            {
                if (CurrentBars[1] < 0 || CurrentBars[0] < 0)
                    return;

                // Must have bid/ask (historical can start before these show)
                if (currentBid <= 0 || currentAsk <= 0)
                    return;

                double lastPrice = Closes[1][0];
                double lastVol   = Volumes[1][0];

				bool isBuy  = false;
				bool isSell = false;
				
				// 1) Bid / Ask classification
				if (lastPrice >= currentAsk)
				{
				    isBuy = true;
				}
				else if (lastPrice <= currentBid)
				{
				    isSell = true;
				}
				else
				{
				    // 2) Mid-print fallback: uptick / downtick
				    if (previousLastPrice != 0)
				    {
				        if (lastPrice > previousLastPrice)
				            isBuy = true;
				        else if (lastPrice < previousLastPrice)
				            isSell = true;
				        else
				        {
				            // 3) Flat tick fallback: reuse last aggressor
				            if (lastAggressor > 0)
				                isBuy = true;
				            else if (lastAggressor < 0)
				                isSell = true;
				        }
				    }
				}
				
				// If still unclassified, skip
				if (!isBuy && !isSell)
				    return;
				
				// Track aggressor memory
				lastAggressor = isBuy ? 1 : -1;
				previousLastPrice = lastPrice;

                // Map tick time -> PRIMARY bar absolute index
                int barIdx = BarsArray[0].GetBar(Times[1][0]);
                if (barIdx < 0)
                    return;

                if (isBuy)
                {

					buyByBar.TryGetValue(barIdx, out double v);
                    buyByBar[barIdx] = v + lastVol;
				}
                else // isSell
                {
					sellByBar.TryGetValue(barIdx, out double v);
                    sellByBar[barIdx] = v - lastVol; // keep sells negative like you were doing
				}

                return;
            }

            // -----------------------------
            // PRIMARY series: publish values for this bar
            // -----------------------------
            if (BarsInProgress != 0)
                return;

            if (CurrentBars[0] < 0)
                return;

            int curBar = CurrentBar;

            buyByBar.TryGetValue(curBar, out double buy);
            sellByBar.TryGetValue(curBar, out double sell);

            BuyVol[0]  = buy;
            SellVol[0] = sell;

            // Optional pruning: remove old entries once we move forward
            // Keeps memory stable on long charts
            if (curBar > lastPrunedBar)
            {
                int pruneBelow = curBar - 2000; // keep last N bars in memory
                if (pruneBelow > 0)
                {
                    // cheap prune: only when advancing
                    // (dictionary enumeration is O(n), but this is infrequent)
                    var toRemove = new List<int>();
                    foreach (var k in buyByBar.Keys)
                        if (k < pruneBelow) toRemove.Add(k);
                    foreach (var k in toRemove) buyByBar.Remove(k);

                    toRemove.Clear();
                    foreach (var k in sellByBar.Keys)
                        if (k < pruneBelow) toRemove.Add(k);
                    foreach (var k in toRemove) sellByBar.Remove(k);
                }
                lastPrunedBar = curBar;
            }
        }

        #region Properties

        [NinjaScriptProperty]
        [XmlIgnore]
        [Display(Name = "Down Color", GroupName = "Visual", Order = 1)]
        public Brush DownColor { get; set; }

        [Browsable(false)]
        public string DownColorSerializable
        {
            get => Serialize.BrushToString(DownColor);
            set => DownColor = Serialize.StringToBrush(value);
        }

        [NinjaScriptProperty]
        [XmlIgnore]
        [Display(Name = "Up Color", GroupName = "Visual", Order = 2)]
        public Brush UpColor { get; set; }

        [Browsable(false)]
        public string UpColorSerializable
        {
            get => Serialize.BrushToString(UpColor);
            set => UpColor = Serialize.StringToBrush(value);
        }

        [Browsable(false)]
        [XmlIgnore]
        public Series<double> BuyVol => Values[0];

        [Browsable(false)]
        [XmlIgnore]
        public Series<double> SellVol => Values[1];

        #endregion
    }
}

#region NinjaScript generated code. Neither change nor remove.

namespace NinjaTrader.NinjaScript.Indicators
{
	public partial class Indicator : NinjaTrader.Gui.NinjaScript.IndicatorRenderBase
	{
		private DeltaData[] cacheDeltaData;
		public DeltaData DeltaData(Brush downColor, Brush upColor)
		{
			return DeltaData(Input, downColor, upColor);
		}

		public DeltaData DeltaData(ISeries<double> input, Brush downColor, Brush upColor)
		{
			if (cacheDeltaData != null)
				for (int idx = 0; idx < cacheDeltaData.Length; idx++)
					if (cacheDeltaData[idx] != null && cacheDeltaData[idx].DownColor == downColor && cacheDeltaData[idx].UpColor == upColor && cacheDeltaData[idx].EqualsInput(input))
						return cacheDeltaData[idx];
			return CacheIndicator<DeltaData>(new DeltaData(){ DownColor = downColor, UpColor = upColor }, input, ref cacheDeltaData);
		}
	}
}

namespace NinjaTrader.NinjaScript.MarketAnalyzerColumns
{
	public partial class MarketAnalyzerColumn : MarketAnalyzerColumnBase
	{
		public Indicators.DeltaData DeltaData(Brush downColor, Brush upColor)
		{
			return indicator.DeltaData(Input, downColor, upColor);
		}

		public Indicators.DeltaData DeltaData(ISeries<double> input , Brush downColor, Brush upColor)
		{
			return indicator.DeltaData(input, downColor, upColor);
		}
	}
}

namespace NinjaTrader.NinjaScript.Strategies
{
	public partial class Strategy : NinjaTrader.Gui.NinjaScript.StrategyRenderBase
	{
		public Indicators.DeltaData DeltaData(Brush downColor, Brush upColor)
		{
			return indicator.DeltaData(Input, downColor, upColor);
		}

		public Indicators.DeltaData DeltaData(ISeries<double> input , Brush downColor, Brush upColor)
		{
			return indicator.DeltaData(input, downColor, upColor);
		}
	}
}

#endregion
