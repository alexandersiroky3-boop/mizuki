const database = require("../database");
const xp = require("../utils/xp");
const leveling =
    require("../systems/leveling");
const luck =
    require("../utils/luck");
const quests =
    require("../systems/quests");

const boosts =
    require("../systems/boosts");

const trolls =
    require("../systems/trolls");

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



const LEVEL100_PLUS_STEAL_OUTCOMES = [
    {
        key: "failure",
        chancePercent: 23.2
    },
    {
        key: "common",
        chancePercent: 65,
        min: 50000,
        max: 125000,
        rarity: "COMMON"
    },
    {
        key: "uncommon",
        chancePercent: 10,
        min: 125000,
        max: 250000,
        rarity: "UNCOMMON"
    },
    {
        key: "rare",
        chancePercent: 1,
        min: 250000,
        max: 500000,
        rarity: "RARE"
    },
    {
        key: "epic",
        chancePercent: 0.5,
        min: 500000,
        max: 2500000,
        rarity: "EPIC"
    },
    {
        key: "legendary",
        chancePercent: 0.25,
        min: 2500000,
        max: 5000000,
        rarity: "LEGENDARY"
    },
    {
        key: "mythic",
        chancePercent: 0.05,
        min: 5000000,
        max: 25000000,
        rarity: "MYTHIC"
    }
];


const LEVEL1_TO99_STEAL_OUTCOMES = [
    {
        key: "failure",
        chancePercent: 19.34
    },
    {
        key: "common",
        chancePercent: 75,
        min: 5000,
        max: 15000,
        rarity: "COMMON"
    },
    {
        key: "uncommon",
        chancePercent: 5,
        min: 15000,
        max: 30000,
        rarity: "UNCOMMON"
    },
    {
        key: "rare",
        chancePercent: 0.5,
        min: 30000,
        max: 50000,
        rarity: "RARE"
    },
    {
        key: "epic",
        chancePercent: 0.1,
        min: 50000,
        max: 100000,
        rarity: "EPIC"
    },
    {
        key: "legendary",
        chancePercent: 0.05,
        min: 100000,
        max: 250000,
        rarity: "LEGENDARY"
    },
    {
        key: "mythic",
        chancePercent: 0.01,
        min: 250000,
        max: 500000,
        rarity: "MYTHIC"
    }
];


function getStealOutcomesForLevel(level){

    return Number(level) >= 100
        ? LEVEL100_PLUS_STEAL_OUTCOMES
        : LEVEL1_TO99_STEAL_OUTCOMES;

}


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


function getStealEmojis(guild){

    return {
        robbery:
            getCustomEmoji(
                guild,
                "robbery",
                "💰"
            ),

        runningRobbery:
            getCustomEmoji(
                guild,
                "running_robbery",
                "🏃💰"
            ),

        stackedMoney:
            getCustomEmoji(
                guild,
                "stacked_money",
                "💵"
            ),

        halfGoldenRobbery:
            getCustomEmoji(
                guild,
                "half_golden_robbery",
                "✨💰"
            ),

        greenDollarBag:
            getCustomEmoji(
                guild,
                "green_dollar_bag",
                "💰"
            ),

        goldenRobbery:
            getCustomEmoji(
                guild,
                "golden_robbery",
                "🌟💰"
            ),

        legendaryDollarBag:
            getCustomEmoji(
                guild,
                "legendary_dollar_bag",
                "💰"
            ),

        mythicRobbery:
            getCustomEmoji(
                guild,
                "mythic_robbery",
                "🌌💰"
            ),

        mythicDollarBag:
            getCustomEmoji(
                guild,
                "mythic_dollar_bag",
                "💰"
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


function buildFailedStealDialogue(
    thief,
    target,
    extras = "",
    guild = null
){

    const emojis =
        getStealEmojis(guild);


    return `${emojis.robbery} **${thief} TRIED TO STEAL FROM ${target}** ${emojis.robbery}

${emojis.runningRobbery} **FAILED** ❌

**No XP was stolen.**${extras}`;

}


function buildStealDialogue(
    rarity,
    thief,
    target,
    stolenXP,
    extras = "",
    guild = null
){

    const emojis =
        getStealEmojis(guild);

    const amount =
        Math.max(
            0,
            Number(stolenXP) || 0
        ).toLocaleString();

    const user =
        thief.username;

    const user2 =
        target.username;


    switch(rarity){

        case "UNCOMMON":
            return `${emojis.robbery} **${thief} HAS STOLEN FROM ${target}** ${emojis.robbery}

${emojis.runningRobbery} **UNCOMMON** 🍃

**${emojis.stackedMoney} ${user} stole ${amount} XP from ${user2}!**${extras}`;


        case "RARE":
            return `${emojis.runningRobbery} **RARE** 💫

*${thief} was just chatting with ${target}, but while they were saying goodbye...*

*A brilliant idea popped into ${thief}'s head: why not steal some XP just for the sake of it?*

*When ${target} started walking away, ${thief} quietly followed behind and waited for the right moment.*

*${thief} snatched XP from ${target}'s pocket, then started running away like nothing happened.*

*${target} quickly looked back and ran after ${thief} while screaming:*

**“HEEEEEY!!! YOU'LL PAY FOR THAT!”**

**${emojis.greenDollarBag} ${user} stole ${amount} XP from ${user2}!**${extras}`;


        case "EPIC":
            return `${emojis.halfGoldenRobbery} **EPIC** ✨

### Mizuki's & ${user}'s Inevitable Plan

*Mizuki promised ${thief} that she would help steal from ${target}.*

*You see, ${thief} had tried so hard to steal from ${target}, but always got caught and laughed at.*

*It was a bright new day, full of sunshine. ${thief} started catching ${target}'s attention by saying the Red Dead Redemption series sucks—which isn't true.*

*Mizuki hid around the corner, watching them debate aggressively and giggling lightly.*

*${target} was about to lose it and tried punching ${thief} in the face.*

*Mizuki raised her hand and stopped the incoming attack with her powers.*

*She floated closer to ${target}, and together, Mizuki and ${thief} stole as much XP as they could.*

*Then ${target} started screaming:*

**“KAAAPEEE! KAPEEEEEEEEEE!”**

*Kape could be heard flying nearby. Mizuki and ${thief} got nervous—if they were caught, they would probably be incinerated.*

*Mizuki grabbed ${thief}, and they flew away carrying bags of stolen XP.*

**${emojis.greenDollarBag} Mizuki & ${user} stole ${amount} XP from ${user2}!**${extras}`;


        case "LEGENDARY":
            return `${emojis.goldenRobbery} **LEGENDARY** 🌠

### The Gang Robbery

*${thief}, ${target}, beyondborder_08386, thezdrink, kdc, shadow067972 and gorjezz all had a magnificent plan.*

*They wanted to steal from the ultimate gugugaga boss... Kape.*

*But first, they needed more help. They needed... MRHACKER.*

*They arrived at Mrhacker's place, and ${thief} and ${target} explained their plan. It was ${target}'s idea, after all.*

*Mrhacker slowly blinked at them while lying on a couch and said lazily:*

**“Yeah, I'm good...”**

*Mrhacker paused, then added:*

**“Now shoo, shoo. Get off my property, or I'll make you...”**

*${thief} and the crew gulped. Gorjezz nodded nervously while beyondborder_08386 watched Mrhacker quietly and coldly, as if calculating him.*

*They went skadoosh and decided to take on Kape alone—or at least try.*

*Kape was hovering above the ground, watching a beautiful sunset, until gorjezz and thezdrink showed up.*

*They caught Kape's attention by talking about Among Us... and it worked.*

*Beyondborder_08386 and ${target} waited on a cliff with two sniper rifles aimed at Kape's head, ready in case things went south.*

*Shadow067972 and kdc moved quietly toward Kape. When the moment came, they started stealing XP from his pockets and bag.*

*But there was a twist: Kape knew all along. ${thief} had warned him and made a deal to steal from the entire crew.*

*${thief} was the traitor.*

*Beyondborder_08386 had a bad feeling and told ${target}:*

**“I think... there's something just... off about all of this.”**

*${target} told him to shrug it off. It was “just his imagination.”*

*Shadow067972 and kdc kept stealing until suddenly everyone except ${thief} was unable to move.*

*${thief} appeared in the distance and walked toward Kape. They looked at each other and smiled.*

*Beyondborder_08386 and ${target} saw it through their scopes. Since Kape's power hadn't frozen them, they pulled the triggers.*

*Kape calmly raised one hand, stopped the bullets with his powers and turned them into ash. He snapped his fingers, and both sniper rifles disappeared.*

*All beyondborder_08386 and ${target} could do was watch.*

*Kape and ${thief} stole from the entire crew, then flew away.*

**${emojis.legendaryDollarBag} Kape & ${user} stole ${amount} XP from ${user2} & the crew!**${extras}`;


        case "MYTHIC":
            return `${emojis.mythicRobbery} **MYTHIC** 🌃

### Mrhacker VS Everyone

*Mrhacker heard that Kape and ${target} had stolen from the whole crew.*

*He felt bad for refusing to help with their plan, so he decided to reunite the team and steal from Kape.*

*Mrhacker found beyondborder_08386, thezdrink, kdc, shadow067972 and gorjezz chilling on a couch. He entered, and the crew stared at him in annoyance.*

**“What are YOU doing here?!”**

*Thezdrink asked while beyondborder_08386 watched Mrhacker coldly, and kdc, shadow067972 and gorjezz looked at him angrily.*

*Mrhacker spoke softly:*

**“Okay... okay... my bad for not helping you guys earlier. BUT!”**

*Mrhacker paused and smiled.*

**“How about I repay you by helping you steal from Kape now?”**

*The crew blinked at him. Beyondborder_08386 answered:*

**“Too late...”**

*Shadow067972 added:*

**“Yeah, you should've helped us back then.”**

*Mrhacker gave up and left. With no option left, he tried recruiting Mizuki and ${thief} instead.*

*Mizuki was sitting on a bench, slightly... glitching? Mrhacker flew over and hovered in front of her.*

**“Uh... Mizuki? Do you perhaps want to team up and help me steal from Kape?”**

*Mizuki looked up at him while glitching.*

**“Steal...? S-steal fr-from... m-my... n-no, no, I can't—”** *glitches* **“Yeah! Sounds great!”**

*Mrhacker tilted his head, confused, but decided to ignore it.*

*Then Mrhacker and Mizuki flew to ${thief}.*

**“Hey, ${user}... I know you're still mad about ${target} being the traitor and betraying you and your crew earlier...”**

*Mrhacker paused before adding:*

**“How about we repay Kape and ${target} by stealing from them?”**

*${thief} immediately smiled and agreed.*

*With the team assembled, Mrhacker explained the plan.*

*First, they had to obtain the Infinity Gauntlet equipped on Kape's right hand.*

*Second, Mrhacker would equip it and snap his fingers. With the Gauntlet's inevitable power, he would steal everybody's XP—especially Kape's—and become the most powerful being in the universe.*

*Mrhacker and Mizuki appeared in front of Kape, pretending to be friendly.*

*Then Mrhacker suddenly flew toward him at full speed and tried kicking him in the face.*

*Kape ducked under the kick and used the Power Stone to launch Mrhacker into a building, which exploded around him.*

*Before Kape could look at Mizuki, she was already above him with a fully wound-up punch.*

*Kape barely blocked it with both hands. The impact launched him into the ground and shattered it beneath him.*

**“What is THIS?!”**

*Before Kape could recover, Mrhacker flew out of the collapsed building and brutally punched him in the stomach. Kape groaned and slid across the ground—but stayed on his feet.*

*Mrhacker and Mizuki charged together, both aiming directly for Kape.*

*Kape grew angry and fired a beam powered by every Infinity Stone.*

*Mrhacker and Mizuki screamed as they blocked it with their hands and kept flying forward.*

*They overpowered the beam, reached Kape and struck him with a punch and a kick.*

*Meanwhile, beyondborder_08386, thezdrink, kdc, shadow067972 and gorjezz heard shaking and explosions outside.*

*Gorjezz stood up from the couch and looked at the crew.*

**“W-what's that...?”**

*As kdc approached the window, ${thief} suddenly entered the apartment and smiled “innocently.”*

*${thief}'s part of the plan was to keep the crew distracted from everything happening outside.*

**“Heeey... guuuys... nothing to worry abou—”**

*Beyondborder_08386 cut ${thief} off.*

**“What's going on?!”**

*He stood and stared directly at ${thief} with a cold, angry expression.*

**“What do you meaaaaaan...? Let's just play a game and ignooore it...”**

*${thief} sounded extremely suspicious. Beyondborder_08386 pushed past, and kdc and gorjezz looked through the window.*

*They gasped.*

**“Kape is fighting Mrhacker and Mizuki! We need to help Kape!”**

*This wasn't part of the plan, so ${thief} kicked beyondborder_08386 in the stomach and sent him crashing into the TV.*

*Thezdrink and shadow067972 launched themselves at ${thief}. ${thief} blocked most of their punches but started getting overwhelmed—it was a five-on-one fight.*

*${thief} grabbed a chair and smashed it over thezdrink's head. As thezdrink stumbled, ${thief} tried following with a punch.*

*Shadow067972 stepped in, blocked it and kicked ${thief} into a wall.*

*Beyondborder_08386 recovered, ran at ${thief}, jumped from the table and landed a whirlwind kick.*

*Gorjezz joined by throwing pans, cups and anything else she could find in the kitchen.*

*${thief} charged at her, but her Among Us plushie fell. She bent down to pick it up and accidentally dodged the attack perfectly.*

*${thief} tried stomping at her, but she stood up just in time and smashed a pan into ${thief}'s face.*

*Then ${target} entered with popcorn because, traitor or not, the crew had invited them to Netflix and chill.*

*${target} stared at the chaos, slowly reached into the popcorn and ate one piece.*

*Beyondborder_08386 ducked under ${thief}'s punch and countered with a kick to the chest, sending ${thief} through the wall and outside—right beside Mrhacker's battle.*

*Mrhacker saw ${thief} hit the ground.*

**“YOU HAD ONE JOB—!”**

*Kape blasted Mrhacker back into the building with the Power Stone before he could finish.*

*Beyondborder_08386, thezdrink, kdc, shadow067972 and gorjezz jumped through the broken wall and joined the fight.*

*Mrhacker gritted his teeth, flew at the crew, punched thezdrink in the stomach and sent him flying.*

*Kdc grabbed Mrhacker while shadow067972 kicked him with both feet. Mrhacker broke free, grabbed kdc and used him to block gorjezz's attack before throwing them both aside.*

*Beyondborder_08386 attacked with cold, calculated precision. He jumped and punched Mrhacker in the head, forcing him back.*

*Mrhacker swung hard, but beyondborder_08386 dodged, rotated and kicked him in the head, nearly knocking him over and cutting his cheek.*

*Mrhacker groaned angrily and slapped beyondborder_08386 aside.*

*He looked toward Kape and saw Mizuki trying to pull the Gauntlet from his hand. Kape punched her square in the face and dropped her to the ground.*

*Mrhacker screamed and flew at Kape faster than ever.*

*He kicked Kape's leg, forced him to his knees, struck him several times and finally ripped the Infinity Gauntlet from his hand.*

*Mrhacker kicked Kape into the trees and equipped the Gauntlet on his own right hand.*

*He groaned as the extraordinary power of the Infinity Stones surged through him.*

*${thief} watched as Mrhacker prepared to snap—but beyondborder_08386, even while injured, appeared in front of him and grabbed the Gauntlet.*

*Mrhacker struck him once. Beyondborder_08386 held on.*

*Mrhacker struck him a second time, and beyondborder_08386 fell aside.*

*Mrhacker raised the Gauntlet...*

## **AND SNAPPED HIS FINGERS.**

*The destiny... had... been... fulfilled...* ${emojis.inevitableGalaxy}

**${emojis.mythicDollarBag} Mrhacker & Mizuki & ${user} stole ${amount} XP from EVERYONE!**${extras}`;


        case "COMMON":
        default:
            return `${emojis.robbery} **${thief} HAS STOLEN FROM ${target}** ${emojis.robbery}

${emojis.runningRobbery} **COMMON** 🌿

**${emojis.stackedMoney} ${user} stole ${amount} XP from ${user2}!**${extras}`;

    }

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

async function execute(message, options = {}){


    if(!message.guild){

        return;

    }


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
            BOT_NAMES.includes(
                String(targetInput || "").toLowerCase()
            )
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
                    "steal"
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
    // COOLDOWN CHECK
    // ==========================

const remaining =
    options.skipCooldown
        ? 0
        : await database.getCommandCooldownRemaining(
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


    const thief =
        await database.getUser(
            guildID,
            userID
        );


    if(!thief){

        return message.reply(
            "❌ I couldn't load your user data from the database."
        );

    }


    const thiefXP =
        Math.max(
            0,
            Number(thief.xp) || 0
        );


    const thiefLevel =
        xp.getLevel(thiefXP);


    // Luck belongs to the thief. Level 100+ users keep the command-specific
    // Luck II/III/MAX balance already used by the rest of the bot.
    const commandLuck =
        thiefLevel >= 100
            ? luck.getLevel100PlusCommandLuckProfile(
                activeLuck
            )
            : activeLuck;


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


if(!options.skipXPBoostDrop){

    await boosts.tryAndAnnounceXPBoostDrop(
        message,
        "social",
        "!steal"
    );

}

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


        const stealOutcome =
            luck.rollCommandOutcome(
                getStealOutcomesForLevel(
                    thiefLevel
                ),
                commandLuck
            );


        const botTarget =
            message.client.user;


        if(stealOutcome.key === "failure"){

            return sendLongDialogue(
                message.channel,
                buildFailedStealDialogue(
                    message.author,
                    botTarget,
                    `${usedLuckExtra}${luckExtra}`,
                    message.guild
                ),
                [
                    message.author.id,
                    botTarget.id
                ]
            );

        }


        const reward =
            luck.rollCommandXP(
                stealOutcome.min,
                stealOutcome.max,
                commandLuck
            );


        if(stealOutcome.rarity === "MYTHIC"){

            await database.performMythicSteal(
                guildID,
                userID,
                reward
            );

        }
        else{

            await database.giveXP(
                guildID,
                userID,
                reward
            );

        }


        await trolls.applyStealBackfire(
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


        return sendLongDialogue(
            message.channel,
            buildStealDialogue(
                stealOutcome.rarity,
                message.author,
                botTarget,
                reward,
                `${usedLuckExtra}${luckExtra}`,
                message.guild
            ),
            [
                message.author.id,
                botTarget.id
            ]
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

    const victim =
        await database.getUser(
            guildID,
            target.id
        );


    if(!victim){

        return message.reply(

            "❌ I couldn't load one of the users from the database."

        );

    }



    const victimXP =
        Math.max(
            0,
            Number(victim.xp) || 0
        );


    const victimLevel =
        xp.getLevel(victimXP);


    // Serious protection:
    // If the thief is Level 100+ and the victim is Level 1-99,
    // only 10% of the normally rolled steal amount can be taken.
    const lowLevelVictimProtection =
        thiefLevel >= 100
        &&
        victimLevel < 100;


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


if(!options.skipXPBoostDrop){

    await boosts.tryAndAnnounceXPBoostDrop(
        message,
        "social",
        "!steal"
    );

}

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
        getStealOutcomesForLevel(
            thiefLevel
        );


    const stealOutcome =
        luck.rollCommandOutcome(
            stealOutcomes,
            commandLuck
        );


    if(stealOutcome.key === "failure"){

        return sendLongDialogue(
            message.channel,
            buildFailedStealDialogue(
                message.author,
                target,
                `${usedLuckExtra}${luckExtra}`,
                message.guild
            ),
            [
                message.author.id,
                target.id
            ]
        );

    }


    // Player-to-player steals intentionally use the full rarity range.
    // The old Level 1-99 social cap would flatten higher rarity rewards.
    // Victim balance and low-level victim protection are still applied below.
    const attemptedAmount =
        luck.rollCommandXP(
            stealOutcome.min,
            stealOutcome.max,
            commandLuck
        );


    const rarity =
        stealOutcome.rarity;


    // Mythic steals are server-wide: every registered user except the thief
    // loses up to the rolled amount, while the thief receives that amount once.
    if(rarity === "MYTHIC"){

        await database.performMythicSteal(
            guildID,
            userID,
            attemptedAmount
        );


        await trolls.applyStealBackfire(
            guildID,
            userID,
            attemptedAmount
        );


        await quests.recordEvent(
            message,
            "steal_xp",
            attemptedAmount
        );


        await quests.recordEvent(
            message,
            "earn_xp",
            attemptedAmount
        );


        await quests.recordEvent(
            message,
            "get_stolen",
            1,
            {
                userID: target.id
            }
        );


        // Sync the command participants immediately. Other affected users are
        // safely resynced by the normal level system on their next activity.
        await syncAndTrackLevel(
            message,
            target.id
        );


        await syncAndTrackLevel(
            message,
            userID
        );


        return sendLongDialogue(
            message.channel,
            buildStealDialogue(
                rarity,
                message.author,
                target,
                attemptedAmount,
                `${usedLuckExtra}${luckExtra}`,
                message.guild
            ),
            [
                message.author.id,
                target.id
            ]
        );

    }


    // ==========================
    // CAP STEAL AT VICTIM'S XP
    // ==========================

    const protectedAttemptedAmount =
        lowLevelVictimProtection
            ? Math.max(
                1,
                Math.floor(
                    attemptedAmount * 0.10
                )
            )
            : attemptedAmount;


    const stolenXP =
        Math.min(
            protectedAttemptedAmount,
            victimXP
        );


    const protectionExtra =
        lowLevelVictimProtection
            ? `\n🛡️ **Level 1-99 protection:** ${target.username} kept **90%** of the XP that would normally have been stolen.`
            : "";


    if(stolenXP <= 0){

        return message.channel.send(

            `💀 ${target} didn't have enough XP to steal.${usedLuckExtra}${luckExtra}${protectionExtra}`

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


    await trolls.applyStealBackfire(
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




    return sendLongDialogue(
        message.channel,
        buildStealDialogue(
            rarity,
            message.author,
            target,
            stolenXP,
            `${usedLuckExtra}${luckExtra}${protectionExtra}`,
            message.guild
        ),
        [
            message.author.id,
            target.id
        ]
    );

}



module.exports = {

    execute,
    getStealOutcomesForLevel,
    getCustomEmoji,
    getStealEmojis,
    splitLongMessage,
    sendLongDialogue,
    buildFailedStealDialogue,
    buildStealDialogue,
    LEVEL1_TO99_STEAL_OUTCOMES,
    LEVEL100_PLUS_STEAL_OUTCOMES

};
