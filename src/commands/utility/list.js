const {SlashCommandBuilder, EmbedBuilder, MessageFlags} = require('discord.js')
const {handleList} = require('../../functions/processBeltMessage.js')
const path = require('node:path')

module.exports = {
    data: new SlashCommandBuilder()
        .setName('list')
        .setDescription('View open belt requests'),





    async execute(interaction) {

        if (interaction.user.bot) return

        const beltRequestsFile = path.join(__dirname, '../../..', 'data/beltRequests.json')

        let replyText
        try {
            await handleList(beltRequestsFile).then(response => {
                replyText = response.success
                    ? response.requestsText
                    : `Sorry <@${interaction.author.id}>: ${response.error}`
            })
        }
        catch (error) {
            console.error(error)
            replyText = `Sorry <@${interaction.author.id}>: An error occurred while processing your request.`
        }

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Belt Requests')
            //.setDescription('Display a list of belt requests')
            .addFields(
                {
                    name: ' ',
                    value: replyText,
                    inline: false
                }
            )

        // , flags: [MessageFlags.Ephemeral]
        await interaction.reply({embeds: [embed]})

    }
}
