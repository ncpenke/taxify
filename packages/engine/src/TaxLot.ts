export enum DerivativeType
{
    None = "NONE",
    Option = "OPTION",
    Future = "FUTURE"
}

export interface TaxLotInput
{
    /* ID of the lot to allow matching with 1099. */
    readonly id: string;
    /* 
     * Identifier for a security or stock for tax purposes. "Similar" stocks/securities should
     * have the same symbol. 
     */
    readonly symbol: string;
    /*
     * The entity through which the transaction was performed. For stocks/securities this should be
     * the financial/brokerage firm at which the transaction was performed, which will report the
     * transaction through a 1099 to the IRS.
     */
    readonly transactionEntity: string;
    /* 
     * Original description as recorded in 1099 or other transaction documentation.
     */
    readonly originalDescription: string;
    /* The type of derivative, if any. */
    readonly derivativeType: DerivativeType;
    /* The quantity transacted. */
    readonly count: number;
    /* The date that the asset was acquired (incorporates holding period
     * adjustments due to wash sales). */
    readonly dateAcquired: Date;
    /* The date the asset was sold. */
    readonly dateSold: Date;
    /* The amount the asset was sold for. */
    readonly proceeds: number;
    /* The amount the asset was bought for (incorporates cost-basis adjustment
     * due to wash sales). */
    readonly costBasis: number;
    /* Any adjustment that should be made to the gains of the asset. */
    readonly adjustment?: number;
    /* True if this is a wash sale. */
    readonly washSale?: boolean;
    /*! True if this is a replacement lot for a wash sale. */
    readonly washSaleReplacement?: boolean;
}

export interface TaxLot extends TaxLotInput
{
    /*! Original ID of the lot to allow matching with 1099. */
    readonly originalId: string;
    /* The original date that the asset was acquired. */
    readonly originalDateAcquired: Date;
    /* The original cost basis. */
    readonly originalCostBasis: number;
    /* The gains for this tranaction (determiend using the determineGains method). */
    readonly gains: number;
    readonly adjustment: number;
    readonly washSale: boolean;
    readonly washSaleReplacement: boolean;
}

export function determineGains(proceeds: number, costBasis: number, adjustment: number): number
{
    return proceeds - costBasis + adjustment;
}


/* Helper function that returns the adjusted cost. */
export function adjustedCost(cost: number, newCount: number, oldCount: number)
{
    if (cost == undefined)
        return cost;

    return cost * newCount / oldCount;
}

export function makeLot(lot: TaxLotInput): TaxLot
{
    return {
        ...lot,
        originalId: lot.id,
        originalDateAcquired: lot.dateAcquired,
        originalCostBasis: lot.costBasis,
        gains: determineGains(lot.proceeds, lot.costBasis, 0),
        washSale: false,
        washSaleReplacement: false,
        adjustment: 0 
    };
}

export function splitLot(lot: TaxLot, newCount: number): TaxLot
{
    let lotCount = lot.count - newCount;
    let newCostBasis = adjustedCost(lot.costBasis, lotCount, lot.count);
    let newProceeds = adjustedCost(lot.proceeds, lotCount, lot.count);
    
    if (lot.adjustment > 0 || lot.washSale || lot.washSaleReplacement)
        throw new Error("Cannot split lot");

    return {
        ...lot,
        count: lotCount,
        costBasis: newCostBasis,
        proceeds: newProceeds,
        gains: determineGains(newCostBasis, newProceeds, 0)
    };
}

export function sortByDateAcquired(lots: TaxLot[])
{
    lots.sort(((a, b) => { return a.dateAcquired.getTime() - b.dateAcquired.getTime(); }));
}