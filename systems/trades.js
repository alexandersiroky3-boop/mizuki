const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags
} = require("discord.js");

const database =
    require("../database");

const boosts =
    require("./boosts");

const luck =
    require("../utils/luck");


const TRADE_CATEGORY_ID =
    "1535247237821505556";

const TRADE_INVITE_TIMEOUT =
    2 * 60 * 1000;

const TRADE_ACTIVE_TIMEOUT =
    15 * 60 * 1000;

const TRADE_CLEANUP_DELAY =
    30 * 1000;

const MAX_TRADE_XP =
    2000000000;

const MAX_BOOST_QUANTITY =
    1000;


const cleanupTimers =
    new Map();


// =====================================================
// HELPERS
// =====================================================

function formatTradeNumber(tradeID){

    return String(
        Number(tradeID)
    ).padStart(
        3,
        "0"
    );

}


function normalizeOffer(offer){

    return database.normalizeTradeOffer(
        offer
    );

}


function getUserOffer(
    trade,
    userID
){

    if(
        String(trade.user1id) ===
        String(userID)
    ){

        return normalizeOffer(
            trade.user1offer
        );

    }


    return normalizeOffer(
        trade.user2offer
    );

}


function isParticipant(
    trade,
    userID
){

    return (
        String(trade.user1id) ===
            String(userID)
        ||
        String(trade.user2id) ===
            String(userID)
    );

}


function getBoostLabel(key){

    const [
        boostType,
        tier
    ] = String(key)
        .toLowerCase()
        .split(":");


    const profile =
        boostType === "xp"
            ? boosts.BOOST_PROFILES[tier]
            : luck.LUCK_ROLES[tier];


    if(profile?.name){

        if(boostType === "luck")
            return `@☘️ ${profile.name}`;

        if(boostType === "xp")
            return `@⚡ ${profile.name}`;

        return `@${profile.name}`;

    }


    return (
        `${boostType.toUpperCase()} ` +
        `${String(tier).toUpperCase()}`
    );

}


function formatOffer(offer){

    const normalized =
        normalizeOffer(
            offer
        );


    const lines = [];


    if(normalized.xp > 0){

        lines.push(
            `💰 **${normalized.xp.toLocaleString()} XP**`
        );

    }


    for(
        const [key, amount] of
        Object.entries(
            normalized.boosts
        )
    ){

        lines.push(
            `🎒 **${getBoostLabel(key)}** ×${amount}`
        );

    }


    if(lines.length === 0){

        return "*Nothing offered yet.*";

    }


    return lines.join("\n");

}


function formatFee(offer){

    const fee =
        database.calculateTradeFee(
            offer
        );


    return (
        `**${fee.total.toLocaleString()} XP**\n` +
        `Base: ${fee.baseFee.toLocaleString()} | ` +
        `XP fee: ${fee.xpFee.toLocaleString()} | ` +
        `Boost fee: ${fee.boostFee.toLocaleString()}`
    );

}


function getStatusLabel(status){

    const labels = {

        pending:
            "Waiting for invitation response",

        setup:
            "Creating private trade room",

        active:
            "Negotiating",

        processing:
            "Processing transaction",

        completed:
            "Completed",

        cancelled:
            "Cancelled",

        declined:
            "Declined",

        expired:
            "Expired"

    };


    return (
        labels[status] ||
        String(status)
    );

}


function getPanelColor(status){

    if(status === "completed")
        return 0x57F287;

    if(
        status === "cancelled"
        ||
        status === "declined"
        ||
        status === "expired"
    ){

        return 0xED4245;

    }


    if(status === "processing")
        return 0xFEE75C;


    return 0x5865F2;

}


function buildTradePanel(trade){

    const offer1 =
        normalizeOffer(
            trade.user1offer
        );

    const offer2 =
        normalizeOffer(
            trade.user2offer
        );


    const embed =
        new EmbedBuilder()

            .setColor(
                getPanelColor(
                    trade.status
                )
            )

            .setTitle(
                `💱 Trade #${formatTradeNumber(trade.id)}`
            )

            .setDescription(
                `<@${trade.user1id}> ⇄ <@${trade.user2id}>\n\n` +
                `**Status:** ${getStatusLabel(trade.status)}\n` +
                `Changing **any** offer automatically removes both confirmations.`
            )

            .addFields(

                {
                    name:
                        `<@${trade.user1id}> Offer`,

                    value:
                        formatOffer(
                            offer1
                        ),

                    inline:
                        true
                },

                {
                    name:
                        `<@${trade.user2id}> Offer`,

                    value:
                        formatOffer(
                            offer2
                        ),

                    inline:
                        true
                },

                {
                    name:
                        "Trade Fees",

                    value:
                        `<@${trade.user1id}> pays ${formatFee(offer1)}\n\n` +
                        `<@${trade.user2id}> pays ${formatFee(offer2)}`,

                    inline:
                        false
                },

                {
                    name:
                        "Confirmations",

                    value:
                        `<@${trade.user1id}> ${trade.user1confirmed ? "✅ Confirmed" : "❌ Not confirmed"}\n` +
                        `<@${trade.user2id}> ${trade.user2confirmed ? "✅ Confirmed" : "❌ Not confirmed"}`,

                    inline:
                        false
                }

            )

            .setFooter({

                text:
                    "Only stored boost inventory and XP can be traded. Active boosts cannot be traded."

            })

            .setTimestamp();


    if(trade.failurereason){

        embed.addFields({

            name:
                "Last transaction check",

            value:
                `⚠️ ${trade.failurereason}`,

            inline:
                false

        });

    }


    const disabled =
        trade.status !==
        "active";


    const row =
        new ActionRowBuilder()

            .addComponents(

                new ButtonBuilder()

                    .setCustomId(
                        `trade_add_xp:${trade.id}`
                    )

                    .setLabel(
                        "Add XP"
                    )

                    .setEmoji(
                        "💰"
                    )

                    .setStyle(
                        ButtonStyle.Primary
                    )

                    .setDisabled(
                        disabled
                    ),

                new ButtonBuilder()

                    .setCustomId(
                        `trade_add_boost:${trade.id}`
                    )

                    .setLabel(
                        "Add Boost"
                    )

                    .setEmoji(
                        "🎒"
                    )

                    .setStyle(
                        ButtonStyle.Primary
                    )

                    .setDisabled(
                        disabled
                    ),

                new ButtonBuilder()

                    .setCustomId(
                        `trade_remove:${trade.id}`
                    )

                    .setLabel(
                        "Remove Item"
                    )

                    .setStyle(
                        ButtonStyle.Secondary
                    )

                    .setDisabled(
                        disabled
                    ),

                new ButtonBuilder()

                    .setCustomId(
                        `trade_confirm:${trade.id}`
                    )

                    .setLabel(
                        "Confirm"
                    )

                    .setEmoji(
                        "✅"
                    )

                    .setStyle(
                        ButtonStyle.Success
                    )

                    .setDisabled(
                        disabled
                    ),

                new ButtonBuilder()

                    .setCustomId(
                        `trade_cancel:${trade.id}`
                    )

                    .setLabel(
                        "Cancel Trade"
                    )

                    .setEmoji(
                        "✖️"
                    )

                    .setStyle(
                        ButtonStyle.Danger
                    )

                    .setDisabled(
                        disabled
                    )

            );


    return {
        embeds: [
            embed
        ],
        components: [
            row
        ]
    };

}


async function privateReply(
    interaction,
    payload
){

    const data = {
        ...payload
    };


    if(interaction.guild){

        data.flags =
            MessageFlags.Ephemeral;

    }


    if(
        interaction.deferred
        ||
        interaction.replied
    ){

        delete data.flags;

        return interaction.editReply(
            data
        );

    }


    return interaction.reply(
        data
    );

}


async function getAuthorizedTrade(
    interaction,
    tradeID,
    requiredStatus = null
){

    const trade =
        await database.getTrade(
            tradeID
        );


    if(!trade){

        await privateReply(
            interaction,
            {
                content:
                    "That trade no longer exists."
            }
        );

        return null;

    }


    if(
        !isParticipant(
            trade,
            interaction.user.id
        )
    ){

        await privateReply(
            interaction,
            {
                content:
                    "Only the two traders can use these controls."
            }
        );

        return null;

    }


    if(
        requiredStatus
        &&
        trade.status !==
            requiredStatus
    ){

        await privateReply(
            interaction,
            {
                content:
                    `This trade is currently **${getStatusLabel(trade.status)}**.`
            }
        );

        return null;

    }


    return trade;

}


async function refreshTradePanel(
    client,
    tradeID
){

    const trade =
        await database.getTrade(
            tradeID
        );


    if(
        !trade
        ||
        !trade.channelid
    ){

        return null;

    }


    const channel =
        await client.channels.fetch(
            trade.channelid
        ).catch(
            () => null
        );


    if(!channel)
        return trade;


    let panel = null;


    if(trade.panelmessageid){

        panel =
            await channel.messages.fetch(
                trade.panelmessageid
            ).catch(
                () => null
            );

    }


    if(panel){

        await panel.edit(
            buildTradePanel(
                trade
            )
        ).catch(
            () => {}
        );

    }
    else if(
        trade.status ===
        "active"
    ){

        const replacement =
            await channel.send(
                buildTradePanel(
                    trade
                )
            );


        await database.updateTradePanelMessage(
            trade.id,
            replacement.id
        );

    }


    return trade;

}


function parsePositiveInteger(value){

    const cleaned =
        String(value || "")
            .replace(
                /[,\s_]/g,
                ""
            );


    if(
        !/^\d+$/.test(
            cleaned
        )
    ){

        return null;

    }


    const amount =
        Number(cleaned);


    if(
        !Number.isSafeInteger(
            amount
        )
    ){

        return null;

    }


    return amount;

}


function activeExpiresAt(){

    return (
        Date.now() +
        TRADE_ACTIVE_TIMEOUT
    );

}


// =====================================================
// INVITATION
// =====================================================

function buildTradeInvite(
    trade,
    user1
){

    const expires =
        Math.floor(
            Number(
                trade.expiresat
            ) / 1000
        );


    const embed =
        new EmbedBuilder()

            .setColor(
                0x5865F2
            )

            .setTitle(
                "💱 Trade Request"
            )

            .setDescription(
                `${user1} wants to start a secure trade with you.\n\n` +
                `Only **XP** and **stored XP/Luck Boosts** can be traded.\n` +
                `Every participant pays an automatic fee when the trade completes.\n\n` +
                `Invite expires <t:${expires}:R>.`
            )

            .setFooter({

                text:
                    "Nothing moves until both traders confirm the final offer."

            });


    const row =
        new ActionRowBuilder()

            .addComponents(

                new ButtonBuilder()

                    .setCustomId(
                        `trade_invite_accept:${trade.id}`
                    )

                    .setLabel(
                        "Accept Trade"
                    )

                    .setStyle(
                        ButtonStyle.Success
                    )
                    .setEmoji(
                        "✅"
                    ),

                new ButtonBuilder()

                    .setCustomId(
                        `trade_invite_decline:${trade.id}`
                    )

                    .setLabel(
                        "Decline"
                    )

                    .setStyle(
                        ButtonStyle.Danger
                    )
                    .setEmoji(
                        "✖️"
                    )

            );


    return {
        embeds: [
            embed
        ],
        components: [
            row
        ]
    };

}


async function sendTradeInvite(
    channel,
    trade,
    user1
){

    const payload =
        buildTradeInvite(
            trade,
            user1
        );


    return channel.send({

        content:
            `<@${trade.user2id}>`,

        ...payload,

        allowedMentions: {
            users: [
                String(
                    trade.user2id
                )
            ]
        }

    });

}


// =====================================================
// PRIVATE CHANNEL SETUP
// =====================================================

async function createTradeRoom(
    interaction,
    trade
){

    const guild =
        await interaction.client.guilds.fetch(
            trade.guildid
        );


    const category =
        await guild.channels.fetch(
            TRADE_CATEGORY_ID
        );


    if(
        !category
        ||
        category.type !==
            ChannelType.GuildCategory
    ){

        throw new Error(
            `Trade category ${TRADE_CATEGORY_ID} was not found or is not a category.`
        );

    }


    const user1 =
        await guild.members.fetch(
            trade.user1id
        );

    const user2 =
        await guild.members.fetch(
            trade.user2id
        );


    const number =
        formatTradeNumber(
            trade.id
        );


    let role = null;
    let channel = null;


    try{

        role =
            await guild.roles.create({

                name:
                    `trading-${number}`,

                reason:
                    `Private role for trade #${number}`

            });


        // Position 1 is directly above @everyone.
        await role.setPosition(
            1
        ).catch(
            () => {}
        );


        await user1.roles.add(
            role,
            `Trade #${number}`
        );


        await user2.roles.add(
            role,
            `Trade #${number}`
        );


        channel =
            await guild.channels.create({

                name:
                    `trade-${number}`,

                type:
                    ChannelType.GuildText,

                parent:
                    category.id,

                topic:
                    `Secure trade #${number}: ${trade.user1id} <-> ${trade.user2id}`,

                permissionOverwrites: [

                    {
                        id:
                            guild.roles.everyone.id,

                        deny: [
                            PermissionFlagsBits.ViewChannel
                        ]
                    },

                    {
                        id:
                            role.id,

                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.EmbedLinks,
                            PermissionFlagsBits.AttachFiles
                        ]
                    },

                    {
                        id:
                            guild.members.me.id,

                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ReadMessageHistory,
                            PermissionFlagsBits.ManageChannels,
                            PermissionFlagsBits.ManageMessages
                        ]
                    }

                ],

                reason:
                    `Secure trade #${number}`

            });


        const debateMessage =
            await channel.send({

                content:
                    `<@${trade.user1id}> <@${trade.user2id}>\n` +
                    `💬 **This is your private trade room.** Debate the deal here, then use the panel below to build the exact trade.\n` +
                    `⚠️ Do not rely on chat promises — **only items shown in the trade panel are transferred.**`

            });


        const panel =
            await channel.send(
                buildTradePanel({
                    ...trade,
                    status:
                        "active",
                    roleid:
                        role.id,
                    channelid:
                        channel.id
                })
            );


        const activated =
            await database.activateTrade(
                trade.id,
                role.id,
                channel.id,
                panel.id,
                activeExpiresAt()
            );


        if(!activated){

            throw new Error(
                "Trade could not be activated in the database."
            );

        }


        await debateMessage.pin()
            .catch(
                () => {}
            );

        await panel.pin()
            .catch(
                () => {}
            );


        return activated;

    }
    catch(error){

        if(channel){

            await channel.delete(
                "Trade setup failed"
            ).catch(
                () => {}
            );

        }


        if(role){

            await role.delete(
                "Trade setup failed"
            ).catch(
                () => {}
            );

        }


        throw error;

    }

}


// =====================================================
// OFFER EDITING
// =====================================================

async function handleAddXP(
    interaction,
    tradeID
){

    const trade =
        await getAuthorizedTrade(
            interaction,
            tradeID,
            "active"
        );


    if(!trade)
        return;


    const current =
        getUserOffer(
            trade,
            interaction.user.id
        );


    const modal =
        new ModalBuilder()

            .setCustomId(
                `trade_xp_modal:${trade.id}`
            )

            .setTitle(
                `Trade #${formatTradeNumber(trade.id)} - XP`
            );


    const input =
        new TextInputBuilder()

            .setCustomId(
                "xp_amount"
            )

            .setLabel(
                "XP to offer"
            )

            .setPlaceholder(
                "Example: 250000"
            )

            .setStyle(
                TextInputStyle.Short
            )

            .setRequired(
                true
            )

            .setMaxLength(
                10
            );


    if(current.xp > 0){

        input.setValue(
            String(
                current.xp
            )
        );

    }


    modal.addComponents(

        new ActionRowBuilder()
            .addComponents(
                input
            )

    );


    await interaction.showModal(
        modal
    );

}


async function handleXPModal(
    interaction,
    tradeID
){

    const trade =
        await database.getTrade(
            tradeID
        );


    if(
        !trade
        ||
        !isParticipant(
            trade,
            interaction.user.id
        )
        ||
        trade.status !==
            "active"
    ){

        return privateReply(
            interaction,
            {
                content:
                    "This trade is no longer editable."
            }
        );

    }


    const amount =
        parsePositiveInteger(
            interaction.fields.getTextInputValue(
                "xp_amount"
            )
        );


    if(
        amount === null
        ||
        amount > MAX_TRADE_XP
    ){

        return privateReply(
            interaction,
            {
                content:
                    `Enter a whole XP amount between **0** and **${MAX_TRADE_XP.toLocaleString()}**.`
            }
        );

    }


    const user =
        await database.getUser(
            trade.guildid,
            interaction.user.id
        );


    const currentOffer =
        getUserOffer(
            trade,
            interaction.user.id
        );


    currentOffer.xp =
        amount;


    const fee =
        database.calculateTradeFee(
            currentOffer
        );


    const required =
        amount +
        fee.total;


    const balance =
        Number(
            user?.xp
        ) || 0;


    if(balance < required){

        return privateReply(
            interaction,
            {
                content:
                    `You currently have **${balance.toLocaleString()} XP**, but this offer plus your current fee needs **${required.toLocaleString()} XP**.`
            }
        );

    }


    const result =
        await database.updateTradeOffer(
            trade.id,
            interaction.user.id,
            currentOffer,
            activeExpiresAt()
        );


    if(!result.success){

        return privateReply(
            interaction,
            {
                content:
                    "The XP offer could not be updated."
            }
        );

    }


    await refreshTradePanel(
        interaction.client,
        trade.id
    );


    return privateReply(
        interaction,
        {
            content:
                amount > 0
                    ? `Your XP offer is now **${amount.toLocaleString()} XP**. Both confirmations were reset.`
                    : "Your XP offer was removed. Both confirmations were reset."
        }
    );

}


async function handleAddBoost(
    interaction,
    tradeID
){

    const trade =
        await getAuthorizedTrade(
            interaction,
            tradeID,
            "active"
        );


    if(!trade)
        return;


    const inventory =
        await database.getBoostInventory(
            trade.guildid,
            interaction.user.id
        );


    const options =
        inventory

            .filter(
                row =>
                    Number(
                        row.amount
                    ) > 0
            )

            .map(
                row => {

                    const key =
                        `${String(row.boosttype).toLowerCase()}:` +
                        `${String(row.tier).toLowerCase()}`;

                    return {

                        label:
                            getBoostLabel(
                                key
                            ),

                        description:
                            `${Number(row.amount).toLocaleString()} in inventory`,

                        value:
                            key

                    };

                }
            )
            .slice(
                0,
                25
            );


    if(options.length === 0){

        return privateReply(
            interaction,
            {
                content:
                    "You do not have any stored boosts available to trade."
            }
        );

    }


    const select =
        new StringSelectMenuBuilder()

            .setCustomId(
                `trade_boost_select:${trade.id}`
            )

            .setPlaceholder(
                "Choose a boost to offer"
            )

            .addOptions(
                options
            );


    return privateReply(
        interaction,
        {
            content:
                "Choose the boost you want to add or change:",
            components: [
                new ActionRowBuilder()
                    .addComponents(
                        select
                    )
            ]
        }
    );

}


async function handleBoostSelect(
    interaction,
    tradeID
){

    const trade =
        await database.getTrade(
            tradeID
        );


    if(
        !trade
        ||
        !isParticipant(
            trade,
            interaction.user.id
        )
        ||
        trade.status !==
            "active"
    ){

        return privateReply(
            interaction,
            {
                content:
                    "This trade is no longer editable."
            }
        );

    }


    const key =
        String(
            interaction.values[0] || ""
        ).toLowerCase();


    const [
        boostType,
        tier
    ] = key.split(":");


    if(
        !database.TRADE_BOOST_FEES[
            key
        ]
    ){

        return privateReply(
            interaction,
            {
                content:
                    "That boost cannot be traded."
            }
        );

    }


    const currentOffer =
        getUserOffer(
            trade,
            interaction.user.id
        );


    const modal =
        new ModalBuilder()

            .setCustomId(
                `trade_boost_modal:${trade.id}:${boostType}:${tier}`
            )

            .setTitle(
                `Offer ${getBoostLabel(key)}`
            );


    const input =
        new TextInputBuilder()

            .setCustomId(
                "boost_amount"
            )

            .setLabel(
                "Quantity to offer"
            )

            .setPlaceholder(
                "Example: 2"
            )

            .setStyle(
                TextInputStyle.Short
            )

            .setRequired(
                true
            )

            .setMaxLength(
                4
            );


    if(currentOffer.boosts[key]){

        input.setValue(
            String(
                currentOffer.boosts[key]
            )
        );

    }


    modal.addComponents(

        new ActionRowBuilder()
            .addComponents(
                input
            )

    );


    await interaction.showModal(
        modal
    );

}


async function handleBoostModal(
    interaction,
    tradeID,
    boostType,
    tier
){

    const trade =
        await database.getTrade(
            tradeID
        );


    if(
        !trade
        ||
        !isParticipant(
            trade,
            interaction.user.id
        )
        ||
        trade.status !==
            "active"
    ){

        return privateReply(
            interaction,
            {
                content:
                    "This trade is no longer editable."
            }
        );

    }


    const key =
        `${String(boostType).toLowerCase()}:` +
        `${String(tier).toLowerCase()}`;


    if(
        !database.TRADE_BOOST_FEES[
            key
        ]
    ){

        return privateReply(
            interaction,
            {
                content:
                    "That boost cannot be traded."
            }
        );

    }


    const amount =
        parsePositiveInteger(
            interaction.fields.getTextInputValue(
                "boost_amount"
            )
        );


    if(
        amount === null
        ||
        amount < 1
        ||
        amount >
            MAX_BOOST_QUANTITY
    ){

        return privateReply(
            interaction,
            {
                content:
                    `Enter a quantity from **1** to **${MAX_BOOST_QUANTITY.toLocaleString()}**.`
            }
        );

    }


    const available =
        await database.getBoostInventoryAmount(
            trade.guildid,
            interaction.user.id,
            boostType,
            tier
        );


    if(available < amount){

        return privateReply(
            interaction,
            {
                content:
                    `You only own **${available.toLocaleString()}** ${getBoostLabel(key)}.`
            }
        );

    }


    const currentOffer =
        getUserOffer(
            trade,
            interaction.user.id
        );


    currentOffer.boosts[key] =
        amount;


    const fee =
        database.calculateTradeFee(
            currentOffer
        );


    const user =
        await database.getUser(
            trade.guildid,
            interaction.user.id
        );


    const balance =
        Number(
            user?.xp
        ) || 0;


    const required =
        currentOffer.xp +
        fee.total;


    if(balance < required){

        return privateReply(
            interaction,
            {
                content:
                    `You need **${required.toLocaleString()} XP** available to cover your offered XP plus the trade fee, but you currently have **${balance.toLocaleString()} XP**.`
            }
        );

    }


    const result =
        await database.updateTradeOffer(
            trade.id,
            interaction.user.id,
            currentOffer,
            activeExpiresAt()
        );


    if(!result.success){

        return privateReply(
            interaction,
            {
                content:
                    "The boost offer could not be updated."
            }
        );

    }


    await refreshTradePanel(
        interaction.client,
        trade.id
    );


    return privateReply(
        interaction,
        {
            content:
                `You are now offering **${getBoostLabel(key)} ×${amount}**. Both confirmations were reset.`
        }
    );

}


async function handleRemove(
    interaction,
    tradeID
){

    const trade =
        await getAuthorizedTrade(
            interaction,
            tradeID,
            "active"
        );


    if(!trade)
        return;


    const offer =
        getUserOffer(
            trade,
            interaction.user.id
        );


    const options = [];


    if(offer.xp > 0){

        options.push({

            label:
                `Remove ${offer.xp.toLocaleString()} XP`,

            value:
                "xp",

            description:
                "Remove your XP offer"

        });

    }


    for(
        const [key, amount] of
        Object.entries(
            offer.boosts
        )
    ){

        options.push({

            label:
                `Remove ${getBoostLabel(key)}`,

            description:
                `Currently offering ×${amount}`,

            value:
                `boost:${key}`

        });

    }


    if(options.length === 0){

        return privateReply(
            interaction,
            {
                content:
                    "You do not currently have anything in your offer."
            }
        );

    }


    const select =
        new StringSelectMenuBuilder()

            .setCustomId(
                `trade_remove_select:${trade.id}`
            )

            .setPlaceholder(
                "Choose an item to remove"
            )

            .addOptions(
                options.slice(
                    0,
                    25
                )
            );


    return privateReply(
        interaction,
        {
            content:
                "Choose what you want to remove:",
            components: [
                new ActionRowBuilder()
                    .addComponents(
                        select
                    )
            ]
        }
    );

}


async function handleRemoveSelect(
    interaction,
    tradeID
){

    const trade =
        await database.getTrade(
            tradeID
        );


    if(
        !trade
        ||
        !isParticipant(
            trade,
            interaction.user.id
        )
        ||
        trade.status !==
            "active"
    ){

        return privateReply(
            interaction,
            {
                content:
                    "This trade is no longer editable."
            }
        );

    }


    const selection =
        String(
            interaction.values[0] || ""
        );


    const offer =
        getUserOffer(
            trade,
            interaction.user.id
        );


    let removedText =
        "item";


    if(selection === "xp"){

        removedText =
            `${offer.xp.toLocaleString()} XP`;

        offer.xp = 0;

    }
    else if(
        selection.startsWith(
            "boost:"
        )
    ){

        const key =
            selection.slice(
                "boost:".length
            );


        removedText =
            `${getBoostLabel(key)} ×${offer.boosts[key] || 0}`;

        delete offer.boosts[key];

    }
    else{

        return privateReply(
            interaction,
            {
                content:
                    "That item could not be removed."
            }
        );

    }


    const result =
        await database.updateTradeOffer(
            trade.id,
            interaction.user.id,
            offer,
            activeExpiresAt()
        );


    if(!result.success){

        return privateReply(
            interaction,
            {
                content:
                    "The offer could not be updated."
            }
        );

    }


    await refreshTradePanel(
        interaction.client,
        trade.id
    );


    return privateReply(
        interaction,
        {
            content:
                `Removed **${removedText}** from your offer. Both confirmations were reset.`
        }
    );

}


// =====================================================
// CONFIRM / COMPLETE
// =====================================================

async function handleConfirm(
    interaction,
    tradeID
){

    const trade =
        await database.getTrade(
            tradeID
        );


    if(
        !trade
        ||
        !isParticipant(
            trade,
            interaction.user.id
        )
    ){

        return privateReply(
            interaction,
            {
                content:
                    "Only the two traders can confirm this trade."
            }
        );

    }


    await interaction.deferReply({
        flags:
            MessageFlags.Ephemeral
    });


    const confirmResult =
        await database.confirmTrade(
            trade.id,
            interaction.user.id,
            activeExpiresAt()
        );


    if(!confirmResult.success){

        await refreshTradePanel(
            interaction.client,
            trade.id
        );


        return interaction.editReply({

            content:
                `This trade cannot be confirmed because it is currently **${getStatusLabel(confirmResult.status)}**.`

        });

    }


    await refreshTradePanel(
        interaction.client,
        trade.id
    );


    if(
        !confirmResult.readyToProcess
    ){

        return interaction.editReply({

            content:
                "✅ You confirmed the current offer. Waiting for the other trader."

        });

    }


    const completion =
        await database.executeTradeTransaction(
            trade.id,
            activeExpiresAt()
        );


    await refreshTradePanel(
        interaction.client,
        trade.id
    );


    if(!completion.success){

        let message =
            "The final safety check failed, so **nothing was transferred** and both confirmations were reset.";


        if(
            completion.status ===
            "insufficient-xp"
        ){

            message +=
                `\n<@${completion.userID}> needs **${completion.required.toLocaleString()} XP** available but has **${completion.balance.toLocaleString()} XP**.`;

        }
        else if(
            completion.status ===
            "insufficient-boost"
        ){

            message +=
                `\n<@${completion.userID}> no longer owns enough **${getBoostLabel(completion.key)}** ` +
                `(${completion.available}/${completion.required}).`;

        }
        else if(
            completion.status ===
            "empty-trade"
        ){

            message +=
                "\nAt least one item or XP amount must be offered.";

        }


        return interaction.editReply({
            content:
                message
        });

    }


    const completedTrade =
        completion.trade;


    const channel =
        await interaction.client.channels.fetch(
            completedTrade.channelid
        ).catch(
            () => null
        );


    if(channel){

        await channel.send({

            embeds: [

                new EmbedBuilder()

                    .setColor(
                        0x57F287
                    )

                    .setTitle(
                        `✅ Trade #${formatTradeNumber(completedTrade.id)} Completed`
                    )

                    .setDescription(
                        `Everything below was transferred atomically. The fees were removed from the economy.`
                    )

                    .addFields(

                        {
                            name:
                                `<@${completedTrade.user1id}> sent`,

                            value:
                                formatOffer(
                                    completedTrade.user1offer
                                ),

                            inline:
                                true
                        },

                        {
                            name:
                                `<@${completedTrade.user2id}> sent`,

                            value:
                                formatOffer(
                                    completedTrade.user2offer
                                ),

                            inline:
                                true
                        },

                        {
                            name:
                                "Fees paid",

                            value:
                                `<@${completedTrade.user1id}>: **${completion.fee1.total.toLocaleString()} XP**\n` +
                                `<@${completedTrade.user2id}>: **${completion.fee2.total.toLocaleString()} XP**`,

                            inline:
                                false
                        }

                    )

                    .setFooter({

                        text:
                            "This trade room will be cleaned up automatically."

                    })

                    .setTimestamp()

            ]

        }).catch(
            () => {}
        );

    }


    scheduleTradeCleanup(
        interaction.client,
        completedTrade.id
    );


    return interaction.editReply({

        content:
            "✅ **Trade completed successfully.** XP, boosts, and fees were all processed in one database transaction."

    });

}


// =====================================================
// CANCEL / DECLINE
// =====================================================

async function handleCancel(
    interaction,
    tradeID
){

    const trade =
        await database.getTrade(
            tradeID
        );


    if(
        !trade
        ||
        !isParticipant(
            trade,
            interaction.user.id
        )
    ){

        return privateReply(
            interaction,
            {
                content:
                    "Only the two traders can cancel this trade."
            }
        );

    }


    const cancelled =
        await database.cancelTrade(
            trade.id,
            interaction.user.id,
            `Cancelled by ${interaction.user.id}.`,
            "cancelled"
        );


    await refreshTradePanel(
        interaction.client,
        trade.id
    );


    if(cancelled?.channelid){

        const channel =
            await interaction.client.channels.fetch(
                cancelled.channelid
            ).catch(
                () => null
            );


        if(channel){

            await channel.send(
                `✖️ **Trade cancelled by ${interaction.user}.** Nothing was transferred.`
            ).catch(
                () => {}
            );

        }

    }


    scheduleTradeCleanup(
        interaction.client,
        trade.id
    );


    return privateReply(
        interaction,
        {
            content:
                "Trade cancelled. Nothing was transferred."
        }
    );

}


async function handleInviteAccept(
    interaction,
    tradeID
){

    const setup =
        await database.beginTradeSetup(
            tradeID,
            interaction.user.id,
            activeExpiresAt()
        );


    if(!setup.success){

        return privateReply(
            interaction,
            {
                content:
                    setup.status === "not-target"
                        ? "Only the user this trade request was sent to can accept or decline it."
                        : setup.status === "expired"
                            ? "This trade invitation expired."
                            : `This invitation is no longer available (**${getStatusLabel(setup.status)}**).`,
                components: []
            }
        );

    }


    await interaction.update({

        content:
            "✅ Trade accepted. Creating the private trade room...",

        embeds: [],

        components: []

    });


    try{

        const active =
            await createTradeRoom(
                interaction,
                setup.trade
            );


        await interaction.followUp({

            content:
                `<@${active.user1id}> <@${active.user2id}> ✅ Trade #${formatTradeNumber(active.id)} is ready.\n🔗 Open the private trade room: <#${active.channelid}>`,

            allowedMentions: {
                users: [
                    String(
                        active.user1id
                    ),
                    String(
                        active.user2id
                    )
                ]
            }

        }).catch(
            () => {}
        );

    }
    catch(error){

        console.error(
            "Trade room setup failed:",
            error
        );


        const cancelled =
            await database.cancelTrade(
                tradeID,
                interaction.user.id,
                "Trade room setup failed.",
                "cancelled"
            );


        await cleanupTradeResources(
            interaction.client,
            cancelled
        );


        await interaction.followUp({

            content:
                "❌ The trade room could not be created. The trade was cancelled and nothing was transferred."

        }).catch(
            () => {}
        );

    }

}


async function handleInviteDecline(
    interaction,
    tradeID
){

    const trade =
        await database.getTrade(
            tradeID
        );


    if(
        !trade
        ||
        String(trade.user2id) !==
            String(interaction.user.id)
    ){

        return privateReply(
            interaction,
            {
                content:
                    "This invitation does not belong to you."
            }
        );

    }


    const declined =
        await database.cancelTrade(
            trade.id,
            interaction.user.id,
            "Trade invitation declined.",
            "declined"
        );


    return interaction.update({

        content:
            `<@${trade.user1id}> ✖️ <@${trade.user2id}> declined Trade #${formatTradeNumber(trade.id)}.`,

        embeds: [],

        components: [],

        allowedMentions: {
            users: [
                String(
                    trade.user1id
                )
            ]
        }

    });

}


// =====================================================
// CLEANUP / RESTORE
// =====================================================

async function cleanupTradeResources(
    client,
    trade
){

    if(!trade)
        return;


    if(trade.channelid){

        const channel =
            await client.channels.fetch(
                trade.channelid
            ).catch(
                () => null
            );


        if(channel){

            await channel.delete(
                `Trade #${formatTradeNumber(trade.id)} cleanup`
            ).catch(
                () => {}
            );

        }

    }


    if(
        trade.roleid
        &&
        trade.guildid
    ){

        const guild =
            await client.guilds.fetch(
                trade.guildid
            ).catch(
                () => null
            );


        if(guild){

            const role =
                await guild.roles.fetch(
                    trade.roleid
                ).catch(
                    () => null
                );


            if(role){

                await role.delete(
                    `Trade #${formatTradeNumber(trade.id)} cleanup`
                ).catch(
                    () => {}
                );

            }

        }

    }


    await database.markTradeCleaned(
        trade.id
    ).catch(
        () => {}
    );

}


function scheduleTradeCleanup(
    client,
    tradeID
){

    const existing =
        cleanupTimers.get(
            Number(tradeID)
        );


    if(existing){

        clearTimeout(
            existing
        );

    }


    const timer =
        setTimeout(
            async () => {

                cleanupTimers.delete(
                    Number(tradeID)
                );


                const trade =
                    await database.getTrade(
                        tradeID
                    ).catch(
                        () => null
                    );


                await cleanupTradeResources(
                    client,
                    trade
                );

            },
            TRADE_CLEANUP_DELAY
        );


    cleanupTimers.set(
        Number(tradeID),
        timer
    );

}


async function cleanupExpiredTrades(
    client
){

    const expired =
        await database.getExpiredTrades();


    for(const trade of expired){

        const updated =
            await database.cancelTrade(
                trade.id,
                null,
                "Trade expired from inactivity.",
                "expired"
            );


        await refreshTradePanel(
            client,
            trade.id
        ).catch(
            () => {}
        );


        await cleanupTradeResources(
            client,
            updated
        );

    }


    const terminal =
        await database.getTradesNeedingCleanup();


    for(const trade of terminal){

        await cleanupTradeResources(
            client,
            trade
        );

    }

}


async function restoreTrades(
    client
){

    // A crash can happen after both users confirmed but before
    // executeTradeTransaction() was called. Re-run those safely:
    // the PostgreSQL transaction itself is idempotent by status.
    const processing =
        await database.getProcessingTrades();


    for(const trade of processing){

        try{

            const result =
                await database.executeTradeTransaction(
                    trade.id,
                    activeExpiresAt()
                );


            await refreshTradePanel(
                client,
                trade.id
            );


            if(result.success){

                scheduleTradeCleanup(
                    client,
                    trade.id
                );

            }

        }
        catch(error){

            console.error(
                `Failed to restore trade #${trade.id}:`,
                error
            );

        }

    }


    await cleanupExpiredTrades(
        client
    );

}


async function handleMemberRemove(
    member
){

    const cancelled =
        await database.cancelOpenTradesForUser(
            member.guild.id,
            member.id,
            "A trader left the server."
        );


    for(const trade of cancelled){

        await refreshTradePanel(
            member.client,
            trade.id
        ).catch(
            () => {}
        );


        await cleanupTradeResources(
            member.client,
            trade
        );

    }

}


// =====================================================
// INTERACTION ROUTER
// =====================================================

async function handleInteraction(
    interaction
){

    if(
        !interaction.isButton()
        &&
        !interaction.isStringSelectMenu()
        &&
        !interaction.isModalSubmit()
    ){

        return false;

    }


    const customID =
        String(
            interaction.customId || ""
        );


    if(
        !customID.startsWith(
            "trade_"
        )
    ){

        return false;

    }


    const parts =
        customID.split(":");

    const action =
        parts[0];

    const tradeID =
        Number(
            parts[1]
        );


    try{

        if(action === "trade_invite_accept"){

            await handleInviteAccept(
                interaction,
                tradeID
            );

        }
        else if(
            action ===
            "trade_invite_decline"
        ){

            await handleInviteDecline(
                interaction,
                tradeID
            );

        }
        else if(
            action ===
            "trade_add_xp"
        ){

            await handleAddXP(
                interaction,
                tradeID
            );

        }
        else if(
            action ===
            "trade_xp_modal"
        ){

            await handleXPModal(
                interaction,
                tradeID
            );

        }
        else if(
            action ===
            "trade_add_boost"
        ){

            await handleAddBoost(
                interaction,
                tradeID
            );

        }
        else if(
            action ===
            "trade_boost_select"
        ){

            await handleBoostSelect(
                interaction,
                tradeID
            );

        }
        else if(
            action ===
            "trade_boost_modal"
        ){

            await handleBoostModal(
                interaction,
                tradeID,
                parts[2],
                parts[3]
            );

        }
        else if(
            action ===
            "trade_remove"
        ){

            await handleRemove(
                interaction,
                tradeID
            );

        }
        else if(
            action ===
            "trade_remove_select"
        ){

            await handleRemoveSelect(
                interaction,
                tradeID
            );

        }
        else if(
            action ===
            "trade_confirm"
        ){

            await handleConfirm(
                interaction,
                tradeID
            );

        }
        else if(
            action ===
            "trade_cancel"
        ){

            await handleCancel(
                interaction,
                tradeID
            );

        }
        else{

            return false;

        }


        return true;

    }
    catch(error){

        console.error(
            "Trade interaction failed:",
            error
        );


        const payload = {

            content:
                "The trade system hit an error. No trade items were intentionally transferred."

        };


        if(
            interaction.deferred
            ||
            interaction.replied
        ){

            await interaction.editReply(
                payload
            ).catch(
                () => {}
            );

        }
        else{

            await privateReply(
                interaction,
                payload
            ).catch(
                () => {}
            );

        }


        return true;

    }

}


module.exports = {

    TRADE_CATEGORY_ID,

    TRADE_INVITE_TIMEOUT,

    TRADE_ACTIVE_TIMEOUT,

    sendTradeInvite,

    handleInteraction,

    cleanupExpiredTrades,

    restoreTrades,

    handleMemberRemove,

    buildTradePanel

};
