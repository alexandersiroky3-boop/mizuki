require("dotenv").config();

const {
    Client,
    GatewayIntentBits
} = require("discord.js");


const leveling = require("./systems/leveling");
const boosts = require("./systems/boosts");
const database = require("./database");
const luck =
    require("./utils/luck");

const quests =
    require("./systems/quests");

const trades =
    require("./systems/trades");

const levelRoles =
    require("./systems/levelRoles");


const levelCommand = require("./commands/level");
const rankCommand = require("./commands/rank");
const giveXPCommand = require("./commands/givexp");
const commandsCommand = require("./commands/commands");
const boostCommand = require("./commands/showboost");
const shopCommand = require("./commands/shop");
const questsCommand = require("./commands/quests");
const setLevelCommand =
require("./commands/setlevel");

const pingCommand =
require("./commands/ping");

const kissCommand =
require("./commands/kiss");

const warnCommand =
require("./commands/warn");

const fixLevelsCommand =
require("./commands/fixlevels");

const ezwinCommand =
require("./commands/ezwin");

const rollCommand =
require("./commands/roll");

const stealCommand =
require("./commands/steal");

const giveallxp =
    require("./commands/giveallxp");

const hugCommand =
require("./commands/hug");

const fixAllUsersInLeaderboardCommand =
    require("./commands/fixallusersinleaderboard");

const logsCommand =
    require("./commands/logs");

const tradeCommand =
    require("./commands/trade");


// =====================================================
// WELCOME + PRIVATE SERVER LOCK
// =====================================================
//
// Mizuki automatically treats the server that owns this
// channel as her ONE allowed server.
const WELCOME_CHANNEL_ID =
    "1324935982755086398";


let MAIN_GUILD_ID =
    null;


function isMainGuild(guildID){

    return (
        MAIN_GUILD_ID
        &&
        String(guildID) ===
            String(MAIN_GUILD_ID)
    );

}


async function resolveMainGuild(){

    const welcomeChannel =
        await client.channels.fetch(
            WELCOME_CHANNEL_ID
        ).catch(
            () => null
        );


    if(
        !welcomeChannel
        ||
        !welcomeChannel.guildId
    ){

        console.error(
            `CRITICAL: Could not resolve welcome channel ${WELCOME_CHANNEL_ID}. ` +
            "Mizuki will ignore all guild commands until the channel is accessible."
        );

        return null;

    }


    MAIN_GUILD_ID =
        String(
            welcomeChannel.guildId
        );


    console.log(
        `Mizuki locked to guild ${MAIN_GUILD_ID}.`
    );


    return MAIN_GUILD_ID;

}


async function leaveUnauthorizedGuilds(){

    for(
        const guild of
        client.guilds.cache.values()
    ){

        if(isMainGuild(guild.id)){
            continue;
        }


        console.warn(
            `Leaving unauthorized guild: ${guild.name} (${guild.id})`
        );


        await guild.leave()
            .catch(error => {

                console.error(
                    `Failed to leave unauthorized guild ${guild.id}:`,
                    error
                );

            });

    }

}


const http = require("http");

const PORT = process.env.PORT || 3000;

http.createServer((request, response) => {
    response.writeHead(200, {
        "Content-Type": "text/plain"
    });

    response.end("Mizuki is online!");
}).listen(PORT, () => {
    console.log(`Health server running on port ${PORT}`);
});






const client = new Client({

intents:[

    GatewayIntentBits.Guilds,

    GatewayIntentBits.GuildMembers,

    GatewayIntentBits.GuildMessages,

    GatewayIntentBits.MessageContent

]

});





client.once("clientReady", async () => {


    await resolveMainGuild();


    if(MAIN_GUILD_ID){

        await leaveUnauthorizedGuilds();

    }


    await database.initDatabase();


    // =====================================================
    // MIZUKI MUST NEVER BE A LEADERBOARD PLAYER
    // =====================================================
    //
    // Older versions of !kiss allowed "@Mizuki" to fall
    // through the normal user path, which created an XP row
    // for the bot. Remove that old row every startup.
    //
    // The fixed !kiss command no longer creates it again.
    if(
        MAIN_GUILD_ID
        &&
        client.user?.id
    ){

        await database.removeUser(
            MAIN_GUILD_ID,
            client.user.id
        ).then(() => {

            console.log(
                "Removed Mizuki from the XP leaderboard/database user table."
            );

        }).catch(error => {

            console.error(
                "Failed to remove Mizuki's old leaderboard entry:",
                error
            );

        });

    }


    await quests.migrateActiveQuestCycles(
        client
    );


    console.log(
        `Logged in as ${client.user.tag}`
    );


    await boosts.restoreBoosts(client);
    await luck.restoreLuckBoosts(client);
    await trades.restoreTrades(client);


    if(MAIN_GUILD_ID){

        const mainGuild =
            await client.guilds.fetch(
                MAIN_GUILD_ID
            ).catch(
                () => null
            );


        if(mainGuild){

            await levelRoles.syncGuildLevelRoles(
                mainGuild
            ).catch(error => {

                console.error(
                    "Initial level-role sync failed:",
                    error
                );

            });

        }

    }



setInterval(async()=>{


    try{

        await boosts.removeExpiredBoosts(
            client
        );

    }
    catch(error){

        console.error(
            "XP Boost cleanup failed:",
            error
        );

    }


    try{

        await luck.removeExpiredLuckBoosts(
            client
        );

    }
    catch(error){

        console.error(
            "Luck Boost cleanup failed:",
            error
        );

    }


},15000);


setInterval(async()=>{

    try{

        await trades.cleanupExpiredTrades(
            client
        );

    }
    catch(error){

        console.error(
            "Trade cleanup failed:",
            error
        );

    }

},60000);


// Backup reconciliation catches unusual/admin XP paths that
// do not call the normal level-sync function.
setInterval(async()=>{

    if(!MAIN_GUILD_ID)
        return;


    const guild =
        await client.guilds.fetch(
            MAIN_GUILD_ID
        ).catch(
            () => null
        );


    if(!guild)
        return;


    await levelRoles.syncGuildLevelRoles(
        guild
    ).catch(error => {

        console.error(
            "Periodic level-role sync failed:",
            error
        );

    });

},5 * 60 * 1000);


});

// =====================================================
// PRIVATE GUILD PROTECTION
// =====================================================
//
// If somebody somehow invites Mizuki to another server,
// she immediately leaves it.
client.on(
    "guildCreate",
    async guild => {

        if(isMainGuild(guild.id)){
            return;
        }


        console.warn(
            `Mizuki was invited to unauthorized guild: ${guild.name} (${guild.id}). Leaving.`
        );


        await guild.leave()
            .catch(console.error);

    }
);


// =====================================================
// WELCOME MESSAGE
// =====================================================

client.on(
    "guildMemberAdd",
    async member => {

        if(
            !isMainGuild(
                member.guild.id
            )
        ){
            return;
        }


        // Only welcome real users, not newly-added bots.
        if(member.user.bot){
            return;
        }


        await levelRoles.syncMemberLevelRole(
            member
        ).catch(error => {

            console.error(
                "Failed to assign join level role:",
                error
            );

        });


        const welcomeChannel =
            await member.guild.channels.fetch(
                WELCOME_CHANNEL_ID
            ).catch(
                () => null
            );


        if(
            !welcomeChannel
            ||
            !welcomeChannel.isTextBased()
        ){
            console.error(
                `Welcome channel ${WELCOME_CHANNEL_ID} could not be used.`
            );

            return;
        }


        await welcomeChannel.send(
            `🌸 Welcome to the server, ${member}~! 💜`
        ).catch(error => {

            console.error(
                "Failed to send welcome message:",
                error
            );

        });

    }
);


client.on(
    "guildMemberUpdate",
    async (oldMember, newMember) => {

        if(
            !isMainGuild(
                newMember.guild.id
            )
        ){
            return;
        }


        await levelRoles.handleProtectedRoleUpdate(
            oldMember,
            newMember
        ).catch(error => {

            console.error(
                "Level-role protection failed:",
                error
            );

        });


        await boosts.checkBoostRole(
            newMember
        );


        await luck.checkLuckBoostRole(
            oldMember,
            newMember
        );

    }
);


client.on("guildMemberRemove", async member => {

    if(
        !isMainGuild(
            member.guild.id
        )
    ){
        return;
    }


    await trades.handleMemberRemove(
        member
    ).catch(error => {

        console.error(
            "Trade member-leave cleanup failed:",
            error
        );

    });


    await database.removeUser(
        member.guild.id,
        member.id
    );

});




client.on(
    "interactionCreate",
    async interaction => {

        if(
            !interaction.guildId
            ||
            !isMainGuild(
                interaction.guildId
            )
        ){
            return;
        }


        await trades.handleInteraction(
            interaction
        );

    }
);



client.on(
"messageCreate",
async message => {


    if(message.author.bot)
        return;


    try {


        if(!message.guild)
            return;


        if(
            !isMainGuild(
                message.guild.id
            )
        ){
            return;
        }


        await quests.recordEvent(
            message,
            "messages",
            1
        );


        if(message.content === "!level"){

            return levelCommand.execute(
                message
            );

        }



        if(message.content === "!rank"){

            return rankCommand.execute(
                message
            );

        }

if(message.content === "!commands"){

    return commandsCommand.execute(
        message
    );

}

if(message.content === "!boost"){

    return boostCommand.execute(
        message
    );

}

if(
    message.content
        .trim()
        .toLowerCase() === "!quests"
){

    return questsCommand.execute(
        message
    );

}

if(
    message.content
        .trim()
        .toLowerCase() === "!shop"
){

    return shopCommand.execute(
        message
    );

}


if(
    /^!trade(?:\s|$)/i.test(
        message.content.trim()
    )
){

    return tradeCommand.execute(
        message
    );

}

if(message.content.startsWith("!setlevel")){

    return setLevelCommand.execute(
        message
    );

}

if(message.content === "!ping"){

    return pingCommand.execute(
        message
    );

}

if(message.content.startsWith("!kiss")){

    return kissCommand.execute(
        message
    );

}

if(message.content.startsWith("!warn")){

    return warnCommand.execute(
        message
    );

}

if(message.content === "!fixlevels"){

    return fixLevelsCommand.execute(
        message
    );

}

if(message.content === "!ezwin"){

    return ezwinCommand.execute(
        message
    );

}

if(
    message.content
        .trim()
        .toLowerCase() === "!roll"
){

    return rollCommand.execute(
        message
    );

}

if(message.content.startsWith("!steal")){

    return stealCommand.execute(
        message
    );

}

if(message.content.startsWith("!giveallxp")){

    return giveallxp.execute(
        message
    );

}

if(message.content.startsWith("!hug")){

    return hugCommand.execute(
        message
    );

}

if(
    message.content.toLowerCase() ===
    "!fixallusersinleaderboard"
){

    return fixAllUsersInLeaderboardCommand.execute(
        message
    );

}

if(
    message.content.toLowerCase() ===
    "!logs"
){

    return logsCommand.execute(
        message
    );

}


        if(message.content.startsWith("!givexp")){

            return giveXPCommand.execute(
                message
            );

        }



        const result =
            await leveling.giveXP(
                message
            );



        if(!result)
            return;


await quests.recordEvent(
    message,
    "earn_xp",
    Math.max(
        0,
        Number(result.earnedXP) || 0
    )
);


if(result.critical){

    await quests.recordEvent(
        message,
        "critical_streak",
        Number(result.criticalStreak) || 0
    );


    // React to every critical message.
    message.react(
        "💥"
    ).catch(() => {});



    // Critical streaks 2–5.
    if(
        result.criticalStreak >= 2 &&
        result.criticalStreak <= 5
    ){

        message.reply(

            `💥 **${message.author.username} got ${result.criticalStreak} critical streaks!**`

        ).catch(() => {});

    }



    // Critical streaks above 5.
    else if(result.criticalStreak > 5){

        message.reply(

            `🐦‍🔥🔥 **${message.author.username} GOT ${result.criticalStreak} CRITICAL STREAKS!!** 🔥🐦‍🔥`

        ).catch(() => {});

    }


}


// The user had a streak but failed the next critical.
else if(result.lostCriticalStreak >= 2){


    message.reply(

        `💔 **${message.author.username} lost their ${result.lostCriticalStreak}x critical streak!**`

    ).catch(() => {});


}

// ======================
// LEVEL-UP ANNOUNCEMENT
// ======================

if(result.leveledUp){


    await quests.recordEvent(
        message,
        "level_change",
        1
    );


    const LEVEL_CHANNEL_ID =
        "1324972482951774249";


    const levelChannel =
        await client.channels.fetch(
            LEVEL_CHANNEL_ID
        ).catch(() => null);



    if(levelChannel){


        await levelChannel.send(

            `🎉 Congratulations my sweet little pancake aka ${message.author}! You reached **Level ${result.level}**!`

        ).catch(console.error);


    }


}



// ======================
// XP LOG CHANNEL
// ======================

const XP_LOG_CHANNEL =
    "1527632057574887474";


const logChannel =
    client.channels.cache.get(
        XP_LOG_CHANNEL
    );


if(logChannel){


let prefix = "";


if(result.critical){

    prefix =
        "💥".repeat(
            Math.min(
                result.criticalStreak,
                5
            )
        ) + " ";

}


logChannel.send(

    `${prefix}${message.author.tag} gained ${result.earnedXP} XP`

).catch(()=>{});


}


console.log(
    `${message.author.tag} gained ${result.earnedXP} XP`
);


    }
catch(error){

    console.error(error);

}


});







client.login(
    process.env.TOKEN
);
