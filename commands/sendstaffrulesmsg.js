const OWNER_ID = "1239975819112353969";

const STAFF_RULE_MESSAGES = [
`### 🛠️ [Mod Rules]

*To be a mod for this server, you'll need to follow specific rules to provide the people with fair & square moderation.*

*1.* **Disrespectful acts toward a user**
If a certain user is being disrespectful toward someone/something, warn them about it. If they continue with the same act, ban them for 1–3 days. **[If a certain user is disrespectful toward a mod, they get permanently banned.]**

*2.* **Spamming**
If you see a flooded chat caused by words/commands, first warn the person. If they continue with the act, ban them for 3–5 days. **[Any spamming that causes the bot to be delayed in any way automatically raises their ban by a day or two.]**`,

`*3.* **Speaking a different language**
If a certain user is communicating with someone in a different language (this doesn't mean comparing or showing examples of your country/language), politely warn them about it. If they continue, warn them for the second and final time. If they keep continuing after both warnings, kick them from the server.

*4.* **Heavy swears/racist slurs toward a user**
If a user uses heavy swear words to disrespect or humiliate another user, warn them about it. If they do it again, fairly ban them for 5–10 days. **[Swear words like "fuck," "shit," "ass," etc. that are pointing at a THING and not a person are fine. For example: "Wow, this day is full of shit" is completely fine.]**

Any racist slur, such as the N-word, that disrespects Black culture is immediately bannable for 10–20 days without a warning.`,

`*5.* **NSFW content**
If a user says or reacts with something that heavily relates to sex, warn them. If they continue with the act, ban them for 3–6 days. **[Flirting, kissing, or saying "I love you" is completely fine.]** Any NSFW media is immediately bannable for 10–20 days without a warning.

**IMPORTANT: These rules stack. For example, if somebody breaks multiple rules [sends NSFW media, uses racist slurs, and spams], the ban time will obviously be longer. Add up the days from all the rules the user broke. However, if a user breaks three or more rules, they are immediately permanently banned.**

*Use these commands: "!ban @user <timeInDays> <reason for banning>", "!unban @user", "!kick @user", and "!permaban @user".*`
];

async function execute(message){
    if(!message.guild) return;

    if(message.author.id !== OWNER_ID){
        return message.reply("❌ Only the server owner can use this command.");
    }

    for(const content of STAFF_RULE_MESSAGES){
        await message.channel.send({
            content,
            allowedMentions: { parse: [] }
        });
    }
}

module.exports = {
    OWNER_ID,
    STAFF_RULE_MESSAGES,
    execute
};
