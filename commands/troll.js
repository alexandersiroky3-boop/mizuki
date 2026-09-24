const database = require("../database");
const xp = require("../utils/xp");
const luck = require("../utils/luck");
const leveling = require("../systems/leveling");
const trolls = require("../systems/trolls");
const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType,
    MessageFlags, SlashCommandBuilder
} = require("discord.js");

const COOLDOWN = 5 * 60 * 1000;

function formatCooldown(ms){
    const seconds = Math.ceil(Math.max(0, ms) / 1000);
    return seconds < 60 ? `${seconds}s` :
        `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function getTargetID(message){
    const mentioned = message.mentions?.users?.first?.();
    if(mentioned) return mentioned.id;
    return String(message.content || "")
        .match(/^!troll\s+(?:<@!?)?(\d{16,22})>?\s*$/i)?.[1] || null;
}

async function resolveTarget(message, targetID){
    const mentionedUser = message.mentions?.users?.first?.();
    const member = message.mentions?.members?.first?.()
        || message.guild.members.cache?.get(targetID)
        || await message.guild.members.fetch(targetID).catch(() => null);
    const user = member?.user
        || (mentionedUser?.id === targetID ? mentionedUser : null);
    return {member, user};
}

function formatSecretEffect(effect){
    const p = effect?.payload || {};
    const amount = value => Number(value || 0).toLocaleString();
    return {
        chat_reduction: `Their next **${p.total} chat rewards** lose **${p.percent}% XP**.`,
        roll_negative: `Their next **${p.total} roll(s)** will be negative.`,
        critical_half: "Their next critical reward is halved.",
        chat_zero: `Their next **${p.total} chat rewards** give 0 XP.`,
        message_mog: `A future message costs them **${amount(p.min)}–${amount(p.max)} XP**.`,
        steal_backfire: "Their next successful !steal backfires.",
        message_fart: `A future message costs them **${amount(p.min)}–${amount(p.max)} XP**.`,
        kiss_share: "Their next successful !kiss shares XP with you.",
        chat_redirect: `Their next **${p.total} chat XP rewards** go to you.`,
        ezwin_reflect: "Their next !ezwin reflects onto you.",
        roll_redirect: `Their next **${p.total} roll rewards** go to you.`,
        critical_fail: "Their next critical is forced to fail.",
        luck_transfer: "Their active Luck Boost may transfer to you for 5 minutes."
    }[effect?.effectType] || "A secret bad effect was applied.";
}

function resultPayload(
    message,
    targetID,
    result,
    usedLuckExtra = ""
){
    const emoji = message.guild.emojis?.cache?.find?.(
        entry => entry.name === "meme_face"
    )?.toString() || "🎭";
    const backfired = result.rarity === "failed";


    const luckLine =
        String(usedLuckExtra || "")
            .replace(/^\s+/, "");


    const content = backfired
        ? [
            `${emoji} **Your troll on <@${targetID}> backfired!**`,
            `**Rarity:** FAILED`,
            `**Result:** ${result.publicDescription || "The troll affected you instead."}`,
            luckLine
        ]
        : [
            `${emoji} **Your secret troll result for <@${targetID}>:**`,
            `**Rarity:** ${result.rarity.toUpperCase()}`,
            `**Effect:** ${formatSecretEffect(result.effect)}`,
            "*Only you can see this. The target learns the effect when it triggers.*",
            luckLine
        ];


    return {
        content:
            content
                .filter(Boolean)
                .join("\n"),
        allowedMentions: {
            parse: []
        }
    };
}

function replyPayload(text){
    return {
        content: text,
        allowedMentions: {
            parse: [],
            repliedUser: false
        }
    };
}


function getMemeEmoji(guild){
    return guild.emojis?.cache?.find?.(
        entry => entry.name === "meme_face"
    )?.toString() || "🎭";
}


async function getActorLuck(
    message,
    actorID,
    actorLevel
){
    const cachedMember =
        message.guild.members.cache?.get(
            actorID
        );


    const actorMember =
        cachedMember ||
        message.member ||
        await message.guild.members
            .fetch(actorID)
            .catch(() => null);


    if(!actorMember){
        return {
            activeLuck: null,
            commandLuck: null,
            usedLuckExtra: ""
        };
    }


    const activeLuck =
        await luck.getActiveLuckBoost(
            actorMember
        );


    const commandLuck =
        actorLevel >= 100
            ? luck.getLevel100PlusCommandLuckProfile(
                activeLuck
            )
            : activeLuck;


    return {
        activeLuck,
        commandLuck,
        usedLuckExtra:
            luck.buildUsedCommandLuckExtra(
                activeLuck
            )
    };
}


async function applyTroll(message, targetID){
    const reply = text => ({
        success: false,
        payload: replyPayload(text)
    });


    if(!message.guild || message.author.bot){
        return reply("This command can only be used inside the server.");
    }


    const guildID = message.guild.id;
    const actorID = message.author.id;

    if(!targetID) return reply("Usage: **/troll user** or **!troll @user**.");
    if(targetID === actorID) return reply("You cannot troll yourself.");

    const target = await resolveTarget(message, targetID);
    if(!target.user) return reply("I could not find that user in this server.");
    if(target.user.bot) return reply("Bots cannot receive troll effects.");

    const remaining = await database.getCommandCooldownRemaining(
        guildID, actorID, "troll"
    );
    if(remaining > 0) return reply(
        `⏳ You can use troll again in **${formatCooldown(remaining)}**.`
    );
    if(await trolls.hasActiveEffect(guildID, targetID)) return reply(
        "That user already has a troll effect active. Wait for it to finish or expire."
    );

    const [actorUser, targetUser] = await Promise.all([
        database.getUser(guildID, actorID),
        database.getUser(guildID, targetID)
    ]);


    const actorLevel =
        xp.getLevel(
            Number(actorUser?.xp) || 0
        );


    const actorLuck =
        await getActorLuck(
            message,
            actorID,
            actorLevel
        );


    const result = await trolls.createTrollAttempt({
        guildID, actorID, targetID,
        actorLevel,
        targetLevel: xp.getLevel(Number(targetUser?.xp) || 0),
        luckProfile: actorLuck.commandLuck
    });
    if(!result?.success && result?.status === "target-active") return reply(
        "That user already has a troll effect active."
    );
    if(!result?.success) return reply("The troll could not be applied. Please try again.");

    await database.setCommandCooldown(
        guildID, actorID, "troll", Date.now() + COOLDOWN
    ).catch(error => console.error("!troll cooldown save failed:", error));

    for(const userID of result.changedUserIDs || []){
        await leveling.syncLevelAndAnnounce(
            message.client, guildID, userID
        ).catch(error => console.error("!troll level sync failed:", error));
    }


    return {
        success: true,
        payload: resultPayload(
            message,
            targetID,
            result,
            actorLuck.usedLuckExtra
        ),
        result
    };
}


async function runPrivately(message, targetID){
    try{
        return await applyTroll(message, targetID);
    }
    catch(error){
        console.error("Troll command failed:", error);
        return {
            success: false,
            payload: replyPayload(
                "❌ The troll failed. Check the bot log for details."
            )
        };
    }
}


function buildRevealButton(){
    return new ButtonBuilder()
        .setCustomId("troll_private_confirm")
        .setLabel("View My Secret Troll")
        .setEmoji("🎭")
        .setStyle(ButtonStyle.Secondary);
}


function buildPublicTrollPayload(
    message,
    targetID,
    showRevealButton = true
){
    const payload = {
        content:
            `${getMemeEmoji(message.guild)} <@${targetID}> got trolled by ` +
            `<@${message.author.id}>! **The troll remains secret...**`,
        allowedMentions: {
            parse: [],
            repliedUser: false
        }
    };


    if(showRevealButton){
        payload.components = [
            new ActionRowBuilder()
                .addComponents(
                    buildRevealButton()
                )
        ];
    }


    return payload;
}


function attachPrivateResultCollector(
    panel,
    authorID,
    privateResult
){
    const collector =
        panel.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 15 * 60 * 1000
        });


    collector.on("collect", async interaction => {
        if(interaction.user.id !== authorID){
            await interaction.reply({
                content:
                    "Only the person who used `!troll` can view this secret result.",
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
            return;
        }


        await interaction.reply({
            ...privateResult,
            flags: MessageFlags.Ephemeral
        });


        collector.stop("used");
    });


    collector.once(
        "end",
        () => panel.edit({components: []})
            .catch(() => {})
    );


    return collector;
}


async function execute(message){
    if(!message.guild || message.author.bot) return null;
    const targetID = getTargetID(message);
    if(!targetID) return message.reply("Usage: **!troll @user** or **/troll user**.");

    // Apply the troll when the command is typed. The button is only for
    // revealing the result privately; the command stays visible to the target.
    const attempt =
        await runPrivately(
            message,
            targetID
        );


    if(!attempt?.success){
        return message.reply(
            attempt?.payload ||
            replyPayload(
                "❌ The troll could not be applied."
            )
        );
    }


    const panel =
        await message.reply(
            buildPublicTrollPayload(
                message,
                targetID
            )
        );


    attachPrivateResultCollector(
        panel,
        message.author.id,
        attempt.payload
    );


    return panel;
}

const slashCommand = new SlashCommandBuilder()
    .setName("troll")
    .setDescription("Secretly troll someone in this server")
    .addUserOption(option => option
        .setName("user")
        .setDescription("Who should receive the troll?")
        .setRequired(true));

async function executeInteraction(interaction){
    await interaction.deferReply({flags: MessageFlags.Ephemeral});
    const user = interaction.options.getUser("user", true);
    const message = {
        guild: interaction.guild,
        member: interaction.member,
        author: interaction.user,
        client: interaction.client,
        mentions: {
            users: {first: () => user},
            members: {first: () => null}
        },
        content: `!troll <@${user.id}>`
    };


    const attempt =
        await runPrivately(
            message,
            user.id
        );


    if(!attempt?.success){
        return interaction.editReply(
            attempt?.payload ||
            replyPayload(
                "❌ The troll could not be applied."
            )
        );
    }


    if(interaction.channel?.isTextBased()){
        await interaction.channel.send(
            buildPublicTrollPayload(
                message,
                user.id,
                false
            )
        ).catch(error => {
            console.error(
                "Could not post the public /troll message:",
                error
            );
        });
    }


    return interaction.editReply(
        attempt.payload
    );
}

module.exports = {
    execute, executeInteraction, slashCommand,
    COOLDOWN, formatCooldown, getTargetID, resolveTarget,
    formatSecretEffect, resultPayload
};
