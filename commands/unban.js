const moderation = require("../systems/moderation");

async function execute(message){
    if(!moderation.isModerator(message.member)){
        return message.reply("❌ You don't have permission to use this command.");
    }

    const raw = message.content.trim().split(/\s+/)[1];
    const userID = message.mentions.users.first()?.id || String(raw || "").replace(/[^0-9]/g, "");
    if(!userID) return message.reply("❌ Usage: `!unban @user` or `!unban userID`");
    if(userID === moderation.OWNER_ID) return message.reply("❌ The server owner is permanently protected.");

    const active = await require("../database").getActiveModerationBan(message.guild.id, userID);
    if(active){
        await moderation.restoreTimedBan(message.guild, userID, `Unbanned by ${message.author.tag}`);
        return message.reply(`✅ <@${userID}> has been unbanned and their saved roles were restored.`);
    }

    const discordBan = await message.guild.bans.fetch(userID).catch(() => null);
    if(discordBan){
        await message.guild.members.unban(userID, `Unbanned by ${message.author.tag}`);
        return message.reply(`✅ <@${userID}> has been unbanned from the server.`);
    }

    return message.reply("❌ That user is not banned.");
}

module.exports = { execute };
