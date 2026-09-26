const database = require("../database");
const xp = require("../utils/xp");
const luck = require("../utils/luck");
const leveling = require("../systems/leveling");
const boosts = require("../systems/boosts");
const trolls = require("../systems/trolls");

const economyLimits =
    require("../utils/economyLimits");


// ======================
// SETTINGS
// ======================

const COOLDOWN =
    24 * 60 * 60 * 1000; // 24 hours


const LEVEL1_TO99_EZWIN_OUTCOMES =
    Object.freeze({

        common: Object.freeze({
            key: "common",
            rarity: "COMMON",
            chancePercent: 95,
            evolvedChancePercent: 10,

            normal: Object.freeze({
                gained: Object.freeze({
                    min: 75000,
                    max: 200000
                }),
                lost: Object.freeze({
                    min: 20000,
                    max: 75000
                })
            }),

            evolved: Object.freeze({
                gained: Object.freeze({
                    min: 250000,
                    max: 400000
                }),
                lost: Object.freeze({
                    min: 100000,
                    max: 250000
                })
            })
        }),

        legendary: Object.freeze({
            key: "legendary",
            rarity: "LEGENDARY",
            chancePercent: 5,
            evolvedChancePercent: 0.1,

            normal: Object.freeze({
                gained: Object.freeze({
                    min: 200000,
                    max: 350000
                }),
                lost: Object.freeze({
                    min: 150000,
                    max: 300000
                })
            }),

            evolved: Object.freeze({
                gained: Object.freeze({
                    min: 450000,
                    max: 750000
                }),
                lost: Object.freeze({
                    min: 350000,
                    max: 450000
                })
            })
        })

    });


// Backwards-compatible export name. It now points at the full low-level
// rarity table, matching the Level 100+ constant's structure.
const LEVEL1_TO99_EZWIN_RANGES =
    LEVEL1_TO99_EZWIN_OUTCOMES;


const LEVEL100_PLUS_EZWIN_OUTCOMES =
    Object.freeze({

        common: Object.freeze({
            key: "common",
            rarity: "COMMON",
            chancePercent: 90,
            evolvedChancePercent: 20,

            normal: Object.freeze({
                gained: Object.freeze({
                    min: 750000,
                    max: 2000000
                }),
                lost: Object.freeze({
                    min: 200000,
                    max: 750000
                })
            }),

            evolved: Object.freeze({
                gained: Object.freeze({
                    min: 3000000,
                    max: 5000000
                }),
                lost: Object.freeze({
                    min: 1500000,
                    max: 3000000
                })
            })
        }),

        legendary: Object.freeze({
            key: "legendary",
            rarity: "LEGENDARY",
            chancePercent: 10,
            evolvedChancePercent: 0.5,

            normal: Object.freeze({
                gained: Object.freeze({
                    min: 12500000,
                    max: 20000000
                }),
                lost: Object.freeze({
                    min: 7500000,
                    max: 12500000
                })
            }),

            evolved: Object.freeze({
                gained: Object.freeze({
                    min: 20000000,
                    max: 35000000
                }),
                lost: Object.freeze({
                    min: 15000000,
                    max: 20000000
                })
            })
        })

    });


// Backwards-compatible name for integrations that imported the old constant.
const LEVEL100_PLUS_EZWIN_RANGES =
    LEVEL100_PLUS_EZWIN_OUTCOMES;


const LEVEL1_TO99_BASE_LEGENDARY_CHANCE =
    5;


const BASE_LEGENDARY_CHANCE =
    10;


// These are additive percentage-point bonuses. They intentionally stay much
// gentler than the generic command rarity weighting used by other commands.
const EZWIN_LUCK_LEGENDARY_BONUSES =
    Object.freeze({
        tier1: 1,
        tier2: 2.5,
        tier3: 5,
        max: 7.5,
        omega: 15
    });


// Low-level bonuses stay milder than the Level 100+ bonuses. Luck MAX adds
// the requested +5 percentage points before permanent Boost scaling.
const LEVEL1_TO99_EZWIN_LUCK_LEGENDARY_BONUSES =
    Object.freeze({
        tier1: 0.5,
        tier2: 1.5,
        tier3: 3,
        max: 5,
        omega: 10
    });


const LEVEL1_TO99_MAX_LEGENDARY_CHANCE =
    20;


const MAX_LEGENDARY_CHANCE =
    35;


function getEZWinLegendaryChance(
    activeLuck,
    isLevel100Plus = true
){

    const tier =
        String(
            activeLuck?.tier || ""
        ).toLowerCase();

    const baseBonus =
        Number(
            (
                isLevel100Plus
                    ? EZWIN_LUCK_LEGENDARY_BONUSES
                    : LEVEL1_TO99_EZWIN_LUCK_LEGENDARY_BONUSES
            )[tier]
        ) || 0;

    const boostUpgradeScale =
        tier
            ? Math.max(
                1,
                Number(
                    activeLuck?.boostMultiplierScale
                ) || 1
            )
            : 1;


    return Math.min(
        isLevel100Plus
            ? MAX_LEGENDARY_CHANCE
            : LEVEL1_TO99_MAX_LEGENDARY_CHANCE,
        (
            isLevel100Plus
                ? BASE_LEGENDARY_CHANCE
                : LEVEL1_TO99_BASE_LEGENDARY_CHANCE
        ) +
            baseBonus *
            boostUpgradeScale
    );

}


function rollEZWinRarity(
    activeLuck,
    random = Math.random,
    isLevel100Plus = true
){

    return (
        random() * 100 <
        getEZWinLegendaryChance(
            activeLuck,
            isLevel100Plus
        )
    )
        ? "legendary"
        : "common";

}


function rollEZWinEvolved(
    rarity,
    random = Math.random,
    isLevel100Plus = true
){

    const outcomes =
        isLevel100Plus
            ? LEVEL100_PLUS_EZWIN_OUTCOMES
            : LEVEL1_TO99_EZWIN_OUTCOMES;

    const outcome =
        outcomes[
            String(rarity || "").toLowerCase()
        ];


    if(!outcome)
        return false;


    // This is deliberately a completely separate raw roll. Luck Boosts and
    // permanent Boost upgrades never alter Evolved chances.
    return (
        random() * 100 <
        outcome.evolvedChancePercent
    );

}


function getEZWinRanges(
    rarity,
    evolved,
    isLevel100Plus = true
){

    const outcomes =
        isLevel100Plus
            ? LEVEL100_PLUS_EZWIN_OUTCOMES
            : LEVEL1_TO99_EZWIN_OUTCOMES;

    const outcome =
        outcomes[
            String(rarity || "").toLowerCase()
        ]
        ||
        outcomes.common;


    return evolved
        ? outcome.evolved
        : outcome.normal;

}


function getLevel1To99EZWinRanges(
    rarity,
    evolved
){

    return getEZWinRanges(
        rarity,
        evolved,
        false
    );

}


function getLevel100PlusEZWinRanges(
    rarity,
    evolved
){

    return getEZWinRanges(
        rarity,
        evolved,
        true
    );

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


function getEZWinEmojis(guild){

    return {
        moneyWithWings:
            getCustomEmoji(
                guild,
                "money_with_wings",
                "💸"
            ),

        boom:
            getCustomEmoji(
                guild,
                "boom",
                "💥"
            ),

        shield:
            getCustomEmoji(
                guild,
                "shield",
                "🛡️"
            ),

        hibiscus:
            getCustomEmoji(
                guild,
                "hibiscus",
                "🌺"
            ),

        stackedMoney:
            getCustomEmoji(
                guild,
                "stacked_money",
                "💵"
            ),

        evolvedCommonLeaf:
            getCustomEmoji(
                guild,
                "evolved_common_leaf",
                "🍃"
            ),

        goldenHeart:
            getCustomEmoji(
                guild,
                "golden_heart",
                "💛"
            ),

        evolvedLegendaryFallingStar:
            getCustomEmoji(
                guild,
                "evolved_legendary_falling_star",
                "🌠"
            ),

        criticalExplosion:
            getCustomEmoji(
                guild,
                "critical_explosion",
                "💥"
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


function buildEZWinDialogue(
    rarity,
    evolved,
    author,
    lostXP,
    gainedXP,
    lowLevelReductionPercent,
    extras = "",
    guild = null,
    rewardRecipient = author.username
){

    const emojis =
        getEZWinEmojis(guild);

    const normalizedRarity =
        String(rarity || "common")
            .toLowerCase();

    const lossEmoji =
        normalizedRarity === "legendary"
        &&
        evolved
            ? emojis.criticalExplosion
            : emojis.boom;

    const rewardEnding =
`**${lossEmoji} Everyone lost ${lostXP.toLocaleString()} XP!**

**${emojis.shield} People with levels below 100 lost ${lowLevelReductionPercent}% less XP!**

**${emojis.hibiscus} ${rewardRecipient} gains ${gainedXP.toLocaleString()} XP!**${extras}`;


    if(normalizedRarity === "legendary"){

        const heading =
            evolved
                ? `${emojis.goldenHeart} **LEGENDARY** ${emojis.evolvedLegendaryFallingStar} **(EVOLVED)**`
                : `${emojis.goldenHeart} **LEGENDARY** 🌠`;

        const title =
            evolved
                ? `### Mizuki's and ${author.username}'s Power Up`
                : `### ${author.username}'s Power Up`;


        return `${heading}

${title}

*When Mrhacker, ${author}, and Mizuki escaped through the portal, they arrived on a completely different planet without any humans.*

*Mrhacker took a few steps forward before sitting on a broken tree log and looking down at the ground.*

*${author} decided to ask:*

**“What will we do now...?”**

*Mrhacker looked at them and answered calmly, his voice no longer sounding injured.*

**“We wait...”**

*Mrhacker looked away at the beautiful scenery before adding:*

**“Now that I have the stolen Gauntlet, I can do almost anything I want.”**

*He looked at his right hand, where Kape's Gauntlet still sat overheated from the earlier snap.*

**“I know for a fact that they will come here, but their chances of stopping us are nearly impossible.”**

*Mrhacker paused and looked at ${author}.*

**“Then I will make sure I become the one and only administrator in this reality—the ruler of them all.”**

*${author} began feeling bad for the crew, but destiny could not be undone. It had already been fulfilled.*

*Before ${author} or Mizuki could respond, Mrhacker raised the Gauntlet toward them.*

*Using its Stones, Mrhacker temporarily boosted ${author}'s and Mizuki's power to an entirely different level—far beyond anything they had been capable of achieving.*

${rewardEnding}`;

    }


    if(evolved){

        return `${emojis.stackedMoney} **COMMON** ${emojis.evolvedCommonLeaf} **(EVOLVED)**

*${author} asked Mizuki if they could receive some spare Power/XP. Mizuki agreed.*

*By snapping her fingers, Mizuki used only a fraction of her power, permanently boosting ${author}.*

${rewardEnding}`;

    }


    return `${emojis.moneyWithWings} **COMMON** 🌿

*${author} asked Mizuki if they could receive some spare Power/XP. Mizuki agreed.*

*By snapping her fingers, Mizuki used only a fraction of her power, permanently boosting ${author}.*

${rewardEnding}`;

}


// ======================
// COMMAND
// ======================

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
            "ezwin"
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
            `⏳ Mizuki is tired... You can use **!ezwin** again in **${hours}h ${minutes}m**.`
        );

    }


    await database.setCommandCooldown(
        guildID,
        userID,
        "ezwin",
        Date.now() + COOLDOWN
    );


    const user =
        await database.getUser(
            guildID,
            userID
        );

    const currentLevel =
        xp.getLevel(
            Number(user?.xp) || 0
        );

    const isLevel100PlusActor =
        currentLevel >= 100;


    const activeLuck =
        await luck.getActiveLuckBoost(
            message.member
        );

    const usedLuckExtra =
        luck.buildUsedCommandLuckExtra(
            activeLuck
        );


    const rarity =
        rollEZWinRarity(
            activeLuck,
            Math.random,
            isLevel100PlusActor
        );

    const evolved =
        rollEZWinEvolved(
            rarity,
            Math.random,
            isLevel100PlusActor
        );

    const rewardRanges =
        getEZWinRanges(
            rarity,
            evolved,
            isLevel100PlusActor
        );


    const gainedXP =
        economyLimits.capSocialXP(
            "ezwin",
            luck.rollCommandXP(
                rewardRanges.gained.min,
                rewardRanges.gained.max,
                activeLuck
            ),
            currentLevel
        );

    const lostXP =
        economyLimits.capSocialXP(
            "ezwin",
            luck.rollCommandXP(
                rewardRanges.lost.min,
                rewardRanges.lost.max,
                activeLuck
            ),
            currentLevel
        );


    const lowLevelLossMultiplier =
        0.10;

    const lowLevelLoss =
        Math.max(
            1,
            Math.floor(
                lostXP *
                lowLevelLossMultiplier
            )
        );


    // Drain every registered player except the actual winner and award the
    // reward in one transaction. A reflected !ezwin makes the troller the
    // winner and makes the command user one of the victims.
    let transactionResult;

    const trollEffect =
        await trolls.getCommandEffect(
            guildID,
            userID,
            trolls.EFFECTS.EZWIN_REFLECT
        );


    try{

        transactionResult =
            await database.performEZWin(
                guildID,
                userID,
                gainedXP,
                lostXP,
                lowLevelLoss,
                xp.getCurrentLevelXP(100),
                trollEffect?.sourceUserID || null
            );

    }
    catch(error){

        // The database transaction has already rolled back. Remove the early
        // cooldown too, so a temporary database failure does not lock the
        // player out of !ezwin for the next 24 hours.
        await database.clearCommandCooldown(
            guildID,
            userID,
            "ezwin"
        ).catch(() => {});


        throw error;

    }


    if(trollEffect){
        await database.completeTrollEffect(
            trollEffect.id,
            {
                ...trollEffect.payload,
                reflectedXP: gainedXP
            }
        );
    }


    const changedUserIDs =
        new Set([
            ...transactionResult.affectedUserIDs,
            transactionResult.winnerUserID || userID
        ]);


    for(const affectedUserID of changedUserIDs){

        await leveling.syncLevelAndAnnounce(
            message.client,
            guildID,
            affectedUserID
        );

    }


    await boosts.tryAndAnnounceXPBoostDrop(
        message,
        "social",
        "!ezwin"
    );


    const dialogue =
        buildEZWinDialogue(
            rarity,
            evolved,
            message.author,
            lostXP,
            gainedXP,
            90,
            usedLuckExtra,
            message.guild,
            trollEffect
                ? `<@${trollEffect.sourceUserID}>`
                : message.author.username
        );


    return sendLongDialogue(
        message.channel,
        dialogue,
        [
            message.author.id,
            ...(
                trollEffect
                    ? [trollEffect.sourceUserID]
                    : []
            )
        ]
    );

}


module.exports = {

    execute,
    COOLDOWN,
    LEVEL1_TO99_EZWIN_RANGES,
    LEVEL1_TO99_EZWIN_OUTCOMES,
    LEVEL100_PLUS_EZWIN_RANGES,
    LEVEL100_PLUS_EZWIN_OUTCOMES,
    LEVEL1_TO99_BASE_LEGENDARY_CHANCE,
    BASE_LEGENDARY_CHANCE,
    LEVEL1_TO99_EZWIN_LUCK_LEGENDARY_BONUSES,
    EZWIN_LUCK_LEGENDARY_BONUSES,
    LEVEL1_TO99_MAX_LEGENDARY_CHANCE,
    MAX_LEGENDARY_CHANCE,
    getEZWinLegendaryChance,
    rollEZWinRarity,
    rollEZWinEvolved,
    getEZWinRanges,
    getLevel1To99EZWinRanges,
    getLevel100PlusEZWinRanges,
    getCustomEmoji,
    getEZWinEmojis,
    splitLongMessage,
    sendLongDialogue,
    buildEZWinDialogue

};
