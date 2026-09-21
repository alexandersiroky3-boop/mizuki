const database = require("../database");
const xp = require("../utils/xp");
const leveling = require("../systems/leveling");
const trolls = require("../systems/trolls");
const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType,
    EmbedBuilder, MessageFlags, SlashCommandBuilder
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

function resultPayload(message, targetID, result){
    const emoji = message.guild.emojis?.cache?.find?.(
        entry => entry.name === "meme_face"
    )?.toString() || "🎭";
    const backfired = result.rarity === "failed";
    const embed = new EmbedBuilder()
        .setColor(backfired ? 0xED4245 : 0x9B59B6)
        .setTitle(`${emoji} Troll ${backfired ? "Backfired" : "Activated"}`)
        .setDescription(backfired
            ? `Target: <@${targetID}>\n\n💥 ${result.publicDescription || "The troll backfired."}`
            : `Target: <@${targetID}>\nRarity: **${result.rarity.toUpperCase()}**\n\n**Secret effect**\n${formatSecretEffect(result.effect)}`)
        .setFooter({text: backfired
            ? "A failed troll affects you instead."
            : "The target learns the effect when it triggers."});
    return {embeds: [embed], allowedMentions: {parse: []}};
}

async function applyTroll(message, targetID, respond){
    const reply = text => respond({
        content: text, allowedMentions: {parse: [], repliedUser: false}
    });
    if(!message.guild || message.author.bot) return null;
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
    const result = await trolls.createTrollAttempt({
        guildID, actorID, targetID,
        actorLevel: xp.getLevel(Number(actorUser?.xp) || 0),
        targetLevel: xp.getLevel(Number(targetUser?.xp) || 0)
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
    return respond(resultPayload(message, targetID, result));
}

async function runPrivately(message, targetID, respond){
    try{
        return await applyTroll(message, targetID, respond);
    }
    catch(error){
        console.error("Troll command failed:", error);
        return respond({
            content: "❌ The troll failed. Check the bot log for details.",
            allowedMentions: {parse: []}
        }).catch(replyError => {
            console.error("Could not show troll error:", replyError);
            return null;
        });
    }
}

async function execute(message){
    if(!message.guild || message.author.bot) return null;
    const targetID = getTargetID(message);
    if(!targetID) return message.reply("Usage: **!troll @user** or **/troll user**.");

    // Ephemeral responses require an interaction. The button creates one.
    const deleted = await message.delete().then(() => true).catch(() => false);
    if(!deleted) return message.reply(
        "Use `/troll` to do this privately. I need **Manage Messages** to hide your `!troll` message."
    );

    const button = new ButtonBuilder()
        .setCustomId("troll_private_confirm")
        .setLabel("Continue")
        .setEmoji("🎭")
        .setStyle(ButtonStyle.Secondary);
    const panel = await message.channel.send({
        content: "🎭 Ready when you are.",
        components: [new ActionRowBuilder().addComponents(button)],
        allowedMentions: {parse: []}
    });
    const collector = panel.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 2 * 60 * 1000
    });
    collector.on("collect", async interaction => {
        if(interaction.user.id !== message.author.id){
            await interaction.reply({
                content: "This button belongs to someone else.",
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
            return;
        }
        collector.stop("used");
        await interaction.deferReply({flags: MessageFlags.Ephemeral});
        await runPrivately(message, targetID,
            payload => interaction.editReply(payload));
    });
    collector.once("end", () => panel.delete().catch(() => {}));
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
        author: interaction.user,
        client: interaction.client,
        mentions: {
            users: {first: () => user},
            members: {first: () => null}
        },
        content: `!troll <@${user.id}>`
    };
    return runPrivately(message, user.id,
        payload => interaction.editReply(payload));
}

module.exports = {
    execute, executeInteraction, slashCommand,
    COOLDOWN, formatCooldown, getTargetID, resolveTarget,
    formatSecretEffect, resultPayload
};
