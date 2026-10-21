const database = require("../database");
const boosts = require("../systems/boosts");
const chests = require("../systems/chests");


const BLESS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;


function formatRemaining(milliseconds){
    const totalHours = Math.ceil(Math.max(0, milliseconds) / 3600000);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    return days > 0
        ? `**${days}d ${hours}h**`
        : `**${hours}h**`;
}


function buildBlessDialogue(user, blessing, extended){
    const luckPercent = Math.round(
        (Number(blessing.luckMultiplier) - 1) * 100
    );
    const chatXPPercent = Math.round(
        (Number(blessing.chatXPMultiplier) - 1) * 100
    );
    const expiry = Math.floor(Number(blessing.expiresAt) / 1000);

    if(extended){
        return `### 🙏💗 ${user} EXTENDED THE BLESSING 💗🙏

*The blessing was already active, so its effects did not stack. Its timer was extended by **8 hours**.*

**🍀 Everyone keeps +${luckPercent}% more LUCK!**

**✦ Everyone keeps +${chatXPPercent}% more chat XP!**

*🕊️ The blessing now ends <t:${expiry}:R> 🕊️*`;
    }

    return `### 🙏💗 ${user} BLESSED EVERYONE 💗🙏

*The whole crew were holding their hands to provide a blessing to each other...

Kape... Mrnoob... thezdrink... gorjezz... beyondborder_08386... shadow067972... kdc... and ${user}.

All of them held their hands before Kape raised the Gauntlet, using all of the Infinity Stones...*

**SNAPS HIS FINGERS**

**🍀 Everyone received +${luckPercent}% more LUCK!**

**✦ Everyone received +${chatXPPercent}% more chat XP!**

*🕊️ The blessing lasts 1 day — ends <t:${expiry}:R> 🕊️*`;
}


async function execute(message, options = {}){
    if(!message.guild){
        return null;
    }

    const argument = String(message.content || "")
        .trim()
        .split(/\s+/)[1]
        ?.toLowerCase();

    if(argument !== "everyone"){
        return message.reply({
            content: "🙏 Usage: `!bless everyone`",
            allowedMentions: {parse: [], repliedUser: false}
        });
    }

    if(!await database.isBlessUnlocked(
        message.guild.id,
        message.author.id
    )){
        return message.reply({
            content:
                `🔒 You have not obtained \`!bless\` yet. It can rarely drop from a ${chests.getChestEmoji(message.guild, "bronze")} **Bronze Chest**.`,
            allowedMentions: {parse: [], repliedUser: false}
        });
    }

    const cooldownEndsAt = Date.now() + BLESS_COOLDOWN_MS;
    const claimed = options.skipCooldown
        ? true
        : await database.claimCommandCooldown(
            message.guild.id,
            message.author.id,
            "bless",
            cooldownEndsAt
        );

    if(!claimed){
        const remaining = await database.getCommandCooldownRemaining(
            message.guild.id,
            message.author.id,
            "bless"
        );
        return message.reply({
            content:
                `⏳ You can bless the server again in ${formatRemaining(remaining)}.`,
            allowedMentions: {parse: [], repliedUser: false}
        });
    }

    try{
        const powerful = Math.random() < 0.15;
        const result = await database.activateGuildBlessing({
            guildID: message.guild.id,
            userID: message.author.id,
            luckMultiplier: powerful ? 21 : 6,
            chatXPMultiplier: powerful ? 6 : 2
        });

        const sent = await message.reply({
            content: buildBlessDialogue(
                message.author,
                result.blessing,
                result.status === "extended"
            ),
            allowedMentions: {
                users: [message.author.id],
                repliedUser: false
            }
        });

        await boosts.tryOmegaDropFromBoostUpgrade(
            message,
            "!bless"
        ).catch(() => null);

        return sent;
    }
    catch(error){
        if(!options.skipCooldown){
            await database.clearCommandCooldown(
                message.guild.id,
                message.author.id,
                "bless"
            ).catch(() => null);
        }
        throw error;
    }
}


module.exports = {
    execute,
    BLESS_COOLDOWN_MS,
    buildBlessDialogue
};
