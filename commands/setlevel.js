const database = require("../database");
const {isBotAdmin} = require("../utils/adminAccess");
const levelRoles = require("../systems/levelRoles");
async function execute(message){
    if(!isBotAdmin(message.author.id)) return message.reply("❌ You cannot use this command.");
    if(!message.guild) return message.reply("Use this command in the server.");
    const args = message.content.trim().split(/\s+/);
    const level = Number(args[1]);
    const userID = (args[2] || "").replace(/^<@!?|>$/g, "");
    if(!Number.isSafeInteger(level) || level < -10000 || level > 10000 || !/^\d{16,22}$/.test(userID)){
        return message.reply("Usage: `!setlevel <level> <@user/userID>` — whole levels from -10000 to 10000, including 0.");
    }
    const member = await message.guild.members.fetch(userID).catch(()=>null);
    if(!member) return message.reply("❌ That user is not a member of this server.");
    await database.adminSetLevel(message.guild.id,userID,level);
    await levelRoles.syncMemberLevelRole(member,level).catch(error=>console.error("Setlevel role sync failed:",error));
    return message.reply({content:`✅ Set **${member.user.username}** to **Level ${level}**.`,allowedMentions:{parse:[]}});
}
module.exports = {execute};
