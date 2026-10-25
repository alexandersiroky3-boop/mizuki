const database = require('../database');
async function execute(message){
    if(!message.guild || message.author.id !== '1239975819112353969') return;
    if(!/^!removemulticommands\s+everyone\s*$/i.test(message.content)){
        return message.reply('Usage: `!removemulticommands everyone`');
    }
    const count = await database.removeMultiCommands(message.guild.id);
    return message.reply({content: `Removed all saved multi-command bonuses for **${count}** users in this server. Already-running commands will finish.`, allowedMentions:{parse:[]}});
}
module.exports = {execute};
