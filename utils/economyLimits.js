const TRADE_UNLOCK_LEVEL =
    50;

const TRADE_FULL_UNLOCK_LEVEL =
    100;

const LIMITED_TRADE_INCOMING_XP_CAP =
    500000;


const MINIMUM_TRADE_XP_OFFER =
    1000;


// Levels 1-100 use the original quadratic thresholds.
const LEVEL_50_XP_THRESHOLD =
    Math.pow(
        TRADE_UNLOCK_LEVEL - 1,
        2
    ) * 250;

const LEVEL_100_XP_THRESHOLD =
    Math.pow(
        TRADE_FULL_UNLOCK_LEVEL - 1,
        2
    ) * 250;


const SOCIAL_FULL_REWARD_LEVEL =
    100;


// These caps apply only to the XP RECEIVER while they are below
// Level 100. Level 100+ keeps the command's original uncapped result.
const LOW_LEVEL_SOCIAL_XP_CAPS =
    Object.freeze({
        hug: 100000,
        kiss: 50000,
        steal: 50000,
        ezwin: 5000
    });


// Backwards-compatible export name for any untouched command code.
const SOCIAL_XP_CAPS =
    LOW_LEVEL_SOCIAL_XP_CAPS;


function normalizeWholeNumber(value){

    return Math.max(
        0,
        Math.floor(
            Number(value) || 0
        )
    );

}


function getLevelThrough100(totalXP){

    return Math.min(
        TRADE_FULL_UNLOCK_LEVEL,
        Math.floor(
            Math.sqrt(
                normalizeWholeNumber(
                    totalXP
                ) / 250
            )
        ) + 1
    );

}


function getTradeProtection(totalXP){

    const safeXP =
        normalizeWholeNumber(
            totalXP
        );


    if(safeXP < LEVEL_50_XP_THRESHOLD){

        return {
            unlocked: false,
            fullyUnlocked: false,
            incomingXPCap: 0,
            level:
                getLevelThrough100(
                    safeXP
                ),
            minimumLevel:
                TRADE_UNLOCK_LEVEL
        };

    }


    if(safeXP < LEVEL_100_XP_THRESHOLD){

        return {
            unlocked: true,
            fullyUnlocked: false,
            incomingXPCap:
                LIMITED_TRADE_INCOMING_XP_CAP,
            level:
                getLevelThrough100(
                    safeXP
                ),
            minimumLevel:
                TRADE_UNLOCK_LEVEL
        };

    }


    return {
        unlocked: true,
        fullyUnlocked: true,
        incomingXPCap: null,
        level:
            getLevelThrough100(
                safeXP
            ),
        minimumLevel:
            TRADE_UNLOCK_LEVEL
    };

}


function offerHasContents(offer){

    if(
        normalizeWholeNumber(
            offer?.xp
        ) > 0
    ){

        return true;

    }


    const boosts =
        offer?.boosts &&
        typeof offer.boosts === "object"
            ? offer.boosts
            : {};


    return Object.values(
        boosts
    ).some(
        amount =>
            normalizeWholeNumber(
                amount
            ) > 0
    );

}


function isValidTradeXPAmount(amount){

    const safeAmount =
        normalizeWholeNumber(
            amount
        );


    return (
        safeAmount === 0
        ||
        safeAmount >=
            MINIMUM_TRADE_XP_OFFER
    );

}


function getSocialXPCap(
    commandName,
    recipientLevel
){

    const command =
        String(commandName || "")
            .toLowerCase();


    const safeLevel =
        Math.max(
            1,
            Math.floor(
                Number(recipientLevel) || 1
            )
        );


    if(
        safeLevel >=
        SOCIAL_FULL_REWARD_LEVEL
    ){

        return null;

    }


    const cap =
        LOW_LEVEL_SOCIAL_XP_CAPS[command];


    if(!Number.isFinite(cap))
        return null;


    return cap;

}


function capSocialXP(
    commandName,
    amount,
    recipientLevel = 1
){

    const normalizedAmount =
        normalizeWholeNumber(
            amount
        );


    const cap =
        getSocialXPCap(
            commandName,
            recipientLevel
        );


    if(!Number.isFinite(cap))
        return normalizedAmount;


    return Math.min(
        normalizedAmount,
        cap
    );

}


module.exports = {
    TRADE_UNLOCK_LEVEL,
    TRADE_FULL_UNLOCK_LEVEL,
    LIMITED_TRADE_INCOMING_XP_CAP,
    MINIMUM_TRADE_XP_OFFER,
    LEVEL_50_XP_THRESHOLD,
    LEVEL_100_XP_THRESHOLD,
    SOCIAL_FULL_REWARD_LEVEL,
    LOW_LEVEL_SOCIAL_XP_CAPS,
    SOCIAL_XP_CAPS,
    getLevelThrough100,
    getTradeProtection,
    offerHasContents,
    isValidTradeXPAmount,
    getSocialXPCap,
    capSocialXP
};
