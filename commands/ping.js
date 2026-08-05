const {
    EmbedBuilder
} = require("discord.js");

async function execute(message){

    const reply =
        await message.reply("🏓 Pinging...");

    const latency =
        reply.createdTimestamp -
        message.createdTimestamp;

    const api =
        Math.round(
            message.client.ws.ping
        );

    const embed =
        new EmbedBuilder()

        .setColor("#8A2BE2")

        .setTitle("🏓 Pong!")

        .addFields(

            {
                name: "Message Latency",
                value: `${latency}ms`,
                inline: true
            },

            {
                name: "API Latency",
                value: `${api}ms`,
                inline: true
            }

        )

        .setTimestamp();

    await reply.edit({

        content: "",

        embeds: [embed]

    });

}

module.exports = {

    execute

};