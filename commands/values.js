const {
    EmbedBuilder
} = require("discord.js");

const database =
    require("../database");

const boosts =
    require("../systems/boosts");

const luck =
    require("../utils/luck");


function getValueProfile(state){

    if(state.boostType === "xp"){
        return boosts.BOOST_PROFILES[state.tier];
    }


    return luck.LUCK_ROLES[state.tier];

}


function getTrendEmoji(state){

    if(Number(state.lastDirection) > 0){
        return "📈";
    }


    if(Number(state.lastDirection) < 0){
        return "📉";
    }


    return "➖";

}


function getMarketConfidence(state){

    const trades =
        Number(state.tradeCount) || 0;


    const traders =
        Number(
            state.distinctTraderCount
        ) || 0;


    if(trades === 0){
        return "Base value";
    }


    if(
        trades < 5
        ||
        traders < 4
    ){
        return "Early market";
    }


    if(
        trades < 20
        ||
        traders < 10
    ){
        return "Growing market";
    }


    return "Established market";

}


function formatValueLine(state){

    const profile =
        getValueProfile(state);


    const roleText =
        profile?.roleID
            ? `<@&${profile.roleID}>`
            : profile?.name ||
                state.key;


    const direction =
        Number(state.lastDirection) || 0;


    const changePercent =
        Math.abs(
            Number(
                state.lastChangePercent
            ) || 0
        );


    let movementText;


    if(direction > 0){

        movementText =
            `Up ${changePercent.toFixed(2)}% from the latest accepted sale`;

    }
    else if(direction < 0){

        movementText =
            `Down ${changePercent.toFixed(2)}% from the latest accepted sale`;

    }
    else if(Number(state.tradeCount) > 0){

        movementText =
            "Stable after the latest accepted sale";

    }
    else{

        movementText =
            "No completed market sales yet";

    }


    const tradeWord =
        Number(state.tradeCount) === 1
            ? "trade"
            : "trades";


    const traderWord =
        Number(
            state.distinctTraderCount
        ) === 1
            ? "trader"
            : "traders";


    return (
        `${getTrendEmoji(state)} ${roleText}\n` +
        `\`${Number(state.currentMin).toLocaleString()}-${Number(state.currentMax).toLocaleString()} XP\`\n` +
        `> ${movementText} • ${Number(state.tradeCount).toLocaleString()} ${tradeWord} • ` +
        `${Number(state.distinctTraderCount).toLocaleString()} ${traderWord} • ${getMarketConfidence(state)}`
    );

}


async function execute(message){

    if(!message.guild){
        return;
    }


    const values =
        await database.getBoostValues(
            message.guild.id
        );


    const xpValues =
        values.filter(
            state =>
                state.boostType === "xp"
        );


    const luckValues =
        values.filter(
            state =>
                state.boostType === "luck"
        );


    const embed =
        new EmbedBuilder()
            .setColor("#F1C40F")
            .setTitle("📊 Live Boost Trading Values")
            .setDescription(
                "These are community market ranges, not forced prices. Only completed `!trade` transactions move them. XP and boosts on both sides count, while extreme overpays, underpays, and repeated trades between the same pair have heavily reduced influence."
            )
            .addFields(
                {
                    name: "⚡ XP Boost Values",
                    value:
                        xpValues
                            .map(
                                formatValueLine
                            )
                            .join("\n\n"),
                    inline: false
                },
                {
                    name: "🍀 Luck Boost Values",
                    value:
                        luckValues
                            .map(
                                formatValueLine
                            )
                            .join("\n\n"),
                    inline: false
                }
            )
            .setFooter({
                text: "📈 latest sale raised the value • 📉 latest sale lowered it • more market history means smaller price swings"
            })
            .setTimestamp();


    return message.reply({
        embeds: [
            embed
        ],
        allowedMentions: {
            parse: [],
            repliedUser: false
        }
    });

}


module.exports = {
    execute,
    formatValueLine,
    getTrendEmoji,
    getMarketConfidence
};
