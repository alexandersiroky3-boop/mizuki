const luck = require("./luck");
const boosts = require("../systems/boosts");

// ======================
// CRITICAL SYSTEM
// ======================
//
// Every user starts with the same BASE critical chance.
// XP Boosts and Luck Boosts add separate exact bonuses.
// Each consecutive critical adds +4% momentum
// to the NEXT critical roll, up to +28%.
// An active streak of 20+ adds another +3% chance.
// Permanent Chatting upgrades replace the old automatic level buffs.
// Streak rewards begin at 5 consecutive criticals. Stronger XP Boosts use
// progressively smaller streak multipliers so their own XP multiplier cannot
// make long streaks explode the economy.
// The normal critical reward (including +100 XP per streak) still applies.
// Final critical chance is normally capped at 95%, with two exact
// Luck Boost Omega combinations receiving their own higher caps.

const CRITICAL_MOMENTUM_PER_STREAK = 4;
const CRITICAL_MOMENTUM_CAP = 28;
const CRITICAL_STREAK_BONUS_THRESHOLD = 20;
const CRITICAL_STREAK_CHANCE_BONUS = 3;
const DEFAULT_CRITICAL_CHANCE_CAP = 95;
const OMEGA_MAX_CRITICAL_CHANCE_CAP = 98;
const OMEGA_INFINITY_CRITICAL_CHANCE_CAP = 99;
const MAX_CRITICAL_EXTRA_XP = 250000;
const LONG_CRITICAL_STREAK_THRESHOLD = 20;
const LONG_CRITICAL_STREAK_GROWTH_PER_CRITICAL = 0.05;


// Guaranteed streak-reward floors for a 20x critical streak. Normal message
// XP is added afterward, so the final reward is slightly above each floor.
// Chatting levels 1–5 rise gradually toward the requested 400K/700K targets,
// levels 6–7 bridge the gap, and fully upgraded Chatting reaches 5M/11M.
const LONG_CRITICAL_MAX_BASE_XP_BY_CHAT_LEVEL =
    Object.freeze([
        100000,
        160000,
        220000,
        280000,
        340000,
        400000,
        1250000,
        2750000,
        5000000
    ]);


const LONG_CRITICAL_INFINITY_BASE_XP_BY_CHAT_LEVEL =
    Object.freeze([
        300000,
        380000,
        460000,
        540000,
        620000,
        700000,
        2500000,
        6000000,
        11000000
    ]);


const LONG_CRITICAL_CAP_XP_BY_CHAT_LEVEL =
    Object.freeze([
        1000000,
        1500000,
        1500000,
        1500000,
        1500000,
        1500000,
        5000000,
        12000000,
        30000000
    ]);


// XP Boost I/II still benefit from the new system, but MAX and Infinity keep
// their explicitly configured floors above.
const LONG_CRITICAL_XP_TIER_SCALE =
    Object.freeze({
        none: 0.10,
        tier1: 0.25,
        tier2: 0.55,
        max: 1
    });


function getCriticalExtraXPCap(criticalStreak){
    const streak = Math.max(0, Math.floor(Number(criticalStreak) || 0));
    return Math.min(MAX_CRITICAL_EXTRA_XP, 5000 + 3000 * streak);
}


function getLongCriticalStreakRewardProfile(
    xpBoostTier,
    chattingUpgradeLevel = 0
){
    const chatLevel =
        Math.max(
            0,
            Math.min(
                LONG_CRITICAL_CAP_XP_BY_CHAT_LEVEL.length - 1,
                Math.floor(
                    Number(chattingUpgradeLevel) || 0
                )
            )
        );


    const normalizedTier =
        String(xpBoostTier || "none")
            .trim()
            .toLowerCase();


    const minimumXP =
        normalizedTier === "infinity"
            ? LONG_CRITICAL_INFINITY_BASE_XP_BY_CHAT_LEVEL[
                chatLevel
            ]
            : Math.floor(
                LONG_CRITICAL_MAX_BASE_XP_BY_CHAT_LEVEL[
                    chatLevel
                ]
                *
                (
                    LONG_CRITICAL_XP_TIER_SCALE[
                        normalizedTier
                    ]
                    ?? LONG_CRITICAL_XP_TIER_SCALE.none
                )
            );


    return {
        chatLevel,
        xpBoostTier:
            normalizedTier,
        minimumXP,
        maximumXP:
            LONG_CRITICAL_CAP_XP_BY_CHAT_LEVEL[
                chatLevel
            ]
    };
}


function getLongCriticalStreakXP(
    reward,
    chatXPMultiplier,
    boostedNormalXP = 0
){
    const criticalStreak =
        Math.max(
            0,
            Math.floor(
                Number(reward?.criticalStreak) || 0
            )
        );


    if(
        !reward?.critical
        || criticalStreak < LONG_CRITICAL_STREAK_THRESHOLD
    ){
        return null;
    }


    const profile =
        getLongCriticalStreakRewardProfile(
            reward.xpBoostTier,
            reward.chattingUpgradeLevel
        );


    const permanentChatMultiplier =
        Math.max(
            1,
            Number(
                reward.upgradeChatXPMultiplier
            ) || 1
        );


    // Quest/merchant chat multipliers may still improve the reward, while the
    // permanent Chatting multiplier is already represented by the profile.
    const temporaryChatMultiplier =
        Math.max(
            1,
            (
                Number(chatXPMultiplier) || 1
            ) / permanentChatMultiplier
        );


    // Boost upgrades use a deliberately gentle 5% per-level curve instead of
    // the general 1.2x/1.5x active-boost scale.
    const boostUpgradeScale =
        Math.max(
            1,
            Number(
                reward.criticalStreakRewardScale
            ) || 1
        );


    const streakGrowth =
        1 +
        (
            criticalStreak -
            LONG_CRITICAL_STREAK_THRESHOLD
        ) * LONG_CRITICAL_STREAK_GROWTH_PER_CRITICAL;


    const streakReward =
        Math.floor(
            profile.minimumXP *
            streakGrowth *
            boostUpgradeScale *
            temporaryChatMultiplier
        );


    return Math.min(
        profile.maximumXP,
        Math.max(
            0,
            Math.floor(
                Number(boostedNormalXP) || 0
            )
        ) + streakReward
    );
}


// Before a 20x streak, retain the smaller safety cap. At 20x and above, use
// the dedicated XP Boost/Chatting profile with its own hard maximum.
function getBalancedChatXP(reward, chatXPMultiplier){
    const multiplier = Math.max(1, Number(chatXPMultiplier) || 1);
    const boostedTotal = Math.floor(Math.max(0, Number(reward.xp) || 0) * multiplier);
    if(!reward.critical) return boostedTotal;
    const boostedNormal = Math.floor(
        Math.max(0, Number(reward.normalXP) || 0) * multiplier
    );


    const longCriticalStreakXP =
        getLongCriticalStreakXP(
            reward,
            multiplier,
            boostedNormal
        );


    if(longCriticalStreakXP != null){
        return longCriticalStreakXP;
    }


    return Math.min(
        boostedTotal,
        boostedNormal + getCriticalExtraXPCap(reward.criticalStreak)
    );
}


const CRITICAL_STREAK_REWARD_TABLE =
    Object.freeze({

        none: Object.freeze({
            5: 5,
            20: 20,
            50: 50,
            100: 100
        }),

        tier1: Object.freeze({
            5: 4,
            20: 17,
            50: 45,
            100: 80
        }),

        tier2: Object.freeze({
            5: 2,
            20: 10,
            50: 20,
            100: 40
        }),

        max: Object.freeze({
            5: 2,
            20: 7,
            50: 15,
            100: 35
        }),

        infinity: Object.freeze({
            5: 1.8,
            20: 3,
            50: 10,
            100: 20
        })

    });


const CRITICAL_STREAK_REWARD_THRESHOLDS =
    Object.freeze([
        100,
        50,
        20,
        5
    ]);


function getCriticalStreakXPMultiplier(
    xpBoostTier,
    criticalStreak
){

    const normalizedTier =
        Object.prototype.hasOwnProperty.call(
            CRITICAL_STREAK_REWARD_TABLE,
            xpBoostTier
        )
            ? xpBoostTier
            : "none";


    const safeStreak =
        Math.max(
            0,
            Math.floor(
                Number(criticalStreak) || 0
            )
        );


    const profile =
        CRITICAL_STREAK_REWARD_TABLE[
            normalizedTier
        ];


    for(
        const threshold of
        CRITICAL_STREAK_REWARD_THRESHOLDS
    ){

        if(safeStreak >= threshold){

            return profile[threshold];

        }

    }


    return 1;

}


function getCriticalMomentum(currentStreak){

    const safeStreak =
        Math.max(
            0,
            Number(currentStreak) || 0
        );


    return Math.min(
        safeStreak *
            CRITICAL_MOMENTUM_PER_STREAK,
        CRITICAL_MOMENTUM_CAP
    );

}


function buildCriticalChance(
    baseCriticalChance,
    xpBoostCriticalBonus,
    luckCriticalBonus,
    currentStreak,
    criticalChanceCap = DEFAULT_CRITICAL_CHANCE_CAP
){

    const momentumBonus =
        getCriticalMomentum(
            currentStreak
        );


    const streakChanceBonus =
        Math.max(
            0,
            Number(currentStreak) || 0
        ) >= CRITICAL_STREAK_BONUS_THRESHOLD
            ? CRITICAL_STREAK_CHANCE_BONUS
            : 0;


    const finalChance =
        Math.min(
            Number(criticalChanceCap) ||
                DEFAULT_CRITICAL_CHANCE_CAP,
            Number(baseCriticalChance) +
            Number(xpBoostCriticalBonus) +
            Number(luckCriticalBonus) +
            momentumBonus +
            streakChanceBonus
        );


    return {

        baseCriticalChance:
            Number(baseCriticalChance),

        xpBoostCriticalBonus:
            Number(xpBoostCriticalBonus),

        luckCriticalBonus:
            Number(luckCriticalBonus),

        momentumBonus,

        streakChanceBonus,

        criticalChanceCap:
            Number(criticalChanceCap) ||
                DEFAULT_CRITICAL_CHANCE_CAP,

        finalChance

    };

}


function getCriticalChanceCap(
    xpBoostTier,
    luckBoostTier
){

    if(luckBoostTier !== "omega"){
        return DEFAULT_CRITICAL_CHANCE_CAP;
    }


    if(xpBoostTier === "infinity"){
        return OMEGA_INFINITY_CRITICAL_CHANCE_CAP;
    }


    if(xpBoostTier === "max"){
        return OMEGA_MAX_CRITICAL_CHANCE_CAP;
    }


    return DEFAULT_CRITICAL_CHANCE_CAP;

}


// ======================
// LEVEL CALCULATIONS
// ======================

function getLevel(xp){


    let level = 1;


    while(
        getNextLevelXP(level) <= xp
    ){

        level++;

    }


    return level;


}



function getLevelRequirement(level){


    const safeLevel =
        Math.max(
            1,
            Math.floor(
                Number(level) || 1
            )
        );


    // ===================================
    // LEVELS 1-99
    // ===================================
    //
    // Keep the original quadratic system.
    if(safeLevel < 100){

        return (
            getNextLevelXP(safeLevel) -
            getCurrentLevelXP(safeLevel)
        );

    }


    // ===================================
    // LEVELS 100-150
    // ===================================
    //
    // Level 100 -> 101 = 250,000 XP
    // Level 150 -> 151 = 2,500,000 XP
    //
    // Increase: +45,000 XP per level.
    if(safeLevel <= 150){

        return Math.floor(
            250000 +
            (
                (safeLevel - 100) / 50
            ) *
            2250000
        );

    }


    // ===================================
    // LEVELS 151-200
    // ===================================
    //
    // Level 150 -> 151 = 2,500,000 XP
    // Level 200 -> 201 = 10,000,000 XP
    //
    // Increase: +150,000 XP per level.
    if(safeLevel <= 200){

        return Math.floor(
            2500000 +
            (
                (safeLevel - 150) / 50
            ) *
            7500000
        );

    }


    // ===================================
    // LEVELS 201-300
    // ===================================
    //
    // Level 200 -> 201 = 10,000,000 XP
    // Level 300 -> 301 = 100,000,000 XP
    //
    // Increase: +900,000 XP per level.
    if(safeLevel <= 300){

        return Math.floor(
            10000000 +
            (
                (safeLevel - 200) / 100
            ) *
            90000000
        );

    }


    // ===================================
    // LEVELS 301+
    // ===================================
    //
    // Keep the brutal post-200 growth going.
    // Every level after 300 costs another
    // +900,000 XP more than the previous one.
    return Math.floor(
        100000000 +
        (safeLevel - 300) *
        900000
    );


}



function getCurrentLevelXP(level){


    const safeLevel =
        Math.max(
            1,
            Math.floor(
                Number(level) || 1
            )
        );


    if(safeLevel <= 1){

        return 0;

    }


    // Original level thresholds through Level 100.
    if(safeLevel <= 100){

        return Math.floor(
            Math.pow(
                safeLevel - 1,
                2
            ) * 250
        );

    }


    // Exact XP threshold for reaching Level 100.
    // This must match getCurrentLevelXP(100).
    let total =
        Math.floor(
            Math.pow(
                100 - 1,
                2
            ) * 250
        );


    // Add the cost of every completed level
    // beginning with Level 100 -> 101.
    for(
        let lvl = 100;
        lvl < safeLevel;
        lvl++
    ){

        total +=
            getLevelRequirement(
                lvl
            );

    }


    return total;


}



function getNextLevelXP(level){


    const safeLevel =
        Math.max(
            1,
            Math.floor(
                Number(level) || 1
            )
        );


    // Preserve the original system below Level 100.
    if(safeLevel < 100){

        return Math.floor(
            Math.pow(
                safeLevel,
                2
            ) * 250
        );

    }


    return (
        getCurrentLevelXP(
            safeLevel
        )
        +
        getLevelRequirement(
            safeLevel
        )
    );


}



// ======================
// RANDOM XP
// ======================

function randomXP(
    min,
    max
){


    return Math.floor(

        Math.random() *
        (
            max -
            min +
            1
        )

    ) + min;


}



// ======================
// XP REWARD
// ======================

function getXPAmount(
    member,
    currentStreak = 0,
    _currentLevel = 1,
    options = {}
){


    const upgradeEffects =
        options.upgradeEffects || {};


    const min = 70;
    const max = 200;


    const baseCriticalChance =
        3 +
        Math.max(
            0,
            Number(
                upgradeEffects
                    .chatCriticalChanceBonus
            ) || 0
        );


    const criticalBonus = 100;


    // First calculate the same normal message reward the user would receive
    // without an XP Boost. The active boost multiplies that completed result
    // later instead of replacing the normal XP ranges.
    const activeXPBoost =
        boosts.getMemberBoostProfile(
            member
        );


    const xpBoostMultiplier =
        Math.max(
            1,
            Number(
                activeXPBoost.multiplier
            ) || 1
        ) *
        Math.max(
            1,
            Number(
                upgradeEffects
                    .boostMultiplierScale
            ) || 1
        );


    const xpBoostCriticalBonus =
        Math.max(
            0,
            Number(
                activeXPBoost.criticalChanceBonus
            ) || 0
        ) *
        Math.max(
            1,
            Number(
                upgradeEffects
                    .boostMultiplierScale
            ) || 1
        );

    // ======================
    // NORMAL XP
    // ======================

    let earnedXP =
        randomXP(
            min,
            max
        );

    const normalXP = Math.floor(earnedXP * xpBoostMultiplier);



    // ======================
    // CRITICAL CHANCE
    // ======================

    const startingStreak =
        Math.max(
            0,
            Number(currentStreak) || 0
        );


    const activeLuckBoost =
        Object.prototype.hasOwnProperty.call(
            options,
            "activeLuckBoost"
        )
            ? options.activeLuckBoost
            : luck.getMemberLuckProfile(
                member
            );


    const luckCriticalBonus =
        Number(
            activeLuckBoost?.criticalChanceBonus
        ) *
        Math.max(
            1,
            Number(
                upgradeEffects
                    .boostMultiplierScale
            ) || 1
        ) || 0;


    const criticalChanceCap =
        getCriticalChanceCap(
            activeXPBoost.tier,
            activeLuckBoost?.tier
        );


    const chanceData =
        buildCriticalChance(
            baseCriticalChance,
            xpBoostCriticalBonus,
            luckCriticalBonus,
            startingStreak,
            criticalChanceCap
        );


    const criticalChanceMultiplier =
        options.criticalChanceMultiplier == null
            ? 1
            : Math.max(
                0,
                Number(
                    options.criticalChanceMultiplier
                ) || 0
            );


    const criticalChance =
        Math.max(
            0,
            Math.min(
                chanceData.criticalChanceCap,
                chanceData.finalChance *
                    criticalChanceMultiplier
            )
        );



    // ======================
    // CRITICAL ROLL
    // ======================

    const forcedCritical =
        Boolean(
            options.forcedCritical
        );


    const forcedCriticalFailure =
        Boolean(
            options.forcedCriticalFailure
        );


    const critical =
        !forcedCriticalFailure
        &&
        (
            forcedCritical
            ||
            Math.random() * 100 <
                criticalChance
        );


    let criticalMultiplier = 1;


    let streakXPMultiplier = 1;


    let configuredStreakXPMultiplier = 1;


    // Kept in the result payload for compatibility with older logging code.
    // Infinity now receives its own reduced streak rewards instead of having
    // the streak reward suppressed completely.
    const streakBonusSuppressedByInfinity = false;


    let criticalStreak =
        startingStreak;


    if(critical){


        criticalStreak++;


        // Unlimited critical XP multiplier.
        // The multiplier always matches the full consecutive streak.
        criticalMultiplier =
            criticalStreak;


        earnedXP +=
            criticalBonus *
            criticalMultiplier;


        configuredStreakXPMultiplier =
            getCriticalStreakXPMultiplier(
                activeXPBoost.tier,
                criticalStreak
            );


        streakXPMultiplier =
            configuredStreakXPMultiplier;


        earnedXP *=
            streakXPMultiplier;


    }
    else{


        // Consecutive still means consecutive:
        // one failed critical fully resets the streak.
        criticalStreak = 0;


    }



    const xpBeforeBoost =
        earnedXP;


    earnedXP =
        Math.floor(
            xpBeforeBoost *
            xpBoostMultiplier
        );



    // The chance the user would have on their NEXT
    // XP-eligible message after this result.
    const nextChanceData =
        buildCriticalChance(
            baseCriticalChance,
            xpBoostCriticalBonus,
            luckCriticalBonus,
            criticalStreak,
            criticalChanceCap
        );



    return {


        xp:
            earnedXP,

        normalXP,


        xpBeforeBoost,


        xpBoostTier:
            activeXPBoost.tier,


        xpBoostMultiplier,


        chattingUpgradeLevel:
            Math.max(
                0,
                Math.floor(
                    Number(
                        upgradeEffects.levels?.chatting
                    ) || 0
                )
            ),


        boostUpgradeLevel:
            Math.max(
                0,
                Math.floor(
                    Number(
                        upgradeEffects.levels?.boosts
                    ) || 0
                )
            ),


        upgradeChatXPMultiplier:
            Math.max(
                1,
                Number(
                    upgradeEffects.chatXPMultiplier
                ) || 1
            ),


        criticalStreakRewardScale:
            Math.max(
                1,
                Number(
                    upgradeEffects
                        .criticalStreakRewardScale
                ) || 1
            ),


        xpBoostCriticalBonus:
            chanceData.xpBoostCriticalBonus,


        critical,


        forcedCritical,


        forcedCriticalFailure,


        criticalBonus,


        baseCriticalChance:
            chanceData.baseCriticalChance,


        luckCriticalBonus:
            chanceData.luckCriticalBonus,


        momentumBonus:
            chanceData.momentumBonus,


        streakChanceBonus:
            chanceData.streakChanceBonus,


        criticalChanceCap:
            chanceData.criticalChanceCap,


        criticalChance,


        nextCriticalChance:
            nextChanceData.finalChance,


        criticalMultiplier,


        streakXPMultiplier,


        configuredStreakXPMultiplier,


        streakBonusSuppressedByInfinity,


        criticalStreak,


        levelGroup:
            "universal"


    };


}



// ======================
// PROGRESS BAR
// ======================

function getProgress(user){


    const level =
        Number(
            user.level
        ) || 1;



    const totalXP =
        Number(
            user.xp
        ) || 0;



    const currentXP =
        getCurrentLevelXP(
            level
        );



    const nextXP =
        getNextLevelXP(
            level
        );



    const progressXP =
        totalXP -
        currentXP;



    const neededXP =
        nextXP -
        currentXP;



    let percentage =
        Math.floor(

            (
                progressXP /
                neededXP
            ) * 100

        );



    percentage =
        Math.max(

            0,

            Math.min(
                percentage,
                100
            )

        );



    const bars = 20;



    const filled =
        Math.floor(
            percentage / 5
        );



    const progressBar =

        "█".repeat(
            filled
        )

        +

        "░".repeat(
            bars - filled
        );



    return {


        percentage,


        progressXP,


        neededXP,


        currentXP,


        nextXP,


        progressBar


    };


}



// ======================
// EXPORTS
// ======================

module.exports = {


    BOOST_ROLES:
        boosts.BOOST_ROLES,


    CRITICAL_STREAK_REWARD_TABLE,


    getCriticalStreakXPMultiplier,

    getCriticalExtraXPCap,

    getLongCriticalStreakRewardProfile,

    getLongCriticalStreakXP,

    getBalancedChatXP,


    getLevel,


    getCurrentLevelXP,


    getLevelRequirement,


    getLevelXP:
        getCurrentLevelXP,


    getNextLevelXP,


    getXPAmount,


    getProgress


};
