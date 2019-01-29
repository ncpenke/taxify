import * as WashSale from '../WashSale' 
import * as TaxLot from '../TaxLot' 

test('one', () => {
    let lots: TaxLot.TaxLotInput[] = [
        {
            id: "1",
            symbol: "TST",
            transactionEntity: "TEST FIRM",
            originalDescription: "test transaction",
            derivativeType: TaxLot.DerivativeType.None,
            count: 10,
            dateAcquired: new Date("2018-10-10"),
            dateSold: new Date("2018-10-10"),
            proceeds: 200.0,
            costBasis: 100.0
        }
    ];
})