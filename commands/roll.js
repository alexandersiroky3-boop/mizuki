const database = require("../database");
const boosts = require("../systems/boosts");
const xp = require("../utils/xp");
const leveling = require("../systems/leveling");
const luck =
    require("../utils/luck");

const quests =
    require("../systems/quests");


// Keep one immutable source of truth for !roll. Discord relative timestamps
// use the viewer's device clock and can make a real 30-second cooldown appear
// as 35 seconds, so sub-minute cooldown messages are rendered from this value
// directly instead.
const ROLL_COOLDOWN_MS =
    30_000;


// =====================================================
// EASY ROLL CUSTOMIZATION
// =====================================================
//
// All chancePercent values are REAL percentages:
//
// 72    = 72%
// 0.5   = 0.5%
// 0.05  = 0.05%
// 0.001 = 0.001%
//
// IMPORTANT:
// These are the BASE chances before an active
// Luck Boost changes the outcome weights.
//
// Each level table must add up to exactly 100%.
// The bot checks this automatically when it starts.

const ROLL_SETTINGS = {

    cooldownSeconds:
        ROLL_COOLDOWN_MS / 1000,

    // Chance to find XP Boost MAX from !roll.
    xpMaxBoostDropPercent: {

        level1To100:
            0.05,

        level101Plus:
            0.05

    },

    chanceTables: {

        // ==========================
        // LEVEL 1-99
        // ==========================

        level1To100: [

            {
                chancePercent: 60.09,
                type: "neutral",
                min: -100,
                max: 100
            },

            {
                chancePercent: 7,
                type: "negative",
                min: -5000,
                max: -101
            },

            {
                chancePercent: 25,
                type: "positive",
                min: 100,
                max: 5000
            },

            {
                chancePercent: 2,
                type: "negative",
                min: -10000,
                max: -5000
            },

            {
                chancePercent: 5,
                type: "positive",
                min: 5000,
                max: 25000
            },

            {
                chancePercent: 0.5,
                type: "positive",
                min: 25000,
                max: 75000
            },

            {
                chancePercent: 0.1,
                type: "positive",
                min: 75000,
                max: 200000
            },

            {
                chancePercent: 0.05,
                type: "positive",
                min: 200000,
                max: 500000
            },

            {
                chancePercent: 0.009,
                type: "positive",
                min: 500000,
                max: 2000000
            },

            {
                chancePercent: 0.250,
                type: "negative",
                min: -100000,
                max: -10000
            },

            {
                chancePercent: 0.001,
                type: "positive",
                min: 2000000,
                max: 10000000
            }

        ],


        // ==========================
        // LEVEL 100+
        // ==========================

        level101Plus: [

            {
                chancePercent: 38.99,
                type: "neutral",
                min: -100,
                max: 100
            },

            {
                chancePercent: 5,
                type: "negative",
                min: -5000,
                max: -101
            },

            {
                chancePercent: 35,
                type: "positive",
                min: 100,
                max: 5000
            },

            {
                chancePercent: 1,
                type: "negative",
                min: -10000,
                max: -5000
            },

            {
                chancePercent: 15,
                type: "positive",
                min: 5000,
                max: 25000
            },

            {
                chancePercent: 4.60,
                type: "positive",
                min: 25000,
                max: 75000
            },

            {
                chancePercent: 0.3,
                type: "positive",
                min: 75000,
                max: 200000
            },

            {
                chancePercent: 0.09,
                type: "positive",
                min: 200000,
                max: 500000
            },

            {
                chancePercent: 0.009,
                type: "positive",
                min: 500000,
                max: 2000000
            },

            {
                chancePercent: 0.005,
                type: "positive",
                min: 2000000,
                max: 10000000
            },

            {
                chancePercent: 0.006,
                type: "negative",
                min: -10000000,
                max: -2000000
            }

        ]

    }

};


function percentChance(chancePercent){

    return (
        Math.random() * 100 <
        Number(chancePercent)
    );

}


function validateRollChanceTable(
    tableName,
    table
){

    if(!Array.isArray(table) || table.length === 0){

        throw new Error(
            `${tableName} must contain at least one roll outcome.`
        );

    }


    const totalPercent =
        table.reduce(
            (total, outcome) =>
                total +
                Number(outcome.chancePercent || 0),
            0
        );


    if(
        Math.abs(totalPercent - 100) >
        0.000001
    ){

        throw new Error(
            `${tableName} chances must total exactly 100%. Current total: ${totalPercent}%`
        );

    }

}


for(
    const [tableName, table] of
    Object.entries(
        ROLL_SETTINGS.chanceTables
    )
){

    validateRollChanceTable(
        tableName,
        table
    );

}


const ROLL_GUARANTEE_THRESHOLD =
    100;


const ROLL_GUARANTEE_MIN_XP =
    500000;


function buildRollGuaranteeFooter(
    rollGuarantee
){

    const progress =
        Math.max(
            0,
            Number(
                rollGuarantee?.progress
            ) || 0
        );


    const threshold =
        Math.max(
            1,
            Number(
                rollGuarantee?.threshold
            ) || ROLL_GUARANTEE_THRESHOLD
        );


    return (
        `\n\n🎯 **100-Roll Guarantee:** ${progress}/${threshold}`
        +
        (
            rollGuarantee?.guaranteed
                ? `\n🎁 **Milestone reached — this roll was guaranteed ${ROLL_GUARANTEE_MIN_XP.toLocaleString()}+ XP!**`
                : ""
        )
    );

}


function buildRollCooldownExtra(
    rollAccess
){

    if(
        rollAccess?.multiRoll
        ||
        rollAccess?.tripleRoll
    ){

        const rollNumber =
            Math.max(
                1,
                Number(
                    rollAccess?.rollNumber
                ) || 1
            );


        const rollCount =
            Math.max(
                1,
                Number(
                    rollAccess?.rollCount
                ) || 3
            );


        const multiText =
            `\n\n🎰 **MULTI ROLL ${rollNumber}/${rollCount}**` +
            (
                rollAccess?.oneShotBurst
                    ? " • one-time quest reward"
                    : ""
            );


        // Only the final automatic roll needs to repeat the
        // cooldown reminder.
        if(!rollAccess?.showCooldown){

            return multiText;

        }


        return (
            multiText +
            `\n⏱️ **Next Multi Roll:** fixed ` +
            `**${ROLL_SETTINGS.cooldownSeconds}-second cooldown**.`
        );

    }


    return (
        `\n\n⏱️ **Next roll:** fixed ` +
        `**${ROLL_SETTINGS.cooldownSeconds}-second cooldown**.`
    );

}


function getDisplayedCooldownSeconds(
    remainingMs
){

    const remaining =
        Number(
            remainingMs
        );


    if(
        !Number.isFinite(remaining)
        ||
        remaining <= 0
    ){

        return 0;

    }


    return Math.min(
        ROLL_SETTINGS.cooldownSeconds,
        Math.max(
            1,
            Math.ceil(
                remaining / 1000
            )
        )
    );

}


async function syncRollLevel(
    message,
    userID
){

    const levelResult =
        await leveling.syncLevelAndAnnounce(
            message.client,
            message.guild.id,
            userID
        );


    await quests.recordLevelChange(
        message,
        levelResult,
        userID
    );


    return levelResult;

}


async function execute(message, options = {}){


    if(!message.guild)
        return;



    const userID =
        message.author.id;


    const user =
        await database.getUser(
            message.guild.id,
            userID
        );


    const currentLevel =
        xp.getLevel(
            Number(user.xp)
        );


    // The new split is exactly Level 1-99 vs. Level 100+.
    const levelTableName =
        currentLevel >= 100
            ? "level101Plus"
            : "level1To100";


    const rollChanceTable =
        ROLL_SETTINGS.chanceTables[
            levelTableName
        ];


    const activeLuckBoost =
        await luck.getActiveLuckBoost(
            message.member
        );


    const rollLuckProfile =
        luck.getRollLuckProfile(
            activeLuckBoost,
            currentLevel
        );


    // Luck changes the roll odds, never the wait between rolls.
    // Every normal or Multi Roll batch uses exactly 30 seconds.
    const currentRollCooldown =
        ROLL_COOLDOWN_MS;



    // ======================
    // Cooldown
    // ======================

const rollAccess =
    options.rollAccess
    ||
    await quests.useRollCooldown(
        message.guild.id,
        message.author.id,
        currentRollCooldown
    );


if(!rollAccess.allowed){


    const seconds =
        getDisplayedCooldownSeconds(
            rollAccess.remaining
        );


    const secondLabel =
        seconds === 1
            ? "second"
            : "seconds";


    const messageText =
        (
            rollAccess.multiRoll
            ||
        rollAccess.tripleRoll
    )
            ? `🎰 Multi Roll cooldown: **${seconds} ${secondLabel} remaining** (fixed 30-second maximum).`
            : `🎲 Roll cooldown: **${seconds} ${secondLabel} remaining** (fixed 30-second maximum).`;


    return message.reply(
        messageText
    );


}


// ======================
// QUEST MULTI ROLL
// ======================
//
// One typed !roll command now performs the rewarded number of complete,
// independent rolls automatically. Each roll still uses:
// - its own XP result
// - its own Luck calculation
// - its own XP MAX / Luck Boost drop checks
// - its own quest progress
// - its own bonus / Impossible bonus
//
// The cooldown was already consumed once above.
if(
    (
        rollAccess.multiRoll
        ||
        rollAccess.tripleRoll
    )
    &&
    !options.skipCooldown
){

    const rollCount =
        Math.max(
            1,
            Number(
                rollAccess.rollCount
            ) || 3
        );


    for(
        let rollIndex = 0;
        rollIndex < rollCount;
        rollIndex++
    ){

        await execute(
            message,
            {
                skipCooldown: true,

                rollAccess: {
                    ...rollAccess,

                    rollNumber:
                        rollIndex + 1,

                    rollCount,

                    showCooldown:
                        rollIndex ===
                        rollCount - 1
                }
            }
        );

    }


    return;

}





// ======================
// ROLL WITH LUCK
// ======================

let wonMaxBoost =
    false;


const luckResult =
    await luck.rollWithLuck(
        message.member,
        rollChanceTable,
        levelTableName,
        rollLuckProfile
    );


let rolledXP =
    luckResult.rolledXP;


const guaranteedRoll =
    await quests.consumeGuaranteedRoll(
        message.guild.id,
        userID
    );


if(guaranteedRoll === "daily_25k_75k"){

    rolledXP =
        Math.max(
            rolledXP,
            Math.floor(
                Math.random() * 50001
            ) + 25000
        );

}
else if(guaranteedRoll === "impossible"){

    rolledXP =
        Math.max(
            rolledXP,
            Math.floor(
                Math.random() * 1500001
            ) + 500000
        );

}
else if(
    guaranteedRoll?.type === "minimum"
){

    rolledXP =
        Math.max(
            rolledXP,
            Number(
                guaranteedRoll.minXP
            ) || 0
        );

}


// Each actual result advances the meter, including every individual result
// in Multi Roll. The counter is stored in PostgreSQL, so restarts do not
// erase progress and concurrent rolls cannot lose an increment.
const rollGuarantee =
    await database.advanceRollGuarantee(
        message.guild.id,
        userID,
        ROLL_GUARANTEE_THRESHOLD
    );


if(rollGuarantee.guaranteed){

    rolledXP =
        Math.max(
            rolledXP,
            ROLL_GUARANTEE_MIN_XP
        );

}


// This is the Luck Boost used
// during the current roll.
//
// A Luck Boost won from this roll
// starts affecting future rolls.

const usedLuckBoost =
    luckResult.profile;


    // ======================
    // GIVE XP
    // ======================


await database.addXP(

    message.guild.id,

    userID,

    rolledXP

);


await quests.recordEvent(
    message,
    "roll_count",
    1
);


await quests.recordEvent(
    message,
    "roll_xp",
    Math.max(
        0,
        rolledXP
    )
);


// "Roll more than X XP" quests use ONE individual roll only.
// Multi Roll calls this same single-roll path once per result, so
// smaller automatic rolls can never combine into one single-roll quest.
await quests.recordEvent(
    message,
    "single_roll_xp",
    Math.max(
        0,
        rolledXP
    )
);


await quests.recordEvent(
    message,
    "earn_xp",
    Math.max(
        0,
        rolledXP
    )
);


// Track roll XP for boosts
await database.addBoostActivity(

    message.guild.id,

    userID,

    Math.max(0, rolledXP)

);

// ======================
// XP BOOST MAX DROP
// ======================
//
// The boost is stored in inventory.
// The user activates it later with !boost.

if(
    percentChance(
        ROLL_SETTINGS
            .xpMaxBoostDropPercent[
                levelTableName
            ]
    )
){

    wonMaxBoost =
        await boosts.awardXPBoost(
            message.member,
            "max",
            "!roll"
        );

}


// Update boost
await boosts.updateBoost(
    message.member
);

// ======================
// LUCK BOOST REWARD
// ======================
//
// This happens before any result message,
// so every roll can potentially award:
//
// - XP
// - XP Boost MAX
// - Luck Boost

const wonLuckBoost =
    await luck.tryLuckBoostDrop(
        message.member
    );


const guaranteedRollExtra =
    guaranteedRoll === "daily_25k_75k"
        ? "\nQuest reward used: guaranteed 25,000–75,000 XP roll."
        : guaranteedRoll === "impossible"
            ? "\nQuest reward used: guaranteed Impossible Roll."
            : guaranteedRoll?.type === "minimum"
                ? `\nQuest reward used: guaranteed ${Number(guaranteedRoll.minXP).toLocaleString()}+ XP roll.`
                : "";


const megaRollExtra =
    luckResult.megaRoll
        ? (
            `\n💎 **MEGA LUCK ROLL!** ` +
            `Your active Luck Boost hit its **${Number(
                luckResult.megaRollChancePercent
            ).toLocaleString("en-US", {
                maximumFractionDigits: 6
            })}%** chance for **10,000,001–50,000,000 XP**.`
        )
        : "";


const rollExtras =
    luck.buildRollExtras(
        message,
        wonMaxBoost,
        usedLuckBoost,
        wonLuckBoost
    )
    + guaranteedRollExtra
    + megaRollExtra
    + buildRollCooldownExtra(
        rollAccess
    );


const rollGuaranteeFooter =
    buildRollGuaranteeFooter(
        rollGuarantee
    );







// ======================
// Impossible Roll
// ======================

if(rolledXP >= 500000){

const bonus =
    Math.floor(
        Math.random() * 1250001
    ) + 750000;

await database.addXP(

    message.guild.id,

    userID,

    bonus

);


await database.addBoostActivity(

    message.guild.id,

    userID,

    bonus

);


await quests.recordEvent(
    message,
    "earn_xp",
    bonus
);


await boosts.updateBoost(
    message.member
);

await syncRollLevel(
    message,
    userID
);

    return message.channel.send(

`🌠 **THE UNIVERSE FALLS SILENT.**

${message.author} rolled **+${rolledXP.toLocaleString()} XP!**${rollExtras}

*Time itself seems to stop.*

*Mizuki simply stares at the glowing number.*

*"...."*

*"You're... unreal."*

*Without saying another word, she rushes toward ${message.author}, wraps both arms around them and refuses to let go.*

*"I... I don't ever want to forget this moment..."*

*After several long seconds she finally lets go, cheeks glowing bright red.*

*"Congratulations... my luckiest person."*

💖 **Mizuki secretly rewarded you with +${bonus.toLocaleString()} XP!**

✨ **The universe itself acknowledged your existence.**${rollGuaranteeFooter}`

    );

}





// ======================
// Legendary Lucky Bonus
// ======================

if(rolledXP >= 200000){

const bonus =
    Math.floor(
        Math.random() * 350001
    ) + 150000;

await database.addXP(

    message.guild.id,

    userID,

    bonus

);


await database.addBoostActivity(

    message.guild.id,

    userID,

    bonus

);


await quests.recordEvent(
    message,
    "earn_xp",
    bonus
);


await boosts.updateBoost(
    message.member
);

await syncRollLevel(
    message,
    userID
);

    return message.channel.send(

`✨ ${message.author} rolled **+${rolledXP.toLocaleString()} XP!**${rollExtras}

*Mizuki stares in complete disbelief.*

*"That's impossible..."*

*Golden sparkles begin swirling around both of you.*

*Mizuki suddenly laughs, throws herself into your arms, and hugs you as tightly as she can.*

*"Hehe... maybe you're my lucky charm after all~"*

💖 **Mizuki secretly rewarded you with +${bonus.toLocaleString()} XP!**${rollGuaranteeFooter}`

    );

}


// ======================
// 75k - 200k
// ======================

if(rolledXP >= 75000){

    const bonus =
    Math.floor(
        Math.random() * 75001
    ) + 50000;

    await database.addXP(
        message.guild.id,
        userID,
        bonus
    );

    await database.addBoostActivity(
        message.guild.id,
        userID,
        bonus
    );

    await quests.recordEvent(
        message,
        "earn_xp",
        bonus
    );

    await boosts.updateBoost(
        message.member
    );

await syncRollLevel(
    message,
    userID
);

    return message.channel.send(

`🌌 ${message.author} rolled **+${rolledXP.toLocaleString()} XP!**${rollExtras}

*The air itself seems to shimmer.*

*Mizuki slowly lands beside you, completely speechless.*

*"I... I don't even know what to say..."*

*She gently holds both of your hands.*

*"Promise me you'll stay by my side, okay?"*

*She blushes, kisses both cheeks, then quietly flies away.*

💖 **Mizuki secretly rewarded you with +${bonus.toLocaleString()} XP!**${rollGuaranteeFooter}`

    );

}


// ======================
// 25k - 75k
// ======================

if(rolledXP >= 25000){

    const bonus =
    Math.floor(
        Math.random() * 40001
    ) + 10000;

    await database.addXP(
        message.guild.id,
        userID,
        bonus
    );

    await database.addBoostActivity(
        message.guild.id,
        userID,
        bonus
    );

    await quests.recordEvent(
        message,
        "earn_xp",
        bonus
    );

    await boosts.updateBoost(
        message.member
    );

await syncRollLevel(
    message,
    userID
);

    return message.channel.send(

`🌟 ${message.author} rolled **+${rolledXP.toLocaleString()} XP!**${rollExtras}

*Mizuki almost drops out of the sky from pure shock.*

*"N-No way..."*

*She circles around you several times, unable to stop smiling.*

*"I've never seen luck like this..."*

*She hugs you tightly, spins you around laughing, then kisses your forehead.*

💖 **Mizuki secretly rewarded you with +${bonus.toLocaleString()} XP!**${rollGuaranteeFooter}`

    );

}

// ======================
// Lucky Roll Bonus
// ======================

if(rolledXP >= 1000){

const bonus =
    Math.floor(
        Math.random() * 501
    ) + 500;

await database.addXP(

    message.guild.id,

    userID,

    bonus

);


await database.addBoostActivity(

    message.guild.id,

    userID,

    bonus

);


await quests.recordEvent(
    message,
    "earn_xp",
    bonus
);


await boosts.updateBoost(
    message.member
);

await syncRollLevel(
    message,
    userID
);

    return message.channel.send(

`🎲 ${message.author} rolled **+${rolledXP.toLocaleString()} XP!**${rollExtras}

*Mizuki's eyes widen for a second before a warm smile appears.*

*"Hehe~ You're stronger than I thought..."*

*She floats closer, gently pats your head before wrapping her arms around you in a quick hug.*

*"Don't stop now... I want to see how far you can go."*

💖 **Mizuki secretly rewarded you with +${bonus} XP!**${rollGuaranteeFooter}`

    );

}


// ======================
// Kiss
// ======================

if(rolledXP > 100){

const bonus =
    Math.floor(
        Math.random() * 451
    ) + 50;

await database.addXP(

    message.guild.id,

    userID,

    bonus

);

await database.addBoostActivity(

    message.guild.id,

    userID,

    bonus

);

await quests.recordEvent(
    message,
    "earn_xp",
    bonus
);

await boosts.updateBoost(
    message.member
);

await syncRollLevel(
    message,
    userID
);


return message.channel.send(

`🎲 ${message.author} rolled **+${rolledXP.toLocaleString()} XP!**${rollExtras}

*Mizuki keeps watching ${message.author} with a smile and a slight blush, then flies over and whispers quietly...*

*"Woow... you're my lucky boy/girl~..."*

*She gently kisses ${message.author}'s cheek before flying away.*

💖 The kiss gave you **+${bonus} XP** as a bonus!${rollGuaranteeFooter}`

);

}



// ======================
// UPDATE LEVEL
// ======================

await syncRollLevel(
    message,
    userID
);



// ======================
// Normal messages
// ======================

if(rolledXP >= 0){

    return message.channel.send(

`🎲 ${message.author} rolled **+${rolledXP.toLocaleString()} XP! Lucky! 🍀**${rollExtras}${rollGuaranteeFooter}`

    );

}


return message.channel.send(

`🎲 ${message.author} rolled **${rolledXP.toLocaleString()} XP!** Better luck next time... 💀${rollExtras}${rollGuaranteeFooter}`

);


}



module.exports = {

    execute,

    ROLL_COOLDOWN_MS,

    buildRollCooldownExtra,

    getDisplayedCooldownSeconds

};
