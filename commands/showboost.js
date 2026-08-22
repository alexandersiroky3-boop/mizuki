const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    MessageFlags
} = require("discord.js");

const database = require("../database");
const boosts = require("../systems/boosts");
const luck = require("../utils/luck");


const PANEL_DURATION_MS =
    2 * 60 * 1000;


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
            `• <@&${profile.roleID}> — **x${amount.toLocaleString()}** ` +
            `• **x${profile.multiplier} XP** • **+${profile.criticalChanceBonus}% crit**`
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
            `• <@&${profile.roleID}> — **x${amount.toLocaleString()}** ` +
            `• **x${profile.multiplier} luck**`
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


    const content =
        "## ⚡ Boost Inventory\n" +
        `**Hourly chat XP:** ${Number(hourlyXP).toLocaleString()} *(tracking only)*\n` +
        `**Active XP Boost:** ${formatActiveBoost(activeXP)}\n` +
        `**Active Luck Boost:** ${formatActiveBoost(activeLuck)}\n\n` +
        "### XP Boosts\n" +
        `${buildXPInventoryLines(inventory).join("\n")}\n\n` +
        "### Luck Boosts\n" +
        `${buildLuckInventoryLines(inventory).join("\n")}` +
        (notice ? `\n\n${notice}` : "") +
        (disabled ? "\n\n*Run `!boost` again to activate another boost.*" : "");


    return {
        content,
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
