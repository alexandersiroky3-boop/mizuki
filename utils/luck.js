// utils/luck.js

const database =
    require("../database");


const {
    AuditLogEvent
} = require("discord.js");


const OWNER_ID =
    "1239975819112353969";


const XP_MAX_ROLE =
    "1526995218098815016";


const LUCK_ROLES = {

    tier1: {

        tier:
            "tier1",

        roleID:
            "1533959325335293982",

        name:
            "Luck Boost I",

        multiplier:
            2,

        criticalChanceBonus:
            2.5,

        duration:
            2 * 60 * 60 * 1000,

        durationText:
            "2 hours",

        order:
            1

    },


    tier2: {

        tier:
            "tier2",

        roleID:
            "1533960540240478432",

        name:
            "Luck Boost II",

        multiplier:
            10,

        criticalChanceBonus:
            7.5,

        duration:
            60 * 60 * 1000,

        durationText:
            "1 hour",

        order:
            2

    },


    tier3: {

        tier:
            "tier3",

        roleID:
            "1533960965949886534",

        name:
            "Luck Boost III",

        multiplier:
            20,

        criticalChanceBonus:
            15,

        duration:
            20 * 60 * 1000,

        durationText:
            "20 minutes",

        order:
            3

    },


    max: {

        tier:
            "max",

        roleID:
            "1533961286310953042",

        name:
            "Luck Boost MAX",

        multiplier:
            50,

        criticalChanceBonus:
            25,

        duration:
            10 * 60 * 1000,

        durationText:
            "10 minutes",

        order:
            4

    },


    omega: {

        tier:
            "omega",

        roleID:
            "1535700310402670592",

        name:
            "Luck Boost Ω",

        multiplier:
            1000,

        // Ω's roll behavior is defined separately below.
        // Ω has its own stronger message-critical bonus.
        criticalChanceBonus:
            35,

        duration:
            3 * 60 * 1000,

        durationText:
            "3 minutes",

        order:
            5

    }

};


const LUCK_ROLE_LIST = [

    LUCK_ROLES.omega,

    LUCK_ROLES.max,

    LUCK_ROLES.tier3,

    LUCK_ROLES.tier2,

    LUCK_ROLES.tier1

];


const LUCK_ROLE_IDS =
    LUCK_ROLE_LIST.map(
        role => role.roleID
    );


// =====================================================
// LEVEL-BASED !ROLL LUCK
// =====================================================
//
// These settings affect !roll only. They do not change:
// - how long an activated Luck Boost role remains active
// - message critical chance
// - !hug / !kiss / !steal balancing
//
// Level 1-99 keeps the existing roll multiplier exactly.
// Level 100+ keeps its small roll-strength increase.
// Luck affects the roll odds only: every tier and level uses
// the same fixed 30-second !roll cooldown.

const ROLL_COOLDOWN_MS =
    30 * 1000;


const ROLL_LUCK_LEVEL_SETTINGS = {

    below100: {

        tier1: {
            multiplier: 2,
            cooldownMs: ROLL_COOLDOWN_MS
        },

        tier2: {
            multiplier: 10,
            cooldownMs: ROLL_COOLDOWN_MS
        },

        tier3: {
            multiplier: 20,
            cooldownMs: ROLL_COOLDOWN_MS
        },

        max: {
            multiplier: 50,
            cooldownMs: ROLL_COOLDOWN_MS
        },

        omega: {
            multiplier: 1000,
            cooldownMs: ROLL_COOLDOWN_MS
        }

    },


    level100Plus: {

        tier1: {
            multiplier: 2.5,
            cooldownMs: ROLL_COOLDOWN_MS
        },

        tier2: {
            multiplier: 12,
            cooldownMs: ROLL_COOLDOWN_MS
        },

        tier3: {
            multiplier: 24,
            cooldownMs: ROLL_COOLDOWN_MS
        },

        max: {
            multiplier: 60,
            cooldownMs: ROLL_COOLDOWN_MS
        },

        omega: {
            multiplier: 1200,
            cooldownMs: ROLL_COOLDOWN_MS
        }

    }

};


// =====================================================
// EASY LUCK CUSTOMIZATION
// =====================================================
//
// Every chancePercent value below is a REAL percentage:
//
// 20    = 20%
// 2.5   = 2.5%
// 0.1   = 0.1%
// 0.001 = 0.001%


// ==============================
// LUCK BOOST DROP CHANCES
// ==============================
//
// These are used after !roll.
// Only one Luck Boost can be won.
//
// The total may be below 100%.
// Anything left over means no Luck Boost drops.

const LUCK_BOOST_DROP_TABLE = [

    {
        tier: "omega",
        chancePercent: 0.01
    },

    {
        tier: "max",
        chancePercent: 0.75
    },

    {
        tier: "tier3",
        chancePercent: 0.75
    },

    {
        tier: "tier2",
        chancePercent: 5
    },

    {
        tier: "tier1",
        chancePercent: 10
    }

];


// ==============================
// COMMAND LUCK BOOST CHANCES
// ==============================
//
// Each tier rolls independently.
// If multiple tiers succeed,
// only the strongest one is awarded.

const COMMAND_LUCK_DROP_PERCENT = {

    hug: {

        tier1:
            35,

        tier2:
            20,

        tier3:
            4,

        max:
            5,

        omega:
            0.01

    },


    kiss: {

        tier1:
            12,

        tier2:
            7.5,

        tier3:
            1,

        max:
            0.8,

        omega:
            0.01

    },


    steal: {

        tier1:
            25,

        tier2:
            12,

        tier3:
            2.5,

        max:
            2,

        omega:
            0.01

    }

};


// The XP roll tables for Level 1-99 and
// Level 100+ are now at the top of:
//
// commands/roll.js
//
// This keeps all regular !roll XP chances
// in the command file where they are easier
// to find and customize.


const OMEGA_ROLL_CHANCE_TABLES = {

    // Levels 1-99.
    // Every range below 200,000 XP has exactly 0% chance.
    level1To100: [

        {
            chancePercent: 55,
            min: 200000,
            max: 500000
        },

        {
            chancePercent: 35,
            min: 500000,
            max: 2000000
        },

        {
            chancePercent: 10,
            min: 2000000,
            max: 10000000
        }

    ],


    // Levels 100+.
    // Every range below 200,000 XP has exactly 0% chance.
    level101Plus: [

        {
            chancePercent: 23,
            min: 200000,
            max: 500000
        },

        {
            chancePercent: 60,
            min: 500000,
            max: 2000000
        },

        {
            chancePercent: 17,
            min: 2000000,
            max: 10000000
        }

    ]

};


function rollFromExactPercentTable(table){

    let roll =
        Math.random() * 100;


    for(const outcome of table){

        roll -=
            Number(
                outcome.chancePercent
            );


        if(roll < 0){

            return randomInteger(
                outcome.min,
                outcome.max
            );

        }

    }


    const fallback =
        table[
            table.length - 1
        ];


    return randomInteger(
        fallback.min,
        fallback.max
    );

}



function percentChance(chancePercent){

    return (
        Math.random() * 100 <
        Number(chancePercent)
    );

}


function validatePercentage(
    label,
    chancePercent
){

    const chance =
        Number(chancePercent);


    if(
        !Number.isFinite(chance)
        ||
        chance < 0
        ||
        chance > 100
    ){

        throw new Error(
            `${label} must be between 0% and 100%. Current value: ${chancePercent}`
        );

    }

}


function validateLuckSettings(){

    let totalRollDropPercent =
        0;


    for(
        const [levelGroup, tierSettings] of
        Object.entries(
            ROLL_LUCK_LEVEL_SETTINGS
        )
    ){

        for(
            const tier of
            [
                "tier1",
                "tier2",
                "tier3",
                "max",
                "omega"
            ]
        ){

            const settings =
                tierSettings[tier];


            if(
                !settings
                ||
                !Number.isFinite(
                    Number(
                        settings.multiplier
                    )
                )
                ||
                Number(settings.multiplier) <= 0
                ||
                !Number.isFinite(
                    Number(
                        settings.cooldownMs
                    )
                )
                ||
                Number(settings.cooldownMs) < 1000
            ){

                throw new Error(
                    `Invalid ${levelGroup} ${tier} roll Luck settings.`
                );

            }

        }

    }


    for(const entry of LUCK_BOOST_DROP_TABLE){

        validatePercentage(
            `Luck Boost ${entry.tier}`,
            entry.chancePercent
        );


        totalRollDropPercent +=
            Number(entry.chancePercent);

    }


    if(totalRollDropPercent > 100){

        throw new Error(
            `Luck Boost roll drops total ${totalRollDropPercent}%. They cannot exceed 100%.`
        );

    }


    for(
        const [tableName, table] of
        Object.entries(
            OMEGA_ROLL_CHANCE_TABLES
        )
    ){

        const total =
            table.reduce(
                (sum, outcome) =>
                    sum +
                    Number(
                        outcome.chancePercent
                    ),
                0
            );


        if(Math.abs(total - 100) > 0.000001){

            throw new Error(
                `Luck Boost Ω ${tableName} roll chances must total 100%. Current total: ${total}%.`
            );

        }


        for(const outcome of table){

            validatePercentage(
                `Luck Boost Ω ${tableName}`,
                outcome.chancePercent
            );

        }

    }


    for(
        const [commandName, chances] of
        Object.entries(
            COMMAND_LUCK_DROP_PERCENT
        )
    ){

        for(
            const [tierName, chancePercent] of
            Object.entries(chances)
        )
        {

            validatePercentage(
                `!${commandName} ${tierName}`,
                chancePercent
            );

        }

    }

}


validateLuckSettings();


const internalRoleChanges =
    new Set();


// ==============================
// HELPERS
// ==============================

function randomInteger(
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


function getNoLuckProfile(){

    return {

        roleID:
            null,

        name:
            "No Luck Boost",

        multiplier:
            1,

        duration:
            0,

        durationText:
            "",

        order:
            0,

        expiresAt:
            null

    };

}


function getLuckRoleByID(roleID){

    return LUCK_ROLE_LIST.find(

        role =>
            role.roleID === roleID

    ) || null;

}


// ==============================
// CRITICAL CHANCE BONUS
// ==============================
//
// Luck Boosts now also improve message criticals.
// Strongest role wins if Discord briefly has more
// than one Luck role cached during a role update.

function getCriticalChanceBonus(member){

    const activeRole =
        LUCK_ROLE_LIST.find(

            role =>
                member.roles.cache.has(
                    role.roleID
                )

        );


    return Number(
        activeRole?.criticalChanceBonus || 0
    );

}


function getMemberKey(member){

    return (
        `${member.guild.id}:${member.id}`
    );

}


function protectRoleChange(member){

    const key =
        getMemberKey(member);


    internalRoleChanges.add(
        key
    );


    setTimeout(() => {

        internalRoleChanges.delete(
            key
        );

    }, 5000);

}


function isProtectedRoleChange(member){

    return internalRoleChanges.has(
        getMemberKey(member)
    );

}


// ==============================
// PREVENT ROLE STACKING
// ==============================

async function syncMemberLuckRoles(
    member,
    activeRoleID = null
){

    const rolesToRemove =
        LUCK_ROLE_IDS.filter(

            roleID =>

                roleID !== activeRoleID
                &&
                member.roles.cache.has(
                    roleID
                )

        );


    const shouldAddActiveRole =

        activeRoleID
        &&
        !member.roles.cache.has(
            activeRoleID
        );


    if(
        rolesToRemove.length === 0
        &&
        !shouldAddActiveRole
    ){

        return;

    }


    protectRoleChange(
        member
    );


    for(const roleID of rolesToRemove){

        await member.roles.remove(
            roleID
        ).catch(error => {

            console.error(

                `Failed to remove Luck Boost role ${roleID}:`,

                error

            );

        });

    }


    if(shouldAddActiveRole){

        await member.roles.add(
            activeRoleID
        ).catch(error => {

            console.error(

                `Failed to add Luck Boost role ${activeRoleID}:`,

                error

            );

        });

    }

}


// ==============================
// GET ACTIVE LUCK BOOST
// ==============================

async function getActiveLuckBoost(member){

    const savedBoost =
        await database.getLuckBoost(
            member.guild.id,
            member.id
        );


    if(!savedBoost){

        await syncMemberLuckRoles(
            member,
            null
        );

        return getNoLuckProfile();

    }


    const expiresAt =
        Number(
            savedBoost.expiresat
        ) || 0;


    if(expiresAt <= Date.now()){

        await database.clearLuckBoost(
            member.guild.id,
            member.id
        );


        await syncMemberLuckRoles(
            member,
            null
        );


        return getNoLuckProfile();

    }


    const profile =
        getLuckRoleByID(
            savedBoost.role
        );


    if(!profile){

        await database.clearLuckBoost(
            member.guild.id,
            member.id
        );


        await syncMemberLuckRoles(
            member,
            null
        );


        return getNoLuckProfile();

    }


    await syncMemberLuckRoles(
        member,
        profile.roleID
    );


    return {

        ...profile,

        expiresAt

    };

}


function getRollLuckProfile(
    profile,
    currentLevel
){

    const safeProfile =
        profile ||
        getNoLuckProfile();


    const levelGroup =
        Number(currentLevel) >= 100
            ? "level100Plus"
            : "below100";


    const tier =
        String(
            safeProfile.tier || ""
        ).toLowerCase();


    const settings =
        ROLL_LUCK_LEVEL_SETTINGS[
            levelGroup
        ][tier];


    if(!settings){

        return {

            ...safeProfile,

            rollLevelGroup:
                levelGroup,

            rollCooldownMs:
                null,

            rollWeightFactor:
                1

        };

    }


    const baseMultiplier =
        Math.max(
            1,
            Number(
                safeProfile.multiplier
            ) || 1
        );


    const rollMultiplier =
        Number(
            settings.multiplier
        );


    return {

        ...safeProfile,

        baseMultiplier,

        multiplier:
            rollMultiplier,

        rollLevelGroup:
            levelGroup,

        rollCooldownMs:
            Number(
                settings.cooldownMs
            ),

        // A value of 1 preserves the old roll chances exactly.
        // Level 100+ gets only the small increase represented
        // by its displayed roll multiplier.
        rollWeightFactor:
            Math.max(
                1,
                rollMultiplier /
                    baseMultiplier
            )

    };

}


function getRollCooldown(
    _rollProfile,
    _fallbackCooldownMs = ROLL_COOLDOWN_MS
){

    // Do not let Luck tier, level, or a caller turn the fixed
    // 30-second gameplay cooldown back into minutes or hours.
    return ROLL_COOLDOWN_MS;

}


// ==============================
// LUCK WEIGHT SYSTEM
// ==============================
//
// The displayed x2 / x10 / x20 / x50
// is the user's Luck rating.
//
// Internally, each XP range receives its
// own balanced weight multiplier.
//
// The weights are normalized afterward,
// so every final chance still adds to 100%.

const LUCK_WEIGHT_MODIFIERS = {

    // No Luck Boost
    0: {

        neutral:
            1,

        negative:
            1,

        commonPositive:
            1,

        valuablePositive:
            1,

        rarePositive:
            1,

        jackpotPositive:
            1

    },


    // Luck Boost I — x2 rating
    1: {

        neutral:
            0.92,

        negative:
            0.82,

        commonPositive:
            1.25,

        valuablePositive:
            1.45,

        rarePositive:
            1.70,

        jackpotPositive:
            2

    },


    // Luck Boost II — x10 rating
    2: {

        neutral:
            0.78,

        negative:
            0.55,

        commonPositive:
            2,

        valuablePositive:
            2.80,

        rarePositive:
            4,

        jackpotPositive:
            6

    },


    // Luck Boost III — x20 rating
    //
    // Designed to strongly suppress:
    // - -100 to +100
    // - negative outcomes
    //
    // +100 to +5,000 remains possible more often,
    // while the most common positive range stays
    // +5,000 to +25,000, while 25,000+ rolls
    // are also much more likely.
    3: {

        neutral:
            0.12,

        negative:
            0.08,

        commonPositive:
            0.50,

        valuablePositive:
            12,

        rarePositive:
            30,

        jackpotPositive:
            50

    },


    // Luck Boost MAX — x50 rating
    //
    // This boost only lasts 10 minutes, so
    // +25,000 to +75,000 and higher outcomes
    // are intentionally the common result.
    //
    // Small, neutral, and negative rolls are
    // heavily suppressed.
    4: {

        neutral:
            0.03,

        negative:
            0.02,

        commonPositive:
            0.08,

        valuablePositive:
            1.50,

        rarePositive:
            80,

        jackpotPositive:
            120

    }

};


function getPositiveWeightType(outcome){

    // +100 to +5,000
    if(outcome.max <= 5000){

        return "commonPositive";

    }


    // +5,000 to +25,000
    if(outcome.max <= 25000){

        return "valuablePositive";

    }


    // +25,000 to +200,000
    if(outcome.max <= 200000){

        return "rarePositive";

    }


    // +200,000 and above
    //
    // This also includes the extremely rare
    // +2,000,000 to +10,000,000 outcome.
    return "jackpotPositive";

}



function getAdjustedWeight(
    outcome,
    profile
){

    const modifiers =

        LUCK_WEIGHT_MODIFIERS[
            profile.order
        ]

        ||

        LUCK_WEIGHT_MODIFIERS[0];


    let adjustedWeight =
        Number(
            outcome.chancePercent
        ) || 0;


    let level100PlusExponent =
        0;


    if(outcome.type === "neutral"){

        adjustedWeight *=
            modifiers.neutral;


        level100PlusExponent =
            -0.25;

    }


    else if(outcome.type === "negative"){

        adjustedWeight *=
            modifiers.negative;


        level100PlusExponent =
            -0.50;

    }


    else if(outcome.type === "positive"){

        const weightType =
            getPositiveWeightType(
                outcome
            );


        adjustedWeight *=
            modifiers[weightType];


        const positiveExponents = {

            commonPositive:
                0,

            valuablePositive:
                0.25,

            rarePositive:
                0.50,

            jackpotPositive:
                0.75

        };


        level100PlusExponent =
            positiveExponents[
                weightType
            ] || 0;

    }


    const rollWeightFactor =
        Math.max(
            1,
            Number(
                profile?.rollWeightFactor
            ) || 1
        );


    return (
        adjustedWeight *
        Math.pow(
            rollWeightFactor,
            level100PlusExponent
        )
    );

}



function rollFromWeightedTable(
    table,
    profile
){

    const weightedOutcomes =
        table.map(outcome => ({

            outcome,

            weight:
                getAdjustedWeight(
                    outcome,
                    profile
                )

        }));


    const totalWeight =
        weightedOutcomes.reduce(

            (total, entry) =>
                total + entry.weight,

            0

        );


    let randomWeight =
        Math.random() *
        totalWeight;


    for(const entry of weightedOutcomes){

        randomWeight -=
            entry.weight;


        if(randomWeight <= 0){

            return randomInteger(
                entry.outcome.min,
                entry.outcome.max
            );

        }

    }


    const fallback =
        weightedOutcomes[
            weightedOutcomes.length - 1
        ].outcome;


    return randomInteger(
        fallback.min,
        fallback.max
    );

}



async function rollWithLuck(
    member,
    rollChanceTable,
    levelTableName = "level1To100",
    preparedProfile = null
){

    if(
        !Array.isArray(rollChanceTable)
        ||
        rollChanceTable.length === 0
    ){

        throw new Error(
            "rollWithLuck received an empty roll chance table."
        );

    }


    const profile =
        preparedProfile
        ||
        getRollLuckProfile(
            await getActiveLuckBoost(
                member
            ),
            levelTableName ===
                "level101Plus"
                ? 100
                : 1
        );


    const rolledXP =
        profile.tier === "omega"

            ? rollFromExactPercentTable(
                OMEGA_ROLL_CHANCE_TABLES[
                    levelTableName === "level101Plus"
                        ? "level101Plus"
                        : "level1To100"
                ]
            )

            : rollFromWeightedTable(
                rollChanceTable,
                profile
            );


    return {

        rolledXP,

        profile

    };

}


// ==============================
// COMMAND-WIDE LUCK SYSTEM
// ==============================
//
// Used by random gameplay commands such as
// !kiss, !hug, !steal and !ezwin.
//
// Luck does TWO things:
// 1. Higher rarities become much more likely.
// 2. XP rolls inside the selected rarity are
//    biased toward the high end of the range.
//
// The visible x2/x10/x20/x50/x1000 Luck rating
// is used as the rarity-weighting strength.

const COMMAND_REWARD_BIAS_POWER = {

    0: 1,
    1: 0.75,
    2: 0.50,
    3: 0.30,
    4: 0.12,
    5: 0.03

};


const COMMAND_SUCCESS_INFLUENCE = {

    0: 0,
    1: 0.10,
    2: 0.25,
    3: 0.50,
    4: 0.85,
    5: 0.98

};


// =====================================================
// LEVEL 100+ COMMAND LUCK BALANCE
// =====================================================
//
// !steal / !hug / !kiss use this profile for users
// at Level 100+.
//
// The Discord role still keeps its normal x10/x20/x50
// identity. These values only soften how aggressively
// those boosts bend command rarity + reward rolls.
//
// Luck I is intentionally unchanged.
// Luck Ω is intentionally unchanged.
const LEVEL100_PLUS_COMMAND_LUCK = {

    tier2: {
        multiplier: 7,
        rewardBiasPower: 0.65
    },

    tier3: {
        multiplier: 12,
        rewardBiasPower: 0.45
    },

    max: {
        multiplier: 20,
        rewardBiasPower: 0.25
    }

};


function getLevel100PlusCommandLuckProfile(profile){

    if(!profile?.tier){
        return profile;
    }


    const balance =
        LEVEL100_PLUS_COMMAND_LUCK[
            String(profile.tier).toLowerCase()
        ];


    if(!balance){
        return profile;
    }


    return {

        ...profile,

        commandMultiplier:
            balance.multiplier,

        commandRewardBiasPower:
            balance.rewardBiasPower

    };

}


function getCommandLuckOrder(profile){

    return Math.max(
        0,
        Math.min(
            5,
            Number(profile?.order) || 0
        )
    );

}


function rollCommandOutcome(
    outcomes,
    profile
){

    if(
        !Array.isArray(outcomes)
        ||
        outcomes.length === 0
    ){

        throw new Error(
            "rollCommandOutcome requires at least one outcome."
        );

    }


    const order =
        getCommandLuckOrder(profile);


    const luckRating =
        order > 0
            ? Math.max(
                1,
                Number(
                    profile?.commandMultiplier ??
                    profile?.multiplier
                ) || 1
            )
            : 1;


    const lastIndex =
        Math.max(
            1,
            outcomes.length - 1
        );


    const weighted =
        outcomes.map(
            (outcome, index) => {

                const baseChance =
                    Math.max(
                        0,
                        Number(outcome.chancePercent) || 0
                    );


                const rarityPosition =
                    index / lastIndex;


                const luckWeight =
                    order > 0
                        ? Math.pow(
                            luckRating,
                            rarityPosition * 2
                        )
                        : 1;


                return {
                    outcome,
                    weight:
                        baseChance * luckWeight
                };

            }
        );


    const totalWeight =
        weighted.reduce(
            (sum, entry) =>
                sum + entry.weight,
            0
        );


    if(totalWeight <= 0){

        return outcomes[0];

    }


    let roll =
        Math.random() * totalWeight;


    for(const entry of weighted){

        roll -= entry.weight;

        if(roll <= 0){

            return entry.outcome;

        }

    }


    return weighted[
        weighted.length - 1
    ].outcome;

}


function rollCommandXP(
    min,
    max,
    profile
){

    const safeMin =
        Math.floor(
            Math.min(
                Number(min) || 0,
                Number(max) || 0
            )
        );


    const safeMax =
        Math.floor(
            Math.max(
                Number(min) || 0,
                Number(max) || 0
            )
        );


    if(safeMax <= safeMin){

        return safeMin;

    }


    const order =
        getCommandLuckOrder(profile);


    const customPower =
        Number(
            profile?.commandRewardBiasPower
        );


    const power =
        Number.isFinite(customPower)
        &&
        customPower > 0
            ? customPower
            : (
                COMMAND_REWARD_BIAS_POWER[order]
                || 1
            );


    // No Luck stays completely uniform.
    // Strong Luck pushes the roll closer to max.
    const position =
        Math.pow(
            Math.random(),
            power
        );


    return Math.floor(
        safeMin +
        position *
        (safeMax - safeMin + 1)
    );

}


function rollCommandPenalty(
    min,
    max,
    profile
){

    const safeMin =
        Math.floor(
            Math.min(
                Number(min) || 0,
                Number(max) || 0
            )
        );


    const safeMax =
        Math.floor(
            Math.max(
                Number(min) || 0,
                Number(max) || 0
            )
        );


    if(safeMax <= safeMin){

        return safeMin;

    }


    const order =
        getCommandLuckOrder(profile);


    const customPower =
        Number(
            profile?.commandRewardBiasPower
        );


    const power =
        Number.isFinite(customPower)
        &&
        customPower > 0
            ? customPower
            : (
                COMMAND_REWARD_BIAS_POWER[order]
                || 1
            );


    // Opposite of reward bias: stronger Luck makes
    // negative penalties trend toward the minimum.
    const position =
        1 - Math.pow(
            Math.random(),
            power
        );


    return Math.floor(
        safeMin +
        position *
        (safeMax - safeMin + 1)
    );

}


function getCommandSuccessChance(
    baseChance,
    profile
){

    const safeBase =
        Math.max(
            0,
            Math.min(
                1,
                Number(baseChance) || 0
            )
        );


    const order =
        getCommandLuckOrder(profile);


    const influence =
        COMMAND_SUCCESS_INFLUENCE[order]
        || 0;


    return Math.min(
        0.9999,
        safeBase +
        (1 - safeBase) * influence
    );

}


function buildUsedCommandLuckExtra(profile){

    if(!profile?.roleID){

        return "";

    }


    return (
        `\n🍀 <@&${profile.roleID}> influenced this command with **x${profile.multiplier} luck**.`
    );

}


// ==============================
// ROLL A LUCK BOOST
// ==============================

function rollLuckBoostDrop(){

    const rollPercent =
        Math.random() * 100;


    let cumulativePercent =
        0;


    for(
        const drop of
        LUCK_BOOST_DROP_TABLE
    ){

        cumulativePercent +=
            Number(
                drop.chancePercent
            );


        if(
            rollPercent <
            cumulativePercent
        ){

            return (
                LUCK_ROLES[
                    drop.tier
                ] || null
            );

        }

    }


    return null;

}


// ==============================
// GIVE LUCK BOOST
// ==============================

async function giveLuckBoost(
    member,
    wonRole,
    source = "reward"
){

    const amount =
        await database.addBoostInventory(
            member.guild.id,
            member.id,
            "luck",
            wonRole.tier,
            1
        );


    console.log(
        `${member.user.tag} stored ${wonRole.name} from ${source}. Inventory: ${amount}`
    );


    return {

        awarded:
            true,

        status:
            "stored",

        source,

        amount,

        role:
            wonRole

    };

}



// ==============================
// ACTIVATE LUCK BOOST INVENTORY
// ==============================

async function activateLuckBoostFromInventory(
    member,
    tier
){

    const selectedBoost =
        LUCK_ROLES[
            String(tier).toLowerCase()
        ];


    if(!selectedBoost){

        return {

            success:
                false,

            status:
                "invalid-tier"

        };

    }


    const currentBoost =
        await getActiveLuckBoost(
            member
        );


    // Do not consume a weaker item while a
    // stronger Luck Boost is already active.
    if(
        currentBoost.order >
        selectedBoost.order
    ){

        return {

            success:
                false,

            status:
                "stronger-active",

            currentBoost,

            selectedBoost

        };

    }


    const consumed =
        await database.consumeBoostInventory(
            member.guild.id,
            member.id,
            "luck",
            selectedBoost.tier
        );


    if(!consumed.success){

        return {

            success:
                false,

            status:
                "no-stock",

            selectedBoost

        };

    }


    const previousBoost =
        await database.getLuckBoost(
            member.guild.id,
            member.id
        );


    const expiresAt =
        Date.now() +
        selectedBoost.duration;


    let status =
        "activated";


    if(
        currentBoost.order ===
        selectedBoost.order
        &&
        currentBoost.order > 0
    ){

        status =
            "refreshed";

    }
    else if(
        currentBoost.order > 0
        &&
        selectedBoost.order >
        currentBoost.order
    ){

        status =
            "upgraded";

    }


    try{

        await database.updateLuckBoost(
            member.guild.id,
            member.id,
            selectedBoost.roleID,
            expiresAt
        );


        await syncMemberLuckRoles(
            member,
            selectedBoost.roleID
        );

    }
    catch(error){

        await database.addBoostInventory(
            member.guild.id,
            member.id,
            "luck",
            selectedBoost.tier,
            1
        );


        if(previousBoost){

            await database.updateLuckBoost(
                member.guild.id,
                member.id,
                previousBoost.role,
                previousBoost.expiresat
            );


            await syncMemberLuckRoles(
                member,
                previousBoost.role
            );

        }
        else{

            await database.clearLuckBoost(
                member.guild.id,
                member.id
            );


            await syncMemberLuckRoles(
                member,
                null
            );

        }


        throw error;

    }


    return {

        success:
            true,

        status,

        remaining:
            consumed.remaining,

        boost: {

            ...selectedBoost,

            expiresAt

        }

    };

}



async function tryLuckBoostDrop(member){

    const wonRole =
        rollLuckBoostDrop();


    if(!wonRole){

        return null;

    }


    return giveLuckBoost(
        member,
        wonRole,
        "roll"
    );

}

// ==============================
// COMMAND LUCK BOOST DROP
// ==============================

function rollCommandLuckBoostDrop(
    commandName
){

    const chances =
        COMMAND_LUCK_DROP_PERCENT[
            String(commandName).toLowerCase()
        ];


    if(!chances){

        return null;

    }


    const successfulRoles =
        [];


    for(
        const tierName of
        [
            "tier1",
            "tier2",
            "tier3",
            "max",
            "omega"
        ]
    ){

        if(
            percentChance(
                chances[tierName]
            )
        ){

            successfulRoles.push(
                LUCK_ROLES[tierName]
            );

        }

    }


    if(successfulRoles.length === 0){

        return null;

    }


    // If several boosts succeed,
    // award only the strongest one.
    successfulRoles.sort(

        (first, second) =>
            second.order -
            first.order

    );


    return successfulRoles[0];

}



async function tryCommandLuckBoostDrop(
    member,
    commandName
){

    const wonRole =
        rollCommandLuckBoostDrop(
            commandName
        );


    if(!wonRole){

        return null;

    }


    return giveLuckBoost(
        member,
        wonRole,
        `!${commandName}`
    );

}


// ==============================
// REMOVE EXPIRED BOOSTS
// ==============================

async function removeExpiredLuckBoosts(
    client
){

    const expiredBoosts =
        await database.getExpiredLuckBoosts();


    for(const boost of expiredBoosts){

        const guild =
            client.guilds.cache.get(
                boost.guildid
            );


        if(guild){

            const member =
                await guild.members.fetch(
                    boost.userid
                ).catch(() => null);


            if(member){

                await syncMemberLuckRoles(
                    member,
                    null
                );

            }

        }


        await database.clearLuckBoost(
            boost.guildid,
            boost.userid
        );

    }

}


// ==============================
// RESTORE AFTER RESTART
// ==============================

async function restoreLuckBoosts(client){

    const savedBoosts =
        await database.getAllLuckBoosts();


    let restored = 0;


    for(const boost of savedBoosts){

        const guild =
            client.guilds.cache.get(
                boost.guildid
            );


        if(
            Number(boost.expiresat) <=
            Date.now()
        ){

            if(guild){

                const member =
                    await guild.members.fetch(
                        boost.userid
                    ).catch(() => null);


                if(member){

                    await syncMemberLuckRoles(
                        member,
                        null
                    );

                }

            }


            await database.clearLuckBoost(
                boost.guildid,
                boost.userid
            );


            continue;

        }


        if(!guild)
            continue;


        const member =
            await guild.members.fetch(
                boost.userid
            ).catch(() => null);


        if(!member)
            continue;


        await syncMemberLuckRoles(
            member,
            boost.role
        );


        restored++;

    }


    console.log(
        `✅ Restored ${restored} Luck Boosts`
    );

}


// ==============================
// OWNER-ONLY MANUAL ROLE CHANGES
// ==============================

function getChangedLuckRoles(
    oldMember,
    newMember
){

    const added =
        LUCK_ROLE_IDS.filter(

            roleID =>
                !oldMember.roles.cache.has(
                    roleID
                )
                &&
                newMember.roles.cache.has(
                    roleID
                )

        );


    const removed =
        LUCK_ROLE_IDS.filter(

            roleID =>
                oldMember.roles.cache.has(
                    roleID
                )
                &&
                !newMember.roles.cache.has(
                    roleID
                )

        );


    return {
        added,
        removed
    };

}



function auditChangeContainsRole(
    change,
    changedRoleIDs
){

    if(
        change.key !== "$add"
        &&
        change.key !== "$remove"
    ){

        return false;

    }


    const roles = [

        ...(Array.isArray(change.new)
            ? change.new
            : []),

        ...(Array.isArray(change.old)
            ? change.old
            : [])

    ];


    return roles.some(

        role =>
            changedRoleIDs.includes(
                role.id
            )

    );

}



async function getRoleChangeExecutor(
    newMember,
    changedRoleIDs
){

    // Audit-log entries sometimes arrive
    // slightly after guildMemberUpdate.
    await new Promise(

        resolve =>
            setTimeout(
                resolve,
                750
            )

    );


    const auditLogs =
        await newMember.guild.fetchAuditLogs({

            type:
                AuditLogEvent.MemberRoleUpdate,

            limit:
                6

        }).catch(error => {

            console.error(
                "Failed to read role audit logs:",
                error
            );

            return null;

        });


    if(!auditLogs){

        return null;

    }


    const now =
        Date.now();


    const entry =
        auditLogs.entries.find(

            logEntry => {

                // Make sure the audit log is
                // for the correct user.
                if(
                    logEntry.target?.id !==
                    newMember.id
                ){

                    return false;

                }


                // Ignore old audit log entries.
                if(
                    now -
                    logEntry.createdTimestamp >
                    15000
                ){

                    return false;

                }


                // Make sure this audit log changed
                // one of the Luck Boost roles.
                return (
                    logEntry.changes?.some(

                        change =>
                            auditChangeContainsRole(
                                change,
                                changedRoleIDs
                            )

                    ) || false
                );

            }

        );


    return entry?.executor?.id || null;

}



// ==============================
// ANTI-STACK / ANTI-FAKE
// ==============================

async function checkLuckBoostRole(
    oldMember,
    newMember
){

    // Ignore role changes made internally
    // by the bot itself.
    if(
        isProtectedRoleChange(
            newMember
        )
    ){

        return;

    }


    const {
        added,
        removed
    } = getChangedLuckRoles(
        oldMember,
        newMember
    );


    const changedRoleIDs = [
        ...added,
        ...removed
    ];


    // This member update did not affect
    // any Luck Boost role.
    if(changedRoleIDs.length === 0){

        return;

    }


    const executorID =
        await getRoleChangeExecutor(
            newMember,
            changedRoleIDs
        );


    // ==============================
    // UNAUTHORIZED ROLE CHANGE
    // ==============================
    //
    // Anyone except the owner is blocked.
    //
    // If they removed a legitimate role,
    // the database role is restored.
    //
    // If they added a fake role,
    // the fake role is removed.

    if(executorID !== OWNER_ID){

        await getActiveLuckBoost(
            newMember
        );


        console.log(
            `Blocked an unauthorized Luck Boost role change on ${newMember.user.tag}`
        );


        return;

    }


    // ==============================
    // OWNER ADDED A ROLE
    // ==============================

    if(added.length > 0){

        // If several Luck Boost roles were
        // somehow added together, use only
        // the strongest one.
        const selectedRole =
            added
                .map(getLuckRoleByID)
                .filter(Boolean)
                .sort(

                    (first, second) =>
                        second.order -
                        first.order

                )[0];


        if(!selectedRole){

            return;

        }


        const expiresAt =
            Date.now() +
            selectedRole.duration;


        // Save the owner's manual role
        // assignment in PostgreSQL.
        await database.updateLuckBoost(
            newMember.guild.id,
            newMember.id,
            selectedRole.roleID,
            expiresAt
        );


        // Remove all other Luck Boost roles
        // so they cannot stack.
        await syncMemberLuckRoles(
            newMember,
            selectedRole.roleID
        );


        console.log(

            `Owner manually gave ${selectedRole.name} to ${newMember.user.tag}`

        );


        return;

    }


    // ==============================
    // OWNER REMOVED A ROLE
    // ==============================

    if(removed.length > 0){

        const savedBoost =
            await database.getLuckBoost(
                newMember.guild.id,
                newMember.id
            );


        const removedActiveRole =
            !savedBoost
            ||
            removed.includes(
                savedBoost.role
            );


        // The owner removed the legitimate
        // active Luck Boost.
        if(removedActiveRole){

            await database.clearLuckBoost(
                newMember.guild.id,
                newMember.id
            );


            await syncMemberLuckRoles(
                newMember,
                null
            );


            console.log(

                `Owner manually removed the Luck Boost from ${newMember.user.tag}`

            );

        }

        // The owner only removed an extra
        // stacked role. Keep the real one.
        else{

            await getActiveLuckBoost(
                newMember
            );

        }

    }

}

// ==============================
// COMMAND LUCK BOOST MESSAGE
// ==============================

function buildCommandLuckExtra(
    user,
    wonLuckBoost,
    commandName
){

    if(
        !wonLuckBoost?.awarded
    ){

        return "";

    }


    const wonRole =
        wonLuckBoost.role;


    return (

        `\n\n🎒 ${user} found <@&${wonRole.roleID}> from **!${commandName}**! Stored in inventory: **x${wonLuckBoost.amount}**.`

    );

}


// ==============================
// EXTRA ROLL MESSAGE
// ==============================

function buildRollExtras(
    message,
    wonXPMaxBoost,
    usedLuckBoost,
    wonLuckBoost
){

    const extras =
        [];


    if(wonXPMaxBoost){

        const amount =

            typeof wonXPMaxBoost ===
            "object"

                ? wonXPMaxBoost.amount

                : null;


        extras.push(

            amount

                ? `💎 ${message.author} found <@&${XP_MAX_ROLE}>! Stored in inventory: **x${amount}**.`

                : `💎 ${message.author} found <@&${XP_MAX_ROLE}> and stored it in their boost inventory.`

        );

    }


    if(usedLuckBoost.roleID){

        const unixExpiry =
            Math.floor(
                usedLuckBoost.expiresAt /
                1000
            );


        extras.push(

            `🍀 <@&${usedLuckBoost.roleID}> used **x${usedLuckBoost.multiplier} luck** for this roll.`

        );

    }


    if(
        wonLuckBoost?.awarded
    ){

        const wonRole =
            wonLuckBoost.role;


        extras.push(

            `🎒 ${message.author} found <@&${wonRole.roleID}>! Stored in inventory: **x${wonLuckBoost.amount}**.`

        );

    }


    if(extras.length === 0){

        return "";

    }


    return (
        `\n\n${extras.join("\n")}`
    );

}



module.exports = {

    LUCK_ROLES,

    getCriticalChanceBonus,

    getActiveLuckBoost,

    getRollLuckProfile,

    getRollCooldown,

    rollWithLuck,

    rollCommandOutcome,

    rollCommandXP,

    rollCommandPenalty,

    getLevel100PlusCommandLuckProfile,

    getCommandSuccessChance,

    buildUsedCommandLuckExtra,

    tryLuckBoostDrop,

    tryCommandLuckBoostDrop,

    activateLuckBoostFromInventory,

    removeExpiredLuckBoosts,

    restoreLuckBoosts,

    checkLuckBoostRole,

    buildCommandLuckExtra,

    buildRollExtras

};
