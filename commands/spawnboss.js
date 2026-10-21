const database = require("../database");
const bosses = require("../systems/bosses");
const boosts = require("../systems/boosts");
const chests = require("../systems/chests");
const bossCommand = require("./boss");


async function execute(message){
    if(!message.guild){
        return null;
    }

    const entitlements = await database.getBossEntitlements(
        message.guild.id,
        message.author.id
    );

    if(entitlements.spawnBossUses <= 0){
        return message.reply({
            content:
                `🔒 You do not have a \`!spawnboss\` use. A ${chests.getChestEmoji(message.guild, "boss")} **Boss Chest** can drop one, and Boss Shop uses stack.`,
            allowedMentions: {parse: [], repliedUser: false}
        });
    }

    const result = await bosses.spawnGuaranteedBoss(
        message.guild.id,
        message.author.id
    );

    if(!result.success){
        if(result.status === "boss-active"){
            return message.reply({
                content:
                    `⚔️ **${result.definition?.name || "A raid boss"}** is already active. Your use was **not consumed**—wait for this raid to end.`,
                allowedMentions: {parse: [], repliedUser: false}
            });
        }

        return message.reply({
            content:
                result.status === "no-use"
                    ? "❌ Your `!spawnboss` use is no longer available."
                    : "⚠️ Another raid boss appeared at the same moment. Your use was returned.",
            allowedMentions: {parse: [], repliedUser: false}
        });
    }

    await bossCommand.handleCombatResult(
        message,
        result
    );

    const reply = await message.reply({
        content:
            `⚔️ ${message.author} used **!spawnboss** and summoned **${result.definition.name} {CANON}**!\n` +
            `Remaining uses: **${Number(result.remainingUses).toLocaleString()}**. ` +
            "The live raid panel was sent to the raid-boss channel.",
        allowedMentions: {
            users: [message.author.id],
            repliedUser: false
        }
    });

    await boosts.tryOmegaDropFromBoostUpgrade(
        message,
        "!spawnboss"
    ).catch(() => null);

    return reply;
}


module.exports = {execute};
