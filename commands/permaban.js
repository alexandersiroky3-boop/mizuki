const moderation = require("../systems/moderation");

async function execute(message){
    if(!moderation.isModerator(message.member)) return message.reply("❌ You don't have permission to use this command.");
    const parts = message.content.trim().split(/\s+/);
    const target = await moderation.resolveMember(message, parts[1]);
    if(!target) return message.reply("❌ Usage: `!permaban @user [reason]`");
    const hierarchyProblem = moderation.hierarchyError(message, target);
    if(hierarchyProblem) return message.reply(hierarchyProblem);
    const reason = parts.slice(2).join(" ").trim() || `Permanently banned by ${message.author.tag}`;
    if(!target.bannable) return message.reply("❌ Mizuki cannot permanently ban that member.");
    await target.ban({ reason, deleteMessageSeconds: 0 });
    return message.reply(`⛔ **${target.user.tag}** was permanently banned.\n**Reason:** ${reason}`);
}

module.exports = { execute };
