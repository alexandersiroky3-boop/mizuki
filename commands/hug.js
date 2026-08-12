const database = require("../database");
const leveling = require("../systems/leveling");
const luck = require("../utils/luck");
const xp = require("../utils/xp");
const boosts = require("../systems/boosts");
const quests = require("../systems/quests");


const COOLDOWN =
    5 * 60 * 60 * 1000; // 5 hours


const MAX_BOOST_DURATION =
    60 * 60 * 1000; // 1 hour


const MAX_BOOST_ROLE =
    "1526995218098815016";



// ======================
// RANDOM NUMBER
// ======================

function random(min, max){

    return Math.floor(
        Math.random() * (max - min + 1)
    ) + min;

}


const HUG_OUTCOMES = [
    {
        key: "common",
        chancePercent: 65,
        min: 15000,
        max: 30000,
        rarity: "💞 COMMON"
    },
    {
        key: "rare",
        chancePercent: 20,
        min: 30000,
        max: 75000,
        rarity: "💖 RARE"
    },
    {
        key: "epic",
        chancePercent: 10,
        min: 75000,
        max: 250000,
        rarity: "🌇 EPIC"
    },
    {
        key: "legendary",
        chancePercent: 3.9,
        min: 250000,
        max: 750000,
        rarity: "🪄 LEGENDARY"
    },
    {
        key: "mythic",
        chancePercent: 1,
        min: 750000,
        max: 3000000,
        rarity: "🌌 MYTHIC"
    },
    {
        key: "divine",
        chancePercent: 0.1,
        min: 10000000,
        max: 10000000,
        rarity: "✨ DIVINE"
    }
];


// Level 100+ base rates are intentionally much stronger than !kiss.
// !hug has a 5-hour cooldown while !kiss has a 15-minute cooldown,
// so every Hug use must have meaningfully better high-rarity odds.
const LEVEL100_PLUS_HUG_OUTCOMES = [
    { key: "common", chancePercent: 20, min: 15000, max: 30000, rarity: "💞 COMMON" },
    { key: "rare", chancePercent: 35, min: 30000, max: 75000, rarity: "💖 RARE" },
    { key: "epic", chancePercent: 27, min: 75000, max: 250000, rarity: "🌇 EPIC" },
    { key: "legendary", chancePercent: 13, min: 250000, max: 750000, rarity: "🪄 LEGENDARY" },
    { key: "mythic", chancePercent: 4, min: 750000, max: 3000000, rarity: "🌌 MYTHIC" },
    { key: "divine", chancePercent: 1, min: 10000000, max: 10000000, rarity: "✨ DIVINE" }
];


// Exact final percentages prevent the generic rarity multiplier from making
// a weaker boost outperform a stronger one. Luck Omega is deliberately not
// listed here, so it keeps the normal uncapped/OP weighting behavior.
const LEVEL100_PLUS_HUG_LUCK_TABLES = {
    tier1: [
        { key: "common", chancePercent: 15 },
        { key: "rare", chancePercent: 32 },
        { key: "epic", chancePercent: 31 },
        { key: "legendary", chancePercent: 16 },
        { key: "mythic", chancePercent: 5 },
        { key: "divine", chancePercent: 1 }
    ],
    tier2: [
        { key: "common", chancePercent: 10 },
        { key: "rare", chancePercent: 30 },
        { key: "epic", chancePercent: 34.8 },
        { key: "legendary", chancePercent: 19 },
        { key: "mythic", chancePercent: 5 },
        { key: "divine", chancePercent: 1.2 }
    ],
    tier3: [
        { key: "common", chancePercent: 5 },
        { key: "rare", chancePercent: 20 },
        { key: "epic", chancePercent: 35 },
        { key: "legendary", chancePercent: 27 },
        { key: "mythic", chancePercent: 11 },
        { key: "divine", chancePercent: 2 }
    ],
    max: [
        { key: "common", chancePercent: 2 },
        { key: "rare", chancePercent: 8 },
        { key: "epic", chancePercent: 30 },
        { key: "legendary", chancePercent: 35 },
        { key: "mythic", chancePercent: 20 },
        { key: "divine", chancePercent: 5 }
    ]
};


function rollExactOutcome(baseTable, chanceTable){
    let roll = Math.random() * 100;
    for(const entry of chanceTable){
        roll -= entry.chancePercent;
        if(roll < 0){
            return baseTable.find(outcome => outcome.key === entry.key) || baseTable[0];
        }
    }
    return baseTable[0];
}



// ======================
// GIVE MAX BOOST
// ======================

async function giveMaxBoost(
    message,
    userID
){

    const member =
        await message.guild.members.fetch(
            userID
        );


    return boosts.awardXPBoost(
        member,
        "max",
        "DIVINE !hug"
    );

}



// ======================
// EXECUTE
// ======================

async function syncAndTrackLevel(
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


async function execute(message){


    if(!message.guild)
        return;


    const guildID =
        message.guild.id;


    const userID =
        message.author.id;



    // ======================
    // COOLDOWN
    // ======================

const remaining =
    await database.getCommandCooldownRemaining(
        guildID,
        userID,
        "hug"
    );


if(remaining > 0){


    const hours =
        Math.floor(
            remaining / 3600000
        );


    const minutes =
        Math.ceil(
            (
                remaining %
                3600000
            ) / 60000
        );


    return message.reply(

        `💞 You need to wait **${hours}h ${minutes}m** before hugging again!`

    );


}



    // ======================
    // TARGET
    // ======================

    const target =
        message.mentions.users.first();



    if(!target){

        return message.reply(
            "💞 You need to hug someone!"
        );

    }



    if(target.id === userID){

        return message.reply(
            "💞 You can't hug yourself!"
        );

    }


    await quests.recordEvent(
        message,
        "hug_given",
        1
    );


    const activeLuck =
        await luck.getActiveLuckBoost(
            message.member
        );


    const usedLuckExtra =
        luck.buildUsedCommandLuckExtra(
            activeLuck
        );


    // ======================
    // HUG BOT
    // ======================

    if(target.bot){


await database.setCommandCooldown(
    guildID,
    userID,
    "hug",
    Date.now() + COOLDOWN
);

const wonLuckBoost =
    await luck.tryCommandLuckBoostDrop(
        message.member,
        "hug"
    );


const luckExtra =
    luck.buildCommandLuckExtra(
        message.author,
        wonLuckBoost,
        "hug"
    );


        const success =
            Math.random() <
            luck.getCommandSuccessChance(
                0.5,
                activeLuck
            );



        // 50% chance:
        // Guaranteed +50,000 XP
        if(success){


            const botRewardRanges = [
                { chancePercent: 65, min: 50000, max: 100000 },
                { chancePercent: 20, min: 100000, max: 250000 },
                { chancePercent: 10, min: 250000, max: 500000 },
                { chancePercent: 4, min: 500000, max: 1500000 },
                { chancePercent: 1, min: 1500000, max: 5000000 }
            ];


            const botOutcome =
                luck.rollCommandOutcome(
                    botRewardRanges,
                    activeLuck
                );


            const reward =
                luck.rollCommandXP(
                    botOutcome.min,
                    botOutcome.max,
                    activeLuck
                );


            await database.addXP(
                guildID,
                userID,
                reward
            );


            await quests.recordEvent(
                message,
                "earn_xp",
                reward
            );


await syncAndTrackLevel(
    message,
    userID
);


            return message.channel.send(

`*Mizuki was just hovering above the ground, looking at her cute members, but suddenly ${message.author} ran up to her and wrapped their arms around her, hugging her tightly... Mizuki immediately blushed and smiled.*

**"T-Thank you... ${message.author}."**

💖 ${message.author} earned **${reward.toLocaleString()} XP!**${usedLuckExtra}${luckExtra}`

            );

        }



        // 50% chance:
        // Guaranteed -25,000 XP
        const loss =
            25000;


        const user =
            await database.getUser(
                guildID,
                userID
            );


        const currentXP =
            Math.max(
                0,
                Number(user.xp) || 0
            );


        const newXP =
            Math.max(
                0,
                currentXP - loss
            );


        const actualLoss =
            currentXP - newXP;


        await database.setXP(
            guildID,
            userID,
            newXP
        );


await syncAndTrackLevel(
    message,
    userID
);


        return message.channel.send(

`*${message.author} suddenly ran toward Mizuki and tried to hug her, but Mizuki quickly moved out of the way.*

*${message.author} fell face-first onto the ground while Mizuki stared down at them.*

**"You could've at least warned me first..."**

💔 ${message.author} lost **${actualLoss.toLocaleString()} XP!**${usedLuckExtra}${luckExtra}`

        );

    }



    // ======================
    // NORMAL USER HUG
    // ======================

    const authorData =
        await database.getUser(
            guildID,
            userID
        );


    const authorLevel =
        xp.getLevel(
            Number(authorData?.xp) || 0
        );


    const targetData =
        await database.getUser(
            guildID,
            target.id
        );


    const targetLevel =
        xp.getLevel(
            Number(targetData?.xp) || 0
        );


    const lowLevelTargetProtection =
        authorLevel >= 100
        &&
        targetLevel < 100;


    // Level 100+ uses softened XP-range bias for Luck II / III / MAX.
    // Rarity odds for I / II / III / MAX are exact tables above;
    // Luck Ω intentionally continues through the uncapped weighting system.
    const commandLuck =
        authorLevel >= 100
            ? luck.getLevel100PlusCommandLuckProfile(
                activeLuck
            )
            : activeLuck;


    const hugTable =
        authorLevel >= 100
            ? LEVEL100_PLUS_HUG_OUTCOMES
            : HUG_OUTCOMES;

    const exactHugLuckTable =
        authorLevel >= 100
            ? LEVEL100_PLUS_HUG_LUCK_TABLES[String(activeLuck?.tier || "").toLowerCase()]
            : null;

    const outcome =
        exactHugLuckTable
            ? rollExactOutcome(hugTable, exactHugLuckTable)
            : luck.rollCommandOutcome(hugTable, commandLuck);


    const reward =
        luck.rollCommandXP(
            outcome.min,
            outcome.max,
            commandLuck
        );


    const rarity =
        outcome.rarity;


    // The high-level author keeps their normal reward.
    // The protected Lv1-99 target only receives 10%.
    const targetReward =
        lowLevelTargetProtection
            ? Math.max(
                1,
                Math.floor(
                    reward * 0.10
                )
            )
            : reward;


    const rewardSummary =
        lowLevelTargetProtection
            ? `💞 ${message.author} received **${reward.toLocaleString()} XP!**\n` +
              `🛡️ ${target} received **${targetReward.toLocaleString()} XP** after **90% Lv1-99 protection**.`
            : `💞 Both users received **${reward.toLocaleString()} XP!**`;


    let text;


    if(outcome.key === "common"){

        text =
`🫂 **${message.author} hugged ${target}!** 🫂`;

    }
    else if(outcome.key === "rare"){

        text =
`🫂💖 **A HEARTFELT HUG** 💖🫂

*${message.author} ran up to ${target} and pulled them into a tight hug.*

*Beautiful particles slowly began appearing around them, glowing brighter as the hug continued.*`;

    }
    else if(outcome.key === "epic"){

        text =
`🌇🫂 **THE SURPRISE HUG** 🫂🌇

*${message.author} quietly walked up behind ${target} without making a sound.*

*Before ${target} could turn around, ${message.author} wrapped both arms around them from behind and lifted them slightly into the air.*

*${target} was completely caught off guard, but eventually relaxed into the hug.*`;

    }
    else if(outcome.key === "legendary"){

        text =
`🪄💫 **THE BACK-BREAKING GROUP HUG** 💫🪄

*${message.author} immediately lifted ${target} into the air and hugged them really, really tightly.*

*Mizuki saw what was happening and excitedly flew toward them.*

*"Wait for me! I want to join too~!"*

*Mizuki wrapped her arms around both of them, turning it into a chaotic group hug.*`;

    }
    else if(outcome.key === "mythic"){

        text =
`🌌🌠 **A HUG BEYOND THE UNIVERSE** 🌠🌌

*${message.author} slowly approached ${target} as stars appeared in the middle of the day.*

*The moment they hugged, a massive purple galaxy formed around both of them.*

*Mizuki stared upward in disbelief.*

*"That isn't just a hug... their energy is connecting across the entire universe..."*`;

    }
    else{

        text =
`✨💞 **THE PERFECT HUG** 💞✨

*The entire universe suddenly stopped.*

*The moment ${message.author} and ${target} hugged, an endless wave of energy erupted across every universe.*

*Mizuki covered her eyes as countless glowing hearts, stars and galaxies filled reality.*

🌠 **The universe has acknowledged their bond.**`;

    }


    // ======================
    // GIVE XP TO BOTH USERS
    // ======================

    await database.addXP(
        guildID,
        userID,
        reward
    );


    await database.addXP(
        guildID,
        target.id,
        targetReward
    );


    await quests.recordEvent(
        message,
        "earn_xp",
        reward,
        {
            userID
        }
    );


    await quests.recordEvent(
        message,
        "earn_xp",
        targetReward,
        {
            userID: target.id
        }
    );


    // ======================
    // UPDATE LEVELS
    // ======================

await syncAndTrackLevel(
    message,
    userID
);


await syncAndTrackLevel(
    message,
    target.id
);



    // ======================
    // DIVINE MAX BOOST
    // ======================

    let authorMaxBoost =
        null;


    let targetMaxBoost =
        null;


    if(rarity === "✨ DIVINE"){


        authorMaxBoost =
            await giveMaxBoost(
                message,
                userID
            );


        targetMaxBoost =
            await giveMaxBoost(
                message,
                target.id
            );

    }



    // ======================
    // START COOLDOWN
    // ======================

await database.setCommandCooldown(
    guildID,
    userID,
    "hug",
    Date.now() + COOLDOWN
);

const wonLuckBoost =
    await luck.tryCommandLuckBoostDrop(
        message.member,
        "hug"
    );


const luckExtra =
    luck.buildCommandLuckExtra(
        message.author,
        wonLuckBoost,
        "hug"
    );



    // ======================
    // RESPONSE
    // ======================

    if(rarity === "✨ DIVINE"){

        return message.channel.send(

`${text}

${rarity}

${rewardSummary}

💎 ${message.author} stored <@&${MAX_BOOST_ROLE}>! Inventory: **x${authorMaxBoost.amount}**

💎 ${target} stored <@&${MAX_BOOST_ROLE}>! Inventory: **x${targetMaxBoost.amount}**${usedLuckExtra}${luckExtra}`

        );

    }


    return message.channel.send(

`${text}

${rarity}

${rewardSummary}${usedLuckExtra}${luckExtra}`

    );

}



module.exports = {

    execute

};
