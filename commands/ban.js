const moderation = require("../systems/moderation");

async function execute(message){
    if(!moderation.isModerator(message.member)){
        return message.reply("❌ You don't have permission to use this command.");
    }

    const parts = message.content.trim().split(/\s+/);
    if(parts.length < 4){
        return message.reply("❌ Usage: `!ban @user <time> <reason>` — example: `!ban @user 7d Spamming`");
    }

    const target = await moderation.resolveMember(message, parts[1]);
    if(!target) return message.reply("❌ I couldn't find that member.");
    const hierarchyProblem = moderation.hierarchyError(message, target);
    if(hierarchyProblem) return message.reply(hierarchyProblem);

    const duration = moderation.parseDuration(parts[2]);
    if(!duration){
        return message.reply("❌ Invalid time. Use `30m`, `12h`, `7d`, or `2w` (maximum 365 days). A number by itself means days.");
    }

    const reason = parts.slice(3).join(" ").trim();
    if(!reason) return message.reply("❌ You must provide a reason.");

    try{
        const result = await moderation.applyTimedBan(message, target, duration, reason);
        if(result.error) return message.reply(result.error);
        return message.reply(`🔨 ${target} has been banned until <t:${Math.floor(result.expiresAt / 1000)}:F>.\n**Reason:** ${reason}`);
    } catch(error){
        console.error("Temporary ban failed:", error);
        return message.reply("❌ I couldn't apply the ban. Check Mizuki's role hierarchy and Manage Roles permission.");
    }
}

module.exports = { execute };
