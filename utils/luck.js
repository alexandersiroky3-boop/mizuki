// utils/luck.js

const database =
    require("../database");

const trolls =
    require("../systems/trolls");


const {
    AuditLogEvent
} = require("discord.js");


const OWNER_ID =
    "1239975819112353969";


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
// UNIVERSAL !ROLL LUCK
// =====================================================
//
// These settings affect !roll only. They do not change:
// - how long an activated Luck Boost role remains active
// - message critical chance
// - !hug / !kiss / !steal balancing
//
// Levels no longer change Luck Boost strength. Permanent Boost upgrades
// apply the user's personal multiplier scale instead.
// Luck affects the roll odds only: every tier and level uses
// the same fixed 30-second !roll cooldown.

const ROLL_COOLDOWN_MS =
    30 * 1000;


const ROLL_LUCK_LEVEL_SETTINGS = {

    universal: {

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
        chancePercent: 0.5
    },

    {
        tier: "tier3",
        chancePercent: 1
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
            5,

        max:
            1,

        omega:
            0.5

    },


    kiss: {

        tier1:
            12,

        tier2:
            7.5,

        tier3:
            1,

        max:
            0.75,

        omega:
            0.05

    },


    steal: {

        tier1:
            25,

        tier2:
            12,

        tier3:
            3,

        max:
            1,

        omega:
            0.3

    }

};


// The universal XP roll table is at the top of:
//
// commands/roll.js
//
// This keeps all regular !roll XP chances
// in the command file where they are easier
// to find and customize.


// Luck II and above use exact level-0 chance tables. This keeps the listed
// percentages honest instead of running a second hidden "Mega Roll" lottery.
// Permanent Rolling upgrades and Boost upgrades are applied to normalized
// copies later; these source tables are never mutated.
const LUCK_ROLL_CHANCE_TABLES = {

    tier2: [
        { chancePercent: 4, type: "neutral", min: -100, max: 100 },
        { chancePercent: 0.75, type: "negative", min: -5000, max: -101 },
        { chancePercent: 20, type: "positive", min: 100, max: 5000 },
        { chancePercent: 0.15, type: "negative", min: -10000, max: -5000 },
        { chancePercent: 50, type: "positive", min: 5000, max: 25000 },
        { chancePercent: 20, type: "positive", min: 25000, max: 75000 },
        { chancePercent: 3, type: "positive", min: 75000, max: 200000 },
        { chancePercent: 1.5, type: "positive", min: 200000, max: 500000 },
        { chancePercent: 0.4, type: "positive", min: 500000, max: 2000000 },
        { chancePercent: 0.05, type: "negative", min: -100000, max: -10000 },
        { chancePercent: 0.1495, type: "positive", min: 2000000, max: 10000000 },
        { chancePercent: 0.00035, type: "positive", min: 10000001, max: 30000000 },
        { chancePercent: 0.0001, type: "positive", min: 30000001, max: 50000000 },
        { chancePercent: 0.00004, type: "positive", min: 50000001, max: 100000000 },
        { chancePercent: 0.000009, type: "positive", min: 100000001, max: 250000000 },
        { chancePercent: 0.000001, type: "positive", min: 250000001, max: 1500000000 }
    ],

    tier3: [
        { chancePercent: 1.5, type: "neutral", min: -100, max: 100 },
        { chancePercent: 0.25, type: "negative", min: -5000, max: -101 },
        { chancePercent: 20, type: "positive", min: 100, max: 5000 },
        { chancePercent: 0.05, type: "negative", min: -10000, max: -5000 },
        { chancePercent: 25, type: "positive", min: 5000, max: 25000 },
        { chancePercent: 40, type: "positive", min: 25000, max: 75000 },
        { chancePercent: 10, type: "positive", min: 75000, max: 200000 },
        { chancePercent: 2.5, type: "positive", min: 200000, max: 500000 },
        { chancePercent: 0.5, type: "positive", min: 500000, max: 2000000 },
        { chancePercent: 0.01, type: "negative", min: -100000, max: -10000 },
        { chancePercent: 0.185, type: "positive", min: 2000000, max: 10000000 },
        { chancePercent: 0.0035, type: "positive", min: 10000001, max: 30000000 },
        { chancePercent: 0.001, type: "positive", min: 30000001, max: 50000000 },
        { chancePercent: 0.0004, type: "positive", min: 50000001, max: 100000000 },
        { chancePercent: 0.00009, type: "positive", min: 100000001, max: 250000000 },
        { chancePercent: 0.00001, type: "positive", min: 250000001, max: 1500000000 }
    ],

    max: [
        { chancePercent: 0.25, type: "neutral", min: -100, max: 100 },
        { chancePercent: 0.04, type: "negative", min: -5000, max: -101 },
        { chancePercent: 2, type: "positive", min: 100, max: 5000 },
        { chancePercent: 0.01, type: "negative", min: -10000, max: -5000 },
        { chancePercent: 24, type: "positive", min: 5000, max: 25000 },
        { chancePercent: 20, type: "positive", min: 25000, max: 75000 },
        { chancePercent: 45, type: "positive", min: 75000, max: 200000 },
        { chancePercent: 7, type: "positive", min: 200000, max: 500000 },
        { chancePercent: 0.75, type: "positive", min: 500000, max: 2000000 },
        { chancePercent: 0.002, type: "negative", min: -100000, max: -10000 },
        { chancePercent: 0.923, type: "positive", min: 2000000, max: 10000000 },
        { chancePercent: 0.0175, type: "positive", min: 10000001, max: 30000000 },
        { chancePercent: 0.005, type: "positive", min: 30000001, max: 50000000 },
        { chancePercent: 0.002, type: "positive", min: 50000001, max: 100000000 },
        { chancePercent: 0.00045, type: "positive", min: 100000001, max: 250000000 },
        { chancePercent: 0.00005, type: "positive", min: 250000001, max: 1500000000 }
    ],

    omega: [
        { chancePercent: 28.365, type: "positive", min: 200000, max: 500000 },
        { chancePercent: 20, type: "positive", min: 500000, max: 2000000 },
        { chancePercent: 45, type: "positive", min: 2000000, max: 10000000 },
        { chancePercent: 5, type: "positive", min: 10000001, max: 30000000 },
        { chancePercent: 1, type: "positive", min: 30000001, max: 50000000 },
        { chancePercent: 0.5, type: "positive", min: 50000001, max: 100000000 },
        { chancePercent: 0.1, type: "positive", min: 100000001, max: 250000000 },
        { chancePercent: 0.035, type: "positive", min: 250000001, max: 1500000000 }
    ]

};


const LUCK_MEGA_ROLL_MIN_XP =
    10000001;


const LUCK_MEGA_ROLL_MAX_XP =
    1500000000;


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
        const [tierName, table] of
        Object.entries(
            LUCK_ROLL_CHANCE_TABLES
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
                `Luck Boost ${tierName} roll chances must total 100%. Current total: ${total}%.`
            );

        }


        for(const outcome of table){

            validatePercentage(
                `Luck Boost ${tierName}`,
                outcome.chancePercent
            );


            if(
                !["neutral", "negative", "positive"]
                    .includes(outcome.type)
                ||
                !Number.isFinite(Number(outcome.min))
                ||
                !Number.isFinite(Number(outcome.max))
                ||
                Number(outcome.max) < Number(outcome.min)
            ){

                throw new Error(
                    `Luck Boost ${tierName} has an invalid roll outcome.`
                );

            }

        }

    }


    if(
        !Number.isFinite(
            Number(
                LUCK_MEGA_ROLL_MIN_XP
            )
        )
        ||
        !Number.isFinite(
            Number(
                LUCK_MEGA_ROLL_MAX_XP
            )
        )
        ||
        Number(LUCK_MEGA_ROLL_MIN_XP) <= 10000000
        ||
        Number(LUCK_MEGA_ROLL_MAX_XP) <
            Number(LUCK_MEGA_ROLL_MIN_XP)
    ){

        throw new Error(
            "Luck Mega Roll range must start above 10,000,000 XP and have a valid maximum."
        );

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

        tier:
            null,

        name:
            "No Luck Boost",

        multiplier:
            1,

        criticalChanceBonus:
            0,

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


async function applyTrollLuckModifiers(
    member,
    ownProfile
){

    const modifiers = await trolls.getLuckModifiers(
        member.guild.id,
        member.id
    );

    const profiles = [];

    if(
        !modifiers.suppressed
        && ownProfile?.roleID
    ){
        profiles.push(ownProfile);
    }

    for(const roleID of modifiers.bonusRoleIDs){
        const bonusProfile = getLuckRoleByID(roleID);
        if(bonusProfile){
            profiles.push(bonusProfile);
        }
    }


    if(profiles.length === 0){
        return {
            ...getNoLuckProfile(),
            suppressedByTroll: modifiers.suppressed,
            trollStackCount: 0
        };
    }


    const upgradeEffects =
        await database.getUserUpgradeEffects(
            member.guild.id,
            member.id
        );

    const boostMultiplierScale = Math.max(
        1,
        Number(upgradeEffects.boostMultiplierScale) || 1
    );

    const highestProfile = profiles.reduce(
        (best, profile) =>
            Number(profile.order) > Number(best.order)
                ? profile
                : best
    );

    const combinedBaseMultiplier = profiles.reduce(
        (sum, profile) =>
            sum + Math.max(
                1,
                Number(
                    profile.baseMultiplier
                    ?? profile.multiplier
                ) || 1
            ),
        0
    );

    const highestBaseMultiplier = profiles.reduce(
        (highest, profile) =>
            Math.max(
                highest,
                Number(
                    profile.baseMultiplier
                    ?? profile.multiplier
                ) || 1
            ),
        1
    );

    const combinedCriticalBonus = profiles.reduce(
        (sum, profile) =>
            sum + Math.max(
                0,
                Number(profile.criticalChanceBonus) || 0
            ),
        0
    );


    return {
        ...highestProfile,
        name: profiles.length > 1
            ? "Stacked Luck Boosts"
            : highestProfile.name,
        baseMultiplier: highestBaseMultiplier,
        multiplier:
            combinedBaseMultiplier *
            boostMultiplierScale,
        criticalChanceBonus: combinedCriticalBonus,
        boostMultiplierScale,
        expiresAt: Math.max(
            ...profiles.map(profile =>
                Number(profile.expiresAt) || 0
            )
        ) || null,
        suppressedByTroll: modifiers.suppressed,
        trollStackCount: modifiers.bonusRoleIDs.length,
        stackedBaseMultiplier: combinedBaseMultiplier
    };

}


// ==============================
// CRITICAL CHANCE BONUS
// ==============================
//
// Luck Boosts now also improve message criticals.
// Strongest role wins if Discord briefly has more
// than one Luck role cached during a role update.

function getMemberLuckProfile(member){

    return (
        LUCK_ROLE_LIST.find(

            role =>
                member?.roles?.cache?.has(
                    role.roleID
                )

        ) || null
    );

}


function getCriticalChanceBonus(member){

    const activeRole =
        getMemberLuckProfile(
            member
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

async function attachLeaderboardRollLuck(
    member,
    profile
){

    const resolvedProfile =
        await profile;


    const [
        leaderboardRollLuckMultiplier,
        blessing
    ] = await Promise.all([
        database.getQuestRollLuckMultiplier(
            member.guild.id,
            member.id
        ),
        database.getActiveGuildBlessing(
            member.guild.id
        )
    ]);


    const blessingLuckMultiplier =
        Math.max(
            1,
            Number(
                blessing?.luckMultiplier
                ?? blessing?.luckmultiplier
            ) || 1
        );


    const blessedProfile =
        blessingLuckMultiplier > 1
            ? {
                ...resolvedProfile,
                order:
                    Math.max(
                        1,
                        Number(resolvedProfile?.order) || 0
                    ),
                multiplier:
                    Math.max(
                        1,
                        Number(resolvedProfile?.multiplier) || 1
                    ) * blessingLuckMultiplier,
                commandMultiplier:
                    Math.max(
                        1,
                        Number(
                            resolvedProfile?.commandMultiplier
                            ?? resolvedProfile?.multiplier
                        ) || 1
                    ) * blessingLuckMultiplier,
                rollWeightFactor:
                    Math.max(
                        1,
                        Number(resolvedProfile?.rollWeightFactor) || 1
                    ) * blessingLuckMultiplier,
                criticalChanceBonus:
                    Math.max(
                        0,
                        Number(resolvedProfile?.criticalChanceBonus) || 0
                    ) + (
                        blessingLuckMultiplier >= 20
                            ? 10
                            : 3
                    ),
                blessingLuckMultiplier,
                blessingExpiresAt:
                    Number(
                        blessing?.expiresAt
                        ?? blessing?.expiresat
                    ) || 0
            }
            : resolvedProfile;


    return {
        ...blessedProfile,
        leaderboardRollLuckMultiplier
    };

}


async function getActiveLuckBoost(
    member,
    options = {}
){

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

        const noLuck = getNoLuckProfile();
        return attachLeaderboardRollLuck(
            member,
            options.ignoreTrolls
                ? noLuck
                : applyTrollLuckModifiers(
                    member,
                    noLuck
                )
        );

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


        const noLuck = getNoLuckProfile();
        return attachLeaderboardRollLuck(
            member,
            options.ignoreTrolls
                ? noLuck
                : applyTrollLuckModifiers(
                    member,
                    noLuck
                )
        );

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


        const noLuck = getNoLuckProfile();
        return attachLeaderboardRollLuck(
            member,
            options.ignoreTrolls
                ? noLuck
                : applyTrollLuckModifiers(
                    member,
                    noLuck
                )
        );

    }


    await syncMemberLuckRoles(
        member,
        profile.roleID
    );


    const upgradeEffects =
        await database.getUserUpgradeEffects(
            member.guild.id,
            member.id
        );


    const boostMultiplierScale =
        Math.max(
            1,
            Number(
                upgradeEffects
                    .boostMultiplierScale
            ) || 1
        );


    const activeProfile = {

        ...profile,

        baseMultiplier:
            profile.multiplier,

        multiplier:
            profile.multiplier *
            boostMultiplierScale,

        boostMultiplierScale,

        expiresAt

    };


    return attachLeaderboardRollLuck(
        member,
        options.ignoreTrolls
            ? activeProfile
            : applyTrollLuckModifiers(
                member,
                activeProfile
            )
    );

}


function getRollLuckProfile(
    profile,
    _legacyLevel
){

    const safeProfile =
        profile ||
        getNoLuckProfile();


    const levelGroup =
        "universal";


    const tier =
        String(
            safeProfile.tier || ""
        ).toLowerCase();


    const settings =
        ROLL_LUCK_LEVEL_SETTINGS[
            levelGroup
        ][tier];


    const baseMultiplier =
        Math.max(
            1,
            Number(
                safeProfile.baseMultiplier ||
                safeProfile.multiplier
            ) || 1
        );


    const rollMultiplier =
        Math.max(
            1,
            Number(
                safeProfile.multiplier
            ) ||
                Number(settings?.multiplier) ||
                1
        );


    const leaderboardRollLuckMultiplier =
        Math.max(
            1,
            Number(
                safeProfile
                    .leaderboardRollLuckMultiplier
            ) || 1
        );


    return {

        ...safeProfile,

        baseMultiplier,

        multiplier:
            rollMultiplier *
            leaderboardRollLuckMultiplier,

        order:
            leaderboardRollLuckMultiplier >= 50
                ? Math.max(
                    Number(safeProfile.order) || 0,
                    4
                )
                : Number(safeProfile.order) || 0,

        rollLevelGroup:
            levelGroup,

        rollCooldownMs:
            settings
                ? Number(settings.cooldownMs)
                : null,

        // Boost Upgrade multipliers gently bias the normalized roll weights;
        // user level is deliberately absent from this calculation.
        rollWeightFactor:
            Math.max(
                1,
                (
                    rollMultiplier /
                    baseMultiplier
                ) *
                leaderboardRollLuckMultiplier
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


    let strengthExponent =
        0;


    if(outcome.type === "neutral"){

        adjustedWeight *=
            modifiers.neutral;


        strengthExponent =
            -0.25;

    }


    else if(outcome.type === "negative"){

        adjustedWeight *=
            modifiers.negative;


        strengthExponent =
            -0.50;

    }


    else if(outcome.type === "positive"){

        const weightType =
            getPositiveWeightType(
                outcome
            );


        adjustedWeight *=
            modifiers[weightType];


        const maximumXP =
            Number(outcome.max) || 0;


        // Boost upgrades strengthen the far end progressively. Keeping these
        // bands separate matters for Ω, whose entire table is already rare.
        if(maximumXP <= 5000){
            strengthExponent = 0;
        }
        else if(maximumXP <= 25000){
            strengthExponent = 0.25;
        }
        else if(maximumXP <= 200000){
            strengthExponent = 0.50;
        }
        else if(maximumXP <= 500000){
            strengthExponent = 0.75;
        }
        else if(maximumXP <= 2000000){
            strengthExponent = 1;
        }
        else if(maximumXP <= 10000000){
            strengthExponent = 1.25;
        }
        else if(maximumXP <= 30000000){
            strengthExponent = 1.50;
        }
        else if(maximumXP <= 50000000){
            strengthExponent = 1.75;
        }
        else if(maximumXP <= 100000000){
            strengthExponent = 2;
        }
        else if(maximumXP <= 250000000){
            strengthExponent = 2.25;
        }
        else{
            strengthExponent = 2.50;
        }

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
            strengthExponent
        )
    );

}



function rollFromWeightedTable(
    table,
    profile
){

    return rollFromExactPercentTable(
        getWeightedChanceTable(
            table,
            profile
        )
    );

}


function normalizeChanceTable(table){

    const totalWeight =
        (table || []).reduce(
            (total, outcome) =>
                total +
                Math.max(
                    0,
                    Number(outcome.chancePercent) || 0
                ),
            0
        );


    if(totalWeight <= 0){

        throw new Error(
            "A roll chance table must have a positive total weight."
        );

    }


    return table.map(outcome => ({
        ...outcome,
        chancePercent:
            Math.max(
                0,
                Number(outcome.chancePercent) || 0
            ) /
            totalWeight *
            100
    }));

}


function getWeightedChanceTable(
    table,
    profile
){

    const safeProfile =
        profile ||
        getNoLuckProfile();


    return normalizeChanceTable(
        table.map(outcome => ({
            ...outcome,
            chancePercent:
                getAdjustedWeight(
                    outcome,
                    safeProfile
                )
        }))
    );

}


const ROLLING_UPGRADE_WEIGHT_FACTORS = {
    neutral: [1, 0.96, 0.88, 0.82, 0.70, 0.58, 0.42, 0.25, 0.10],
    negative: [1, 0.77, 0.66, 0.44, 0.27, 0.21, 0.14, 0.07, 0.02],
    common: [1, 1.18, 1.40, 1.58, 2.10, 2.35, 2.70, 3, 3.50],
    fiveThousand: [1, 1.25, 2.10, 3.15, 4.25, 7.40, 8.50, 10, 14],
    // Keep each higher reward band's step-up at least as strong as the band
    // below it. Normalization can otherwise make an upgrade hurt jackpot odds.
    twentyFiveThousand: [1, 1.30, 2.20, 3.35, 4.55, 8, 9.50, 16, 25],
    seventyFiveThousand: [1, 1.32, 2.25, 3.42, 4.65, 8.15, 9.75, 100, 160],
    twoHundredThousand: [1, 1.34, 2.28, 3.48, 4.75, 8.35, 10.10, 250, 400],
    million: [1, 1.35, 2.30, 3.55, 4.85, 8.60, 10.60, 31.80, 3000],
    rare: [1, 1.37, 2.34, 3.62, 4.95, 8.85, 12, 36, 180],
    mega: [1, 1.40, 2.40, 3.80, 5.20, 9.25, 12.75, 38.25, 220],
    ultra: [1, 1.45, 2.50, 4, 5.50, 9.90, 14.90, 44.70, 260]
};


function getRollingUpgradeChanceTable(
    baseTable,
    rollingLevel
){

    if(
        !Array.isArray(baseTable)
        ||
        baseTable.length === 0
    ){

        throw new Error(
            "getRollingUpgradeChanceTable received an empty chance table."
        );

    }


    const level =
        Math.max(
            0,
            Math.min(
                8,
                Math.floor(
                    Number(rollingLevel) || 0
                )
            )
        );


    return normalizeChanceTable(
        baseTable.map(outcome => {
            let group = "neutral";

            if(outcome.type === "negative"){
                group = "negative";
            }
            else if(outcome.type === "positive"){
                if(Number(outcome.min) >= 50000001){
                    group = "ultra";
                }
                else if(Number(outcome.min) >= 10000001){
                    group = "mega";
                }
                else if(Number(outcome.min) >= 2000000){
                    group = "rare";
                }
                else if(Number(outcome.min) >= 500000){
                    group = "million";
                }
                else if(Number(outcome.min) >= 200000){
                    group = "twoHundredThousand";
                }
                else if(Number(outcome.min) >= 75000){
                    group = "seventyFiveThousand";
                }
                else if(Number(outcome.min) >= 25000){
                    group = "twentyFiveThousand";
                }
                else if(Number(outcome.min) >= 5000){
                    group = "fiveThousand";
                }
                else{
                    group = "common";
                }
            }

            return {
                ...outcome,
                chancePercent:
                    Number(outcome.chancePercent) *
                    ROLLING_UPGRADE_WEIGHT_FACTORS[group][level]
            };
        })
    );

}


function getResolvedRollChanceTable(
    rollChanceTable,
    profile,
    rollingLevel = 0
){

    const safeProfile =
        profile ||
        getNoLuckProfile();


    const tier =
        String(
            safeProfile.tier || ""
        ).toLowerCase();


    const exactLuckTable =
        LUCK_ROLL_CHANCE_TABLES[tier];


    const upgradedTable =
        getRollingUpgradeChanceTable(
            exactLuckTable || rollChanceTable,
            rollingLevel
        );


    // Tier II/III/MAX/Ω source tables already contain the exact Luck odds.
    // Setting order to 0 prevents those tiers from being applied twice, while
    // rollWeightFactor still lets permanent Boost upgrades improve the table.
    const weightingProfile =
        exactLuckTable
            ? {
                ...safeProfile,
                order: 0
            }
            : safeProfile;


    return getWeightedChanceTable(
        upgradedTable,
        weightingProfile
    );

}


function getChanceAtOrAbove(
    table,
    minimumXP
){

    return (table || []).reduce(
        (total, outcome) =>
            Number(outcome.min) >= Number(minimumXP)
                ? total + Number(outcome.chancePercent || 0)
                : total,
        0
    );

}


function getLuckMegaRollChance(
    profile,
    rollChanceTable,
    rollingLevel = 0
){

    const tier =
        String(
            profile?.tier || ""
        ).toLowerCase();


    const sourceTable =
        rollChanceTable ||
        LUCK_ROLL_CHANCE_TABLES[tier];


    if(
        !Array.isArray(sourceTable)
        ||
        sourceTable.length === 0
    ){

        return 0;

    }


    return getChanceAtOrAbove(
        getResolvedRollChanceTable(
            sourceTable,
            profile,
            rollingLevel
        ),
        LUCK_MEGA_ROLL_MIN_XP
    );

}



async function rollWithLuck(
    member,
    rollChanceTable,
    _levelTableName = "base",
    preparedProfile = null,
    rollingLevel = 0
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
            1
        );


    const resolvedChanceTable =
        getResolvedRollChanceTable(
            rollChanceTable,
            profile,
            rollingLevel
        );


    const rolledXP =
        rollFromExactPercentTable(
            resolvedChanceTable
        );


    const megaRollChancePercent =
        getChanceAtOrAbove(
            resolvedChanceTable,
            LUCK_MEGA_ROLL_MIN_XP
        );


    return {

        rolledXP,

        profile,

        megaRoll:
            rolledXP >=
            LUCK_MEGA_ROLL_MIN_XP,

        megaRollChancePercent:
            megaRollChancePercent

    };

}


function rollGuaranteedMinimumWithLuck(
    currentXP,
    minimumXP,
    rollChanceTable,
    _levelTableName = "base",
    profile = null,
    rollingLevel = 0
){

    const safeMinimum =
        Math.max(
            0,
            Math.floor(
                Number(minimumXP) || 0
            )
        );


    const safeCurrent =
        Math.floor(
            Number(currentXP) || 0
        );


    if(safeCurrent >= safeMinimum){
        return safeCurrent;
    }


    const sourceTable =
        getResolvedRollChanceTable(
            rollChanceTable,
            profile,
            rollingLevel
        );


    const eligibleTable =
        (sourceTable || [])
            .filter(
                outcome =>
                    Number(outcome.max) >= safeMinimum
                    &&
                    Number(outcome.max) > 0
            )
            .map(
                outcome => ({
                    ...outcome,
                    type:
                        outcome.type || "positive",
                    min:
                        Math.max(
                            safeMinimum,
                            Number(outcome.min) || 0
                        )
                })
            );


    if(eligibleTable.length > 0){

        return rollFromExactPercentTable(
            normalizeChanceTable(
                eligibleTable
            )
        );

    }


    // Safety fallback for a custom guarantee above every configured range.
    return rollCommandXP(
        safeMinimum,
        Math.max(
            safeMinimum,
            LUCK_MEGA_ROLL_MAX_XP
        ),
        profile
    );

}


// Rolls from a purpose-built guarantee table while still respecting the
// user's permanent Rolling and Boost upgrades. Active Luck adds a gentle
// high-range bias instead of replacing the guarantee table with a normal
// Luck table (which could reintroduce low or negative results).
function rollGuaranteedChanceTableWithLuck(
    guaranteeChanceTable,
    profile = null,
    rollingLevel = 0
){

    if(
        !Array.isArray(guaranteeChanceTable)
        ||
        guaranteeChanceTable.length === 0
    ){

        throw new Error(
            "rollGuaranteedChanceTableWithLuck received an empty chance table."
        );

    }


    const safeProfile =
        profile || getNoLuckProfile();


    const activeLuckScale =
        1 +
        getCommandLuckOrder(
            safeProfile
        ) * 0.15;


    const guaranteeProfile = {
        ...safeProfile,

        rollWeightFactor:
            Math.max(
                1,
                Number(
                    safeProfile.rollWeightFactor
                ) || 1
            ) * activeLuckScale
    };


    const upgradedTable =
        getRollingUpgradeChanceTable(
            guaranteeChanceTable,
            rollingLevel
        );


    const resolvedTable =
        getWeightedChanceTable(
            upgradedTable,
            guaranteeProfile
        );


    return rollFromExactPercentTable(
        resolvedTable
    );

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
            balance.multiplier *
            Math.max(
                1,
                Number(
                    profile.boostMultiplierScale
                ) || 1
            ) *
            Math.max(
                1,
                (
                    Number(
                        profile.stackedBaseMultiplier
                    ) ||
                    Number(profile.baseMultiplier) ||
                    1
                ) /
                Math.max(
                    1,
                    Number(profile.baseMultiplier) || 1
                )
            ),

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


// =====================================================
// EVOLVED COMMAND RARITIES
// =====================================================
//
// The normal rarity is always selected first. A second, independent roll
// then decides whether that exact rarity evolves. Permanent upgrades do not
// affect this chance; only the highest active Luck Boost tier does.
const EVOLVED_XP_MULTIPLIER =
    10;


const EVOLVED_BASE_CHANCE_PERCENT =
    1;


const EVOLVED_LUCK_BONUS_PERCENT =
    Object.freeze({
        tier1: 1,
        tier2: 3,
        tier3: 5,
        max: 7,
        omega: 15
    });


function getEvolvedChancePercent(profile){

    const tier =
        String(profile?.tier || "")
            .toLowerCase();


    return Math.min(
        100,
        EVOLVED_BASE_CHANCE_PERCENT +
        (
            EVOLVED_LUCK_BONUS_PERCENT[tier]
            || 0
        )
    );

}


function rollEvolvedCommandRarity(
    profile,
    random = Math.random
){

    const chancePercent =
        getEvolvedChancePercent(profile);


    const position =
        Math.max(
            0,
            Math.min(
                0.999999999999,
                Number(random()) || 0
            )
        );


    return (
        position * 100 <
        chancePercent
    );

}


function applyEvolvedXP(
    amount,
    evolved
){

    const safeAmount =
        Math.trunc(
            Number(amount) || 0
        );


    return evolved
        ? safeAmount * EVOLVED_XP_MULTIPLIER
        : safeAmount;

}


function buildEvolvedCommandExtra(
    evolved,
    _rarity = ""
){

    if(!evolved){
        return "";
    }

    return (
        `\n✨ This evolved result was multiplied by **${EVOLVED_XP_MULTIPLIER}×**.`
    );

}


function buildEvolvedRarityMarker(
    guild,
    evolved
){

    if(!evolved){
        return "";
    }


    const emoji =
        guild?.emojis?.cache?.find?.(
            entry =>
                entry.name ===
                    "evolved_common_leaf"
        );


    return (
        ` ${emoji ? emoji.toString() : ":evolved_common_leaf:"} **(EVOLVED)**`
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


    const questEvent =
        wonRole.tier === "omega"
            ? "obtain_luck_omega"
            : wonRole.tier === "max"
                ? "obtain_luck_max"
                : null;


    if(questEvent){
        const quests =
            require("../systems/quests");


        await quests.recordEvent(
            {
                guild: member.guild,
                client: member.client || member.guild?.client,
                user: member.user || {id: member.id}
            },
            questEvent,
            1,
            {
                userID: member.id
            }
        ).catch(error => {
            console.error(
                `Could not record ${questEvent} quest progress for ${member.id}:`,
                error
            );
        });
    }


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
            member,
            {ignoreTrolls: true}
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


    const upgradeEffects =
        await database.getUserUpgradeEffects(
            member.guild.id,
            member.id
        );


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


    const upgradedDuration =
        Math.floor(
            selectedBoost.duration *
            Math.max(
                1,
                Number(
                    upgradeEffects
                        .boostDurationScale
                ) || 1
            )
        );


    const expiresAt =
        Date.now() +
        upgradedDuration;


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


        await trolls.activatePendingLuckTransfer(
            member.guild.id,
            member.id,
            selectedBoost.roleID
        ).catch(error => {
            console.error(
                "Could not activate pending troll Luck transfer:",
                error
            );
        });

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

            duration:
                upgradedDuration,

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


        const upgradeEffects =
            await database.getUserUpgradeEffects(
                newMember.guild.id,
                newMember.id
            );


        const expiresAt =
            Date.now() +
            Math.floor(
                selectedRole.duration *
                Math.max(
                    1,
                    Number(
                        upgradeEffects
                            .boostDurationScale
                    ) || 1
                )
            );


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


        await trolls.activatePendingLuckTransfer(
            newMember.guild.id,
            newMember.id,
            selectedRole.roleID
        ).catch(error => {
            console.error(
                "Could not activate pending troll Luck transfer:",
                error
            );
        });


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
    usedLuckBoost,
    wonLuckBoost
){

    const extras =
        [];


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

    LUCK_ROLL_CHANCE_TABLES,

    LUCK_MEGA_ROLL_MIN_XP,

    LUCK_MEGA_ROLL_MAX_XP,

    getMemberLuckProfile,

    applyTrollLuckModifiers,

    getCriticalChanceBonus,

    getActiveLuckBoost,

    getRollLuckProfile,

    getRollCooldown,

    rollWithLuck,

    rollGuaranteedMinimumWithLuck,

    rollGuaranteedChanceTableWithLuck,

    getLuckMegaRollChance,

    getRollingUpgradeChanceTable,

    getResolvedRollChanceTable,

    EVOLVED_XP_MULTIPLIER,

    EVOLVED_BASE_CHANCE_PERCENT,

    EVOLVED_LUCK_BONUS_PERCENT,

    getEvolvedChancePercent,

    rollEvolvedCommandRarity,

    applyEvolvedXP,

    buildEvolvedCommandExtra,

    buildEvolvedRarityMarker,

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
