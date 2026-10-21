const {SlashCommandBuilder, EmbedBuilder} = require('discord.js')
const {handleList} = require('../../functions/processBeltMessage.js')
const {beltRequestsFile} = require('../../../keys/botConfig.js')

module.exports = {
    data: new SlashCommandBuilder()
        .setName('request')
        .setDescription('Act on belt requests')
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Action to take')
                .setRequired(true)
                .addChoices(
                    {name: 'List', value: 'list'},
                    {name: 'Approve', value: 'approve'},
                    {name: 'Reject', value: 'reject'},
                    {name: 'Delete', value: 'delete'},
                    {name: 'Pend', value: 'pend'},
                    {name: 'Review', value: 'review'},
                    {name: 'Unreview', value: 'unreview'},
                    {name: 'Moreinfo', value: 'moreinfo'},
                    {name: 'Info', value: 'info'},
                    {name: 'Delete All', value: 'delete_all'},
                    {name: 'Stats', value: 'stats'},
                    {name: 'Sync', value: 'sync'},
                    {name: 'Help', value: 'help'}
                ))
        .addStringOption(option =>
            option
                .setName('request-id')
                .setDescription('Request ID')
        )
        .addStringOption(option =>
            option
                .setName('note')
                .setDescription('Note')
        ),

    async execute(interaction) {

        if (interaction.user.bot) return
        await interaction.deferReply()
        await interaction.editReply({content: 'Processing flair request...'})

        let replyText
        try {
            await handleList(beltRequestsFile).then(response => {
                replyText = response.success
                    ? response.requestsText
                    : `Sorry <@${interaction.author.id}>: ${response.error}`
            })
        } catch (error) {
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
