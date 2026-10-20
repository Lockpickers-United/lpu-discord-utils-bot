const {SlashCommandBuilder, EmbedBuilder, MessageFlags} = require('discord.js')
const {handleList} = require('../../functions/processBeltMessage.js')
const {default: belts} = require('../../util/belts.js')
const path = require('node:path')

module.exports = {
    category: 'utility',
    data: new SlashCommandBuilder()
        .setName('list')
        .setDescription('View open belt requests'),

    async execute(interaction) {

        if (interaction.user.bot) return

        const beltRequestsFile = path.join(__dirname, '../../..', 'data/beltRequests.json')

        let replyText
        let embeds = []
        let flags = []
        try {
            await handleList(beltRequestsFile).then(response => {
                replyText = response.success
                    ? ''
                    : `Sorry <@${interaction.author.id}>: ${response.error}`



                if (response.organizedRequests?.length) {
                    response.organizedRequests?.forEach(userRequests => {

                        let requestText = ''

                        userRequests.requests?.forEach(request => {
                            const reviewText = request.status === 'reviewing'
                                ? ` (${request.reviewerName} reviewing)`
                                : ''
                            requestText += `**${request.belt}**${reviewText}\n`
                            if (request.redditUsername)
                                requestText += `Reddit: u/${request.redditUsername}\n`
                            requestText += `${request.dateAdded} `
                            requestText += ` https://discord.com/channels/140129091796992000/282173282546089985/${request.messageId}\n`
                            requestText += `ID: ${request.id}\n\n`
                        })

                        const color = belts[userRequests.requests[0].belt.replace(' Belt', '')].color
                        const embed = new EmbedBuilder()
                            .setColor(color)
                            .setTitle(userRequests.requests[0].userName.toString())
                            .addFields(
                                {
                                    name: ' ',
                                    value: requestText,
                                    inline: false
                                }
                            )
                        embeds.push(embed)
                    })
                } else {
                    const embed = new EmbedBuilder()
                        .setColor('#00bb00')
                        .setTitle('Congratulations!')
                        .addFields(
                            {
                                name: ' ',
                                value: 'All Clear.',
                                inline: false
                            }
                        )
                    embeds.push(embed)
                }
            })
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
