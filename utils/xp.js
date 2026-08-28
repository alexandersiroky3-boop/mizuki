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
// Base streak rewards are 2x at 20+ and 5x at 50+; later upgrades raise
// those values and unlock a 50x reward at 100+.
// XP Boost Infinity already applies its own very large multiplier,
// so it does not also multiply with the special 20+/50+/100+ streak reward.
// The normal critical reward (including +100 XP per streak) still applies.
// Final critical chance is normally capped at 95%, with two exact
// Luck Boost Omega combinations receiving their own higher caps.

const CRITICAL_MOMENTUM_PER_STREAK = 4;
const CRITICAL_MOMENTUM_CAP = 28;
const CRITICAL_STREAK_BONUS_THRESHOLD = 20;
const CRITICAL_STREAK_CHANCE_BONUS = 3;
const CRITICAL_STREAK_XP_MULTIPLIER = 2;
const CRITICAL_STREAK_SUPER_THRESHOLD = 50;
const CRITICAL_STREAK_SUPER_XP_MULTIPLIER = 5;
const DEFAULT_CRITICAL_CHANCE_CAP = 95;
const OMEGA_MAX_CRITICAL_CHANCE_CAP = 98;
const OMEGA_INFINITY_CRITICAL_CHANCE_CAP = 99;


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



    // ======================
    // CRITICAL CHANCE
    // ======================

    const startingStreak =
        Math.max(
            0,
            Number(currentStreak) || 0
        );


    const activeLuckBoost =
        luck.getMemberLuckProfile(
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


    const critical20Multiplier =
        Math.max(
            1,
            Number(
                upgradeEffects
                    .critical20Multiplier
            ) ||
                CRITICAL_STREAK_XP_MULTIPLIER
        );


    const critical50Multiplier =
        Math.max(
            critical20Multiplier,
            Number(
                upgradeEffects
                    .critical50Multiplier
            ) ||
                CRITICAL_STREAK_SUPER_XP_MULTIPLIER
        );


    const critical100Multiplier =
        Number(
            upgradeEffects
                .critical100Multiplier
        ) || null;


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


    const criticalChance =
        chanceData.finalChance;



    // ======================
    // CRITICAL ROLL
    // ======================

    const forcedCritical =
        Boolean(
            options.forcedCritical
        );


    const critical =
        forcedCritical
        ||
        Math.random() * 100 <
            criticalChance;


    let criticalMultiplier = 1;


    let streakXPMultiplier = 1;


    let configuredStreakXPMultiplier = 1;


    let streakBonusSuppressedByInfinity = false;


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


        if(
            critical100Multiplier
            &&
            criticalStreak >= 100
        ){

            configuredStreakXPMultiplier =
                critical100Multiplier;

        }
        else if(
            criticalStreak >=
                CRITICAL_STREAK_SUPER_THRESHOLD
        ){

            configuredStreakXPMultiplier =
                critical50Multiplier;

        }
        else if(
            criticalStreak >=
                CRITICAL_STREAK_BONUS_THRESHOLD
        ){

            configuredStreakXPMultiplier =
                critical20Multiplier;

        }


        streakBonusSuppressedByInfinity =
            activeXPBoost.tier === "infinity"
            &&
            configuredStreakXPMultiplier > 1;


        streakXPMultiplier =
            streakBonusSuppressedByInfinity
                ? 1
                : configuredStreakXPMultiplier;


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


        xpBeforeBoost,


        xpBoostTier:
            activeXPBoost.tier,


        xpBoostMultiplier,


        xpBoostCriticalBonus:
            chanceData.xpBoostCriticalBonus,


        critical,


        forcedCritical,


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


    getLevel,


    getCurrentLevelXP,


    getLevelRequirement,


    getLevelXP:
        getCurrentLevelXP,


    getNextLevelXP,


    getXPAmount,


    getProgress


};
