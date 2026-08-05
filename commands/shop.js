const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    MessageFlags
} = require("discord.js");


const database =
    require("../database");


const boosts =
    require("../systems/boosts");


const luck =
    require("../utils/luck");


const leveling =
    require("../systems/leveling");


const SHOP_OPEN_TIME =
    10 * 60 * 1000;


const TIERS = [
    "tier1",
    "tier2",
    "tier3",
    "max"
];


const TIER_LABELS = {

    tier1: "I",
    tier2: "II",
    tier3: "III",
    max: "MAX"

};


function getProfile(
    boostType,
    tier
){

    if(boostType === "xp"){

        return boosts.BOOST_PROFILES[tier];

    }


    return luck.LUCK_ROLES[tier];

}


function mapStock(rows){

    const stock = {

        xp: {
            tier1: 0,
            tier2: 0,
            tier3: 0,
            max: 0
        },

        luck: {
            tier1: 0,
            tier2: 0,
            tier3: 0,
            max: 0
        }

    };


    for(const row of rows){

        const boostType =
            String(
                row.boosttype
            ).toLowerCase();


        const tier =
            String(
                row.tier
            ).toLowerCase();


        if(
            stock[boostType]
            &&
            Object.prototype.hasOwnProperty.call(
                stock[boostType],
                tier
            )
        ){

            stock[boostType][tier] =
                Number(
                    row.amount
                ) || 0;

        }

    }


    return stock;

}


function getCatalogItem(
    boostType,
    tier
){

    return database.SHOP_CATALOG[
        `${boostType}:${tier}`
    ];

}


function formatShopLine(
    boostType,
    tier,
    stock
){

    const item =
        getCatalogItem(
            boostType,
            tier
        );


    const profile =
        getProfile(
            boostType,
            tier
        );


    const amount =
        stock[boostType][tier];


    const stockText =
        amount > 0
            ? `**${amount}/${item.maxStock} left**`
            : "**SOLD OUT**";


    return (
        `<@&${profile.roleID}> — ` +
        `**${item.price.toLocaleString()} XP** ` +
        `• ${stockText}`
    );

}


function createShopButtons(
    stock,
    disableAll = false
){

    const xpRow =
        new ActionRowBuilder();


    const luckRow =
        new ActionRowBuilder();


    for(const tier of TIERS){

        const xpItem =
            getCatalogItem(
                "xp",
                tier
            );


        const luckItem =
            getCatalogItem(
                "luck",
                tier
            );


        xpRow.addComponents(

            new ButtonBuilder()

                .setCustomId(
                    `shop_buy:xp:${tier}`
                )

                .setLabel(
                    `XP ${TIER_LABELS[tier]} • ${xpItem.price.toLocaleString()}`
                )

                .setEmoji("⚡")

                .setStyle(
                    tier === "max"
                        ? ButtonStyle.Danger
                        : ButtonStyle.Primary
                )

                .setDisabled(
                    disableAll
                    ||
                    stock.xp[tier] <= 0
                )

        );


        luckRow.addComponents(

            new ButtonBuilder()

                .setCustomId(
                    `shop_buy:luck:${tier}`
                )

                .setLabel(
                    `Luck ${TIER_LABELS[tier]} • ${luckItem.price.toLocaleString()}`
                )

                .setEmoji("🍀")

                .setStyle(
                    tier === "max"
                        ? ButtonStyle.Danger
                        : ButtonStyle.Success
                )

                .setDisabled(
                    disableAll
                    ||
                    stock.luck[tier] <= 0
                )

        );

    }


    return [
        xpRow,
        luckRow
    ];

}


async function buildShopPanel(
    disableAll = false
){

    const shop =
        await database.getGlobalShop();


    const stock =
        mapStock(
            shop.stock
        );


    const refreshTimestamp =
        Math.floor(
            shop.nextRefreshAt / 1000
        );


    const xpLines =
        TIERS.map(
            tier =>
                formatShopLine(
                    "xp",
                    tier,
                    stock
                )
        ).join("\n");


    const luckLines =
        TIERS.map(
            tier =>
                formatShopLine(
                    "luck",
                    tier,
                    stock
                )
        ).join("\n");


    const embed =
        new EmbedBuilder()

            .setColor("#D4AF37")

            .setTitle(
                "🧙 Mizuki's Global Boost Merchant"
            )

            .setDescription(

`*"Welcome, traveler... Spend your XP wisely. My stock is shared by everyone."*

## ⚡︎ XP Boosts
${xpLines}

## 🍀 Luck Boosts
${luckLines}

### 🕰️ Merchant Restock
The entire global stock refreshes <t:${refreshTimestamp}:R> at <t:${refreshTimestamp}:T>.

*Anyone may use these buttons. The purchase uses the XP of whoever clicks.*`

            )

            .setFooter({

                text:
                    disableAll
                        ? "This merchant panel closed. Run !shop again."
                        : "Purchased boosts are stored in your !boost inventory."

            })

            .setTimestamp();


    return {

        embeds: [
            embed
        ],

        components:
            createShopButtons(
                stock,
                disableAll
            )

    };

}


function getPurchaseMessage(
    interaction,
    result,
    boostType,
    tier
){

    const profile =
        getProfile(
            boostType,
            tier
        );


    if(
        result.status ===
        "sold-out"
    ){

        const refreshTimestamp =
            Math.floor(
                result.nextRefreshAt / 1000
            );


        return (
            `❌ <@&${profile.roleID}> is sold out. ` +
            `The merchant restocks <t:${refreshTimestamp}:R>.`
        );

    }


    if(
        result.status ===
        "not-enough-xp"
    ){

        return (
            `❌ You need **${result.price.toLocaleString()} XP** ` +
            `to buy <@&${profile.roleID}>.\n` +
            `You currently have **${result.balance.toLocaleString()} XP** ` +
            `and need **${result.missing.toLocaleString()} more XP**.`
        );

    }


    if(!result.success){

        return (
            "❌ The merchant could not complete that purchase."
        );

    }


    return (
        `✅ ${interaction.user} bought <@&${profile.roleID}> ` +
        `for **${result.price.toLocaleString()} XP**!\n` +
        `🎒 Inventory: **x${result.inventoryAmount}**\n` +
        `🏪 Global stock remaining: **${result.remainingStock}**\n` +
        `💰 Your XP balance: **${result.balance.toLocaleString()} XP**`
    );

}


async function execute(message){

    if(!message.guild)
        return;


    const shopMessage =
        await message.reply(
            await buildShopPanel()
        );


    const collector =
        shopMessage.createMessageComponentCollector({

            componentType:
                ComponentType.Button,

            time:
                SHOP_OPEN_TIME

        });


    collector.on(
        "collect",
        async interaction => {

            const [
                action,
                boostType,
                tier
            ] = interaction.customId.split(":");


            if(action !== "shop_buy")
                return;


            try{

                await interaction.deferReply({
                    flags: MessageFlags.Ephemeral
                });


                const result =
                    await database.purchaseGlobalShopItem(
                        interaction.guild.id,
                        interaction.user.id,
                        `${boostType}:${tier}`
                    );


                if(result.success){

                    await leveling.syncLevelAndAnnounce(
                        interaction.client,
                        interaction.guild.id,
                        interaction.user.id
                    );

                }


                await shopMessage.edit(
                    await buildShopPanel()
                ).catch(() => {});


                await interaction.editReply({

                    content:
                        getPurchaseMessage(
                            interaction,
                            result,
                            boostType,
                            tier
                        )

                });

            }
            catch(error){

                console.error(
                    "Shop purchase failed:",
                    error
                );


                const errorMessage =
                    "❌ The merchant ran into an error. Your XP was not intentionally charged.";


                if(
                    interaction.deferred
                    ||
                    interaction.replied
                ){

                    await interaction.editReply({

                        content:
                            errorMessage

                    }).catch(() => {});

                }
                else{

                    await interaction.reply({

                        content:
                            errorMessage,

                        flags:
                            MessageFlags.Ephemeral

                    }).catch(() => {});

                }

            }

        }
    );


    collector.on(
        "end",
        async () => {

            await shopMessage.edit(
                await buildShopPanel(
                    true
                )
            ).catch(() => {});

        }
    );

}


module.exports = {
    execute
};
