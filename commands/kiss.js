const database = require("../database");
const leveling =
    require("../systems/leveling");
const luck =
    require("../utils/luck");
const xp =
    require("../utils/xp");
const quests =
    require("../systems/quests");

const boosts =
    require("../systems/boosts");

const trolls =
    require("../systems/trolls");

const economyLimits =
    require("../utils/economyLimits");


// 15-minute cooldown
const COOLDOWN =
    15 * 60 * 1000;



const BOT_NAME =
    "bot";



function random(min, max){

    return Math.floor(
        Math.random() * (max - min + 1)
    ) + min;

}


const KISS_TABLES = Object.freeze({

    level1To99: Object.freeze([
        {
            key: "common",
            chancePercent: 75,
            min: 2000,
            max: 10000,
            rarity: "COMMON"
        },
        {
            key: "uncommon",
            chancePercent: 22,
            min: 10000,
            max: 25000,
            rarity: "UNCOMMON"
        },
        {
            key: "rare",
            chancePercent: 2.2,
            min: 25000,
            max: 75000,
            rarity: "RARE"
        },
        {
            key: "epic",
            chancePercent: 0.75,
            min: 75000,
            max: 150000,
            rarity: "EPIC"
        },
        {
            key: "legendary",
            chancePercent: 0.049,
            min: 150000,
            max: 300000,
            rarity: "LEGENDARY"
        },
        {
            key: "mythic",
            chancePercent: 0.001,
            min: 300000,
            max: 1000000,
            rarity: "MYTHIC"
        }
    ]),

    level100Plus: Object.freeze([
        {
            key: "common",
            chancePercent: 70,
            min: 15000,
            max: 75000,
            rarity: "COMMON"
        },
        {
            key: "uncommon",
            chancePercent: 25,
            min: 75000,
            max: 200000,
            rarity: "UNCOMMON"
        },
        {
            key: "rare",
            chancePercent: 4,
            min: 200000,
            max: 750000,
            rarity: "RARE"
        },
        {
            key: "epic",
            chancePercent: 0.89,
            min: 750000,
            max: 3000000,
            rarity: "EPIC"
        },
        {
            key: "legendary",
            chancePercent: 0.1,
            min: 3000000,
            max: 12500000,
            rarity: "LEGENDARY"
        },
        {
            key: "mythic",
            chancePercent: 0.01,
            min: 12500000,
            max: 75000000,
            rarity: "MYTHIC"
        }
    ])

});


function getKissTableForLevel(level){

    return Number(level) >= 100
        ? KISS_TABLES.level100Plus
        : KISS_TABLES.level1To99;

}


const KISS_BOT_RANGES =
    Object.freeze({

        level1To99: {
            reward: {
                min: 1000,
                max: 3000
            },
            loss: {
                min: 500,
                max: 2500
            }
        },

        level100Plus: {
            reward: {
                min: 25000,
                max: 75000
            },
            loss: {
                min: 10000,
                max: 30000
            }
        }

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


function getKissEmojis(guild){

    return {
        heartpulse:
            getCustomEmoji(
                guild,
                "heartpulse",
                "💗"
            ),

        kiss:
            getCustomEmoji(
                guild,
                "kiss",
                "💋"
            ),

        heartExclamation:
            getCustomEmoji(
                guild,
                "heart_exclamation",
                "❣️"
            ),

        twoHearts:
            getCustomEmoji(
                guild,
                "two_hearts",
                "💕"
            ),

        halfGoldenHeart:
            getCustomEmoji(
                guild,
                "half_golden_heart",
                "💖"
            ),

        cupid:
            getCustomEmoji(
                guild,
                "cupid",
                "💘"
            ),

        revolvingHearts:
            getCustomEmoji(
                guild,
                "revolving_hearts",
                "💞"
            ),

        goldenHeart:
            getCustomEmoji(
                guild,
                "golden_heart",
                "💛"
            ),

        mythicHeart:
            getCustomEmoji(
                guild,
                "mythic_heart",
                "💜"
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


    for(const paragraph of paragraphs){

        const candidate =
            chunk
                ? `${chunk}\n\n${paragraph}`
                : paragraph;


        if(
            candidate.length > maxLength
            &&
            chunk
        ){

            chunks.push(chunk);
            chunk = paragraph;

        }
        else{

            chunk = candidate;

        }

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


function calculateKissRewards(
    targetReward,
    discountPercent = random(10, 20)
){

    const safeTargetReward =
        Math.max(
            0,
            Math.floor(
                Number(targetReward) || 0
            )
        );

    const safeDiscountPercent =
        Math.max(
            10,
            Math.min(
                20,
                Math.floor(
                    Number(discountPercent) || 10
                )
            )
        );


    return {
        targetReward:
            safeTargetReward,

        kisserReward:
            Math.floor(
                safeTargetReward *
                (100 - safeDiscountPercent) /
                100
            ),

        discountPercent:
            safeDiscountPercent,

        everyoneReward:
            Math.floor(
                safeTargetReward * 0.20
            )
    };

}


function buildKissDialogue(
    rarity,
    author,
    target,
    rewards,
    extras = "",
    guild = null
){

    const emojis =
        getKissEmojis(guild);

    const user =
        author.username;

    const user2 =
        target.username;

    const userReward =
        rewards.kisserReward
            .toLocaleString();

    const user2Reward =
        rewards.targetReward
            .toLocaleString();

    const everyoneReward =
        rewards.everyoneReward
            .toLocaleString();

    const commonEnding =
`**${emojis.kiss} ${user} kissed ${user2} ${emojis.heartExclamation}**

**${emojis.heartpulse} ${user} received ${userReward} XP ${emojis.heartExclamation}**

**${emojis.twoHearts} ${user2} received ${user2Reward} XP ${emojis.heartExclamation}**${extras}`;

    switch(String(rarity || "").toUpperCase()){

        case "UNCOMMON":
            return `${emojis.heartpulse} **UNCOMMON** 🍃

*${target} was just walking until ${author} showed up, quickly kissed ${target}, and disappeared as if nothing happened.*

**“H-huh...”**

*${target} looked around in confusion, blushing.*

${commonEnding}`;


        case "RARE":
            return `${emojis.heartpulse} **RARE** 💫

*${target} was getting slightly annoyed by ${author} constantly kissing them.*

*Now ${target} kept their guard up whenever ${author} was around.*

*${target} was walking around the block when ${author} appeared.*

**“Heeeeeeeeeey!! How are you doiiing?!”**

*${author} could see that ${target} was guarded... and smiled.*

*${author} leaned in and tried to kiss ${target}, but ${target} dodged.*

*${author} blinked.*

*${target} blinked too.*

*${author} tried again—this time gently pulling ${target} closer before giving them a quick, warm kiss.*

${commonEnding}`;


        case "EPIC":
            return `${emojis.halfGoldenHeart} **EPIC** ✨

### The Group Kiss

*The crew—shadow067972, beyondborder_08386, kdc, thezdrink, gorjezz, ${author}, and ${target}—were chilling together on the couch in their apartment.*

*Then gorjezz spoke.*

**“Um... guys... Haven't you seen Kape, Mrhacker and Mizuki?”**

*Thezdrink answered:*

**“They're probably just... goofing around...”**

*Gorjezz looked at thezdrink, then looked away.*

**“It's just that... they disappeared all of a sudden. I hope they're okay...”**

*${author} noticed that she was nervous and sighed.*

**“Don't be nervous, gorjezz... let's have a group kiss, and it'll be okay.”**

*${target} nodded in agreement. Then the whole crew nodded.*

*They all kissed, but only for five seconds before pulling away.*

*Suddenly ${target} spoke.*

**“You guys promised we could Netflix and chill today, so I'll bring some popcorn!”**

*${target} ran away just like that. Even though ${target} had kind of betrayed them, they were still friends.*

*Then ${author} received a message from Mrhacker: “Meet me at the park...”*

**${emojis.kiss} The crew kissed each other ${emojis.heartExclamation}**

**${emojis.cupid} ${user} received ${userReward} XP ${emojis.heartExclamation}**

**${emojis.revolvingHearts} ${user2} received ${user2Reward} XP ${emojis.heartExclamation}**${extras}`;


        case "LEGENDARY":
            return `${emojis.goldenHeart} **LEGENDARY** 🌠

### Kape's & Mizuki's Stunning Kiss...

*Kape visited the crew's apartment.*

*He saw Mizuki, shadow067972, beyondborder_08386, kdc, thezdrink and gorjezz sitting on the couch.*

**“Heeey, Kape... come and join us!”**

*Kape greeted them. As soon as he sat down, beyondborder_08386 whispered so the others couldn't hear.*

**“Hey, can I have a little chat with you, Kape?”**

*Kape looked slightly annoyed.*

**“I just sat down! Alright, alright...”**

*Kape and beyondborder_08386 went into another room. Beyondborder_08386 spoke quietly and coldly.*

**“I think your daughter... uh... Mizuki is somewhat broken.”**

*Kape blinked in confusion.*

**“What do you mean... broken?”**

*Beyondborder_08386 nodded.*

**“Yes, broken. She sometimes glitches in a really weird way.”**

*He paused before adding:*

**“You ask her a question, and she answers differently from how she's supposed to.”**

*Kape sighed and put a hand on beyondborder_08386's shoulder.*

**“Calm down. I think she just wants to be more like you guys.”**

*Kape smiled slightly.*

**“I'll try speaking to her, though...”**

*They returned to the crew—and watched in disbelief.*

*${author} and ${target} were suddenly dancing on the table with cringe music playing.*

*Kape ignored it and walked over to Mizuki.*

**“Hey, Mizuki? Are you alright?”**

*Mizuki looked up at Kape with a bright—perhaps too bright—smile.*

**“Yeah! I'm alright, my sweet little pancake!”**

*Kape blinked at her, slowly turned toward beyondborder_08386, then looked at ${author} and ${target}. He realized that something probably was broken, but decided to ignore it.*

**“Alright...”**

*Kape calmly kissed Mizuki on the forehead.*

*The kiss was so stunning and powerful that it gave the whole crew XP.*

**“Okay, guys... I'm sorry, but I have to go. Sorry I can't stay for Netflix and chill. Bye!”**

*Kape left. Then gorjezz suddenly asked:*

**“Where even is Mrnoob?”**

*Thezdrink shrugged.*

**“He told me he's working on his ‘important’ and great plan...”**

*Thezdrink paused and continued.*

**“Also, call him Mrhacker. He evolved from a noob to a hacker—and he'd send you to Mars if you called him Mrnoob.”**

**${emojis.kiss} Kape kissed Mizuki ${emojis.heartExclamation}**

**The kiss overflowed to everyone.**

**${emojis.cupid} ${user} received ${userReward} XP ${emojis.heartExclamation}**

**${emojis.revolvingHearts} ${user2} received ${user2Reward} XP ${emojis.heartExclamation}**${extras}`;


        case "MYTHIC":
            return `${emojis.mythicHeart} **MYTHIC** 🌃

### The Aftermath of Mrhacker's Snap

*After Mrhacker snapped his fingers, the Gauntlet overheated as if it had exploded.*

*The injured crew watched Mrhacker in disbelief.*

*Then Kape, injured as well, slowly walked toward him.*

**“W-what did you do...?”**

*Kape paused before repeating himself.*

**“WHAT DID YOU DO?!”**

*Mrhacker breathed loudly, looked at Kape and tilted his head—but before he could answer, the power and XP of shadow067972, beyondborder_08386, kdc, thezdrink, gorjezz and ${target} began transferring into Mrhacker.*

*Almost all of everyone's power simply disappeared into him.*

*Even Kape's XP transferred to Mrhacker.*

*Everyone lost 90% of their power, only making Mrhacker stronger.*

*Kape dropped to his knees.*

*Without his powers, Kape was no longer an admin. He was simply like everyone else.*

*The only person who ruled the world now was Mrhacker... or was he?*

*Gorjezz suddenly walked up to Mrhacker and kissed him.*

*But Mrhacker simply ignored it.*

*Even so, it was one of the most powerful kisses ever—and its energy flooded literally everyone.*

*Mrhacker used the Space Stone to teleport away with Mizuki and ${author}.*

**${emojis.kiss} Gorjezz kissed Mrhacker ${emojis.heartExclamation}**

**${emojis.mythicHeart} The kiss was one of the most powerful kisses in the world... It flooded everyone... ${emojis.mythicHeart}**

**${emojis.cupid} ${user} received ${userReward} XP ${emojis.heartExclamation}**

**${emojis.revolvingHearts} ${user2} received ${user2Reward} XP ${emojis.heartExclamation}**

**${emojis.heartExclamation} ${emojis.heartExclamation} Everyone else received ${everyoneReward} XP ${emojis.heartExclamation} ${emojis.heartExclamation}**${extras}`;


        case "COMMON":
        default:
            return `${emojis.heartpulse} **COMMON** 🌿

*${target} was just walking until ${author} showed up, quickly kissed ${target}, and disappeared as if nothing happened.*

**“H-huh...”**

*${target} looked around in confusion, blushing.*

${commonEnding}`;

    }

}


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


        const normalizedTargetID =
            String(targetInput || "")
                .replace(/[^0-9]/g, "");


        const repeatTargetLooksValid =
            String(targetInput || "").toLowerCase() === BOT_NAME
            ||
            /^\d{17,20}$/.test(
                normalizedTargetID
            );


        const repeatCount =
            targetInput
            &&
            repeatTargetLooksValid
            &&
            normalizedTargetID !== userID
                ? await quests.getSocialCommandRepeatCount(
                    guildID,
                    userID
                )
                : 1;


        if(repeatCount > 1){

            const remaining =
                await database.getCommandCooldownRemaining(
                    guildID,
                    userID,
                    "kiss"
                );


            if(remaining > 0){

                return execute(
                    message,
                    {
                        questRepeatChild: true
                    }
                );

            }


            for(
                let repeatIndex = 0;
                repeatIndex < repeatCount;
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



    // ==========================
    // Cooldown check
    // ==========================

const remaining =
    options.skipCooldown
        ? 0
        : await database.getCommandCooldownRemaining(
            guildID,
            userID,
            "kiss"
        );


if(remaining > 0){


    const minutes =
        Math.ceil(
            remaining / 60000
        );


    return message.reply(

        `⏳ You can use !kiss again in ${minutes} minutes.`

    );


}



    const args =
        message.content.trim().split(" ");



    const targetInput =
        args[1];



    if(!targetInput){


        return message.reply(
            "💋 Usage: !kiss @user / user ID / Bot"
        );


    }





    let target = null;



    // ==========================
    // Kiss Mizuki / bot
    // ==========================
    //
    // Treat all of these EXACTLY like "!kiss bot":
    // - !kiss bot
    // - !kiss @Mizuki
    // - !kiss <Mizuki's user ID>
    //
    // This prevents Mizuki from falling through into the
    // normal player-kiss path and receiving leaderboard XP.
    const mizukiUserID =
        String(
            message.client.user.id
        );


    const normalizedTargetInput =
        String(
            targetInput
        ).trim().toLowerCase();


    const isMizukiTarget =
        normalizedTargetInput ===
            BOT_NAME
        ||
        normalizedTargetInput ===
            mizukiUserID
        ||
        normalizedTargetInput ===
            `<@${mizukiUserID}>`
        ||
        normalizedTargetInput ===
            `<@!${mizukiUserID}>`;


    const authorData =
        await database.getUser(
            guildID,
            userID
        );


    const currentLevel =
        xp.getLevel(
            Number(authorData?.xp) || 0
        );


    const kissBotRanges =
        currentLevel >= 100
            ? KISS_BOT_RANGES.level100Plus
            : KISS_BOT_RANGES.level1To99;


    if(isMizukiTarget){

await database.setCommandCooldown(
    guildID,
    userID,
    "kiss",
    Date.now() + COOLDOWN
);


if(!options.skipXPBoostDrop){

    await boosts.tryAndAnnounceXPBoostDrop(
        message,
        "social",
        "!kiss"
    );

}

await quests.recordEvent(
    message,
    "kiss_given",
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


const wonLuckBoost =
    await luck.tryCommandLuckBoostDrop(
        message.member,
        "kiss"
    );


const luckExtra =
    luck.buildCommandLuckExtra(
        message.author,
        wonLuckBoost,
        "kiss"
    );


        const nice =
            Math.random() <
            luck.getCommandSuccessChance(
                0.5,
                activeLuck
            );



        if(nice){


            const reward =
                economyLimits.capSocialXP(
                    "kiss",
                    luck.rollCommandXP(
                        kissBotRanges.reward.min,
                        kissBotRanges.reward.max,
                        activeLuck
                    ),
                    currentLevel
                );



await database.giveXP(
    message.guild.id,
    userID,
    reward
);

const trollShare =
    await trolls.applyKissShare(
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

if(trollShare?.sourceUserID){
    await syncAndTrackLevel(
        message,
        trollShare.sourceUserID
    );
}



            return message.channel.send(

`*Goth mommy bot blushed so hard that her whole face turned as red as a tomato... then she licks her lips and keeps looking at you.*

"For your kiss, I will give you **${reward.toLocaleString()} XP**~~ 💋"${luckExtra}`

            );


        }


        else{


            const loss =
                luck.rollCommandPenalty(
                    kissBotRanges.loss.min,
                    kissBotRanges.loss.max,
                    activeLuck
                );



const user =
    await database.getUser(
        message.guild.id,
        userID
    );


const currentXP =
    Math.max(
        0,
        Number(user?.xp) || 0
    );


const actualLoss =
    Math.min(
        currentXP,
        loss
    );


await database.setXP(

    message.guild.id,

    userID,

    Math.max(
        0,
        currentXP - actualLoss
    )

);

await syncAndTrackLevel(
    message,
    userID
);



            return message.channel.send(

`*Goth mommy blushes for a second... then suddenly slaps you.*

"EW! DON'T YOU KISS ME!" *she says with pure shock and anger.*

"For that, I will take **${actualLoss.toLocaleString()} XP**!" 😤${usedLuckExtra}${luckExtra}`

            );


        }

    }






    // ==========================
    // Mention
    // ==========================

    target =
        message.mentions.users.first();





    // ==========================
    // User ID
    // ==========================

    if(!target && /^\d+$/.test(targetInput)){


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




    // Prevent kissing yourself

    if(target.id === userID){


        return message.reply(
            "💀 You cannot kiss yourself."
        );


    }




await database.setCommandCooldown(
    guildID,
    userID,
    "kiss",
    Date.now() + COOLDOWN
);


if(!options.skipXPBoostDrop){

    await boosts.tryAndAnnounceXPBoostDrop(
        message,
        "social",
        "!kiss"
    );

}

await quests.recordEvent(
    message,
    "kiss_given",
    1
);

await quests.recordEvent(
    message,
    "kiss_received",
    1,
    {
        userID: target.id
    }
);

// ==========================
// KISS RARITY + XP
// ==========================

const activeLuck =
    await luck.getActiveLuckBoost(
        message.member
    );


const usedLuckExtra =
    luck.buildUsedCommandLuckExtra(
        activeLuck
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
    currentLevel >= 100
    &&
    targetLevel < 100;


const kissTable =
    getKissTableForLevel(
        currentLevel
    );


// Level 100+ keeps Luck useful, but II / III / MAX
// use the softer command balance from utils/luck.js.
const commandLuck =
    currentLevel >= 100
        ? luck.getLevel100PlusCommandLuckProfile(
            activeLuck
        )
        : activeLuck;


const outcome =
    luck.rollCommandOutcome(
        kissTable,
        commandLuck
    );


const rolledReward =
    luck.rollCommandXP(
        outcome.min,
        outcome.max,
        commandLuck
    );


// A Level 1-99 target only receives 10% of a player-command
// reward when the command author is Level 100+.
const protectedTargetReward =
    lowLevelTargetProtection
        ? Math.max(
            1,
            Math.floor(
                rolledReward * 0.10
            )
        )
        : rolledReward;


const targetReward =
    economyLimits.capSocialXP(
        "kiss",
        protectedTargetReward,
        targetLevel
    );


const targetLevelCapApplied =
    targetReward <
    protectedTargetReward;


const calculatedRewards =
    calculateKissRewards(
        targetReward
    );


const kissRewards = {
    ...calculatedRewards,

    kisserReward:
        economyLimits.capSocialXP(
            "kiss",
            calculatedRewards.kisserReward,
            currentLevel
        )
};


if(outcome.key === "mythic"){

    // Mythic is one transaction: user2 receives the complete rolled reward,
    // the kisser receives 10-20% less, and every other registered player
    // receives 20% of user2's reward. The two command participants are
    // excluded from the server-wide part so nobody is paid twice.
    await database.performMythicKissReward(
        guildID,
        userID,
        target.id,
        kissRewards.kisserReward,
        kissRewards.targetReward,
        kissRewards.everyoneReward
    );

}
else{

    await database.giveXP(
        guildID,
        target.id,
        kissRewards.targetReward
    );


    await database.giveXP(
        guildID,
        userID,
        kissRewards.kisserReward
    );

}


const trollShare =
    await trolls.applyKissShare(
        guildID,
        userID,
        kissRewards.kisserReward
    );


await quests.recordEvent(
    message,
    "earn_xp",
    kissRewards.targetReward,
    {
        userID: target.id
    }
);


await quests.recordEvent(
    message,
    "earn_xp",
    kissRewards.kisserReward,
    {
        userID
    }
);


await syncAndTrackLevel(
    message,
    target.id
);


await syncAndTrackLevel(
    message,
    userID
);


if(trollShare?.sourceUserID){
    await syncAndTrackLevel(
        message,
        trollShare.sourceUserID
    );
}


const wonLuckBoost =
    await luck.tryCommandLuckBoostDrop(
        message.member,
        "kiss"
    );


const luckExtra =
    luck.buildCommandLuckExtra(
        message.author,
        wonLuckBoost,
        "kiss"
    );


const protectionExtra =
    `${lowLevelTargetProtection ? "\n🛡️ **Level 1-99 protection:** the kissed user received 10% of the original high-level roll." : ""}` +
    `${targetLevelCapApplied ? "\n🛡️ **Level 1-99 reward cap applied.**" : ""}`;


const dialogue =
    buildKissDialogue(
        outcome.rarity,
        message.author,
        target,
        kissRewards,
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
    KISS_TABLES,
    KISS_BOT_RANGES,
    getKissTableForLevel,
    getCustomEmoji,
    getKissEmojis,
    splitLongMessage,
    sendLongDialogue,
    calculateKissRewards,
    buildKissDialogue

};
