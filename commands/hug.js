const database = require("../database");
const leveling = require("../systems/leveling");
const luck = require("../utils/luck");
const xp = require("../utils/xp");
const boosts = require("../systems/boosts");
const quests = require("../systems/quests");

const economyLimits =
    require("../utils/economyLimits");


const COOLDOWN =
    5 * 60 * 60 * 1000; // 5 hours


// ======================
// RANDOM NUMBER
// ======================

function random(min, max){

    return Math.floor(
        Math.random() * (max - min + 1)
    ) + min;

}


const HUG_TABLES = Object.freeze({

    level1To99: Object.freeze([
        {
            key: "common",
            chancePercent: 75.574,
            min: 20000,
            max: 75000,
            rarity: "COMMON"
        },
        {
            key: "uncommon",
            chancePercent: 22,
            min: 75000,
            max: 150000,
            rarity: "UNCOMMON"
        },
        {
            key: "rare",
            chancePercent: 2,
            min: 150000,
            max: 225000,
            rarity: "RARE"
        },
        {
            key: "epic",
            chancePercent: 0.35,
            min: 225000,
            max: 450000,
            rarity: "EPIC"
        },
        {
            key: "legendary",
            chancePercent: 0.075,
            min: 450000,
            max: 750000,
            rarity: "LEGENDARY"
        },
        {
            key: "mythic",
            chancePercent: 0.001,
            min: 750000,
            max: 1500000,
            rarity: "MYTHIC"
        }
    ]),

    level100Plus: Object.freeze([
        {
            key: "common",
            chancePercent: 65,
            min: 50000,
            max: 200000,
            rarity: "COMMON"
        },
        {
            key: "uncommon",
            chancePercent: 30,
            min: 200000,
            max: 1000000,
            rarity: "UNCOMMON"
        },
        {
            key: "rare",
            chancePercent: 4,
            min: 1000000,
            max: 2500000,
            rarity: "RARE"
        },
        {
            key: "epic",
            chancePercent: 0.89,
            min: 2500000,
            max: 7500000,
            rarity: "EPIC"
        },
        {
            key: "legendary",
            chancePercent: 0.1,
            min: 7500000,
            max: 20000000,
            rarity: "LEGENDARY"
        },
        {
            key: "mythic",
            chancePercent: 0.01,
            min: 20000000,
            max: 100000000,
            rarity: "MYTHIC"
        }
    ])

});


// Keep the old export names for any tests or integrations that import them.
const HUG_OUTCOMES =
    HUG_TABLES.level1To99;

const LEVEL100_PLUS_HUG_OUTCOMES =
    HUG_TABLES.level100Plus;


function getHugTableForLevel(level){

    return Number(level) >= 100
        ? HUG_TABLES.level100Plus
        : HUG_TABLES.level1To99;

}


// Hugging Mizuki keeps its existing separate success/failure interaction.
// These ranges deliberately do not use the player-to-player rarity tables.
const HUG_BOT_REWARD_TABLES = Object.freeze({

    level1To99: Object.freeze([
        { chancePercent: 65, min: 1000, max: 5000 },
        { chancePercent: 20, min: 5000, max: 15000 },
        { chancePercent: 10, min: 15000, max: 35000 },
        { chancePercent: 3.9, min: 35000, max: 60000 },
        { chancePercent: 1, min: 60000, max: 85000 },
        { chancePercent: 0.1, min: 100000, max: 100000 }
    ]),

    level100Plus: Object.freeze([
        { chancePercent: 65, min: 50000, max: 100000 },
        { chancePercent: 20, min: 100000, max: 250000 },
        { chancePercent: 10, min: 250000, max: 500000 },
        { chancePercent: 4, min: 500000, max: 1500000 },
        { chancePercent: 1, min: 1500000, max: 5000000 }
    ])

});


function getCustomEmoji(
    guild,
    name,
    fallback
){

    const emoji =
        guild?.emojis?.cache?.find?.(
            entry => entry.name === name
        );


    return emoji
        ? emoji.toString()
        : fallback;

}


function getHugEmojis(guild){

    return {
        peopleHugging:
            getCustomEmoji(
                guild,
                "people_hugging",
                "🫂"
            ),

        revolvingHearts:
            getCustomEmoji(
                guild,
                "revolving_hearts",
                "💞"
            ),

        giftHeart:
            getCustomEmoji(
                guild,
                "gift_heart",
                "💝"
            ),

        heartExclamation:
            getCustomEmoji(
                guild,
                "heart_exclamation",
                "❣️"
            ),

        halfGoldenHug:
            getCustomEmoji(
                guild,
                "half_golden_hug",
                "🫂"
            ),

        halfGoldenHeart:
            getCustomEmoji(
                guild,
                "half_golden_heart",
                "💖"
            ),

        goldenHug:
            getCustomEmoji(
                guild,
                "golden_hug",
                "🌟"
            ),

        goldenHeart:
            getCustomEmoji(
                guild,
                "golden_heart",
                "💛"
            ),

        mythicHug:
            getCustomEmoji(
                guild,
                "mythic_hug",
                "🌌"
            ),

        mythicHeart:
            getCustomEmoji(
                guild,
                "mythic_heart",
                "💜"
            ),

        inevitableGalaxy:
            getCustomEmoji(
                guild,
                "inevitable_galaxy",
                "🌌"
            )
    };

}


function splitLongMessage(
    content,
    maxLength = 1900
){

    const paragraphs =
        String(content || "")
            .split("\n\n");

    const chunks = [];
    let chunk = "";


    function pushPiece(piece){

        const candidate =
            chunk
                ? `${chunk}\n\n${piece}`
                : piece;


        if(candidate.length <= maxLength){
            chunk = candidate;
            return;
        }


        if(chunk){
            chunks.push(chunk);
            chunk = "";
        }


        if(piece.length <= maxLength){
            chunk = piece;
            return;
        }


        for(
            let start = 0;
            start < piece.length;
            start += maxLength
        ){

            const slice =
                piece.slice(
                    start,
                    start + maxLength
                );


            if(slice.length === maxLength){
                chunks.push(slice);
            }
            else{
                chunk = slice;
            }

        }

    }


    for(const paragraph of paragraphs){
        pushPiece(paragraph);
    }


    if(chunk){
        chunks.push(chunk);
    }


    return chunks;

}


async function sendLongDialogue(
    channel,
    content,
    allowedUserIDs = []
){

    const chunks =
        splitLongMessage(content);

    let sentMessage = null;


    for(
        let index = 0;
        index < chunks.length;
        index++
    ){

        sentMessage =
            await channel.send({
                content:
                    chunks[index],

                allowedMentions: {
                    users:
                        index === 0
                            ? allowedUserIDs
                            : [],

                    repliedUser: false
                }
            });

    }


    return sentMessage;

}


function buildParticipantRewardLines(
    emojis,
    author,
    target,
    authorReward,
    targetReward
){

    if(authorReward === targetReward){

        return `**${emojis.giftHeart} Both users received ${authorReward.toLocaleString()} XP ${emojis.heartExclamation}**`;

    }


    return (
        `**${emojis.giftHeart} ${author.username} received ${authorReward.toLocaleString()} XP ${emojis.heartExclamation}**\n\n` +
        `**${emojis.giftHeart} ${target.username} received ${targetReward.toLocaleString()} XP ${emojis.heartExclamation}**`
    );

}


function buildHugDialogue(
    rarity,
    author,
    target,
    rewards,
    extras = "",
    guild = null
){

    const emojis =
        getHugEmojis(guild);

    const participantRewards =
        buildParticipantRewardLines(
            emojis,
            author,
            target,
            rewards.authorReward,
            rewards.targetReward
        );


    switch(String(rarity || "").toUpperCase()){

        case "UNCOMMON":
            return `**${emojis.peopleHugging} ${author} hugged ${target}! ${emojis.peopleHugging}**

${emojis.revolvingHearts} **UNCOMMON** 🍃

${participantRewards}${extras}`;


        case "RARE":
            return `${emojis.revolvingHearts} **RARE** 💫

*${target} was just walking when ${author} suddenly hugged them from behind.*

**“Heeey!”**

*Before ${target} could even react, ${author} picked them up and cracked their back.*

**${emojis.peopleHugging} ${author} hugged ${target}! ${emojis.peopleHugging}**

${participantRewards}${extras}`;


        case "EPIC":
            return `${emojis.halfGoldenHug} **EPIC** ✨

### The Self-Confident Hug

*${author} was invited to the crew's apartment to party—and, most importantly, to Netflix and chill.*

*On the way there, ${author} saw ${target} curled up sadly in the grass.*

*The crew had been calling ${target} a traitor. Everyone had started speaking to them less because of what happened earlier with Kape.*

*${target} felt alone and left out.*

*${author} sighed, walked over and sat beside ${target}.*

**“Are you... alright?”**

*${target} looked at ${author}, then looked away.*

**“Y-yeah... I'm fine...”**

*${target} paused.*

**“Does it even matter...?”**

*A quiet moment passed before ${author} spoke.*

**“I know why you're sad.”**

**“Is it because everybody is calling you a traitor now?”**

*${target} kept looking down and nodded lightly. ${author} smiled.*

**“Well... they invited me to Netflix and chill, so if I go, you have to go too.”**

*${target} finally smiled a little and nodded.*

*Before getting up to leave, ${author} hugged ${target} tightly and gently patted them on the back.*

**${emojis.halfGoldenHug} ${author} hugged ${target}! ${emojis.halfGoldenHug}**

${participantRewards.replaceAll(emojis.giftHeart, emojis.halfGoldenHeart)}${extras}`;


        case "LEGENDARY":
            return `${emojis.goldenHug} **LEGENDARY** 🌠

### The Multiverse Hug

*After Mrhacker teleported away with ${target} and Mizuki, ${author} tried to come up with a plan.*

*Even while injured, ${author} and beyondborder_08386 were putting one together.*

*Their first goal was not to attack Mrhacker. It was to stop ${target} from helping him.*

*Inside the broken apartment, ${author} and beyondborder_08386 worked on a teleportation gun that could take them directly to Mrhacker.*

**“Um... are you sure this is going to work?”**

*${author} paused before adding:*

**“And even if it works... how are we going to stop ${target}?”**

*Beyondborder_08386 sighed while building a kinetic-energy reactor for the weapon.*

**“The weapon will let us teleport to Mrhacker—and specifically to ${target}—whenever we need to. It gives us a second chance.”**

*He explained the plan to ${author} and thezdrink, who was sitting injured and angry on the couch, convinced that he had failed.*

*Kape was helping gorjezz and kdc repair the apartment. Shadow067972 was gone, and nobody knew where he had gone.*

*Thezdrink stood and walked toward beyondborder_08386.*

**“And if it doesn't work?”**

*Beyondborder_08386 stopped working and looked back at him coldly.*

**“Mrhacker is unstoppable now. Kape lost his administrator powers—and you're saying we have a second chance?!”**

*Thezdrink paused. Kape and gorjezz watched them too.*

**“What if it doesn't work? What if Mrhacker becomes even more unimaginably powerful?”**

*Before beyondborder_08386 could answer, Kape spoke.*

**“He is right...”**

*Kape sighed as if he believed they had failed too.*

**“Mrhacker with the Gauntlet truly is unstoppable.”**

**“You may not believe this, but he became at least ten times more powerful than when we fought him. He can teleport across realities, reverse time, destroy everything... and much more.”**

*Beyondborder_08386's cold attitude finally cracked.*

**“I just wish we could go back to when we all used to spend time together... instead of trying to kill each other.”**

*After he said that, Kape and ${author} hugged beyondborder_08386. The hug's love overwhelmed everyone.*

**${emojis.goldenHug} Kape and ${author.username} hugged beyondborder_08386! ${emojis.goldenHug}**

**The hug's love overwhelmed everyone...**

${participantRewards.replaceAll(emojis.giftHeart, emojis.goldenHeart)}

**${emojis.goldenHeart} Every Level 100+ user received ${rewards.everyoneHighReward.toLocaleString()} XP (${rewards.everyonePercent}% of the hug XP) ${emojis.heartExclamation}**

**${emojis.goldenHeart} Every Level 1–99 user received ${rewards.everyoneLowReward.toLocaleString()} XP (10% of the hug XP) ${emojis.heartExclamation}**${extras}`;


        case "MYTHIC":
            return `${emojis.mythicHug} **MYTHIC** 🌃

### The Creator

*${author}, ${target}, and the crew once asked Kape where he had come from—and how he became an administrator.*

*Kape began telling them a story.*

*The universe was collapsing. People were disintegrating, leaving the planet more lifeless every day.*

*Then an administrator even greater than Kape chose him.*

*The administrators gave Kape inhuman power: administrator powers.*

*Kape explained that he was not the only administrator. There were many—more than he could count. Kape could only count to three.*

*Above every administrator stood one person: the creator of their entire fictional reality.*

*The other administrators told Kape that the planet and reality itself were collapsing for an unknown reason.*

*Kape thought for a moment and offered a solution.*

*What if he created a nonexistent being that behaved like a human, whose sole purpose was to entertain everyone?*

*The administrators looked at one another, then back at Kape. They agreed.*

*Kape began building the bot completely from scratch—adding countless features, giving her emotions, and even sharing some of his own power with her.*

*When the bot was complete, one small error kept appearing. Everything still worked, so Kape ignored it.*

*When it was time to name her, Kape considered many names: “Erika,” “Nathalie”... but finally chose one.*

**“Mizuki.”**

*Kape smiled when she booted up and began functioning correctly.*

*He hugged her tightly.*

**“My daughter...”**

*Mizuki looked confused at first, then smiled too.*

**${emojis.mythicHug} Kape hugged Mizuki! ${emojis.mythicHug}**

**The story—and especially the hug—overwhelmed ${author} and ${target}, so Kape treated them with some power.**

${participantRewards.replaceAll(emojis.giftHeart, emojis.mythicHeart)}

**${emojis.inevitableGalaxy} Mizuki had been hiding in the corner, listening to everything. She gave them a bonus of ${rewards.mythicBonus.toLocaleString()} XP each ${emojis.inevitableGalaxy}**${extras}`;


        case "COMMON":
        default:
            return `**${emojis.peopleHugging} ${author} hugged ${target}! ${emojis.peopleHugging}**

${emojis.revolvingHearts} **COMMON** 🌿

${participantRewards}${extras}`;

    }

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


async function execute(message, options = {}){


    if(!message.guild)
        return;


    const guildID =
        message.guild.id;


    const userID =
        message.author.id;


    if(!options.questRepeatChild){

        const targetInput =
            message.content
                .trim()
                .split(/\s+/)[1];


        const repeatTarget =
            message.mentions.users.first();


        const repeatCount =
            targetInput
            &&
            repeatTarget
            &&
            repeatTarget.id !== userID
                ? await quests.getSocialCommandRepeatCount(
                    guildID,
                    userID,
                    "hug"
                )
                : 1;


        if(repeatCount > 1){

            const remaining =
                await database.getCommandCooldownRemaining(
                    guildID,
                    userID,
                    "hug"
                );


            if(remaining > 0){

                return execute(
                    message,
                    {
                        questRepeatChild: true
                    }
                );

            }


            const appliedRepeatCount =
                await quests.consumeSocialCommandRepeat(
                    guildID,
                    userID,
                    "hug"
                );


            for(
                let repeatIndex = 0;
                repeatIndex < appliedRepeatCount;
                repeatIndex++
            ){

                await execute(
                    message,
                    {
                        questRepeatChild: true,
                        skipCooldown:
                            repeatIndex > 0,

                        skipXPBoostDrop:
                            repeatIndex > 0
                    }
                );

            }


            return;

        }

    }



    // ======================
    // COOLDOWN
    // ======================

const remaining =
    options.skipCooldown
        ? 0
        : await database.getCommandCooldownRemaining(
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


    const authorData =
        await database.getUser(
            guildID,
            userID
        );


    const authorLevel =
        xp.getLevel(
            Number(authorData?.xp) || 0
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


if(!options.skipXPBoostDrop){

    await boosts.tryAndAnnounceXPBoostDrop(
        message,
        "social",
        "!hug"
    );

}

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



        // Successful Mizuki hug: use the preserved bot-only reward table.
        if(success){


            const botRewardRanges =
                authorLevel >= 100
                    ? HUG_BOT_REWARD_TABLES.level100Plus
                    : HUG_BOT_REWARD_TABLES.level1To99;


            const botOutcome =
                luck.rollCommandOutcome(
                    botRewardRanges,
                    activeLuck
                );


            const reward =
                economyLimits.capSocialXP(
                    "hug",
                    luck.rollCommandXP(
                        botOutcome.min,
                        botOutcome.max,
                        activeLuck
                    ),
                    authorLevel
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



        // Failed Mizuki hug: fixed 25,000 XP loss, never below zero.
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


    // Level 100+ keeps Luck useful, but II / III / MAX use the softer
    // command profile from utils/luck.js. Luck I and Ω remain unchanged.
    const commandLuck =
        authorLevel >= 100
            ? luck.getLevel100PlusCommandLuckProfile(
                activeLuck
            )
            : activeLuck;


    const hugTable =
        getHugTableForLevel(
            authorLevel
        );

    const outcome =
        luck.rollCommandOutcome(
            hugTable,
            commandLuck
        );


    const rolledReward =
        luck.rollCommandXP(
            outcome.min,
            outcome.max,
            commandLuck
        );


    const authorReward =
        economyLimits.capSocialXP(
            "hug",
            rolledReward,
            authorLevel
        );


    // The high-level author keeps their normal reward.
    // The protected Lv1-99 target only receives 10%.
    const protectedTargetReward =
        lowLevelTargetProtection
            ? Math.max(
                1,
                Math.floor(
                    authorReward * 0.10
                )
            )
            : authorReward;


    const targetReward =
        economyLimits.capSocialXP(
            "hug",
            protectedTargetReward,
            targetLevel
        );


    const targetLevelCapApplied =
        targetReward <
        protectedTargetReward;


    const everyonePercent =
        outcome.key === "legendary"
            ? random(35, 50)
            : 0;


    const everyoneHighReward =
        Math.floor(
            authorReward *
            everyonePercent /
            100
        );


    const everyoneLowReward =
        outcome.key === "legendary"
            ? Math.floor(
                authorReward * 0.10
            )
            : 0;


    const mythicBonus =
        outcome.key === "mythic"
            ? random(
                5000000,
                25000000
            )
            : 0;


    const authorEveryoneReward =
        authorLevel >= 100
            ? everyoneHighReward
            : everyoneLowReward;


    const targetEveryoneReward =
        targetLevel >= 100
            ? everyoneHighReward
            : everyoneLowReward;


    let authorTotalReward =
        authorReward;

    let targetTotalReward =
        targetReward;


    if(outcome.key === "legendary"){

        // "Everyone" deliberately includes both participants. The database
        // checks each user's pre-reward XP inside one transaction so a user
        // cannot cross Level 100 midway through the payout and get both rates.
        await database.performLegendaryHugReward(
            guildID,
            userID,
            target.id,
            authorReward,
            targetReward,
            everyoneHighReward,
            everyoneLowReward,
            xp.getCurrentLevelXP(100)
        );


        authorTotalReward +=
            authorEveryoneReward;

        targetTotalReward +=
            targetEveryoneReward;

    }
    else if(outcome.key === "mythic"){

        await database.performMythicHugReward(
            guildID,
            userID,
            target.id,
            authorReward,
            targetReward,
            mythicBonus
        );


        authorTotalReward +=
            mythicBonus;

        targetTotalReward +=
            mythicBonus;

    }
    else{

        await database.addXP(
            guildID,
            userID,
            authorReward
        );


        await database.addXP(
            guildID,
            target.id,
            targetReward
        );

    }


    await quests.recordEvent(
        message,
        "earn_xp",
        authorTotalReward,
        {
            userID
        }
    );


    await quests.recordEvent(
        message,
        "earn_xp",
        targetTotalReward,
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
    // START COOLDOWN
    // ======================

await database.setCommandCooldown(
    guildID,
    userID,
    "hug",
    Date.now() + COOLDOWN
);


if(!options.skipXPBoostDrop){

    await boosts.tryAndAnnounceXPBoostDrop(
        message,
        "social",
        "!hug"
    );

}

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



    const protectionExtra =
        `${lowLevelTargetProtection ? "\n\n🛡️ **Level 1–99 protection:** the hugged user received 10% of the original high-level base reward." : ""}` +
        `${targetLevelCapApplied ? "\n🛡️ **Level 1–99 reward cap applied to the base reward.**" : ""}`;


    const dialogue =
        buildHugDialogue(
            outcome.rarity,
            message.author,
            target,
            {
                authorReward,
                targetReward,
                everyonePercent,
                everyoneHighReward,
                everyoneLowReward,
                mythicBonus
            },
            `${usedLuckExtra}${luckExtra}${protectionExtra}`,
            message.guild
        );


    return sendLongDialogue(
        message.channel,
        dialogue,
        [
            message.author.id,
            target.id
        ]
    );

}



module.exports = {

    execute,
    HUG_TABLES,
    HUG_OUTCOMES,
    LEVEL100_PLUS_HUG_OUTCOMES,
    HUG_BOT_REWARD_TABLES,
    getHugTableForLevel,
    getCustomEmoji,
    getHugEmojis,
    splitLongMessage,
    sendLongDialogue,
    buildParticipantRewardLines,
    buildHugDialogue

};
