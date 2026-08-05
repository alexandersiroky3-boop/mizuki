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

        duration:
            30 * 60 * 1000,

        durationText:
            "30 minutes",

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

        duration:
            10 * 60 * 1000,

        durationText:
            "10 minutes",

        order:
            4

    }

};


const LUCK_ROLE_LIST = [

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
        tier: "max",
        chancePercent: 0.75
    },

    {
        tier: "tier3",
        chancePercent: 2
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
            10,

        max:
            5

    },


    kiss: {

        tier1:
            12,

        tier2:
            7.5,

        tier3:
            3,

        max:
            0.8

    },


    steal: {

        tier1:
            25,

        tier2:
            12,

        tier3:
            6,

        max:
            2

    }

};


// The XP roll tables for Level 1-100 and
// Level 101+ are now at the top of:
//
// commands/roll.js
//
// This keeps all regular !roll XP chances
// in the command file where they are easier
// to find and customize.


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
    3: {

        neutral:
            0.65,

        negative:
            0.35,

        commonPositive:
            3,

        valuablePositive:
            4.50,

        rarePositive:
            6.50,

        jackpotPositive:
            10

    },


    // Luck Boost MAX — x50 rating
    4: {

        neutral:
            0.50,

        negative:
            0.20,

        commonPositive:
            4.50,

        valuablePositive:
            7,

        rarePositive:
            11,

        jackpotPositive:
            20

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


    if(outcome.type === "neutral"){

        return (
            outcome.chancePercent *
            modifiers.neutral
        );

    }


    if(outcome.type === "negative"){

        return (
            outcome.chancePercent *
            modifiers.negative
        );

    }


    if(outcome.type === "positive"){

        const weightType =
            getPositiveWeightType(
                outcome
            );


        return (
            outcome.chancePercent *
            modifiers[weightType]
        );

    }


    return outcome.chancePercent;

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
    rollChanceTable
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
        await getActiveLuckBoost(
            member
        );


    return {

        rolledXP:
            rollFromWeightedTable(
                rollChanceTable,
                profile
            ),

        profile

    };

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
            "max"
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

    getActiveLuckBoost,

    rollWithLuck,

    tryLuckBoostDrop,

    tryCommandLuckBoostDrop,

    activateLuckBoostFromInventory,

    removeExpiredLuckBoosts,

    restoreLuckBoosts,

    checkLuckBoostRole,

    buildCommandLuckExtra,

    buildRollExtras

};
