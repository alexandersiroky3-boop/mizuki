const BOOST_SELL_PAYOUT_RATE =
    0.10;


// A single sale may still contain far more boosts than a normal player is
// expected to own. The cap only protects PostgreSQL/JavaScript from absurd
// or malformed modal submissions; it is not a daily selling limit.
const MAX_BOOST_SELL_QUANTITY =
    1000000;


function parseSellQuantity(value){

    const normalized =
        typeof value === "string"
            ? value
                .trim()
                .replace(
                    /[,_\s]/g,
                    ""
                )
            : value;


    const quantity =
        Number(
            normalized
        );


    if(
        !Number.isSafeInteger(
            quantity
        )
        ||
        quantity < 1
        ||
        quantity >
            MAX_BOOST_SELL_QUANTITY
    ){

        return null;

    }


    return quantity;

}


function getStateNumber(
    state,
    camelName,
    lowerName
){

    if(!state){
        return NaN;
    }


    const value =
        Object.prototype.hasOwnProperty.call(
            state,
            camelName
        )
            ? state[camelName]
            : state[lowerName];


    return Number(value);

}


function calculateBoostSellQuote(
    state,
    requestedQuantity = 1
){

    const quantity =
        parseSellQuantity(
            requestedQuantity
        );


    if(!quantity){
        return null;
    }


    const rawMin =
        getStateNumber(
            state,
            "currentMin",
            "currentmin"
        );


    const rawMax =
        getStateNumber(
            state,
            "currentMax",
            "currentmax"
        );


    if(
        !Number.isFinite(rawMin)
        ||
        !Number.isFinite(rawMax)
        ||
        rawMin < 1
        ||
        rawMax < rawMin
    ){

        return null;

    }


    const currentMin =
        Math.floor(rawMin);


    const currentMax =
        Math.floor(rawMax);


    const marketMidpoint =
        (
            currentMin +
            currentMax
        ) /
        2;


    const unitPayout =
        Math.max(
            1,
            Math.floor(
                marketMidpoint *
                BOOST_SELL_PAYOUT_RATE
            )
        );


    const totalPayout =
        unitPayout *
        quantity;


    if(
        !Number.isSafeInteger(
            totalPayout
        )
    ){

        return null;

    }


    return {
        quantity,
        currentMin,
        currentMax,
        marketMidpoint,
        payoutRate:
            BOOST_SELL_PAYOUT_RATE,
        unitPayout,
        totalPayout
    };

}


module.exports = {
    BOOST_SELL_PAYOUT_RATE,
    MAX_BOOST_SELL_QUANTITY,
    parseSellQuantity,
    calculateBoostSellQuote
};
