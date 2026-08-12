const moderation = require("../systems/moderation");

async function execute(message){
    if(!moderation.isModerator(message.member)) return message.reply("❌ You don't have permission to use this command.");
    const parts = message.content.trim().split(/\s+/);
    const target = await moderation.resolveMember(message, parts[1]);
    if(!target) return message.reply("❌ Usage: `!kick @user [reason]`");
    const hierarchyProblem = moderation.hierarchyError(message, target);
    if(hierarchyProblem) return message.reply(hierarchyProblem);
    const reason = parts.slice(2).join(" ").trim() || `Kicked by ${message.author.tag}`;
    if(!target.kickable) return message.reply("❌ Mizuki cannot kick that member.");
    await target.kick(reason);
    return message.reply(`👢 **${target.user.tag}** was kicked.\n**Reason:** ${reason}`);
}

module.exports = { execute };
