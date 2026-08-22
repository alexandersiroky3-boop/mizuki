const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    EmbedBuilder,
    MessageFlags
} = require("discord.js");

const database = require("../database");
const boosts = require("../systems/boosts");
const luck = require("../utils/luck");


const PANEL_DURATION_MS =
    2 * 60 * 1000;


const EMBED_COLORS = {
    default:
        0x7C5CFC,
    success:
        0x57F287,
    expired:
        0x747F8D
};


const XP_TIERS =
    [
        "tier1",
        "tier2",
        "max",
        "infinity"
    ];


const LUCK_TIERS =
    [
        "tier1",
        "tier2",
        "tier3",
        "max",
        "omega"
    ];


function inventoryMap(rows){

    return new Map(
        rows.map(row => [
            `${String(row.boosttype).toLowerCase()}:${String(row.tier).toLowerCase()}`,
            Number(row.amount) || 0
        ])
    );

}


function getInventoryAmount(
    inventory,
    type,
    tier
){

    return Number(
        inventory.get(
            `${type}:${tier}`
        ) || 0
    );

}


function formatActiveBoost(profile){

    if(!profile?.roleID){
        return "None";
    }


    const expiresAt =
        Number(profile.expiresAt) || 0;


    const expiry =
        expiresAt > Date.now()
            ? ` • ends <t:${Math.floor(expiresAt / 1000)}:R>`
            : "";


    return `<@&${profile.roleID}>${expiry}`;

}


function buildXPInventoryLines(inventory){

    return XP_TIERS.map(tier => {

        const profile =
            boosts.BOOST_PROFILES[tier];


        const amount =
            getInventoryAmount(
                inventory,
                "xp",
                tier
            );


        return (
            `<@&${profile.roleID}>　**×${amount.toLocaleString()}**`
        );

    });

}


function buildLuckInventoryLines(inventory){

    return LUCK_TIERS.map(tier => {

        const profile =
            luck.LUCK_ROLES[tier];


        const amount =
            getInventoryAmount(
                inventory,
                "luck",
                tier
            );


        return (
            `<@&${profile.roleID}>　**×${amount.toLocaleString()}**`
        );

    });

}


function buildButtons(
    inventory,
    disabled = false
){

    const xpRow =
        new ActionRowBuilder();


    for(const tier of XP_TIERS){

        const profile =
            boosts.BOOST_PROFILES[tier];


        const amount =
            getInventoryAmount(
                inventory,
                "xp",
                tier
            );


        xpRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`activate_xp_${tier}`)
                .setLabel(
                    `${profile.name} (x${amount.toLocaleString()})`
                )
                .setStyle(
                    tier === "infinity"
                        ? ButtonStyle.Danger
                        : tier === "max"
                            ? ButtonStyle.Success
                            : ButtonStyle.Primary
                )
                .setDisabled(
                    disabled || amount <= 0
                )
        );

    }


    const luckRow =
        new ActionRowBuilder();


    for(const tier of LUCK_TIERS){

        const profile =
            luck.LUCK_ROLES[tier];


        const amount =
            getInventoryAmount(
                inventory,
                "luck",
                tier
            );


        luckRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`activate_luck_${tier}`)
                .setLabel(
                    `${profile.name} (x${amount.toLocaleString()})`
                )
                .setStyle(
                    tier === "omega"
                        ? ButtonStyle.Danger
                        : tier === "max"
                            ? ButtonStyle.Success
                            : ButtonStyle.Secondary
                )
                .setDisabled(
                    disabled || amount <= 0
                )
        );

    }


    return [
        xpRow,
        luckRow
    ];

}


async function buildBoostPanel(
    member,
    disabled = false,
    notice = ""
){

    const [
        rows,
        hourlyXP,
        activeXP,
        activeLuck
    ] = await Promise.all([
        database.getBoostInventory(
            member.guild.id,
            member.id
        ),
        database.getHourlyBoostXP(
            member.guild.id,
            member.id
        ),
        boosts.getActiveBoost(
            member
        ),
        luck.getActiveLuckBoost(
            member
        )
    ]);


    const inventory =
        inventoryMap(rows);


    const displayName =
        member.displayName
        || member.user?.globalName
        || member.user?.username
        || "Player";


    const avatarURL =
        typeof member.displayAvatarURL === "function"
            ? member.displayAvatarURL({
                size: 128
            })
            : typeof member.user?.displayAvatarURL === "function"
                ? member.user.displayAvatarURL({
                    size: 128
                })
                : null;


    const author = {
        name:
            `${displayName}'s inventory`
    };


    if(avatarURL){
        author.iconURL = avatarURL;
    }


    const description = [
        disabled
            ? "⏳ This panel has expired. Run `!boost` to open a new one."
            : "Choose a stored boost below to activate it.",
        notice || ""
    ]
        .filter(Boolean)
        .join("\n\n");


    const embed =
        new EmbedBuilder()
            .setColor(
                disabled
                    ? EMBED_COLORS.expired
                    : notice
                        ? EMBED_COLORS.success
                        : EMBED_COLORS.default
            )
            .setAuthor(
                author
            )
            .setTitle(
                "⚡ Boost Inventory"
            )
            .setDescription(
                description
            )
            .addFields(
                {
                    name:
                        "⚡ Active XP",
                    value:
                        formatActiveBoost(
                            activeXP
                        ),
                    inline:
                        true
                },
                {
                    name:
                        "🍀 Active Luck",
                    value:
                        formatActiveBoost(
                            activeLuck
                        ),
                    inline:
                        true
                },
                {
                    name:
                        "💬 Hourly XP",
                    value:
                        `**${Number(hourlyXP || 0).toLocaleString()}**`,
                    inline:
                        true
                },
                {
                    name:
                        "⚔️ XP Boosts",
                    value:
                        buildXPInventoryLines(
                            inventory
                        ).join("\n"),
                    inline:
                        true
                },
                {
                    name:
                        "🌿 Luck Boosts",
                    value:
                        buildLuckInventoryLines(
                            inventory
                        ).join("\n"),
                    inline:
                        true
                }
            )
            .setFooter({
                text:
                    disabled
                        ? "Buttons disabled • Your inventory is safe"
                        : "Only you can use these buttons • Expires in 2 minutes"
            });


    return {
        embeds: [
            embed
        ],
        components:
            buildButtons(
                inventory,
                disabled
            ),
        allowedMentions: {
            parse: []
        }
    };

}


function activationFailureMessage(result){

    if(result?.status === "no-stock"){
        return "That boost is no longer in your inventory.";
    }


    if(result?.status === "stronger-active"){
        return (
            `You already have the stronger <@&${result.currentBoost.roleID}> active. ` +
            "The weaker item was not consumed."
        );
    }


    return "That boost could not be activated.";

}


async function execute(message){

    if(!message.guild || !message.member){
        return null;
    }


    let lastNotice = "";


    const panel =
        await message.reply(
            await buildBoostPanel(
                message.member
            )
        );


    const collector =
        panel.createMessageComponentCollector({
            componentType:
                ComponentType.Button,
            time:
                PANEL_DURATION_MS
        });


    collector.on("collect", async interaction => {

        try{

        if(interaction.user.id !== message.author.id){

            await interaction.reply({
                content:
                    "This is someone else's boost inventory. Run `!boost` to open yours.",
                flags:
                    MessageFlags.Ephemeral
            }).catch(() => {});


            return;

        }


        const match =
            /^activate_(xp|luck)_(tier1|tier2|tier3|max|infinity|omega)$/
                .exec(
                    interaction.customId
                );


        if(!match){
            return;
        }


        const [, type, tier] =
            match;


        const result =
            type === "xp"
                ? await boosts.activateXPBoostFromInventory(
                    message.member,
                    tier
                )
                : await luck.activateLuckBoostFromInventory(
                    message.member,
                    tier
                );


        if(!result.success){

            await interaction.reply({
                content:
                    activationFailureMessage(result),
                flags:
                    MessageFlags.Ephemeral,
                allowedMentions: {
                    parse: []
                }
            }).catch(() => {});


            await panel.edit(
                await buildBoostPanel(
                    message.member,
                    false,
                    lastNotice
                )
            ).catch(() => {});


            return;

        }


        const statusText = {
            activated: "activated",
            refreshed: "refreshed for a fresh duration",
            upgraded: "upgraded"
        }[result.status] || "activated";


        lastNotice =
            `✅ <@&${result.boost.roleID}> ${statusText}. ` +
            `Inventory remaining: **x${Number(result.remaining).toLocaleString()}**.`;


        await interaction.update(
            await buildBoostPanel(
                message.member,
                false,
                lastNotice
            )
        );

        }
        catch(error){

            console.error(
                "Boost panel interaction failed:",
                error
            );


            const errorReply = {
                content:
                    "The boost panel hit a temporary error. Your inventory was protected; run `!boost` again to refresh it.",
                flags:
                    MessageFlags.Ephemeral
            };


            if(
                interaction.replied
                ||
                interaction.deferred
            ){

                await interaction.followUp(
                    errorReply
                ).catch(() => {});

            }
            else{

                await interaction.reply(
                    errorReply
                ).catch(() => {});

            }

        }

    });


    collector.once("end", async() => {

        try{

            await panel.edit(
                await buildBoostPanel(
                    message.member,
                    true,
                    lastNotice
                )
            ).catch(() => {});

        }
        catch(error){

            console.error(
                "Could not close expired boost panel:",
                error
            );

        }

    });


    return panel;

}


module.exports = {
    execute,
    buildBoostPanel
};
