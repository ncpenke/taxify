
import * as TaxLot from "./TaxLot";

/* Identify wash sales, match replacement lots and return the adjusted lots. */
export function adjust(lots: TaxLot.TaxLot[]) : TaxLot.TaxLot[]
{   
    // The array of adjusted lots to be returned.
    let adjustedLots: TaxLot.TaxLot[] = [];

    // Group lots by symbol.
    let groups = new Map<string, TaxLot.TaxLot[]>();
    lots.forEach((lot) => {
        if (!(lot.symbol in groups)) {
            groups[lot.symbol] = []
        }
        groups[lot.symbol].push(lot);
    });

    // For each symbol make any wash sale adjustments, and append them to the adjusted lots.
    groups.forEach((symbolLots) => {
        adjustForSymbol(symbolLots);
        adjustedLots.push(...symbolLots);
    })
    
    return adjustedLots;
}

/* Helper function to find the replacement lot.
 *
 * IRS rules (https://www.irs.gov/publications/p550#en_US_2017_publink100010601):
 *
 *   If the number of shares of substantially identical stock or securities you buy within
 *   30 days before or after the sale is either more or less than the number of shares you 
 *   sold, you must determine the particular shares to which the wash sale rules apply. 
 *   You do this by matching the shares bought with an equal number of the shares sold. Match 
 *   the shares bought in the same order that you bought them, beginning with the first shares
 *   bought. The shares or securities so matched are subject to the wash sale rules.
 * 
 * Also ignore lots that have a sell date before the sell date of the wash sale lot (otherwise can
 * result in infinite back propagation of the loss into the past). The IRS rules are ambiguous about 
 * this.
 */
function findReplacement(lot: TaxLot.TaxLot, lots: TaxLot.TaxLot[]): number
{
    let lotAcquired = lot.dateAcquired.getTime();
    const msInMonth = 30 * 24 * 60 * 60 * 1000;

    for (let i = 0; i < lots.length; ++i) {
        let candidate = lots[i];
        // If the candidate is already a replacement lot, a wash sale, or was never acquired (open short sale),
        // or has the same id (part of the same transaction) then skip it.
        if (candidate.washSaleReplacement || candidate.washSale || !candidate.dateAcquired || candidate.id == lot.id)
            continue;

        // If the candidate was acquired outside of the thirty day window then skip it.
        let candidateAcquired = candidate.dateAcquired.getTime();
        if (Math.abs(candidateAcquired - lotAcquired) > msInMonth)
            continue;

        // If the candidate was sold before the lot was acquired, skip it.
        if (candidate.dateSold) {
            let candidateSold = candidate.dateSold.getTime();
            if (candidateSold - lotAcquired <= 0)
                continue;
        }

        // We have a replacement candidate.
        return i;
    }

    return -1;
}

/* Helper function to peform wash sale adjustment for a single symbol. This returns
 * each time an adjustment is made. Returns true if a lot is adjusted.
 */
function adjustForSymbolOnce(lots: TaxLot.TaxLot[]): boolean
{
    for (let i = 0; i < lots.length; ++i)
    {
        let lot = lots[i];

        if (lot.gains >= 0)
            continue;

        let replacementIndex = findReplacement(lot, lots);
        if (replacementIndex == -1)
            continue;

        let replacement = lots[replacementIndex];
        let newCount = Math.min(replacement.count, lot.count);

        // split replacement lot, and apply the adjustment. flag the original lot as a wash sale.
        let splitReplacement = TaxLot.splitLot(replacement, newCount);
        let splitOriginal = TaxLot.splitLot(lot, newCount);
        
        {
            let newCostBasis = splitReplacement.costBasis + splitOriginal.costBasis;
            let newReplacement = {
                ...splitReplacement,
                costBasis: newCostBasis,
                id: splitOriginal.id,
                proceeds: splitReplacement.proceeds,
                dateAcquired: lot.dateAcquired,
                gains: TaxLot.determineGains(splitReplacement.proceeds, newCostBasis, 0),
                washSaleReplacement: true
            };
            lots[replacementIndex] = splitReplacement;
        }
        {
            let newOriginal = {
                ...splitOriginal,
                washSale: true,
                adjustment: splitOriginal.gains
            };
            lots[i] = newOriginal;
        }

        if (newCount < lot.count)
        {
            lots.push(TaxLot.splitLot(lot, lot.count - newCount));
        }
        else if (newCount < replacement.count)
        {
            lots.push(TaxLot.splitLot(replacement, lot.count - newCount));
        }

        return true;
    }

    return false;
}

/* Helper function to perform wash sale adjustments for a single symbol. */
function adjustForSymbol(lots: TaxLot.TaxLot[])
{
    let run = true;

    while (run) {
        TaxLot.sortByDateAcquired(lots);
        run = adjustForSymbolOnce(lots);
    }
}