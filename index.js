require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    Partials
} = require("discord.js");


const leveling = require("./systems/leveling");
const boosts = require("./systems/boosts");
const powerRunes = require("./systems/powerRunes");
const trolls = require("./systems/trolls");
const database = require("./database");
const luck =
    require("./utils/luck");
const {getCriticalEmojis} = require("./utils/criticalEmojis");

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
const updatesCommand = require("./commands/updates");
const afkCommand = require("./commands/afk");
const trollCommand = require("./commands/troll");
const boostCommand = require("./commands/showboost");
const valuesCommand = require("./commands/values");
const sellCommand = require("./commands/sell");
const muteCommand = require("./commands/mute");
const upgradesCommand = require("./commands/upgrades");
const setUpgradeCommand = require("./commands/setupgrade");
const shopCommand = require("./commands/shop");
const merchantCommand =
    require("./commands/merchant");
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

const sendVerifyMSGCommand =
    require("./commands/sendverifymsg");

const moderation =
    require("./systems/moderation");

const banCommand = require("./commands/ban");
const unbanCommand = require("./commands/unban");
const kickCommand = require("./commands/kick");
const permabanCommand = require("./commands/permaban");
const sendStaffRulesMSGCommand = require("./commands/sendstaffrulesmsg");


// =====================================================
// SAFE PREFIX COMMAND ROUTER
// =====================================================
//
// A command must never disappear because an unrelated AFK, troll or quest
// hook failed first. Every known prefix command is routed in one place and
// command failures are reported both in the log and to the user.

const missingMessageHookWarnings =
    new Set();


function warnAboutMissingMessageHook(
    hookName
){

    if(
        missingMessageHookWarnings.has(
            hookName
        )
    ){
        return;
    }


    missingMessageHookWarnings.add(
        hookName
    );


    console.error(
        `Missing message hook: ${hookName}. Commands will continue without it.`
    );

}


async function runMessageHooksSafely(
    message,
    normalizedMessageContent
){

    if(
        normalizedMessageContent !== "!afk"
    ){

        if(
            typeof afkCommand
                ?.removeAFKOnMessage ===
                "function"
        ){

            try{

                await afkCommand
                    .removeAFKOnMessage(
                        message
                    );

            }
            catch(error){

                console.error(
                    "Automatic AFK removal failed before command routing:",
                    error
                );

            }

        }
        else{

            warnAboutMissingMessageHook(
                "commands/afk.removeAFKOnMessage"
            );

        }

    }


    let changedUserIDs = [];


    if(
        typeof trolls
            ?.handleMessageStart ===
            "function"
    ){

        try{

            const trollMessageResult =
                await trolls.handleMessageStart(
                    message
                );


            changedUserIDs =
                Array.isArray(
                    trollMessageResult
                        ?.changedUserIDs
                )
                    ? trollMessageResult
                        .changedUserIDs
                    : [];

        }
        catch(error){

            console.error(
                "Troll message hook failed before command routing:",
                error
            );

        }

    }
    else{

        warnAboutMissingMessageHook(
            "systems/trolls.handleMessageStart"
        );

    }


    for(
        const changedUserID of
        new Set(changedUserIDs)
    ){

        await leveling
            .syncLevelAndAnnounce(
                message.client,
                message.guild.id,
                changedUserID
            )
            .catch(error => {

                console.error(
                    "Troll level sync failed before command routing:",
                    error
                );

            });

    }

}


async function recordMessageQuestSafely(
    message
){

    if(
        typeof quests?.recordEvent !==
            "function"
    ){

        warnAboutMissingMessageHook(
            "systems/quests.recordEvent"
        );

        return;

    }


    try{

        await quests.recordEvent(
            message,
            "messages",
            1
        );

    }
    catch(error){

        console.error(
            "Message quest progress failed before command routing:",
            error
        );

    }

}


async function executePrefixCommandSafely(
    message,
    label,
    commandModule,
    methodName = "execute"
){

    const handler =
        commandModule?.[methodName];


    if(typeof handler !== "function"){

        console.error(
            `Command ${label} is misconfigured: ${methodName}() was not exported. Check that the correct file is in the correct folder.`
        );


        await message.reply({
            content:
                `❌ **${label} is temporarily unavailable because its command file is in the wrong location or is the wrong version.**`,
            allowedMentions: {
                parse: [],
                repliedUser: false
            }
        }).catch(() => {});


        return true;

    }


    try{

        await handler.call(
            commandModule,
            message
        );

    }
    catch(error){

        console.error(
            `Command ${label} failed:`,
            error
        );


        await message.reply({
            content:
                `❌ **${label} failed while running.** The error was recorded in the bot log.`,
            allowedMentions: {
                parse: [],
                repliedUser: false
            }
        }).catch(() => {});

    }


    return true;

}


async function dispatchPrefixCommand(
    message,
    normalizedMessageContent
){

    const content =
        String(message.content || "")
            .trim();


    const exactRoutes =
        new Map([
            ["!level", ["!level", levelCommand]],
            ["!rank", ["!rank", rankCommand]],
            ["!leaderboard", ["!leaderboard", rankCommand]],
            ["!commands", ["!commands", commandsCommand]],
            ["!updates", ["!updates", updatesCommand]],
            ["!afk", ["!afk", afkCommand]],
            ["!boost", ["!boost", boostCommand]],
            ["!values", ["!values", valuesCommand]],
            ["!sell", ["!sell", sellCommand]],
            ["!mute", ["!mute", muteCommand]],
            ["!upgrades", ["!upgrades", upgradesCommand]],
            ["!quests", ["!quests", questsCommand]],
            ["!shop", ["!shop", shopCommand]],
            ["!sendstaffrulesmsg", ["!sendstaffrulesmsg", sendStaffRulesMSGCommand]],
            ["!sendverifymsg", ["!sendverifymsg", sendVerifyMSGCommand]],
            ["!ping", ["!ping", pingCommand]],
            ["!fixlevels", ["!fixlevels", fixLevelsCommand]],
            ["!ezwin", ["!ezwin", ezwinCommand]],
            ["!roll", ["!roll", rollCommand]],
            ["!fixallusersinleaderboard", ["!fixallusersinleaderboard", fixAllUsersInLeaderboardCommand]],
            ["!logs", ["!logs", logsCommand]],
            ["!resetweeklyrank", ["!resetweeklyrank", rankCommand, "resetWeeklyRank"]]
        ]);


    const exactRoute =
        exactRoutes.get(
            normalizedMessageContent
        );


    if(exactRoute){

        return executePrefixCommandSafely(
            message,
            exactRoute[0],
            exactRoute[1],
            exactRoute[2] || "execute"
        );

    }


    const patternRoutes = [
        ["!resetmonthlyrank", /^!resetmonthlyrank(?:\s|$)/i, rankCommand, "resetMonthlyRank"],
        ["!setupgrade", /^!setupgrade(?:\s|$)/i, setUpgradeCommand],
        ["!merchant", /^!merchant(?:\s|$)/i, merchantCommand],
        ["!permaban", /^!permaban(?:\s|$)/i, permabanCommand],
        ["!unban", /^!unban(?:\s|$)/i, unbanCommand],
        ["!kick", /^!kick(?:\s|$)/i, kickCommand],
        ["!ban", /^!ban(?:\s|$)/i, banCommand],
        ["!trade", /^!trade(?:\s|$)/i, tradeCommand],
        ["!setlevel", /^!setlevel(?:\s|$)/i, setLevelCommand],
        ["!troll", /^!troll(?:\s|$)/i, trollCommand],
        ["!kiss", /^!kiss(?:\s|$)/i, kissCommand],
        ["!warn", /^!warn(?:\s|$)/i, warnCommand],
        ["!steal", /^!steal(?:\s|$)/i, stealCommand],
        ["!giveallxp", /^!giveallxp(?:\s|$)/i, giveallxp],
        ["!hug", /^!hug(?:\s|$)/i, hugCommand],
        ["!givexp", /^!givexp(?:\s|$)/i, giveXPCommand]
    ];


    for(const route of patternRoutes){

        if(route[1].test(content)){

            return executePrefixCommandSafely(
                message,
                route[0],
                route[2],
                route[3] || "execute"
            );

        }

    }


    return false;

}


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

const serviceState = {
    databaseReady: false,
    discordReady: false,
    shuttingDown: false
};


function isServiceReady(){

    return (
        serviceState.databaseReady
        &&
        serviceState.discordReady
        &&
        !serviceState.shuttingDown
    );

}


const healthServer =
    http.createServer((request, response) => {

        const ready =
            isServiceReady();


        response.writeHead(
            ready ? 200 : 503,
            {
                "Content-Type":
                    "text/plain; charset=utf-8",
                "Cache-Control":
                    "no-store"
            }
        );


        response.end(
            ready
                ? "Mizuki is online!"
                : serviceState.shuttingDown
                    ? "Mizuki is shutting down."
                    : "Mizuki is starting up."
        );

    });


healthServer.on("error", error => {

    console.error(
        "Health server failed:",
        error
    );


    process.exit(1);

});


healthServer.listen(
    PORT,
    "0.0.0.0",
    () => {
        console.log(
            `Health server listening on port ${PORT}; waiting for PostgreSQL and Discord.`
        );
    }
);






const client = new Client({

intents:[

    GatewayIntentBits.Guilds,

    GatewayIntentBits.GuildMembers,

    GatewayIntentBits.GuildMessages,

    GatewayIntentBits.GuildMessageReactions,

    GatewayIntentBits.MessageContent

],

partials:[

    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User

]

});





client.once("clientReady", async () => {


    // Discord is connected. Render may now mark the service healthy once
    // PostgreSQL is ready too; startup restore jobs can continue afterward.
    serviceState.discordReady =
        true;


    await resolveMainGuild();


    if(MAIN_GUILD_ID){

        await leaveUnauthorizedGuilds();

    }


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
        const guild = await client.guilds.fetch(MAIN_GUILD_ID).catch(() => null);
        if(guild){
            await guild.emojis.fetch().catch(error =>
                console.error("Could not load critical emojis:", error));
            await guild.commands.create(trollCommand.slashCommand.toJSON())
                .catch(error => console.error("Could not register /troll:", error));
            await powerRunes.restorePowerRuneRoles(client, MAIN_GUILD_ID)
                .catch(error => console.error("Power Rune role restore failed:", error));
        }
    }

    if(MAIN_GUILD_ID){
        await moderation.initialize(client, MAIN_GUILD_ID).catch(error => {
            console.error("Moderation restore failed:", error);
        });
    }


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


    if(MAIN_GUILD_ID){

        // Older rank.js versions do not export processScheduledResets().
        // Calling a missing method throws synchronously, so attaching .catch()
        // cannot prevent the Client error event from crashing the bot.
        if(
            typeof rankCommand
                ?.processScheduledResets ===
                "function"
        ){

            const runScheduledResetCheck =
                async label => {

                    try{

                        await rankCommand
                            .processScheduledResets(
                                client,
                                MAIN_GUILD_ID
                            );

                    }
                    catch(error){

                        console.error(
                            `${label} leaderboard reset check failed:`,
                            error
                        );

                    }

                };


            await runScheduledResetCheck(
                "Initial"
            );


            setInterval(
                () => {

                    void runScheduledResetCheck(
                        "Scheduled"
                    );

                },
                60 * 1000
            );

        }
        else{

            console.warn(
                "Scheduled leaderboard resets are disabled because commands/rank.js does not export processScheduledResets(). The bot will continue running normally."
            );

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

setInterval(async () => {
    if(!MAIN_GUILD_ID) return;
    await powerRunes.removeExpiredPowerRuneRoles(client, MAIN_GUILD_ID)
        .catch(error => console.error("Power Rune role cleanup failed:", error));
}, 5000);


setInterval(async()=>{

    try{

        if(MAIN_GUILD_ID){
            await database.cleanupExpiredTrollEffects(
                MAIN_GUILD_ID
            );
        }

    }
    catch(error){

        console.error(
            "Troll effect cleanup failed:",
            error
        );

    }

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


setInterval(async()=>{

    try{
        await moderation.restoreExpiredBans(client);

        if(MAIN_GUILD_ID){
            const guild = await client.guilds.fetch(MAIN_GUILD_ID).catch(() => null);
            if(guild) await moderation.updateBanList(guild);
        }
    }
    catch(error){
        console.error("Temporary-ban cleanup failed:", error);
    }

},30000);


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


client.on("interactionCreate", async interaction => {
    if(!interaction.isChatInputCommand() || interaction.commandName !== "troll"){
        return;
    }
    if(!interaction.guild || !isMainGuild(interaction.guild.id)){
        return interaction.reply({
            content: "This command is only available in the main server.",
            flags: 64
        }).catch(() => {});
    }
    if(String(interaction.channelId) === "1536777096200720545"){
        return interaction.reply({
            content: "🚫 You cannot use commands in this channel.",
            flags: 64
        }).catch(() => {});
    }
    await trollCommand.executeInteraction(interaction).catch(error => {
        console.error("Private /troll interaction failed:", error);
    });
});

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


        let bannedRoleProtection;

        try{

            bannedRoleProtection =
                await moderation.handleBannedRoleProtection(
                    oldMember,
                    newMember
                );

        }
        catch(error){

            console.error(
                "Banned-role protection failed:",
                error
            );


            // Do not let other automatic role systems act on a member while
            // a protected Banned-role change could not be verified/reverted.
            return;

        }


        if(bannedRoleProtection.reverted){
            return;
        }


        // A banned member is intentionally excluded from every other role
        // repair system until !unban or automatic expiry removes Banned.
        if(newMember.roles.cache.has(moderation.BANNED_ROLE_ID)){
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


        await powerRunes.checkPowerRuneRoles(
            oldMember,
            newMember
        ).catch(error => {

            console.error(
                "Power Rune role protection failed:",
                error
            );

        });

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


        const sellHandled =
            await sellCommand.handleInteraction(
                interaction
            );


        if(sellHandled){
            return;
        }


        await trades.handleInteraction(
            interaction
        );

    }
);


// =====================================================
// VERIFICATION REACTION SYSTEM
// =====================================================
//
// Works even after a bot restart because it identifies
// Mizuki's verification embed instead of storing only
// a temporary message ID in memory.
client.on(
    "messageReactionAdd",
    async (reaction, user) => {

        if(user.bot){
            return;
        }


        try{

            if(reaction.partial){

                await reaction.fetch();

            }


            const message =
                reaction.message;


            if(message.partial){

                await message.fetch();

            }


            if(
                !message.guild
                ||
                !isMainGuild(
                    message.guild.id
                )
            ){
                return;
            }


            if(
                reaction.emoji.name !==
                    sendVerifyMSGCommand.VERIFY_EMOJI
            ){
                return;
            }


            // Only Mizuki's own verification message is valid.
            if(
                message.author?.id !==
                    client.user.id
            ){
                return;
            }


            const embed =
                message.embeds?.[0];


            if(
                !embed
                ||
                embed.title !==
                    sendVerifyMSGCommand.VERIFY_EMBED_TITLE
                ||
                embed.footer?.text !==
                    sendVerifyMSGCommand.VERIFY_EMBED_FOOTER
            ){
                return;
            }


            const member =
                await message.guild.members.fetch(
                    user.id
                ).catch(
                    () => null
                );


            if(!member){
                return;
            }


            if(
                member.roles.cache.has(
                    sendVerifyMSGCommand.VERIFY_ROLE_ID
                )
            ){
                return;
            }


            await member.roles.add(
                sendVerifyMSGCommand.VERIFY_ROLE_ID,
                "Completed Mizuki reaction verification"
            );


            console.log(
                `Verified ${member.user.tag} (${member.id}).`
            );

        }
        catch(error){

            console.error(
                "Verification reaction failed:",
                error
            );

        }

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


        const normalizedMessageContent =
            message.content
                .trim()
                .toLowerCase();


        // These optional systems are isolated so an outdated AFK/troll file
        // can no longer stop every prefix command from being routed.
        await runMessageHooksSafely(
            message,
            normalizedMessageContent
        );


        // =====================================================
        // NO-COMMANDS CHAT CHANNEL
        // =====================================================
        //
        // Channel 1536777096200720545 is normal chat only.
        // Block any command-looking message BEFORE:
        // - command handlers
        // - quest message progress
        // - normal message XP
        //
        // This means commands typed here do absolutely nothing
        // except receive the warning below.
        const NO_COMMANDS_CHANNEL_ID =
            "1536777096200720545";


        if(
            String(message.channel.id) ===
                NO_COMMANDS_CHANNEL_ID
            &&
            message.content
                .trim()
                .startsWith("!")
        ){

            return message.reply(
                "🚫 **You cannot use commands in this channel.**"
            );

        }


        await recordMessageQuestSafely(
            message
        );


        if(
            await dispatchPrefixCommand(
                message,
                normalizedMessageContent
            )
        ){
            return;
        }


        if(message.content === "!level"){

            return levelCommand.execute(
                message
            );

        }


        if(
            normalizedMessageContent ===
                "!resetweeklyrank"
        ){

            return rankCommand.resetWeeklyRank(
                message
            );

        }


        if(
            /^!resetmonthlyrank(?:\s|$)/i.test(
                message.content.trim()
            )
        ){

            return rankCommand.resetMonthlyRank(
                message
            );

        }



        if(
            [
                "!rank",
                "!leaderboard"
            ].includes(
                message.content
                    .trim()
                    .toLowerCase()
            )
        ){

            return rankCommand.execute(
                message
            );

        }

if(message.content === "!commands"){

    return commandsCommand.execute(
        message
    );

}

if(
    message.content
        .trim()
        .toLowerCase() === "!updates"
){

    return updatesCommand.execute(
        message
    );

}

if(
    normalizedMessageContent === "!afk"
){

    return afkCommand.execute(
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
        .toLowerCase() === "!values"
){

    return valuesCommand.execute(
        message
    );

}

if(
    message.content
        .trim()
        .toLowerCase() === "!sell"
){

    return sellCommand.execute(
        message
    );

}

if(
    message.content
        .trim()
        .toLowerCase() === "!mute"
){

    return muteCommand.execute(
        message
    );

}

if(
    /^!setupgrade(?:\s|$)/i.test(
        message.content.trim()
    )
){

    return setUpgradeCommand.execute(
        message
    );

}

if(
    message.content
        .trim()
        .toLowerCase() === "!upgrades"
){

    return upgradesCommand.execute(
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
    /^!merchant(?:\s|$)/i.test(
        message.content.trim()
    )
){

    return merchantCommand.execute(
        message
    );

}


        const normalizedCommand =
            message.content.trim().toLowerCase();

        if(normalizedCommand === "!sendstaffrulesmsg"){
            return sendStaffRulesMSGCommand.execute(message);
        }

        if(/^!permaban(?:\s|$)/i.test(normalizedCommand)){
            return permabanCommand.execute(message);
        }

        if(/^!unban(?:\s|$)/i.test(normalizedCommand)){
            return unbanCommand.execute(message);
        }

        if(/^!kick(?:\s|$)/i.test(normalizedCommand)){
            return kickCommand.execute(message);
        }

        if(/^!ban(?:\s|$)/i.test(normalizedCommand)){
            return banCommand.execute(message);
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

if(
    /^!troll(?:\s|$)/i.test(
        message.content.trim()
    )
){

    return trollCommand.execute(
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


await boosts.sendXPBoostDropReply(
    message,
    result.xpBoostDrop
).catch(error => {

    console.error(
        "Could not send chat XP Boost drop reply:",
        error
    );

});


await powerRunes.sendPowerRuneDropReply(
    message,
    result.powerRuneDrop
).catch(error => {

    console.error(
        "Could not send chat Power Rune drop reply:",
        error
    );

});


await quests.recordEvent(
    message,
    "earn_xp",
    Math.max(
        0,
        Number(result.earnedXP) || 0
    )
);


// Chat-only XP quest progress. Keep this separate from earn_xp so XP from
// !roll, quest rewards, trades, and admin commands cannot complete it.
await quests.recordEvent(
    message,
    "chat_xp",
    Math.max(
        0,
        Number(result.earnedXP) || 0
    )
);


const criticalMessagesMuted =
    (
        result.critical
        ||
        Number(result.lostCriticalStreak) >= 2
    )
        ? await database.isMessageTypeMuted(
            message.guild.id,
            message.author.id,
            "critical"
        )
        : false;


if(result.critical){

    await quests.recordEvent(
        message,
        "critical_streak",
        Number(result.criticalStreak) || 0
    );


    if(result.newBestCriticalStreak){

        await quests.recordEvent(
            message,
            "new_best_critical_streak",
            1
        );

    }


    const criticalEmojis = getCriticalEmojis(
        message.guild, result.criticalStreak
    );

    // Keep the reaction consistent at every streak tier. The extra phoenix,
    // ice and large emojis belong in the announcement text only.
    message.react(
        criticalEmojis.reaction
    ).catch(() => {});



    if(!criticalMessagesMuted){

    // 50+ uses the two large custom emojis.
    if(result.criticalStreak >= 50){

        message.reply(

            `${criticalEmojis.text} **${message.author.username} GOT ${result.criticalStreak} CRITICAL STREAKS!!**`

        ).catch(() => {});

    }



    // Critical streaks 20-49.
    else if(result.criticalStreak >= 20){

        message.reply(

            `${criticalEmojis.text} **${message.author.username} GOT ${result.criticalStreak} CRITICAL STREAKS!!**`

        ).catch(() => {});

    }



    // Critical streaks 5–19.
    else if(result.criticalStreak >= 5){

        message.reply(

            `${criticalEmojis.text} **${message.author.username} GOT ${result.criticalStreak} CRITICAL STREAKS!!**`

        ).catch(() => {});

    }



    // Critical streaks 2–4. The first critical is intentionally quiet;
    // announcements begin only once the user reaches two in a row.
    else if(result.criticalStreak >= 2){

        message.reply(

            `${criticalEmojis.text} **${message.author.username} got ${result.criticalStreak} critical streaks!**`

        ).catch(() => {});

    }



    }


}


// The user had a streak but failed the next critical.
else if(result.lostCriticalStreak >= 2){


    if(!criticalMessagesMuted){

    message.reply(

        `💔 **${message.author.username} lost their ${result.lostCriticalStreak}x critical streak!**`

    ).catch(() => {});

    }


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
    prefix = `${getCriticalEmojis(message.guild, result.criticalStreak).text} `;

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







async function startBot(){

    // Do not connect Discord until PostgreSQL and its tables are ready.
    // This prevents commands/events from running against an unavailable DB.
    await database.initDatabase();


    serviceState.databaseReady =
        true;


    const token =
        String(
            process.env.TOKEN || ""
        ).trim();


    if(!token){

        throw new Error(
            "TOKEN is missing. Add the Discord bot token to Render's environment variables."
        );

    }


    await client.login(
        token
    );

}


let shutdownStarted =
    false;


function shutdownApplication(
    reason,
    exitCode = 0
){

    if(shutdownStarted){
        return;
    }


    shutdownStarted =
        true;


    serviceState.shuttingDown =
        true;

    serviceState.discordReady =
        false;


    console.log(
        `Mizuki is shutting down (${reason}).`
    );


    try{
        client.destroy();
    }
    catch(error){
        console.error(
            "Discord shutdown failed:",
            error
        );
    }


    const exit = () => {
        process.exit(exitCode);
    };


    healthServer.close(exit);


    const forcedExit =
        setTimeout(
            exit,
            5000
        );


    forcedExit.unref();

}


process.once(
    "SIGTERM",
    () => shutdownApplication(
        "Render sent SIGTERM",
        0
    )
);


process.once(
    "SIGINT",
    () => shutdownApplication(
        "SIGINT",
        0
    )
);


startBot().catch(error => {

    serviceState.databaseReady =
        false;

    serviceState.discordReady =
        false;

    console.error(
        "Mizuki could not start:"
    );

    console.error(
        error
    );

    shutdownApplication(
        "startup failure",
        1
    );

});
