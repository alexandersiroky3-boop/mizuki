const luck = require("./luck");
const boosts = require("../systems/boosts");

// Critical chance and XP growth are independent. No 20/50/100-hit XP milestones.
const CRITICAL_MOMENTUM_PER_STREAK = 4;
const CRITICAL_MOMENTUM_CAP = 28;
const DEFAULT_CRITICAL_CHANCE_CAP = 93;
const OMEGA_MAX_CRITICAL_CHANCE_CAP = 93;
const OMEGA_INFINITY_CRITICAL_CHANCE_CAP = 95;
const CRITICAL_CAP_XP_BY_CHAT_LEVEL = Object.freeze([
    1000000, 1500000, 1500000, 1500000, 1500000, 1500000, 5000000, 5000000, 7000000
]);

function getCriticalXPCap(chatLevel = 0){
    return CRITICAL_CAP_XP_BY_CHAT_LEVEL[Math.min(8, Math.max(0, Math.floor(Number(chatLevel) || 0)))];
}

function getBalancedChatXP(reward, chatXPMultiplier){
    const total = Math.floor(Math.max(0, Number(reward.xp) || 0) * Math.max(1, Number(chatXPMultiplier) || 1));
    return reward.critical ? Math.min(total, getCriticalXPCap(reward.chattingUpgradeLevel)) : total;
}

// Inspect Discord-provided media metadata only; never fetch arbitrary links.
function hasChatMedia(message){
    const isMedia = item => /^(image|video)\//i.test(item?.contentType || "")
        || /\.(gif|png|jpe?g|webp|avif|mp4|webm|mov)(?:$|[?#])/i.test(item?.name || item?.url || "");
    if(message?.attachments?.some?.(isMedia)) return true;
    if(message?.embeds?.some?.(embed =>
        ["image", "video", "gifv"].includes(embed.type) || embed.image || embed.video
    )) return true;
    return /https?:\/\/(?:tenor\.com\/view\/|(?:www\.)?giphy\.com\/gifs\/|[^\s<>]+\.(?:gif|png|jpe?g|webp|avif|mp4|webm|mov)(?:[?#][^\s<>]*)?(?:\s|$))/i.test(message?.content || "");
}

function applyChatMediaBonus(amount, reward, multiplier = 1){
    const base = Math.max(0, Math.floor(Number(amount) || 0));
    if(multiplier <= 1) return base;
    return Math.min(
        Math.floor(base * Math.min(2.25, Math.max(1.5, multiplier))),
        Math.floor(getCriticalXPCap(reward.chattingUpgradeLevel) * 1.5)
    );
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
        0;


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
    // Use the same linear progression as the earlier level bands.
    // Level 300 -> 301 =   100,000,000 XP
    // Level 350 -> 351 = 2,000,000,000 XP
    // Level 400 -> 401 = 3,900,000,000 XP
    // Increase: +38,000,000 XP per level, continuing past Level 400.
    // Total XP to reach Level 400 is approximately 203.934 billion.
    // Existing XP balances and requirements through Level 300 are unchanged.
    return Math.floor(
        100000000 +
        (safeLevel - 300) *
        38000000
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


    const criticalBonus = 0;


    // First calculate the same normal message reward the user would receive
    // without an XP Boost. The active boost multiplies that completed result
    // later instead of replacing the normal XP ranges.
    const activeXPBoost =
        boosts.getMemberBoostProfile(
            member
        );


    // Boost upgrades strengthen an active item; they must not turn the
    // neutral 1x "No XP Boost" profile into free 1.2x/1.5x/3x chat XP.
    const activeXPBoostUpgradeScale =
        activeXPBoost?.tier
            ? Math.max(
                1,
                Number(
                    upgradeEffects
                        .boostMultiplierScale
                ) || 1
            )
            : 1;


    const xpBoostMultiplier =
        Math.max(
            1,
            Number(
                activeXPBoost.multiplier
            ) || 1
        ) *
        activeXPBoostUpgradeScale;


    const xpBoostCriticalBonus =
        Math.max(
            0,
            Number(
                activeXPBoost.criticalChanceBonus
            ) || 0
        ) *
        activeXPBoostUpgradeScale;

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


    // Raid-boss Degeneration needs to know whether this exact message would
    // still have crit without a Luck Boost. XP Boost critical bonuses,
    // permanent upgrades, momentum and guaranteed criticals still count.
    const noLuckChanceData =
        buildCriticalChance(
            baseCriticalChance,
            xpBoostCriticalBonus,
            0,
            startingStreak,
            DEFAULT_CRITICAL_CHANCE_CAP
        );

    const criticalChanceWithoutLuck =
        Math.max(
            0,
            Math.min(
                noLuckChanceData
                    .criticalChanceCap,
                noLuckChanceData.finalChance *
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


    const criticalRoll =
        Math.random() * 100;

    const critical =
        !forcedCriticalFailure
        &&
        (
            criticalRoll < (forcedCritical ? criticalChanceCap : criticalChance)
        );

    const criticalWithoutLuck =
        !forcedCriticalFailure
        &&
        (
            criticalRoll < (forcedCritical ? DEFAULT_CRITICAL_CHANCE_CAP : criticalChanceWithoutLuck)
        );


    let criticalMultiplier = 1;


    let streakXPMultiplier = 1;


    let configuredStreakXPMultiplier = 1;
    let criticalGrowthXP = 0;
    let criticalGrowthPercent = 0;


    // Kept in the result payload for compatibility with older logging code.
    // Infinity uses the same gradual streak growth as other XP boosts.
    const streakBonusSuppressedByInfinity = false;


    let criticalStreak =
        startingStreak;


    if(critical){


        criticalStreak++;


        criticalGrowthPercent = randomXP(15, 30);
        const previousBase = startingStreak > 0
            ? Math.max(0, Number(options.previousCriticalGrowthXP) || 0) : 0;
        const initialBase = previousBase > 0 ? previousBase : earnedXP;
        criticalGrowthXP = Math.min(7000000, Math.floor(initialBase * (1 + criticalGrowthPercent / 100)));
        earnedXP = criticalGrowthXP;
        criticalMultiplier = earnedXP / Math.max(1, initialBase);


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


        criticalRoll,


        criticalChanceWithoutLuck,


        criticalWithoutLuck,


        nextCriticalChance:
            nextChanceData.finalChance,


        criticalMultiplier,
        criticalGrowthXP,
        criticalGrowthPercent,


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


    getCriticalXPCap,
    randomXP,
    hasChatMedia,
    applyChatMediaBonus,

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
