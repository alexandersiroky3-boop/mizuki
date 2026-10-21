const database = require("../database");
const leveling = require("../systems/leveling");
const chests = require("../systems/chests");


const MIN_BET = 1000;
const MAX_BET = 100000000;
const MIN_MULTIPLIER = 1.1;
const MAX_MULTIPLIER = 10;
const COINFLIP_LOCK_MS = 30 * 1000;
const FRAME_DELAY_MS = 450;


function getCustomEmoji(guild, name, fallback){
    const emoji = guild?.emojis?.cache?.find?.(
        entry => entry.name === name
    );
    return emoji ? emoji.toString() : fallback;
}


function getCoinEmojis(guild){
    return {
        heads: getCustomEmoji(guild, "coin_heads", "🪙"),
        middle: getCustomEmoji(guild, "coin_mid_flip", "✨"),
        tails: getCustomEmoji(guild, "coin_tails", "🪙")
    };
}


function parseAmount(value){
    const normalized = String(value || "")
        .replaceAll(",", "")
        .replaceAll("_", "")
        .trim();
    if(!/^\d+$/.test(normalized)){
        return null;
    }
    const amount = Number(normalized);
    return Number.isSafeInteger(amount) ? amount : null;
}


function parseMultiplier(value){
    const normalized = String(value || "")
        .trim()
        .toLowerCase()
        .replace(/x$/, "");
    if(!/^\d+(?:\.\d+)?$/.test(normalized)){
        return null;
    }
    const multiplier = Number(normalized);
    return Number.isFinite(multiplier) ? multiplier : null;
}


function wait(milliseconds){
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}


async function execute(message, options = {}){
    if(!message.guild){
        return null;
    }

    if(!await database.isCoinflipUnlocked(
        message.guild.id,
        message.author.id
    )){
        return message.reply({
            content:
                `🔒 You have not obtained \`!coinflip\` yet. It has a **0.5%** drop chance from a ${chests.getChestEmoji(message.guild, "boss")} **Boss Chest**.`,
            allowedMentions: {parse: [], repliedUser: false}
        });
    }

    const [, predictionInput, betInput, multiplierInput] =
        String(message.content || "").trim().split(/\s+/);

    const prediction = String(predictionInput || "").toLowerCase();
    const bet = parseAmount(betInput);
    const multiplier = parseMultiplier(multiplierInput);

    if(
        !["heads", "tails"].includes(prediction)
        || bet == null
        || bet < MIN_BET
        || bet > MAX_BET
        || multiplier == null
        || multiplier < MIN_MULTIPLIER
        || multiplier > MAX_MULTIPLIER
    ){
        return message.reply({
            content:
                "🪙 Usage: `!coinflip <heads|tails> <1,000-100,000,000 XP> <1.1x-10x>`\n" +
                "Example: `!coinflip heads 5000000 2.5x`",
            allowedMentions: {parse: [], repliedUser: false}
        });
    }

    const lockClaimed = options.skipLock
        ? true
        : await database.claimCommandCooldown(
            message.guild.id,
            message.author.id,
            "coinflip",
            Date.now() + COINFLIP_LOCK_MS
        );

    if(!lockClaimed){
        return message.reply({
            content: "🪙 Your previous coin is still flipping. Wait for it to land.",
            allowedMentions: {parse: [], repliedUser: false}
        });
    }

    const emojis = getCoinEmojis(message.guild);
    const frames = [
        emojis.heads,
        emojis.middle,
        emojis.tails,
        emojis.middle,
        emojis.heads,
        emojis.middle,
        emojis.tails,
        emojis.middle
    ];

    let flipMessage;
    let settlementCompleted = false;

    try{
        flipMessage = await message.reply({
            content:
                `${frames[0]} **Flipping...**\n` +
                `Prediction: **${prediction.toUpperCase()}** • Bet: **${bet.toLocaleString()} XP** • Multiplier: **${multiplier}x**`,
            allowedMentions: {parse: [], repliedUser: false}
        });

        for(const frame of frames.slice(1)){
            await wait(FRAME_DELAY_MS);
            await flipMessage.edit({
                content:
                    `${frame} **Flipping...**\n` +
                    `Prediction: **${prediction.toUpperCase()}** • Bet: **${bet.toLocaleString()} XP** • Multiplier: **${multiplier}x**`,
                allowedMentions: {parse: []}
            });
        }

        const landed = Math.random() < 0.5 ? "heads" : "tails";
        const won = landed === prediction;

        const settlement = await database.settleCoinflip({
            guildID: message.guild.id,
            userID: message.author.id,
            bet,
            multiplier,
            won
        });

        if(!settlement.success){
            await flipMessage.edit({
                content:
                    `❌ The coin was cancelled because you need at least **${bet.toLocaleString()} XP** available when it lands. ` +
                    `Current balance: **${Number(settlement.balance).toLocaleString()} XP**.`,
                allowedMentions: {parse: []}
            });
            return flipMessage;
        }

        settlementCompleted = true;

        await leveling.syncLevelAndAnnounce(
            message.client,
            message.guild.id,
            message.author.id
        ).catch(() => null);

        const landedEmoji =
            landed === "heads" ? emojis.heads : emojis.tails;

        await flipMessage.edit({
            content:
                `${landedEmoji} **The coin landed on ${landed.toUpperCase()}!**\n\n` +
                `${won ? "✅" : "❌"} ${message.author} **${won ? "WON" : "LOST"}** the coinflip.\n` +
                `${won ? "Received" : "Lost"}: **${Math.abs(settlement.delta).toLocaleString()} XP**\n` +
                `New balance: **${Number(settlement.balance).toLocaleString()} XP**`,
            allowedMentions: {
                users: [message.author.id],
                repliedUser: false
            }
        });

        return flipMessage;
    }
    catch(error){
        if(flipMessage){
            await flipMessage.edit({
                content:
                    settlementCompleted
                        ? "⚠️ The coin landed and XP was settled, but I could not finish updating this message. Check your `!level` balance."
                        : "❌ The coinflip stopped before settlement. No XP was changed.",
                allowedMentions: {parse: []}
            }).catch(() => null);
        }
        throw error;
    }
    finally{
        if(!options.skipLock){
            await database.clearCommandCooldown(
                message.guild.id,
                message.author.id,
                "coinflip"
            ).catch(() => null);
        }
    }
}


module.exports = {
    execute,
    MIN_BET,
    MAX_BET,
    MIN_MULTIPLIER,
    MAX_MULTIPLIER,
    parseAmount,
    parseMultiplier,
    getCoinEmojis
};
