const database = require("../database");
const xp = require("../utils/xp");
const leveling =
    require("../systems/leveling");
const luck =
    require("../utils/luck");
const quests =
    require("../systems/quests");


// ==========================
// SETTINGS
// ==========================

// 20-minute cooldown
const COOLDOWN =
    20 * 60 * 1000;


const BOT_NAMES = [
    "bot",
    "mizuki"
];



// ==========================
// RANDOM NUMBER
// ==========================

function random(min, max){

    return Math.floor(
        Math.random() * (max - min + 1)
    ) + min;

}



// ==========================
// FORMAT TIME
// ==========================

function formatCooldown(milliseconds){

    const totalSeconds =
        Math.ceil(milliseconds / 1000);

    const minutes =
        Math.floor(totalSeconds / 60);

    const seconds =
        totalSeconds % 60;


    if(minutes <= 0){

        return `${seconds} seconds`;

    }


    if(seconds === 0){

        return `${minutes} minutes`;

    }


    return `${minutes}m ${seconds}s`;

}



// ==========================
// LEVEL SYNC
// ==========================

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


// ==========================
// EXECUTE COMMAND
// ==========================

async function execute(message){


    if(!message.guild){

        return;

    }


    const guildID =
        message.guild.id;

    const userID =
        message.author.id;



    // ==========================
    // COOLDOWN CHECK
    // ==========================

const remaining =
    await database.getCommandCooldownRemaining(
        guildID,
        userID,
        "steal"
    );


if(remaining > 0){

    return message.reply(

        `⏳ You can use **!steal** again in **${formatCooldown(remaining)}**.`

    );

}



    // ==========================
    // TARGET INPUT
    // ==========================

    const args =
        message.content
            .trim()
            .split(/\s+/);

    const targetInput =
        args[1];


    if(!targetInput){

        return message.reply(

            "💰 Usage: `!steal @user`, `!steal userID`, or `!steal bot`"

        );

    }



    const activeLuck =
        await luck.getActiveLuckBoost(
            message.member
        );


    const usedLuckExtra =
        luck.buildUsedCommandLuckExtra(
            activeLuck
        );


    // ==========================
    // STEAL FROM BOT
    // ==========================

    if(
        BOT_NAMES.includes(
            targetInput.toLowerCase()
        )
    ){

await database.setCommandCooldown(
    guildID,
    userID,
    "steal",
    Date.now() + COOLDOWN
);

const wonLuckBoost =
    await luck.tryCommandLuckBoostDrop(
        message.member,
        "steal"
    );


const luckExtra =
    luck.buildCommandLuckExtra(
        message.author,
        wonLuckBoost,
        "steal"
    );


        const success =
            Math.random() <
            luck.getCommandSuccessChance(
                0.75,
                activeLuck
            );


        if(success){

            const reward =
                luck.rollCommandXP(
                    100,
                    2000,
                    activeLuck
                );


            await database.giveXP(
                guildID,
                userID,
                reward
            );


            await quests.recordEvent(
                message,
                "steal_xp",
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

`💰 **${message.author} tried stealing from Mizuki...**

*Mizuki notices ${message.author} reaching toward her XP bag.*

*"Hmm...? What are you doing over there~?"*

*Before Mizuki can fully turn around, ${message.author} grabs some XP and runs away.*

💰 **${message.author.username} successfully stole ${reward.toLocaleString()} XP from Mizuki!**${usedLuckExtra}${luckExtra}`

            );

        }


        // 25% failure
        return message.channel.send(

`🚨 **${message.author} tried stealing from Mizuki...**

*Mizuki immediately grabs ${message.author}'s wrist before they can reach her XP.*

*"Did you seriously think I wouldn't notice~?"*

*She smiles while taking her XP bag back.*

❌ **The robbery failed! No XP was stolen.**${usedLuckExtra}${luckExtra}`

        );

    }



    // ==========================
    // FIND TARGET
    // ==========================

    let target =
        message.mentions.users.first();



    // User ID
    if(
        !target &&
        /^\d+$/.test(targetInput)
    ){

        try{

            target =
                await message.client.users.fetch(
                    targetInput
                );

        }
        catch{

            return message.reply(
                "❌ User not found."
            );

        }

    }



    if(!target){

        return message.reply(
            "❌ I couldn't find that user."
        );

    }



    // ==========================
    // TARGET VALIDATION
    // ==========================

    if(target.id === userID){

        return message.reply(
            "💀 You cannot steal from yourself."
        );

    }


    if(target.bot){

        return message.reply(

            "🤖 To steal from Mizuki, use `!steal bot`."

        );

    }



    // ==========================
    // GET USERS
    // ==========================

    const thief =
        await database.getUser(
            guildID,
            userID
        );


    const victim =
        await database.getUser(
            guildID,
            target.id
        );


    if(!thief || !victim){

        return message.reply(

            "❌ I couldn't load one of the users from the database."

        );

    }



    const thiefXP =
        Math.max(
            0,
            Number(thief.xp) || 0
        );


    const thiefLevel =
        xp.getLevel(thiefXP);


    const victimXP =
        Math.max(
            0,
            Number(victim.xp) || 0
        );


    const victimLevel =
        xp.getLevel(victimXP);


    const isLevel100Plus =
        victimLevel >= 100;


    // Luck belongs to the thief, so the Level 100+ command
    // nerf is based on the thief's level, not the victim's.
    const commandLuck =
        thiefLevel >= 100
            ? luck.getLevel100PlusCommandLuckProfile(
                activeLuck
            )
            : activeLuck;



    if(victimXP <= 0){

        return message.reply(

            `💀 ${target} doesn't have any XP for you to steal.`

        );

    }



await database.setCommandCooldown(
    guildID,
    userID,
    "steal",
    Date.now() + COOLDOWN
);

const wonLuckBoost =
    await luck.tryCommandLuckBoostDrop(
        message.member,
        "steal"
    );


const luckExtra =
    luck.buildCommandLuckExtra(
        message.author,
        wonLuckBoost,
        "steal"
    );


    // ==========================
    // STEAL CHANCES + ACTIVE LUCK
    // ==========================

    const stealOutcomes =
        isLevel100Plus
            ? [
                {
                    key: "failure",
                    chancePercent: 13.35
                },
                {
                    key: "common",
                    chancePercent: 75,
                    min: 100,
                    max: 2000,
                    rarity: "COMMON"
                },
                {
                    key: "rare",
                    chancePercent: 10,
                    min: 2000,
                    max: 15000,
                    rarity: "RARE"
                },
                {
                    key: "epic",
                    chancePercent: 1,
                    min: 15000,
                    max: 50000,
                    rarity: "EPIC"
                },
                {
                    key: "legendary",
                    chancePercent: 0.5,
                    min: 50000,
                    max: 100000,
                    rarity: "LEGENDARY"
                },
                {
                    key: "mythic",
                    chancePercent: 0.1,
                    min: 100000,
                    max: 500000,
                    rarity: "MYTHIC"
                },
                {
                    key: "mythic_high",
                    chancePercent: 0.05,
                    min: 500000,
                    max: 3000000,
                    rarity: "MYTHIC"
                }
            ]
            : [
                {
                    key: "failure",
                    chancePercent: 13.5
                },
                {
                    key: "common",
                    chancePercent: 75,
                    min: 100,
                    max: 2000,
                    rarity: "COMMON"
                },
                {
                    key: "rare",
                    chancePercent: 10,
                    min: 2000,
                    max: 15000,
                    rarity: "RARE"
                },
                {
                    key: "epic",
                    chancePercent: 1,
                    min: 15000,
                    max: 50000,
                    rarity: "EPIC"
                },
                {
                    key: "legendary",
                    chancePercent: 0.5,
                    min: 50000,
                    max: 100000,
                    rarity: "LEGENDARY"
                }
            ];


    const stealOutcome =
        luck.rollCommandOutcome(
            stealOutcomes,
            commandLuck
        );


    if(stealOutcome.key === "failure"){

        return message.channel.send(

`🚨 **${message.author} tried stealing from ${target}!**

*${message.author} slowly reaches toward ${target}'s XP bag...*

*Unfortunately, ${target} turns around at the worst possible moment.*

*"What do you think you're doing?"*

*${message.author} immediately runs away before things get worse.*

❌ **The robbery failed! No XP was stolen.**${usedLuckExtra}${luckExtra}`

        );

    }


    const attemptedAmount =
        luck.rollCommandXP(
            stealOutcome.min,
            stealOutcome.max,
            commandLuck
        );


    const rarity =
        stealOutcome.rarity;


    // ==========================
    // CAP STEAL AT VICTIM'S XP
    // ==========================

    const stolenXP =
        Math.min(
            attemptedAmount,
            victimXP
        );


    if(stolenXP <= 0){

        return message.channel.send(

            `💀 ${target} didn't have enough XP to steal.${usedLuckExtra}${luckExtra}`

        );

    }



    // ==========================
    // TRANSFER XP
    // ==========================

    const victimNewXP =
        Math.max(
            0,
            victimXP - stolenXP
        );


    await database.setXP(
        guildID,
        target.id,
        victimNewXP
    );


    await database.giveXP(
        guildID,
        userID,
        stolenXP
    );


    await quests.recordEvent(
        message,
        "steal_xp",
        stolenXP
    );


    await quests.recordEvent(
        message,
        "earn_xp",
        stolenXP
    );


    await quests.recordEvent(
        message,
        "get_stolen",
        1,
        {
            userID: target.id
        }
    );

// ==========================
// UPDATE LEVELS
// ==========================

// Victim may lose a level.
// Their stored level will be corrected,
// but no level-up message will be sent.
await syncAndTrackLevel(
    message,
    target.id
);


// Thief may level up from the stolen XP.
await syncAndTrackLevel(
    message,
    userID
);




    // ==========================
    // COMMON DIALOGUE
    // ==========================

    if(rarity === "COMMON"){

        return message.channel.send(

`💰 **${message.author} STOLE FROM ${target}!** 💰

💸 **${message.author.username} stole ${stolenXP.toLocaleString()} XP from ${target.username}!**${usedLuckExtra}${luckExtra}`

        );

    }



    // ==========================
    // RARE DIALOGUE
    // ==========================

    if(rarity === "RARE"){

        return message.channel.send(

`🤫 **A SNEAKY ROBBERY...** 🤫

*${message.author} secretly followed ${target}.*

*When ${target} turned into a dark corner, ${message.author} finally got to work.*

*${message.author} quickly grabbed ${target}'s bag and started running away while ${target} chased after them, screaming with anger.*

💸 **${message.author.username} stole ${stolenXP.toLocaleString()} XP from ${target.username}!**${usedLuckExtra}${luckExtra}`

        );

    }



    // ==========================
    // EPIC DIALOGUE
    // ==========================

    if(rarity === "EPIC"){

        return message.channel.send(

`👀👥 **MIZUKI'S DISTRACTION** 👥👀

*${message.author} begged Mizuki to help steal from ${target}, and Mizuki agreed because she thought it would be fun.*

*Mizuki walked up to ${target}, intentionally trying to grab their attention while saying some random ahh words.*

*${target} started getting suspicious.*

*Meanwhile, ${message.author} quietly walked behind ${target}. ${target} noticed, but Mizuki raised her hand and stopped them from moving.*

*${message.author} laughed, grabbed as much XP as possible and ran away before the Ohio final boss Kape could notice.*

*Mizuki quickly flew away like nothing had happened.*

💸 **${message.author.username} stole ${stolenXP.toLocaleString()} XP from ${target.username}!**${usedLuckExtra}${luckExtra}`

        );

    }



    // ==========================
    // LEGENDARY DIALOGUE
    // ==========================

    if(rarity === "LEGENDARY"){

        return message.channel.send(

`🎆👤 **THE FINAL BOSS ROBBERY** 👤🎆

*${message.author} saw that ${target} had befriended Mizuki, making it almost impossible to steal from them without Kape's help.*

*${message.author} managed to find Kape staring at a white wall and imagining a TV was there. Kape agreed to help.*

*${message.author} walked up to ${target}, but Mizuki immediately stopped them with her powers.*

*"No, no, no~..." Mizuki said with a slight frown.*

*"You're NOT stealing from ${target.username}—"*

*Kape suddenly appeared behind ${message.author}, floating in the air with a serious expression.*

*"No, no, no, no... I say when we're done."*

*Mizuki felt the final-boss aura and released ${message.author}. She slowly looked back at ${target}, then flew away without hesitation.*

*Kape used his Thanos gauntlet to pull gravity itself, dragging ${target} toward him and holding them in his giant gauntlet hand.*

💸 **Kape and ${message.author.username} successfully stole ${stolenXP.toLocaleString()} XP from ${target.username}!**${usedLuckExtra}${luckExtra}`

        );

    }



    // ==========================
    // MYTHIC DIALOGUE
    // ==========================

    return message.channel.send(

`🌌💎 **MRHACKER'S INEVITABLE PLAN** 💎🌌

*Mrnoob had a universal plan.*

*He had evolved from being a noob into MRHACKER. His power was now equal to Kape's—maybe even greater.*

*MRHACKER believed everybody in the universe had far too much XP. He wanted to eradicate half of it.*

*He believed he was inevitable.*

*One day, MRHACKER approached ${message.author} and promised them a massive reward. ${message.author} agreed to help.*

*Their mission was simple: steal Kape's Infinity Gauntlet.*

*Kape was getting ready to sleep. He removed the gauntlet, placed it beside his bed and slowly fell asleep.*

*${message.author} quietly entered the room, crept toward the gauntlet and carefully took it without waking Kape.*

*${message.author} returned to MRHACKER and handed him the Infinity Gauntlet.*

*MRHACKER smiled and put it on. The Infinity Stones immediately began fusing with his body.*

*He released a powerful sigh, then patted ${message.author} on the head.*

*"Good boy..."*

*Without wasting another second, MRHACKER flew into the sky, raised his arm and activated every Infinity Stone.*

*Before he could snap his fingers, Kape flew toward him at an insane speed.*

*"COME AT MEEEE!" MRHACKER screamed.*

*MRHACKER blocked Kape's punch and attempted to kick him in the head. Kape dodged by lowering his body in midair and struck MRHACKER in the side.*

*MRHACKER crashed into the ground, creating an enormous explosion.*

*Using the Infinity Gauntlet, MRHACKER absorbed the flames and launched them back at Kape.*

*Kape blocked the attack, flew through the flames and attempted to punch MRHACKER in the face.*

*MRHACKER dodged and counterattacked with the Power Stone, punching Kape directly in the stomach.*

*Kape spat out blood and crashed through several buildings.*

*MRHACKER finally had his opportunity.*

*He raised the Infinity Gauntlet...*

*...and snapped his fingers.*

*MRHACKER did it.*

💸 **${message.author.username} stole ${stolenXP.toLocaleString()} XP from ${target.username}!**

✨ **The robbery was inevitable.**${usedLuckExtra}${luckExtra}`

    );

}



module.exports = {

    execute

};
