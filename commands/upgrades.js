const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    MessageFlags
} = require("discord.js");

const database = require("../database");
const upgrades = require("../utils/upgrades");
const chests = require("../systems/chests");


const PANEL_LIFETIME_MS =
    15 * 60 * 1000;


function progressBar(level, maxLevel){
    const safeLevel = Math.max(0, Math.min(maxLevel, Number(level) || 0));
    return "◼".repeat(safeLevel) + "◻".repeat(maxLevel - safeLevel);
}


function renderUpgradeCost(guild, cost){
    return upgrades.formatCost(cost)
        .replaceAll(
            ":bronze_chest:",
            chests.getChestEmoji(guild, "bronze")
        )
        .replaceAll(
            ":gilded_chest:",
            chests.getChestEmoji(guild, "gilded")
        );
}


function buildCategoryField(category, level, guild = null){
    const definition = upgrades.UPGRADE_DEFINITIONS[category];
    const maxLevel = definition.upgrades.length;
    const next = upgrades.getNextUpgrade(category, level);

    const lines = [
        definition.summary,
        "",
        `\`${progressBar(level, maxLevel)}\` **${level}/${maxLevel}**`
    ];

    if(next){
        lines.push(
            "",
            `**Next — Upgrade ${next.level}:** ${next.description}`,
            `**Cost:** ${renderUpgradeCost(guild, next.cost)}`
        );
    }
    else{
        lines.push("", "✅ **Fully upgraded.**");
    }

    lines.push("", "━━━━━━━━━━━━━━━━━━━━");

    return {
        name: `${definition.emoji} ${definition.name}`,
        value: lines.join("\n"),
        inline: false
    };
}


function buildButtons(levels, disabled = false){
    const rows = [];
    const categories = upgrades.UPGRADE_CATEGORIES;

    for(let index = 0; index < categories.length; index += 3){
        const row = new ActionRowBuilder();

        for(const category of categories.slice(index, index + 3)){
            const definition = upgrades.UPGRADE_DEFINITIONS[category];
            const level = levels[category];
            const maxLevel = definition.upgrades.length;

            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`upgrade_buy:${category}`)
                    .setLabel(`Upgrade ${definition.name} | ${level}/${maxLevel}`)
                    .setEmoji(definition.emoji)
                    .setStyle(
                        level >= maxLevel
                            ? ButtonStyle.Secondary
                            : ButtonStyle.Primary
                    )
                    .setDisabled(disabled || level >= maxLevel)
            );
        }

        rows.push(row);
    }

    return rows;
}


function buildPanel(
    user,
    levels,
    disabled = false,
    guild = null
){
    const safeLevels = upgrades.normalizeLevels(levels);

    const embed = new EmbedBuilder()
        .setColor("#8E44AD")
        .setTitle("🧬 Upgrades")
        .setDescription(
            `${user} — permanent progression is now earned here instead of unlocked automatically by level.\n` +
            "Each button purchases only the **next** upgrade in that track."
        )
        .addFields(
            ...upgrades.UPGRADE_CATEGORIES.map(category =>
                buildCategoryField(
                    category,
                    safeLevels[category],
                    guild
                )
            )
        )
        .setFooter({
            text: disabled
                ? "This upgrade panel expired. Run !upgrades for a fresh panel."
                : "Purchases are permanent and cannot be refunded. This panel stays active for 15 minutes."
        })
        .setTimestamp();

    return {
        embeds: [embed],
        components: buildButtons(safeLevels, disabled),
        allowedMentions: {
            parse: [],
            users: [user.id]
        }
    };
}


function getFailureMessage(result, guild = null){
    if(result.status === "not-enough-xp"){
        return `❌ You need **${Number(result.missing).toLocaleString()} more XP** for this upgrade.`;
    }

    if(result.status === "not-enough-boosts"){
        const key = `${result.boost.boostType}:${result.boost.tier}`;
        const label = {
            "chest:bronze":
                `${chests.getChestEmoji(guild, "bronze")} Bronze Chest`,
            "chest:gilded":
                `${chests.getChestEmoji(guild, "gilded")} Gilded Chest`
        }[key] || upgrades.BOOST_LABELS[key] || key;
        return `❌ You need **${Number(result.missing).toLocaleString()} more** ${label}.`;
    }

    if(result.status === "max-level"){
        return "✅ That upgrade track is already complete.";
    }

    return "❌ That upgrade could not be purchased. Please refresh the panel and try again.";
}


async function execute(message){
    if(!message.guild){
        return;
    }

    let levels = await database.getUserUpgradeLevels(
        message.guild.id,
        message.author.id
    );

    const panelMessage = await message.reply(
        buildPanel(
            message.author,
            levels,
            false,
            message.guild
        )
    );

    const collector = panelMessage.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: PANEL_LIFETIME_MS
    });

    collector.on("collect", async interaction => {
        if(interaction.user.id !== message.author.id){
            return interaction.reply({
                content: "❌ This upgrade panel belongs to someone else. Run `!upgrades` to open your own.",
                flags: MessageFlags.Ephemeral
            });
        }

        const [, category] = interaction.customId.split(":");

        await interaction.deferUpdate();

        try{
            const result = await database.purchaseUserUpgrade(
                message.guild.id,
                message.author.id,
                category
            );

            levels = result.levels || await database.getUserUpgradeLevels(
                message.guild.id,
                message.author.id
            );

            await interaction.editReply(
                buildPanel(
                    message.author,
                    levels,
                    false,
                    message.guild
                )
            );

            if(result.success){
                const definition = upgrades.UPGRADE_DEFINITIONS[result.category];
                await interaction.followUp({
                    content:
                        `✅ **${definition.name} Upgrade ${result.level}/${result.maxLevel} purchased.**\n` +
                        `${result.upgrade.description}\n` +
                        `Remaining XP: **${Number(result.balance).toLocaleString()}**`,
                    flags: MessageFlags.Ephemeral,
                    allowedMentions: { parse: [] }
                });
            }
            else{
                await interaction.followUp({
                    content: getFailureMessage(
                        result,
                        message.guild
                    ),
                    flags: MessageFlags.Ephemeral,
                    allowedMentions: { parse: [] }
                });
            }
        }
        catch(error){
            console.error("Upgrade purchase failed:", error);

            await interaction.followUp({
                content: "❌ The upgrade purchase failed before anything was charged. Please try again.",
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }
    });

    collector.on("end", async () => {
        levels = await database.getUserUpgradeLevels(
            message.guild.id,
            message.author.id
        ).catch(() => levels);

        await panelMessage.edit(
            buildPanel(
                message.author,
                levels,
                true,
                message.guild
            )
        ).catch(() => {});
    });
}


module.exports = {
    execute,
    buildPanel,
    progressBar
};
