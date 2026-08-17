const {
    EmbedBuilder
} = require("discord.js");

const database =
    require("../database");

const boosts =
    require("./boosts");

const luck =
    require("../utils/luck");

const leveling =
    require("./leveling");


const QUEST_RESET_TIME_ZONE =
    "UTC";


const DAILY_QUEST_COUNT =
    3;


const WEEKLY_QUEST_COUNT =
    3;


const QUEST_UNLOCK_LEVEL =
    100;


const ELITE_REWARD_LEVEL =
    150;


const QUEST_RULESET_VERSION =
    6;


const QUEST_RESET_CONFIG =
    database.QUEST_RESET_CONFIG;


// =====================================================
// LEVEL 1-99 DAILY QUESTS
// =====================================================
//
// Keep the existing lower-level quest difficulty.
// Weekly quests are locked until Level 100.
const DAILY_QUEST_POOL_LOW = [

    {
        type: "messages",
        icon: "💬",
        targets: [25, 50, 100, 200],
        label: target => `Send ${target.toLocaleString()} messages`
    },

    {
        type: "roll_xp",
        icon: "🎲",
        targets: [5000, 10000, 50000],
        label: target => `Roll a total of ${target.toLocaleString()} XP`
    },

    {
        type: "earn_xp",
        icon: "✦",
        targets: [20000, 50000, 100000],
        label: target => `Earn ${target.toLocaleString()} XP`
    },

    {
        type: "steal_xp",
        icon: "💰",
        targets: [500, 1000, 2500],
        label: target => `Steal ${target.toLocaleString()} XP`
    },

    {
        type: "get_stolen",
        icon: "💰",
        targets: [1],
        label: () => "Get stolen from by someone"
    },

    {
        type: "kiss_given",
        icon: "💋",
        targets: [3, 5, 10],
        label: target => `Kiss someone ${target} times`
    },

    {
        type: "kiss_received",
        icon: "💋",
        targets: [3, 5, 10],
        label: target => `Get kissed ${target} times`
    },

    {
        type: "roll_count",
        icon: "🎲",
        targets: [10, 20, 50],
        label: target => `Use !roll ${target} times`
    },

    {
        type: "critical_streak",
        icon: "💥",
        targets: [2, 3],
        mode: "max",
        label: target => `Reach a ${target}x critical streak`
    },

    {
        type: "level_change",
        icon: "★",
        targets: [1],
        label: () => "Gain or lose a level"
    },

    {
        type: "shop_purchase",
        icon: "💸",
        targets: [1],
        label: () => "Buy something from the shop"
    },

    {
        type: "successful_trade",
        icon: "🤝",
        targets: [2, 4, 6],
        label: target => `Successfully trade with someone ${target} times`
    },

    {
        type: "hug_given",
        icon: "🫂",
        targets: [1],
        label: () => "Hug someone"
    }

];


// =====================================================
// LEVEL 100+ DAILY QUESTS
// =====================================================
//
// Only the quests requested by the owner are buffed.
// All other daily quests keep their previous targets.
const DAILY_QUEST_POOL_HIGH = [

    {
        type: "messages",
        icon: "💬",
        targets: [25, 50, 100, 200],
        label: target => `Send ${target.toLocaleString()} messages`
    },

    {
        type: "roll_xp",
        icon: "🎲",
        targets: [500000, 1000000, 2500000],
        label: target => `Roll a total of ${target.toLocaleString()} XP`
    },

    {
        type: "single_roll_xp",
        icon: "🎯",
        // Stored as threshold + 1 so "more than" is literal.
        targets: [25001, 50001, 100001],
        mode: "max",
        label: target =>
            `Roll more than ${(target - 1).toLocaleString()} XP in one roll`
    },

    {
        type: "earn_xp",
        icon: "✦",
        targets: [1000000, 2500000, 3000000],
        label: target => `Earn ${target.toLocaleString()} XP`
    },

    {
        type: "steal_xp",
        icon: "💰",
        targets: [25000, 50000, 100000],
        label: target => `Steal ${target.toLocaleString()} XP`
    },

    {
        type: "get_stolen",
        icon: "💰",
        targets: [1],
        label: () => "Get stolen from by someone"
    },

    {
        type: "kiss_given",
        icon: "💋",
        targets: [3, 5, 10],
        label: target => `Kiss someone ${target} times`
    },

    {
        type: "kiss_received",
        icon: "💋",
        targets: [3, 5, 10],
        label: target => `Get kissed ${target} times`
    },

    {
        type: "roll_count",
        icon: "🎲",
        targets: [10, 20, 50],
        label: target => `Use !roll ${target} times`
    },

    {
        type: "critical_streak",
        icon: "💥",
        targets: [5, 10, 15],
        mode: "max",
        label: target => `Reach a ${target}x critical streak`
    },

    {
        type: "level_change",
        icon: "★",
        targets: [1],
        label: () => "Gain or lose a level"
    },

    {
        type: "shop_purchase",
        icon: "💸",
        targets: [1],
        label: () => "Buy something from the shop"
    },

    {
        type: "successful_trade",
        icon: "🤝",
        targets: [2, 4, 6],
        label: target => `Successfully trade with someone ${target} times`
    },

    {
        type: "hug_given",
        icon: "🫂",
        targets: [1],
        label: () => "Hug someone"
    }

];


// =====================================================
// LEVEL 100+ WEEKLY QUESTS
// =====================================================

const WEEKLY_QUEST_POOL_HIGH = [

    {
        type: "messages",
        icon: "💬",
        targets: [1000, 2000, 5000],
        label: target => `Send ${target.toLocaleString()} messages`
    },

    {
        type: "roll_xp",
        icon: "🎲",
        targets: [1000000],
        label: target => `Roll a total of ${target.toLocaleString()} XP`
    },

    {
        type: "single_roll_xp",
        icon: "🎯",
        targets: [500001, 750001, 1000001],
        mode: "max",
        label: target =>
            `Roll more than ${(target - 1).toLocaleString()} XP in one roll`
    },

    {
        type: "earn_xp",
        icon: "✦",
        targets: [25000000, 50000000, 100000000],
        label: target => `Earn ${target.toLocaleString()} XP`
    },

    {
        type: "steal_xp",
        icon: "💰",
        targets: [1000000, 2500000, 5000000],
        label: target => `Steal ${target.toLocaleString()} XP`
    },

    {
        type: "kiss_given",
        icon: "💋",
        targets: [50, 100, 200],
        label: target => `Kiss someone ${target} times`
    },

    {
        type: "kiss_received",
        icon: "💋",
        targets: [25, 35, 50],
        label: target => `Get kissed ${target} times`
    },

    {
        type: "roll_count",
        icon: "🎲",
        targets: [500, 1000, 1500],
        label: target => `Use !roll ${target.toLocaleString()} times`
    },

    {
        type: "new_best_critical_streak",
        icon: "🏅",
        targets: [1],
        label: () => "Get a new highest Best critical streak"
    },

    {
        type: "successful_trade",
        icon: "🤝",
        targets: [25, 50, 75],
        label: target => `Successfully trade with someone ${target} times`
    },

    {
        type: "buy_luck_max",
        icon: "💸",
        targets: [2, 3],
        label: target => `Buy Luck Boost MAX ${target} times`
    },

    {
        type: "sold_out_store",
        icon: "🛒",
        targets: [1],
        label: () => "Sell out the entire store"
    }

];


// Compatibility only:
// Existing active weekly "Reach a critical streak" quests are NOT replaced
// mid-week, because that would destroy or reinterpret saved progress.
// They remain valid until the current weekly cycle resets.
const LEGACY_WEEKLY_CRITICAL_STREAK = {
    type: "critical_streak",
    icon: "💥",
    targets: [10, 15, 20],
    mode: "max",
    label: target => `Reach a ${target}x critical streak`
};


const DAILY_TARGET_MIGRATIONS = {

    roll_xp: {
        low: [5000, 10000, 50000],
        high: [500000, 1000000, 2500000]
    },

    earn_xp: {
        low: [20000, 50000, 100000],
        high: [1000000, 2500000, 3000000]
    },

    steal_xp: {
        low: [500, 1000, 2500],
        high: [25000, 50000, 100000]
    },

    critical_streak: {
        low: [2, 3],
        high: [5, 10, 15]
    }

};


const WEEKLY_TARGET_MIGRATIONS = {

    earn_xp: {
        old: [2000000, 5000000, 10000000],
        high: [25000000, 50000000, 100000000]
    },

    steal_xp: {
        old: [20000, 50000, 75000],
        high: [250000, 500000, 1000000]
    }

};


function isHighQuestLevel(level){

    return (
        Number(level) >=
        QUEST_UNLOCK_LEVEL
    );

}


function isEliteRewardLevel(level){

    return (
        Number(level) >=
        ELITE_REWARD_LEVEL
    );

}


function getLevelBand(level){

    if(isEliteRewardLevel(level)){

        return "elite";

    }


    return isHighQuestLevel(level)
        ? "high"
        : "low";

}


function randomChoice(values){

    return values[
        Math.floor(
            Math.random() * values.length
        )
    ];

}


function shuffle(values){

    const copy =
        [...values];


    for(
        let index = copy.length - 1;
        index > 0;
        index--
    ){

        const otherIndex =
            Math.floor(
                Math.random() * (index + 1)
            );


        [
            copy[index],
            copy[otherIndex]
        ] = [
            copy[otherIndex],
            copy[index]
        ];

    }


    return copy;

}


function makeQuest(
    definition,
    slot,
    levelBand
){

    const target =
        randomChoice(
            definition.targets
        );


    return {
        id:
            `${definition.type}:${slot}`,

        rulesetVersion:
            QUEST_RULESET_VERSION,

        levelBand,

        type:
            definition.type,

        icon:
            definition.icon,

        label:
            definition.label(target),

        target,

        progress:
            0,

        mode:
            definition.mode || "add",

        completed:
            false,

        completedAt:
            null
    };

}


function generateQuests(
    cycleType,
    level
){

    const highLevel =
        isHighQuestLevel(
            level
        );


    if(
        cycleType === "weekly"
        &&
        !highLevel
    ){

        return [];

    }


    const pool =
        cycleType === "daily"
            ? (
                highLevel
                    ? DAILY_QUEST_POOL_HIGH
                    : DAILY_QUEST_POOL_LOW
            )
            : WEEKLY_QUEST_POOL_HIGH;


    const amount =
        cycleType === "daily"
            ? DAILY_QUEST_COUNT
            : WEEKLY_QUEST_COUNT;


    const band =
        getLevelBand(
            level
        );


    return shuffle(pool)
        .slice(0, amount)
        .map(
            (definition, slot) =>
                makeQuest(
                    definition,
                    slot,
                    band
                )
        );

}


function generateDailyRewardsLow(){

    return [

        {
            type: "xp",
            amount:
                randomChoice([
                    50000,
                    100000,
                    200000
                ]),
            levelBand: "low"
        },

        randomChoice([

            {
                type: "boost",
                boostType: "luck",
                tier: "tier3",
                amount:
                    randomChoice([1, 2]),
                levelBand: "low"
            },

            {
                type: "boost",
                boostType: "xp",
                tier: "tier3",
                amount:
                    randomChoice([1, 2]),
                levelBand: "low"
            },

            {
                type: "guaranteed_roll",
                rollType: "daily_25k_75k",
                amount: 1,
                levelBand: "low"
            }

        ])

    ];

}


function generateDailyRewardsHigh(){

    const xpReward = {
        type: "xp",
        amount:
            randomChoice([
                200000,
                500000,
                1000000
            ]),
        levelBand: "high"
    };


    const extraReward =
        randomChoice([

            {
                type: "boost",
                boostType: "luck",
                tier:
                    randomChoice([
                        "tier2",
                        "tier3"
                    ]),
                amount: 5,
                levelBand: "high"
            },

            {
                type: "boost",
                boostType: "xp",
                tier:
                    randomChoice([
                        "tier2",
                        "tier3"
                    ]),
                amount: 5,
                levelBand: "high"
            },

            {
                type: "guaranteed_roll",
                rollType: "daily_25k_75k",
                amount: 1,
                levelBand: "high"
            }

        ]);


    return [
        xpReward,
        extraReward
    ];

}


function generateDailyRewardsElite(){

    const levelBand =
        "elite";


    const xpReward = {
        type: "xp",
        amount:
            randomChoice([
                2500000,
                7000000,
                14000000
            ]),
        levelBand
    };


    const extras =
        shuffle([

        {
            type: "boost",
            boostType: "xp",
            tier: "max",
            amount:
                randomChoice([2, 4, 6]),
            levelBand
        },

        {
            type: "boost",
            boostType: "luck",
            tier: "max",
            amount:
                randomChoice([2, 4, 6]),
            levelBand
        },

        {
            type: "boost",
            boostType: "xp",
            tier: "tier3",
            amount:
                randomChoice([5, 10, 15]),
            levelBand
        },

        {
            type: "boost",
            boostType: "luck",
            tier: "tier3",
            amount:
                randomChoice([5, 10, 15]),
            levelBand
        },

        {
            type: "guaranteed_roll_minimum",
            minXP:
                randomChoice([
                    250000,
                    500000,
                    1000000
                ]),
            amount: 1,
            levelBand
        },

        {
            type: "next_roll_burst",
            rollCount:
                randomChoice([10, 20, 50]),
            amount: 1,
            levelBand
        },

        {
            type: "shop_discount",
            discountPercent: 50,
            durationMs:
                24 * 60 * 60 * 1000,
            levelBand
        },

        {
            type: "guaranteed_criticals",
            amount:
                randomChoice([15, 20, 25]),
            levelBand
        },

        {
            type: "chat_xp_multiplier",
            multiplier: 2,
            durationMs:
                24 * 60 * 60 * 1000,
            levelBand
        }

        ]);


    const extraCount =
        randomChoice([3, 4]);


    return [
        xpReward,
        ...extras.slice(0, extraCount)
    ];

}


function generateWeeklyRewardsHigh(){

    const rewards = [
        {
            type: "xp",
            amount:
                randomChoice([
                    15000000,
                    30000000,
                    50000000
                ]),
            levelBand: "high"
        }
    ];


    const extras =
        shuffle([

            {
                type: "boost",
                boostType: "luck",
                tier: "max",
                amount:
                    randomChoice([2, 5]),
                levelBand: "high"
            },

            {
                type: "boost",
                boostType: "xp",
                tier: "max",
                amount:
                    randomChoice([2, 5]),
                levelBand: "high"
            },

            {
                type: "boost",
                boostType: "luck",
                tier: "tier3",
                amount:
                    randomChoice([10, 20]),
                levelBand: "high"
            },

            {
                type: "boost",
                boostType: "xp",
                tier: "tier3",
                amount:
                    randomChoice([10, 20]),
                levelBand: "high"
            },

            {
                type: "guaranteed_roll",
                rollType: "impossible",
                amount: 1,
                levelBand: "high"
            },

            {
                type: "triple_roll",
                durationMs:
                    24 * 60 * 60 * 1000,
                levelBand: "high"
            }

        ]);


    const extraCount =
        Math.random() < 0.5
            ? 2
            : 3;


    rewards.push(
        ...extras.slice(0, extraCount)
    );


    return rewards;

}


function generateWeeklyRewardsElite(){

    const levelBand =
        "elite";


    const rewards = [
        {
            type: "xp",
            amount:
                randomChoice([
                    30000000,
                    45000000,
                    67676767
                ]),
            levelBand
        }
    ];


    const multiRollStrength =
        randomChoice([
            {
                rollCount: 3,
                durationMs:
                    24 * 60 * 60 * 1000
            },
            {
                rollCount: 6,
                durationMs:
                    24 * 60 * 60 * 1000
            },
            {
                rollCount: 9,
                durationMs:
                    48 * 60 * 60 * 1000
            }
        ]);


    const socialDuration =
        randomChoice([
            24 * 60 * 60 * 1000,
            24 * 60 * 60 * 1000,
            48 * 60 * 60 * 1000
        ]);


    const extras =
        shuffle([

            {
                type: "boost",
                boostType: "luck",
                tier: "max",
                amount:
                    randomChoice([7, 10, 12]),
                levelBand
            },

            {
                type: "guaranteed_roll_minimum",
                minXP:
                    randomChoice([
                        10000000,
                        15000000,
                        25000000
                    ]),
                amount: 1,
                levelBand
            },

            {
                type: "multi_roll",
                rollCount:
                    multiRollStrength.rollCount,
                durationMs:
                    multiRollStrength.durationMs,
                levelBand
            },

            {
                type: "chat_xp_multiplier",
                multiplier: 10,
                durationMs:
                    24 * 60 * 60 * 1000,
                levelBand
            },

            {
                type: "shop_discount",
                discountPercent: 90,
                durationMs:
                    24 * 60 * 60 * 1000,
                levelBand
            },

            {
                type: "social_command_triple",
                repeatCount: 3,
                durationMs:
                    socialDuration,
                levelBand
            },

            {
                type: "boost",
                boostType: "luck",
                tier: "omega",
                amount: 1,
                levelBand
            }

        ]);


    const extraCount =
        randomChoice([3, 4, 5]);


    rewards.push(
        ...extras.slice(0, extraCount)
    );


    return rewards;

}


function generateRewards(
    cycleType,
    level
){

    if(cycleType === "daily"){

        if(isEliteRewardLevel(level)){

            return generateDailyRewardsElite();

        }


        return isHighQuestLevel(level)
            ? generateDailyRewardsHigh()
            : generateDailyRewardsLow();

    }


    if(isEliteRewardLevel(level)){

        return generateWeeklyRewardsElite();

    }


    return isHighQuestLevel(level)
        ? generateWeeklyRewardsHigh()
        : [];

}


function formatUTCDateKey(date){

    return [
        String(
            date.getUTCFullYear()
        ),
        String(
            date.getUTCMonth() + 1
        ).padStart(
            2,
            "0"
        ),
        String(
            date.getUTCDate()
        ).padStart(
            2,
            "0"
        )
    ].join("-");

}


function getCycleInfo(
    cycleType,
    now = Date.now()
){

    const current =
        new Date(now);


    if(cycleType === "daily"){

        const start =
            new Date(
                Date.UTC(
                    current.getUTCFullYear(),
                    current.getUTCMonth(),
                    current.getUTCDate()
                )
            );


        return {
            cycleType,
            cycleKey:
                formatUTCDateKey(
                    start
                ),
            expiresAt:
                Date.UTC(
                    start.getUTCFullYear(),
                    start.getUTCMonth(),
                    start.getUTCDate() + 1
                )
        };

    }


    const startOfToday =
        new Date(
            Date.UTC(
                current.getUTCFullYear(),
                current.getUTCMonth(),
                current.getUTCDate()
            )
        );


    const daysSinceMonday =
        (
            startOfToday.getUTCDay() +
            6
        ) % 7;


    const monday =
        new Date(
            Date.UTC(
                startOfToday.getUTCFullYear(),
                startOfToday.getUTCMonth(),
                startOfToday.getUTCDate() -
                    daysSinceMonday
            )
        );


    return {
        cycleType,
        cycleKey:
            formatUTCDateKey(
                monday
            ),
        expiresAt:
            Date.UTC(
                monday.getUTCFullYear(),
                monday.getUTCMonth(),
                monday.getUTCDate() + 7
            )
    };

}

function normalizeJSON(value){

    if(typeof value === "string"){

        try{

            return JSON.parse(value);

        }
        catch{

            return [];

        }

    }


    return value;

}


function normalizeCycle(row){

    if(!row){

        return null;

    }


    return {
        ...row,

        cycletype:
            row.cycletype || row.cycleType,

        cyclekey:
            row.cyclekey || row.cycleKey,

        expiresat:
            Number(
                row.expiresat ||
                row.expiresAt ||
                0
            ),

        quests:
            normalizeJSON(row.quests) || [],

        rewards:
            normalizeJSON(row.rewards) || [],

        rewarded:
            Boolean(row.rewarded),

        resetcount:
            Math.max(
                0,
                Number(
                    row.resetcount ??
                    row.resetCount ??
                    0
                )
            )
    };

}


function getQuestDefinition(
    cycleType,
    questType,
    level = QUEST_UNLOCK_LEVEL
){

    const highLevel =
        isHighQuestLevel(
            level
        );


    let pool;


    if(cycleType === "daily"){

        pool =
            highLevel
                ? DAILY_QUEST_POOL_HIGH
                : DAILY_QUEST_POOL_LOW;

    }
    else{

        pool =
            WEEKLY_QUEST_POOL_HIGH;

    }


    const definition =
        pool.find(
            item =>
                item.type === questType
        );


    if(definition){

        return definition;

    }


    // Cross-band fallback keeps an active quest readable if somebody
    // crosses Level 100 in the middle of a cycle.
    const fallbackPools = [
        DAILY_QUEST_POOL_LOW,
        DAILY_QUEST_POOL_HIGH,
        WEEKLY_QUEST_POOL_HIGH
    ];


    for(const fallbackPool of fallbackPools){

        const found =
            fallbackPool.find(
                item =>
                    item.type === questType
            );


        if(found){

            return found;

        }

    }


    if(
        cycleType === "weekly"
        &&
        questType ===
            LEGACY_WEEKLY_CRITICAL_STREAK.type
    ){

        return LEGACY_WEEKLY_CRITICAL_STREAK;

    }


    return null;

}


function mapTargetByDifficulty(
    target,
    fromTargets,
    toTargets
){

    const numericTarget =
        Number(target) || 0;


    if(
        toTargets.includes(
            numericTarget
        )
    ){

        return numericTarget;

    }


    let index =
        fromTargets.indexOf(
            numericTarget
        );


    if(index < 0){

        let bestDistance =
            Infinity;


        for(
            let i = 0;
            i < fromTargets.length;
            i++
        ){

            const distance =
                Math.abs(
                    numericTarget -
                    fromTargets[i]
                );


            if(distance < bestDistance){

                bestDistance =
                    distance;

                index =
                    i;

            }

        }

    }


    index =
        Math.max(
            0,
            Math.min(
                index,
                toTargets.length - 1
            )
        );


    return toTargets[index];

}


function migrateQuestTarget(
    cycleType,
    quest,
    level
){

    const target =
        Number(quest.target) || 1;


    if(cycleType === "daily"){

        const mapping =
            DAILY_TARGET_MIGRATIONS[
                quest.type
            ];


        if(!mapping){

            return target;

        }


        if(isHighQuestLevel(level)){

            return mapTargetByDifficulty(
                target,
                mapping.low,
                mapping.high
            );

        }


        return mapTargetByDifficulty(
            target,
            mapping.high,
            mapping.low
        );

    }


    if(
        cycleType === "weekly"
        &&
        isHighQuestLevel(level)
    ){

        const mapping =
            WEEKLY_TARGET_MIGRATIONS[
                quest.type
            ];


        if(mapping){

            return mapTargetByDifficulty(
                target,
                mapping.old,
                mapping.high
            );

        }

    }


    return target;

}


function migrateDailyRewardsForLevel(
    rewards,
    level
){

    const eliteLevel =
        isEliteRewardLevel(
            level
        );


    const highLevel =
        isHighQuestLevel(
            level
        );


    const currentRewards =
        rewards || [];


    const hasEliteRewards =
        currentRewards.some(
            reward =>
                String(
                    reward.levelBand || ""
                ).toLowerCase() === "elite"
        );


    // Crossing the Level 150 boundary swaps the entire unclaimed reward
    // set. This guarantees that old Level 100-149 rewards never leak into
    // the separate Level 150+ pool (and vice versa after a level loss).
    if(eliteLevel){

        const allElite =
            currentRewards.length > 0
            &&
            currentRewards.every(
                reward =>
                    String(
                        reward.levelBand || ""
                    ).toLowerCase() === "elite"
            )
            &&
            [4, 5].includes(
                currentRewards.length
            );


        return allElite
            ? currentRewards.map(
                reward => ({
                    ...reward
                })
            )
            : generateDailyRewardsElite();

    }


    if(hasEliteRewards){

        return highLevel
            ? generateDailyRewardsHigh()
            : generateDailyRewardsLow();

    }


    return currentRewards.map(
        reward => {

            const migrated = {
                ...reward
            };


            const oldBand =
                String(
                    migrated.levelBand || ""
                ).toLowerCase();


            if(migrated.type === "xp"){

                const amount =
                    Math.max(
                        0,
                        Number(migrated.amount) || 0
                    );


                if(highLevel){

                    if(oldBand === "low"){

                        migrated.amount =
                            mapTargetByDifficulty(
                                amount,
                                [50000, 100000, 200000],
                                [200000, 500000, 1000000]
                            );

                    }
                    else if(amount <= 50000){

                        migrated.amount =
                            200000;

                    }
                    else if(amount <= 100000){

                        migrated.amount =
                            500000;

                    }
                    else if(
                        ![
                            200000,
                            500000,
                            1000000
                        ].includes(amount)
                    ){

                        migrated.amount =
                            Math.min(
                                1000000,
                                Math.max(
                                    200000,
                                    amount
                                )
                            );

                    }

                }
                else{

                    if([
                        50000,
                        100000,
                        200000
                    ].includes(amount)){

                        migrated.amount =
                            amount;

                    }
                    else if(amount <= 50000){

                        migrated.amount =
                            50000;

                    }
                    else if(amount <= 100000){

                        migrated.amount =
                            100000;

                    }
                    else{

                        migrated.amount =
                            200000;

                    }

                }


                migrated.levelBand =
                    highLevel
                        ? "high"
                        : "low";

            }
            else if(migrated.type === "boost"){

                if(highLevel){

                    // A reward that came from the low-level daily pool
                    // upgrades to the normal Level 100+ daily quantity.
                    if(
                        oldBand === "low"
                        ||
                        Number(migrated.amount) <= 2
                    ){

                        migrated.tier =
                            "tier3";

                        migrated.amount =
                            5;

                    }

                }
                else{

                    // Lv1-99 daily boosts are ONLY Luck III / XP III,
                    // in quantities of 1x or 2x.
                    migrated.tier =
                        "tier3";

                    migrated.amount =
                        Math.max(
                            1,
                            Math.min(
                                2,
                                Number(migrated.amount) || 1
                            )
                        );

                }


                migrated.levelBand =
                    highLevel
                        ? "high"
                        : "low";

            }
            else if(
                migrated.type === "guaranteed_roll"
                &&
                migrated.rollType === "daily_25k_75k"
            ){

                migrated.amount =
                    Math.max(
                        1,
                        Number(migrated.amount) || 1
                    );

                migrated.levelBand =
                    highLevel
                        ? "high"
                        : "low";

            }


            return migrated;

        }
    );

}


function migrateWeeklyRewards(
    rewards,
    level
){

    const currentRewards =
        rewards || [];


    const eliteLevel =
        isEliteRewardLevel(
            level
        );


    const allElite =
        currentRewards.length > 0
        &&
        currentRewards.every(
            reward =>
                String(
                    reward.levelBand || ""
                ).toLowerCase() === "elite"
        )
        &&
        currentRewards.length >= 4
        &&
        currentRewards.length <= 6;


    if(eliteLevel){

        return allElite
            ? currentRewards.map(
                reward => ({
                    ...reward
                })
            )
            : generateWeeklyRewardsElite();

    }


    if(
        currentRewards.some(
            reward =>
                String(
                    reward.levelBand || ""
                ).toLowerCase() === "elite"
        )
    ){

        return generateWeeklyRewardsHigh();

    }


    return currentRewards.map(
        reward => {

            const migrated = {
                ...reward
            };


            // -----------------------------
            // WEEKLY XP
            // -----------------------------
            if(migrated.type === "xp"){

                const amount =
                    Math.max(
                        0,
                        Number(migrated.amount) || 0
                    );


                // Old weekly XP difficulty:
                // 2m / 5m / 10m
                //
                // New weekly XP difficulty:
                // 15m / 30m / 50m
                if(amount <= 2000000){

                    migrated.amount =
                        15000000;

                }
                else if(amount <= 5000000){

                    migrated.amount =
                        30000000;

                }
                else if(
                    ![
                        15000000,
                        30000000,
                        50000000
                    ].includes(amount)
                ){

                    migrated.amount =
                        50000000;

                }

            }


            // -----------------------------
            // WEEKLY BOOSTS
            // -----------------------------
            else if(migrated.type === "boost"){

                const boostType =
                    String(
                        migrated.boostType || ""
                    ).toLowerCase();


                const tier =
                    String(
                        migrated.tier || ""
                    ).toLowerCase();


                const amount =
                    Math.max(
                        0,
                        Number(migrated.amount) || 0
                    );


                // Luck/XP MAX:
                // old 2 / 3 / 5
                // new 2 / 5
                if(
                    (
                        boostType === "luck"
                        ||
                        boostType === "xp"
                    )
                    &&
                    tier === "max"
                ){

                    migrated.amount =
                        amount <= 2
                            ? 2
                            : 5;

                }


                // Luck/XP III:
                // old 5 / 10
                // new 10 / 20
                else if(
                    (
                        boostType === "luck"
                        ||
                        boostType === "xp"
                    )
                    &&
                    tier === "tier3"
                ){

                    migrated.amount =
                        amount <= 5
                            ? 10
                            : 20;

                }

            }


            // IMPORTANT:
            // guaranteed_roll:impossible stays unchanged.
            // triple_roll stays unchanged.
            // Any other reward type stays unchanged.


            migrated.levelBand =
                "high";


            return migrated;

        }
    );

}


function migrateCycleData(
    cycle,
    level = QUEST_UNLOCK_LEVEL
){

    const normalized =
        normalizeCycle(cycle);


    if(!normalized){

        return {
            changed: false,
            cycle: normalized
        };

    }


    // Weekly quests are frozen/hidden for Lv1-99.
    // Do not rewrite their saved quest progress while locked.
    if(
        normalized.cycletype === "weekly"
        &&
        !isHighQuestLevel(level)
    ){

        return {
            changed: false,
            cycle: normalized
        };

    }


    const beforeQuests =
        JSON.stringify(
            normalized.quests
        );


    const beforeRewards =
        JSON.stringify(
            normalized.rewards
        );


    const band =
        getLevelBand(
            level
        );


    const quests =
        normalized.quests.map(
            quest => {

                const migrated = {
                    ...quest
                };


                // Never replace an active weekly legacy critical-streak quest
                // with the new "best streak" quest mid-cycle. That would make
                // saved progress meaningless. New cycles use the new quest.
                if(
                    !(
                        normalized.cycletype === "weekly"
                        &&
                        migrated.type === "critical_streak"
                    )
                ){

                    migrated.target =
                        migrateQuestTarget(
                            normalized.cycletype,
                            migrated,
                            level
                        );

                }


                migrated.rulesetVersion =
                    QUEST_RULESET_VERSION;

                migrated.levelBand =
                    band;


                const definition =
                    getQuestDefinition(
                        normalized.cycletype,
                        migrated.type,
                        level
                    );


                if(definition){

                    migrated.icon =
                        definition.icon;

                    migrated.mode =
                        definition.mode || "add";

                    migrated.label =
                        definition.label(
                            Number(migrated.target)
                        );

                }


                // Absolutely preserve existing progress and completed state.
                const progress =
                    Math.max(
                        0,
                        Number(migrated.progress) || 0
                    );


                const target =
                    Math.max(
                        1,
                        Number(migrated.target) || 1
                    );


                migrated.progress =
                    progress;


                // A completed quest always stays completed even if its target
                // gets buffed. An incomplete quest only auto-completes if its
                // already-saved progress meets the new target.
                if(
                    !migrated.completed
                    &&
                    progress >= target
                ){

                    migrated.completed =
                        true;

                    migrated.completedAt =
                        migrated.completedAt ||
                        Date.now();

                }


                return migrated;

            }
        );


    let rewards =
        normalized.rewards;


    // Never modify/claw back rewards that were already claimed.
    if(!normalized.rewarded){

        if(
            normalized.cycletype === "daily"
        ){

            rewards =
                migrateDailyRewardsForLevel(
                    normalized.rewards,
                    level
                );

        }
        else if(
            normalized.cycletype === "weekly"
            &&
            isHighQuestLevel(level)
        ){

            rewards =
                migrateWeeklyRewards(
                    normalized.rewards,
                    level
                );

        }

    }


    const changed =
        beforeQuests !==
            JSON.stringify(quests)
        ||
        beforeRewards !==
            JSON.stringify(rewards);


    return {
        changed,
        cycle: {
            ...normalized,
            quests,
            rewards
        }
    };

}


async function migrateActiveQuestCycles(
    client = null
){

    const rows =
        await database.getActiveQuestCycles(
            Date.now()
        );


    let changedCount = 0;
    let autoClaimedCount = 0;


    const levelCache =
        new Map();


    for(const row of rows){

        const guildID =
            row.guildid ||
            row.guildID;

        const userID =
            row.userid ||
            row.userID;

        const cacheKey =
            `${guildID}:${userID}`;


        let level =
            levelCache.get(
                cacheKey
            );


        if(!level){

            const user =
                await database.getUser(
                    guildID,
                    userID
                );


            const xpUtil =
                require("../utils/xp");


            level =
                xpUtil.getLevel(
                    Number(user?.xp) || 0
                );


            levelCache.set(
                cacheKey,
                level
            );

        }


        const normalizedRow =
            normalizeCycle(
                row
            );


        const weeklyLocked =
            normalizedRow.cycletype === "weekly"
            &&
            !isHighQuestLevel(level);


        const migrated =
            migrateCycleData(
                row,
                level
            );


        const cycle =
            migrated.cycle;


        const cycleInfo =
            getCycleInfo(
                cycle.cycletype
            );


        const shouldUpdateExpiry =
            cycle.cyclekey ===
                cycleInfo.cycleKey
            &&
            Number(cycle.expiresat) !==
                Number(cycleInfo.expiresAt);


        if(
            migrated.changed
            ||
            shouldUpdateExpiry
        ){

            const updated =
                await database.replaceQuestCycleData(
                    guildID,
                    userID,
                    cycle.cycletype,
                    cycle.cyclekey,
                    cycle.quests,
                    cycle.rewards,
                    shouldUpdateExpiry
                        ? cycleInfo.expiresAt
                        : null
                );


            if(updated){

                changedCount++;

            }

        }


        // Weekly completion/rewards stay frozen for Lv1-99 until Level 100.
        if(weeklyLocked){

            continue;

        }


        const refreshed =
            await database.getQuestCycle(
                guildID,
                userID,
                cycle.cycletype,
                cycle.cyclekey
            );


        const normalizedUpdated =
            normalizeCycle(
                refreshed ||
                cycle
            );


        const allCompleted =
            normalizedUpdated.quests.length > 0
            &&
            normalizedUpdated.quests.every(
                quest =>
                    Boolean(quest.completed)
            );


        if(
            allCompleted
            &&
            !normalizedUpdated.rewarded
        ){

            const claim =
                await database.claimQuestCycleRewards(
                    guildID,
                    userID,
                    normalizedUpdated.cycletype,
                    normalizedUpdated.cyclekey
                );


            if(claim?.claimed){

                autoClaimedCount++;


                if(
                    client
                    &&
                    claim.rewards.some(
                        reward =>
                            reward.type === "xp"
                            &&
                            Number(reward.amount) > 0
                    )
                ){

                    await leveling.syncLevelAndAnnounce(
                        client,
                        guildID,
                        userID
                    ).catch(
                        () => {}
                    );

                }

            }

        }

    }


    console.log(
        `✅ Quest ruleset v${QUEST_RULESET_VERSION} migrated ${changedCount} active cycles and auto-claimed ${autoClaimedCount} eligible completed cycles without resetting progress.`
    );


    return {
        changedCount,
        autoClaimedCount
    };

}


async function ensureCycle(
    guildID,
    userID,
    cycleType,
    level
){

    const cycleInfo =
        getCycleInfo(cycleType);


    let cycle =
        await database.getQuestCycle(
            guildID,
            userID,
            cycleType,
            cycleInfo.cycleKey
        );


    if(!cycle){

        await database.createQuestCycle(
            guildID,
            userID,
            cycleType,
            cycleInfo.cycleKey,
            cycleInfo.expiresAt,
            generateQuests(
                cycleType,
                level
            ),
            generateRewards(
                cycleType,
                level
            )
        );


        cycle =
            await database.getQuestCycle(
                guildID,
                userID,
                cycleType,
                cycleInfo.cycleKey
            );

    }
    else if(
        Number(
            cycle.expiresat ||
            cycle.expiresAt
        ) !==
        Number(
            cycleInfo.expiresAt
        )
    ){

        cycle =
            await database.replaceQuestCycleData(
                guildID,
                userID,
                cycleType,
                cycleInfo.cycleKey,
                normalizeJSON(cycle.quests) || [],
                normalizeJSON(cycle.rewards) || [],
                cycleInfo.expiresAt
            );

    }


    const migrated =
        migrateCycleData(
            cycle,
            level
        );


    if(migrated.changed){

        cycle =
            await database.replaceQuestCycleData(
                guildID,
                userID,
                cycleType,
                cycleInfo.cycleKey,
                migrated.cycle.quests,
                migrated.cycle.rewards,
                cycleInfo.expiresAt
            );

    }


    return normalizeCycle(cycle);

}


async function ensureUserQuests(
    guildID,
    userID
){

    const user =
        await database.getUser(
            guildID,
            userID
        );


    const xpUtil =
        require("../utils/xp");


    const level =
        xpUtil.getLevel(
            Number(user?.xp) || 0
        );


    const daily =
        await ensureCycle(
            guildID,
            userID,
            "daily",
            level
        );


    const weeklyLocked =
        !isHighQuestLevel(
            level
        );


    let weekly = null;


    if(weeklyLocked){

        // Do NOT create or progress weekly quests for Lv1-99.
        // If they had an older active weekly cycle, it remains saved
        // untouched in PostgreSQL and resumes if they reach Level 100
        // before the weekly reset.
        const weeklyInfo =
            getCycleInfo(
                "weekly"
            );


        weekly =
            normalizeCycle(
                await database.getQuestCycle(
                    guildID,
                    userID,
                    "weekly",
                    weeklyInfo.cycleKey
                )
            );

    }
    else{

        weekly =
            await ensureCycle(
                guildID,
                userID,
                "weekly",
                level
            );

    }


    return {
        daily,
        weekly,
        weeklyLocked,
        level
    };

}


function generateQuestResetData(
    cycleType,
    level,
    currentCycle
){

    const currentSignature =
        JSON.stringify({
            quests:
                currentCycle?.quests || [],
            rewards:
                currentCycle?.rewards || []
        });


    let nextData;


    // A reset is intended to reroll both lists. Try several times so a
    // user is not normally charged just to see the exact same panel.
    for(let attempt = 0; attempt < 10; attempt++){

        nextData = {
            quests:
                generateQuests(
                    cycleType,
                    level
                ),
            rewards:
                generateRewards(
                    cycleType,
                    level
                )
        };


        if(
            JSON.stringify(nextData) !==
            currentSignature
        ){

            break;

        }

    }


    return nextData;

}


async function resetQuestCycle(
    guildID,
    userID,
    cycleType
){

    const normalizedCycleType =
        String(
            cycleType || ""
        ).toLowerCase();


    const config =
        QUEST_RESET_CONFIG[
            normalizedCycleType
        ];


    if(!config){

        return {
            success: false,
            status: "invalid-cycle-type"
        };

    }


    const dashboard =
        await ensureUserQuests(
            guildID,
            userID
        );


    if(
        normalizedCycleType === "weekly"
        &&
        dashboard.weeklyLocked
    ){

        return {
            success: false,
            status: "weekly-locked",
            cycleType:
                normalizedCycleType,
            level:
                dashboard.level,
            unlockLevel:
                QUEST_UNLOCK_LEVEL,
            price:
                config.price,
            maxResets:
                config.maxResets
        };

    }


    const currentCycle =
        dashboard[
            normalizedCycleType
        ];


    if(!currentCycle){

        return {
            success: false,
            status: "missing-cycle",
            cycleType:
                normalizedCycleType
        };

    }


    const resetCount =
        Math.max(
            0,
            Number(
                currentCycle.resetcount || 0
            )
        );


    if(resetCount >= config.maxResets){

        return {
            success: false,
            status: "reset-limit-reached",
            cycleType:
                normalizedCycleType,
            price:
                config.price,
            maxResets:
                config.maxResets,
            resetCount,
            remainingResets: 0,
            nextResetAt:
                currentCycle.expiresat
        };

    }


    const nextData =
        generateQuestResetData(
            normalizedCycleType,
            dashboard.level,
            currentCycle
        );


    const result =
        await database.resetQuestCycleWithXP(
            guildID,
            userID,
            normalizedCycleType,
            currentCycle.cyclekey,
            nextData.quests,
            nextData.rewards
        );


    return {
        ...result,
        cycle:
            result.cycle
                ? normalizeCycle(
                    result.cycle
                )
                : null
    };

}


function getContext(
    source,
    userIDOverride = null
){

    const guild =
        source.guild ||
        source.message?.guild ||
        null;


    const client =
        source.client ||
        source.message?.client ||
        null;


    const channel =
        source.channel ||
        source.message?.channel ||
        null;


    const userID =
        userIDOverride ||
        source.author?.id ||
        source.user?.id ||
        source.member?.id ||
        null;


    return {
        guild,
        client,
        channel,
        userID
    };

}


function formatRewardDuration(durationMs){

    const safeDuration =
        Math.max(
            1,
            Number(durationMs) ||
            24 * 60 * 60 * 1000
        );


    const hours =
        Math.max(
            1,
            Math.round(
                safeDuration /
                (60 * 60 * 1000)
            )
        );


    return `${hours} hour${hours === 1 ? "" : "s"}`;

}


function formatReward(reward){

    if(reward.type === "xp"){

        return `**${Number(reward.amount).toLocaleString()} XP**`;

    }


    if(reward.type === "boost"){

        const profile =
            reward.boostType === "xp"
                ? boosts.BOOST_PROFILES[reward.tier]
                : luck.LUCK_ROLES[reward.tier];


        const name =
            profile
                ? `<@&${profile.roleID}>`
                : `${reward.boostType} ${reward.tier}`;


        return `**${reward.amount}x** ${name}`;

    }


    if(
        reward.type === "guaranteed_roll" &&
        reward.rollType === "daily_25k_75k"
    ){

        return "Guaranteed **25,000–75,000 XP** on your next `!roll`";

    }


    if(
        reward.type === "guaranteed_roll" &&
        reward.rollType === "impossible"
    ){

        return "Guaranteed **Impossible Roll** on your next `!roll`";

    }


    if(reward.type === "triple_roll"){

        return "Each `!roll` automatically performs **3 rolls at once** for 24 hours";

    }


    if(reward.type === "guaranteed_roll_minimum"){

        return (
            `Guaranteed **${Number(reward.minXP).toLocaleString()}+ XP** ` +
            "on your next `!roll`"
        );

    }


    if(reward.type === "next_roll_burst"){

        return (
            `Your next \`!roll\` performs **${Number(reward.rollCount).toLocaleString()} rolls at once**`
        );

    }


    if(reward.type === "shop_discount"){

        return (
            `**${Number(reward.discountPercent)}% off** \`!shop\` for ` +
            `**${formatRewardDuration(reward.durationMs)}**`
        );

    }


    if(reward.type === "guaranteed_criticals"){

        return (
            `Your next **${Number(reward.amount)}** chat XP drops are guaranteed criticals in a row`
        );

    }


    if(reward.type === "chat_xp_multiplier"){

        return (
            `Earn **${Number(reward.multiplier)}x chat XP** for ` +
            `**${formatRewardDuration(reward.durationMs)}**`
        );

    }


    if(reward.type === "multi_roll"){

        return (
            `Each \`!roll\` performs **${Number(reward.rollCount)} rolls at once** for ` +
            `**${formatRewardDuration(reward.durationMs)}**`
        );

    }


    if(reward.type === "social_command_triple"){

        return (
            "Each `!hug`, `!kiss`, and `!steal` performs " +
            `**${Number(reward.repeatCount) || 3} uses at once** for ` +
            `**${formatRewardDuration(reward.durationMs)}**`
        );

    }


    return "Unknown reward";

}


async function sendQuestCompleted(
    context,
    cycleType,
    quest
){

    if(!context.channel){

        return;

    }


    const cycleName =
        cycleType === "daily"
            ? "Daily"
            : "Weekly";


    await context.channel.send(

        `${quest.icon} <@${context.userID}> completed a **${cycleName} Quest**: **${quest.label}**`

    ).catch(() => {});

}


async function sendCycleCompleted(
    context,
    cycleType,
    rewards
){

    if(!context.channel){

        return;

    }


    const cycleName =
        cycleType === "daily"
            ? "Daily Quests Completed"
            : "Weekly Quests Completed";


    const embed =
        new EmbedBuilder()

            .setColor(
                cycleType === "daily"
                    ? "#7A5CFF"
                    : "#D4AF37"
            )

            .setTitle(
                cycleName
            )

            .setDescription(
                `<@${context.userID}> completed every ${cycleType} quest.\n\n` +
                rewards
                    .map(
                        reward =>
                            `• ${formatReward(reward)}`
                    )
                    .join("\n")
            )

            .setFooter({
                text:
                    "Rewards were added automatically."
            })

            .setTimestamp();


    await context.channel.send({
        embeds: [
            embed
        ]
    }).catch(() => {});

}


async function claimCompletedCycle(
    context,
    cycleType,
    cycleKey
){

    const claim =
        await database.claimQuestCycleRewards(
            context.guild.id,
            context.userID,
            cycleType,
            cycleKey
        );


    if(!claim?.claimed){

        return null;

    }


    const hasXPReward =
        claim.rewards.some(
            reward =>
                reward.type === "xp" &&
                Number(reward.amount) > 0
        );


    if(
        hasXPReward &&
        context.client
    ){

        await leveling.syncLevelAndAnnounce(
            context.client,
            context.guild.id,
            context.userID
        );

    }


    await sendCycleCompleted(
        context,
        cycleType,
        claim.rewards
    );


    return claim;

}


async function recordEventUnsafe(
    source,
    eventType,
    amount = 1,
    options = {}
){

    const context =
        getContext(
            source,
            options.userID || null
        );


    if(
        !context.guild ||
        !context.userID
    ){

        return [];

    }


    const numericAmount =
        Number(amount) || 0;


    if(numericAmount <= 0){

        return [];

    }


    const cycles =
        await ensureUserQuests(
            context.guild.id,
            context.userID
        );


    const results = [];


    const cycleTypes =
        cycles.weeklyLocked
            ? ["daily"]
            : [
                "daily",
                "weekly"
            ];


    for(const cycleType of cycleTypes){

        const cycle =
            cycles[cycleType];


        if(!cycle){

            continue;

        }


        const result =
            await database.updateQuestCycleProgress(
                context.guild.id,
                context.userID,
                cycleType,
                cycle.cyclekey,
                eventType,
                numericAmount
            );


        if(!result){

            continue;

        }


        for(const quest of result.newlyCompleted){

            await sendQuestCompleted(
                context,
                cycleType,
                quest
            );

        }


        if(result.allCompleted){

            await claimCompletedCycle(
                context,
                cycleType,
                cycle.cyclekey
            );

        }


        results.push(result);

    }


    return results;

}


async function recordEvent(
    source,
    eventType,
    amount = 1,
    options = {}
){

    try{

        return await recordEventUnsafe(
            source,
            eventType,
            amount,
            options
        );

    }
    catch(error){

        console.error(
            "Quest progress update failed:",
            error
        );


        return [];

    }

}


async function recordLevelChange(
    source,
    levelResult,
    userID = null
){

    if(!levelResult){

        return;

    }


    const oldLevel =
        Number(levelResult.oldLevel);


    const newLevel =
        Number(
            levelResult.newLevel ??
            levelResult.level
        );


    const changed =
        Number.isFinite(oldLevel) &&
        Number.isFinite(newLevel)
            ? oldLevel !== newLevel
            : Boolean(levelResult.leveledUp);


    if(changed){

        await recordEvent(
            source,
            "level_change",
            1,
            {
                userID
            }
        );

    }

}


async function getDashboard(
    guildID,
    userID
){

    return ensureUserQuests(
        guildID,
        userID
    );

}


async function consumeGuaranteedRoll(
    guildID,
    userID
){

    return database.consumeGuaranteedQuestRoll(
        guildID,
        userID
    );

}


async function useRollCooldown(
    guildID,
    userID,
    cooldownMs
){

    return database.useQuestRollCooldown(
        guildID,
        userID,
        cooldownMs
    );

}


async function getChatXPMultiplier(
    guildID,
    userID
){

    return database.getQuestChatXPMultiplier(
        guildID,
        userID
    );

}


async function consumeGuaranteedCritical(
    guildID,
    userID
){

    return database.consumeQuestGuaranteedCritical(
        guildID,
        userID
    );

}


async function getSocialCommandRepeatCount(
    guildID,
    userID
){

    return database.getQuestSocialCommandRepeatCount(
        guildID,
        userID
    );

}


module.exports = {

    QUEST_UNLOCK_LEVEL,

    ELITE_REWARD_LEVEL,

    QUEST_RESET_CONFIG,

    ensureUserQuests,

    resetQuestCycle,

    migrateActiveQuestCycles,

    getDashboard,

    recordEvent,

    recordLevelChange,

    consumeGuaranteedRoll,

    useRollCooldown,

    getChatXPMultiplier,

    consumeGuaranteedCritical,

    getSocialCommandRepeatCount,

    formatReward

};
