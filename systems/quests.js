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


// These values are permanent Quest-upgrade tiers, not player levels.
const QUEST_UPGRADE_ONE =
    1;


const QUEST_UPGRADE_TWO =
    2;


const QUEST_RULESET_VERSION =
    12;


// Stored on every newly generated weekly reward. Active, unclaimed weekly
// cycles from older builds are rerolled once so users see the new economy
// immediately without losing any quest progress.
const WEEKLY_REWARD_RULESET_VERSION =
    3;


// Daily-only Luck Boost MAX quantities. Weekly Luck MAX rewards keep their
// separate values and are deliberately not affected by this economy nerf.
const DAILY_LUCK_MAX_AMOUNTS =
    [1, 2, 3];


// Quest chat-XP rewards deliberately stop at 2x. Merchant chat-XP deals are
// a separate system and keep their own stronger 8x/12x/15x reward pool.
const QUEST_CHAT_XP_MULTIPLIERS =
    Object.freeze([1.5, 1.75, 2]);


function normalizeQuestChatXPMultiplier(
    multiplier
){

    const safeMultiplier =
        Number(multiplier) ||
        QUEST_CHAT_XP_MULTIPLIERS[0];


    return (
        QUEST_CHAT_XP_MULTIPLIERS.find(
            tier => safeMultiplier <= tier
        )
        ||
        QUEST_CHAT_XP_MULTIPLIERS[
            QUEST_CHAT_XP_MULTIPLIERS.length - 1
        ]
    );

}


function upgradeQuestChatXPMultiplier(
    multiplier
){

    const normalized =
        normalizeQuestChatXPMultiplier(
            multiplier
        );


    const currentIndex =
        QUEST_CHAT_XP_MULTIPLIERS.indexOf(
            normalized
        );


    return QUEST_CHAT_XP_MULTIPLIERS[
        Math.min(
            currentIndex + 1,
            QUEST_CHAT_XP_MULTIPLIERS.length - 1
        )
    ];

}


// Easy-to-edit targets for the chat-only XP quest. Only XP awarded by
// leveling.giveXP(message) counts; rolls, quest rewards, trades, and admin
// XP do not advance this quest.
const CHAT_XP_QUEST_TARGETS = {

    daily: {
        low: [2500, 7500, 15000],
        high: [25000, 75000, 150000],
        elite: [100000, 250000, 500000]
    },

    weekly: {
        low: [50000, 150000, 300000],
        high: [250000, 750000, 1500000],
        elite: [1000000, 2500000, 5000000]
    }

};


const QUEST_RESET_CONFIG =
    database.QUEST_RESET_CONFIG;


function getQuestResetPrice(
    cycleType,
    level
){

    return database.getQuestResetPrice(
        cycleType,
        level
    );

}


// =====================================================
// BASE DAILY QUESTS (QUEST UPGRADE 0)
// =====================================================
//
// Every player begins here regardless of display level.
const DAILY_QUEST_POOL_LOW = [

    {
        type: "messages",
        icon: "💬",
        targets: [50, 100, 200, 250],
        label: target => `Send ${target.toLocaleString()} messages`
    },

    {
        type: "chat_xp",
        icon: "💬✦",
        targetsByLevelBand:
            CHAT_XP_QUEST_TARGETS.daily,
        label: target =>
            `Earn ${target.toLocaleString()} XP by chatting.`
    },

    {
        type: "roll_xp",
        icon: "🎲",
        targets: [10000, 50000, 100000],
        label: target => `Roll a total of ${target.toLocaleString()} XP`
    },

    {
        type: "earn_xp",
        icon: "✦",
        targets: [50000, 100000, 200000],
        label: target => `Earn ${target.toLocaleString()} XP`
    },

    {
        type: "steal_xp",
        icon: "💰",
        targets: [5000, 10000, 20000],
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
        targets: [2, 3, 5],
        label: target => `Get kissed ${target} times`
    },

    {
        type: "roll_count",
        icon: "🎲",
        targets: [15, 25, 50],
        label: target => `Use !roll ${target} times`
    },

    {
        type: "critical_streak",
        icon: "💥",
        targets: [2, 3, 5],
        mode: "max",
        label: target => `Reach a ${target}x critical streak`
    },

    {
        type: "level_change",
        icon: "★",
        targets: [2, 5, 10],
        mode: "max",
        label: target => `Gain ${target} levels.`
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
// QUEST UPGRADE 1 DAILY QUESTS
// =====================================================
//
// Only the quests requested by the owner are buffed.
// All other daily quests keep their previous targets.
const DAILY_QUEST_POOL_HIGH = [

    {
        type: "messages",
        icon: "💬",
        targets: [100, 200, 300],
        label: target => `Send ${target.toLocaleString()} messages`
    },

    {
        type: "chat_xp",
        icon: "💬✦",
        targetsByLevelBand:
            CHAT_XP_QUEST_TARGETS.daily,
        label: target =>
            `Earn ${target.toLocaleString()} XP by chatting.`
    },

    {
        type: "roll_xp",
        icon: "🎲",
        targets: [1000000, 2500000, 5000000],
        label: target => `Roll a total of ${target.toLocaleString()} XP`
    },

    {
        type: "single_roll_xp",
        icon: "🎯",
        // Stored as threshold + 1 so "more than" is literal.
        targets: [50001, 100001, 200001],
        mode: "max",
        label: target =>
            `Roll more than ${(target - 1).toLocaleString()} XP in one roll`
    },

    {
        type: "earn_xp",
        icon: "✦",
        targets: [5000000, 10000000, 25000000],
        label: target => `Earn ${target.toLocaleString()} XP`
    },

    {
        type: "steal_xp",
        icon: "💰",
        targets: [50000, 100000, 200000],
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
        targets: [20, 50, 100],
        label: target => `Use !roll ${target} times`
    },

    {
        type: "critical_streak",
        icon: "💥",
        targets: [15, 20, 25],
        mode: "max",
        label: target => `Reach a ${target}x critical streak`
    },

    {
        type: "level_change",
        icon: "★",
        targets: [5, 10, 15],
        mode: "max",
        label: target => `Gain ${target} levels.`
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
// BASE WEEKLY QUESTS (QUEST UPGRADE 0)
// =====================================================

const WEEKLY_QUEST_POOL_LOW = [

    {
        type: "messages",
        icon: "💬",
        targets: [250, 500, 1000],
        label: target => `Send ${target.toLocaleString()} messages`
    },

    {
        type: "chat_xp",
        icon: "💬✦",
        targetsByLevelBand:
            CHAT_XP_QUEST_TARGETS.weekly,
        label: target =>
            `Earn ${target.toLocaleString()} XP by chatting.`
    },

    {
        type: "roll_xp",
        icon: "🎲",
        targets: [250000, 500000, 1000000],
        label: target => `Roll a total of ${target.toLocaleString()} XP`
    },

    {
        type: "earn_xp",
        icon: "✦",
        targets: [2500000, 5000000, 10000000],
        label: target => `Earn ${target.toLocaleString()} XP`
    },

    {
        type: "steal_xp",
        icon: "💰",
        targets: [100000, 250000, 500000],
        label: target => `Steal ${target.toLocaleString()} XP`
    },

    {
        type: "kiss_given",
        icon: "💋",
        targets: [15, 25, 40],
        label: target => `Kiss someone ${target} times`
    },

    {
        type: "kiss_received",
        icon: "💋",
        targets: [10, 15, 25],
        label: target => `Get kissed ${target} times`
    },

    {
        type: "roll_count",
        icon: "🎲",
        targets: [100, 200, 300],
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
        targets: [5, 10, 15],
        label: target => `Successfully trade with someone ${target} times`
    }

];


// =====================================================
// QUEST UPGRADE 1+ WEEKLY QUESTS
// =====================================================

const WEEKLY_QUEST_POOL_HIGH = [

    {
        type: "messages",
        icon: "💬",
        targets: [1000, 2000, 5000],
        label: target => `Send ${target.toLocaleString()} messages`
    },

    {
        type: "chat_xp",
        icon: "💬✦",
        targetsByLevelBand:
            CHAT_XP_QUEST_TARGETS.weekly,
        label: target =>
            `Earn ${target.toLocaleString()} XP by chatting.`
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
        targets: [50000000, 100000000, 150000000],
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
        targets: [50, 75, 100],
        label: target => `Kiss someone ${target} times`
    },

    {
        type: "kiss_received",
        icon: "💋",
        targets: [25, 35, 40],
        label: target => `Get kissed ${target} times`
    },

    {
        type: "roll_count",
        icon: "🎲",
        targets: [500, 1000, 1250],
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
        targets: [25, 35, 50],
        label: target => `Successfully trade with someone ${target} times`
    },

    {
        type: "buy_luck_max",
        icon: "💸",
        targets: [3, 5, 7],
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
    targets: [25, 35, 40],
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


function hasQuestUpgradeOne(level){

    return (
        Number(level) >=
        QUEST_UPGRADE_ONE
    );

}


function hasQuestUpgradeTwo(level){

    return (
        Number(level) >=
        QUEST_UPGRADE_TWO
    );

}


function getQuestUpgradeBand(level){

    if(hasQuestUpgradeTwo(level)){

        return "elite";

    }


    return hasQuestUpgradeOne(level)
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


function getDefinitionTargets(
    definition,
    levelBand
){

    const targets =
        definition?.targetsByLevelBand?.[
            levelBand
        ]
        ||
        definition?.targets
        ||
        [];


    return Array.isArray(targets)
        ? targets
        : [];

}


function makeQuest(
    definition,
    slot,
    levelBand
){

    const availableTargets =
        getDefinitionTargets(
            definition,
            levelBand
        );


    const target =
        randomChoice(
            availableTargets
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
        hasQuestUpgradeOne(
            level
        );


    const pool =
        cycleType === "daily"
            ? (
                highLevel
                    ? DAILY_QUEST_POOL_HIGH
                    : DAILY_QUEST_POOL_LOW
            )
            : (
                highLevel
                    ? WEEKLY_QUEST_POOL_HIGH
                    : WEEKLY_QUEST_POOL_LOW
            );


    const amount =
        cycleType === "daily"
            ? DAILY_QUEST_COUNT
            : WEEKLY_QUEST_COUNT;


    // Quest Upgrade 1 introduces the harder/expanded target pools. Quest
    // Upgrades 2 and 3 improve rewards and reset perks without silently
    // making those targets harder again.
    const band =
        highLevel
            ? "high"
            : "low";


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


function generateWeeklyRewardsBase(){

    const levelBand = "low";

    return [
        {
            type: "xp",
            amount:
                randomChoice([
                    500000,
                    1000000,
                    2500000
                ]),
            levelBand,
            weeklyRewardRulesetVersion:
                WEEKLY_REWARD_RULESET_VERSION
        },
        randomChoice([
            {
                type: "boost",
                boostType: "luck",
                tier: "tier3",
                amount: randomChoice([1, 2, 3]),
                levelBand,
                weeklyRewardRulesetVersion:
                    WEEKLY_REWARD_RULESET_VERSION
            },
            {
                type: "boost",
                boostType: "xp",
                tier: "tier1",
                amount: randomChoice([3, 5]),
                levelBand,
                weeklyRewardRulesetVersion:
                    WEEKLY_REWARD_RULESET_VERSION
            },
            {
                type: "guaranteed_roll_minimum",
                minXP: 250000,
                amount: 1,
                levelBand,
                weeklyRewardRulesetVersion:
                    WEEKLY_REWARD_RULESET_VERSION
            }
        ])
    ];

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
                2000000,
                3500000,
                5000000
            ]),
        levelBand
    };


    const extras =
        shuffle([

        {
            type: "boost",
            boostType: "luck",
            tier: "max",
            amount:
                randomChoice(
                    DAILY_LUCK_MAX_AMOUNTS
                ),
            levelBand
        },

        {
            type: "boost",
            boostType: "luck",
            tier: "tier3",
            amount:
                randomChoice([3, 5, 7]),
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
            multiplier: 1.5,
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
                    7500000,
                    15000000,
                    25000000
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
                    randomChoice([2, 3]),
                levelBand: "high"
            },

            {
                type: "boost",
                boostType: "luck",
                tier: "tier3",
                amount:
                    randomChoice([3, 5, 8]),
                levelBand: "high"
            },

            {
                type: "multi_roll",
                rollCount: 3,
                durationMs:
                    24 * 60 * 60 * 1000,
                levelBand: "high"
            },

            {
                type: "chat_xp_multiplier",
                multiplier:
                    randomChoice([1.5, 1.75]),
                durationMs:
                    24 * 60 * 60 * 1000,
                levelBand: "high"
            },

            {
                type: "boost",
                boostType: "xp",
                tier: "tier2",
                amount:
                    randomChoice([3, 5, 7]),
                levelBand: "high"
            },

            {
                type: "boost",
                boostType: "xp",
                tier: "max",
                amount:
                    randomChoice([2, 3]),
                levelBand: "high"
            },

            {
                type: "shop_discount",
                discountPercent: 30,
                durationMs:
                    24 * 60 * 60 * 1000,
                levelBand: "high"
            },

            {
                type: "guaranteed_roll_minimum",
                minXP:
                    randomChoice([
                        500000,
                        1000000,
                        2500000
                    ]),
                amount: 1,
                levelBand: "high"
            },

            {
                type: "next_hug_triple",
                repeatCount: 3,
                amount: 1,
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


    return rewards.map(
        reward => ({
            ...reward,
            weeklyRewardRulesetVersion:
                WEEKLY_REWARD_RULESET_VERSION
        })
    );

}


function generateWeeklyRewardsElite(
    questUpgradeLevel = QUEST_UPGRADE_TWO
){

    const levelBand =
        "elite";


    const rewards = [
        {
            type: "xp",
            amount:
                randomChoice([
                    25000000,
                    35000000,
                    40000000
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
                    24 * 60 * 60 * 1000
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
                    randomChoice([4, 5, 7, 10]),
                levelBand
            },

            {
                type: "guaranteed_roll_minimum",
                minXP:
                    randomChoice([
                        5000000,
                        7500000,
                        12500000
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
                multiplier:
                    randomChoice(
                        QUEST_CHAT_XP_MULTIPLIERS
                    ),
                durationMs:
                    randomChoice([
                        12 * 60 * 60 * 1000,
                        24 * 60 * 60 * 1000
                    ]),
                levelBand
            },

            {
                type: "shop_discount",
                discountPercent:
                    randomChoice([50, 60, 75]),
                durationMs:
                    randomChoice([
                        24 * 60 * 60 * 1000,
                        48 * 60 * 60 * 1000
                    ]),
                levelBand
            },

            {
                type: "boost",
                boostType: "xp",
                tier: "max",
                amount:
                    randomChoice([6, 9, 12, 15]),
                levelBand
            },

            {
                type: "social_command_triple",
                repeatCount: 3,
                durationMs:
                    socialDuration,
                levelBand
            }

        ]);


    const extraCount =
        randomChoice([3, 4, 5]);


    rewards.push(
        ...extras.slice(0, extraCount)
    );


    const rareChance =
        Number(questUpgradeLevel) >= 3
            ? 0.25
            : 0.10;


    // Exactly one rare boost can appear from this roll. That keeps the
    // advertised 10%/25% chance exact instead of accidentally allowing two.
    if(Math.random() < rareChance){

        rewards.push(
            Math.random() < 0.5
                ? {
                    type: "boost",
                    boostType: "luck",
                    tier: "omega",
                    amount: 1,
                    levelBand
                }
                : {
                    type: "boost",
                    boostType: "xp",
                    tier: "infinity",
                    amount: 1,
                    levelBand
                }
        );

    }


    return rewards.map(
        reward => ({
            ...reward,
            weeklyRewardRulesetVersion:
                WEEKLY_REWARD_RULESET_VERSION
        })
    );

}


function applyStrongestQuestRewardBuff(
    rewards,
    questUpgradeLevel
){

    if(Number(questUpgradeLevel) < 3){
        return rewards;
    }


    return rewards.map(reward => {
        const buffed = {
            ...reward
        };

        if(reward.type === "xp"){
            buffed.amount =
                Math.floor(
                    Number(reward.amount) * 1.5
                );
        }
        else if(
            reward.type === "boost"
            &&
            !["omega", "infinity"].includes(
                String(reward.tier).toLowerCase()
            )
        ){
            buffed.amount =
                Math.max(
                    1,
                    Math.ceil(
                        Number(reward.amount) * 1.5
                    )
                );
        }
        else if(reward.type === "guaranteed_roll_minimum"){
            buffed.minXP =
                Math.floor(
                    Number(reward.minXP) * 1.5
                );
        }
        else if(reward.type === "chat_xp_multiplier"){
            buffed.multiplier =
                upgradeQuestChatXPMultiplier(
                    reward.multiplier
                );
        }
        else if(reward.type === "multi_roll"){
            buffed.rollCount =
                Math.ceil(
                    Number(reward.rollCount) * 1.25
                );
        }

        return buffed;
    });

}


function generateRewards(
    cycleType,
    level
){

    let rewards;


    if(cycleType === "daily"){

        if(hasQuestUpgradeTwo(level)){

            rewards = applyStrongestQuestRewardBuff(
                generateDailyRewardsElite(),
                level
            );

        }
        else{

            rewards = hasQuestUpgradeOne(level)
                ? generateDailyRewardsHigh()
                : generateDailyRewardsLow();

        }

    }
    else if(hasQuestUpgradeTwo(level)){

        rewards = applyStrongestQuestRewardBuff(
            generateWeeklyRewardsElite(
                level
            ),
            level
        );

    }
    else{

        rewards = hasQuestUpgradeOne(level)
            ? generateWeeklyRewardsHigh()
            : generateWeeklyRewardsBase();

    }


    return rewards.map(reward => ({
        ...reward,
        questUpgradeLevel:
            Math.max(
                0,
                Math.min(
                    3,
                    Number(level) || 0
                )
            )
    }));

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


function isQuestCycleCompleted(cycle){

    const normalized =
        normalizeCycle(cycle);


    if(!normalized){

        return false;

    }


    return (
        normalized.rewarded
        ||
        (
            normalized.quests.length > 0
            &&
            normalized.quests.every(
                quest =>
                    Boolean(quest?.completed)
            )
        )
    );

}


function getQuestDefinition(
    cycleType,
    questType,
    level = 0
){

    const highLevel =
        hasQuestUpgradeOne(
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
            highLevel
                ? WEEKLY_QUEST_POOL_HIGH
                : WEEKLY_QUEST_POOL_LOW;

    }


    const definition =
        pool.find(
            item =>
                item.type === questType
        );


    if(definition){

        return definition;

    }


    // Cross-pool fallback keeps active quests readable after an upgrade.
    const fallbackPools = [
        DAILY_QUEST_POOL_LOW,
        DAILY_QUEST_POOL_HIGH,
        WEEKLY_QUEST_POOL_LOW,
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


    const upgraded =
        hasQuestUpgradeOne(level);


    const lowPool =
        cycleType === "daily"
            ? DAILY_QUEST_POOL_LOW
            : WEEKLY_QUEST_POOL_LOW;


    const highPool =
        cycleType === "daily"
            ? DAILY_QUEST_POOL_HIGH
            : WEEKLY_QUEST_POOL_HIGH;


    const fromPool =
        upgraded
            ? lowPool
            : highPool;


    const toPool =
        upgraded
            ? highPool
            : lowPool;


    const fromDefinition =
        fromPool.find(
            definition =>
                definition.type === quest.type
        );


    const toDefinition =
        toPool.find(
            definition =>
                definition.type === quest.type
        );


    const fromTargets =
        getDefinitionTargets(
            fromDefinition,
            upgraded ? "low" : "high"
        );


    const toTargets =
        getDefinitionTargets(
            toDefinition,
            upgraded ? "high" : "low"
        );


    if(
        fromTargets.length > 0
        &&
        toTargets.length > 0
    ){

        return mapTargetByDifficulty(
            target,
            fromTargets,
            toTargets
        );

    }


    // Fallback mappings preserve compatibility with active quest versions
    // whose old target arrays predate the current permanent-upgrade pools.
    const legacyMapping =
        cycleType === "daily"
            ? DAILY_TARGET_MIGRATIONS[quest.type]
            : WEEKLY_TARGET_MIGRATIONS[quest.type];


    if(legacyMapping){

        const oldTargets =
            legacyMapping.low ||
            legacyMapping.old;


        if(upgraded){

            return mapTargetByDifficulty(
                target,
                oldTargets,
                legacyMapping.high
            );

        }


        return mapTargetByDifficulty(
            target,
            legacyMapping.high,
            oldTargets
        );

    }


    return target;

}


function migrateDailyRewardsForUpgrade(
    rewards,
    level
){

    const eliteLevel =
        hasQuestUpgradeTwo(
            level
        );


    const highLevel =
        hasQuestUpgradeOne(
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


    // Reaching Quest Upgrade 2 swaps the entire unclaimed reward set. This
    // keeps rewards created by an older ruleset from leaking across upgrade
    // tiers while preserving the user's quest progress.
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
                reward => {

                    const migrated = {
                        ...reward
                    };


                    // Move active, unclaimed elite daily XP rewards from the
                    // old 2.5m/7m/14m pool to 2m/3.5m/5m.
                    if(migrated.type === "xp"){

                        const dailyXPRewardMigration = {
                            2500000: 2000000,
                            7000000: 3500000,
                            14000000: 5000000
                        };


                        migrated.amount =
                            dailyXPRewardMigration[
                                Number(migrated.amount)
                            ]
                            ||
                            migrated.amount;

                    }


                    // Nerf only unclaimed daily Luck MAX rewards created by
                    // the old 2x/4x/6x pool. This is idempotent, so the new
                    // legal 1x/2x/3x quantities remain unchanged.
                    if(
                        migrated.type === "boost"
                        &&
                        String(
                            migrated.boostType || ""
                        ).toLowerCase() === "luck"
                        &&
                        String(
                            migrated.tier || ""
                        ).toLowerCase() === "max"
                        &&
                        Number(migrated.amount) > 3
                    ){

                        migrated.amount =
                            Math.min(
                                3,
                                Math.max(
                                    1,
                                    Math.ceil(
                                        Number(
                                            migrated.amount
                                        ) / 2
                                    )
                                )
                            );

                    }


                    // Old elite daily Luck III rewards used 5/10/15.
                    // 5 remains a legal new value; only the now-illegal
                    // quantities need changing to the new 3/5/7 pool.
                    if(
                        migrated.type === "boost"
                        &&
                        String(
                            migrated.boostType || ""
                        ).toLowerCase() === "luck"
                        &&
                        String(
                            migrated.tier || ""
                        ).toLowerCase() === "tier3"
                    ){

                        const amount =
                            Number(migrated.amount) || 0;


                        if(amount === 10){

                            migrated.amount = 5;

                        }
                        else if(amount === 15){

                            migrated.amount = 7;

                        }

                    }


                    return migrated;

                }
            )
            : applyStrongestQuestRewardBuff(
                generateDailyRewardsElite(),
                level
            );

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

                    // A reward that came from the base daily pool upgrades
                    // to the Quest Upgrade 1 daily quantity.
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

                    // Base-pool daily boosts stay in their entry quantities.
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
        hasQuestUpgradeTwo(
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
        );


    const allHigh =
        currentRewards.length > 0
        &&
        currentRewards.every(
            reward =>
                String(
                    reward.levelBand || ""
                ).toLowerCase() === "high"
        );


    const allLow =
        currentRewards.length > 0
        &&
        currentRewards.every(
            reward =>
                String(
                    reward.levelBand || ""
                ).toLowerCase() === "low"
        );


    const currentRewardRuleset =
        currentRewards.length > 0
        &&
        currentRewards.every(
            reward =>
                Number(
                    reward.weeklyRewardRulesetVersion
                ) ===
                WEEKLY_REWARD_RULESET_VERSION
        );


    if(eliteLevel){

        return (
            allElite
            &&
            currentRewardRuleset
        )
            ? currentRewards
            : applyStrongestQuestRewardBuff(
                generateWeeklyRewardsElite(
                    level
                ),
                level
            );

    }


    if(hasQuestUpgradeOne(level)){

        return (
            allHigh
            &&
            currentRewardRuleset
        )
            ? currentRewards
            : generateWeeklyRewardsHigh();

    }


    return (
        allLow
        &&
        currentRewardRuleset
    )
        ? currentRewards
        : generateWeeklyRewardsBase();

}


function removeRetiredXPBoostQuestRewards(
    rewards,
    cycleType,
    level
){

    return (rewards || []).filter(
        reward => {

            const isXPBoost =
                reward?.type === "boost"
                &&
                String(
                    reward.boostType || ""
                ).toLowerCase() === "xp";


            if(!isXPBoost){
                return true;
            }


            if(
                String(cycleType).toLowerCase() !== "weekly"
            ){
                return false;
            }


            const tier =
                String(
                    reward.tier || ""
                ).toLowerCase();


            return (
                Number(reward.amount) > 0
                &&
                [
                    "tier1",
                    "tier2",
                    "max",
                    "infinity"
                ].includes(tier)
            );

        }
    );

}


function migrateCycleData(
    cycle,
    level = 0
){

    const normalized =
        normalizeCycle(cycle);


    if(!normalized){

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


    const questBand =
        hasQuestUpgradeOne(level)
            ? "high"
            : "low";


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
                    questBand;


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
                migrateDailyRewardsForUpgrade(
                    normalized.rewards,
                    level
                );

        }
        else if(
            normalized.cycletype === "weekly"
        ){

            rewards =
                migrateWeeklyRewards(
                    normalized.rewards,
                    level
                );

        }


        rewards =
            removeRetiredXPBoostQuestRewards(
                rewards,
                normalized.cycletype,
                level
            );


        const rewardsMatchUpgrade =
            rewards.length > 0
            &&
            rewards.every(
                reward =>
                    Number(
                        reward.questUpgradeLevel
                    ) === Number(level)
            );


        if(!rewardsMatchUpgrade){

            rewards =
                generateRewards(
                    normalized.cycletype,
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


    const upgradeCache =
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
            upgradeCache.get(
                cacheKey
            );


        if(level === undefined){

            const effects =
                await database.getUserUpgradeEffects(
                    guildID,
                    userID
                );


            level =
                effects.questLevel;


            upgradeCache.set(
                cacheKey,
                level
            );

        }


        const normalizedRow =
            normalizeCycle(
                row
            );


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

    const upgradeEffects =
        await database.getUserUpgradeEffects(
            guildID,
            userID
        );


    const level =
        upgradeEffects.questLevel;


    const daily =
        await ensureCycle(
            guildID,
            userID,
            "daily",
            level
        );


    const weeklyLocked =
        false;


    const weekly =
        await ensureCycle(
            guildID,
            userID,
            "weekly",
            level
        );


    return {
        daily,
        weekly,
        weeklyLocked,
        level,
        questUpgradeLevel:
            level,
        questResetUnlocked:
            upgradeEffects.questResetUnlocked
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


    const price =
        getQuestResetPrice(
            normalizedCycleType,
            dashboard.level
        );


    if(!dashboard.questResetUnlocked){

        return {
            success: false,
            status: "reset-upgrade-locked",
            cycleType:
                normalizedCycleType,
            questUpgradeLevel:
                dashboard.questUpgradeLevel,
            requiredQuestUpgradeLevel: 2,
            price,
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


    // Paid resets are only for rerolling an unfinished quest set. Once every
    // quest in the section is complete, its result is final until the normal
    // daily/weekly renewal.
    if(isQuestCycleCompleted(currentCycle)){

        return {
            success: false,
            status: "quests-completed",
            cycleType:
                normalizedCycleType,
            price:
                price,
            maxResets:
                config.maxResets,
            resetCount,
            remainingResets: 0,
            nextResetAt:
                currentCycle.expiresat
        };

    }


    if(resetCount >= config.maxResets){

        return {
            success: false,
            status: "reset-limit-reached",
            cycleType:
                normalizedCycleType,
            price:
                price,
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
            nextData.rewards,
            dashboard.level
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
            `Earn **${normalizeQuestChatXPMultiplier(reward.multiplier)}x chat XP** for ` +
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


    if(reward.type === "next_hug_triple"){

        return (
            "Your next valid `!hug` performs " +
            `**${Number(reward.repeatCount) || 3} hugs at once**`
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
    userID,
    commandName = null
){

    return database.getQuestSocialCommandRepeatCount(
        guildID,
        userID,
        commandName
    );

}


async function consumeSocialCommandRepeat(
    guildID,
    userID,
    commandName
){

    return database.consumeQuestSocialCommandRepeat(
        guildID,
        userID,
        commandName
    );

}


module.exports = {

    QUEST_UPGRADE_ONE,

    QUEST_UPGRADE_TWO,

    QUEST_RESET_CONFIG,

    getQuestResetPrice,

    isQuestCycleCompleted,

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

    consumeSocialCommandRepeat,

    formatReward,

    // Pure helpers exported for startup/unit validation.
    generateQuests,

    generateRewards,

    applyStrongestQuestRewardBuff,

    normalizeQuestChatXPMultiplier,

    upgradeQuestChatXPMultiplier

};
