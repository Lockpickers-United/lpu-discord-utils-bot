const {SlashCommandBuilder, EmbedBuilder, MessageFlags} = require('discord.js')
const path = require('node:path')
const {buildRequestStats} = require('../../util/buildRequestStats.js')


module.exports = {
    category: 'requests',
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View request stats'),

    async execute(interaction) {

        if (interaction.user.bot) return

        const beltRequestsFile = path.join(__dirname, '../../..', 'data/beltRequests.json')

        let replyText
        let embeds = []
        let flags = []
        try {
            await buildRequestStats(beltRequestsFile)
                .then(response => {
                        replyText = response.success
                            ? ''
                            : `Sorry <@${interaction.author.id}>: ${response.error}`

                        if (response.sevenBlocks?.length) {
                            embeds.push(new EmbedBuilder()
                                .setColor('#00bb00')
                                .setTitle('Last 7 Days')
                                .addFields(
                                    response.sevenBlocks.map(block => {
                                            return {
                                                name: block.title ?? '',
                                                value: block.text ?? '',
                                                inline: true
                                            }
                                        }
                                    ))
                            )
                        } else {
                            const embed = new EmbedBuilder()
                                .setColor('#00bb00')
                                .setTitle('Congratulations!')
                                .addFields(
                                    {
                                        name: ' ',
                                        value: 'No stats :-(',
                                        inline: false
                                    }
                                )
                            embeds.push(embed)
                        }
                    }
                )
        } catch (error) {
            console.error(error)
            const embed = new EmbedBuilder()
                .setColor('#ff9900')
                .setTitle('Ooops.')
                .addFields(
                    {
                        name: ' ',
                        value: replyText,
                        inline: false
                    }
                )
            embeds = [embed]
            flags = [MessageFlags.Ephemeral]
        }

        await interaction.reply({embeds}, {flags})

    }
}
