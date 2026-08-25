const {SlashCommandBuilder, MessageFlags} = require('discord.js')
const postSyncApproval = require('../../functions/postSyncApproval.js')
const isValidEvent = require('../../functions/isValidEvent')

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sync')
        .setDescription('Sync Reddit belt approval and post message')
        .addStringOption(option =>
            option
                .setName('discordusername')
                .setDescription('Discord username to sync')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('belt')
                .setDescription('Belt rank to assign.')
                .setRequired(true)
                .addChoices(
                    {name: 'White', value: 'White'},
                    {name: 'Yellow', value: 'Yellow'},
                    {name: 'Orange', value: 'Orange'},
                    {name: 'Green', value: 'Green'},
                    {name: 'Blue', value: 'Blue'},
                    {name: 'Purple', value: 'Purple'},
                    {name: 'Brown', value: 'Brown'},
                    {name: 'Red', value: 'Red'},
                    {name: 'Black', value: 'Black'},
                    {name: '1st Dan', value: '1st Dan'},
                    {name: '2nd Dan', value: '2nd Dan'},
                    {name: '3rd Dan', value: '3rd Dan'},
                    {name: '4th Dan', value: '4th Dan'},
                    {name: '5th Dan', value: '5th Dan'},
                    {name: '6th Dan', value: '6th Dan'},
                ))
        .addStringOption(option =>
            option
                .setName('message')
                .setDescription('Message to add to sync annnouncement (optional)')
        ),

    async execute(interaction) {

        if (interaction.user.bot) return
        const roles = interaction.member.roles.cache
        if (!roles.some(role => (role.name === 'Mods' || role.name === 'Staff'))) {
            console.log('User is not a mod or staff')
            await interaction.editReply({content: 'You do not have permission to use this command.'})
            return
        }

        const check = await isValidEvent(interaction)

        if (!check.valid) {
            await interaction.reply({content: check.reason, flags: [MessageFlags.Ephemeral]})
            return
        }

        const {options} = interaction
        const discordusername = options.getString('discordusername')
        const belt = options.getString('belt')
        const role = belt.includes('Dan') ? belt : `${belt} Belt`

        await interaction.deferReply()
        await interaction.editReply({content: 'Processing sync request...'})

        const transaction = await postSyncApproval(interaction)

        if (transaction.status === 'success') {

            let replyText = `Successfully set ${role} role for ${discordusername}.`
            if (transaction.message) {
                replyText = replyText + '\n  messages: ' + transaction.message
            }

            await interaction.editReply({content: replyText, flags: [MessageFlags.Ephemeral]})
        } else {
            await interaction.editReply({content: transaction.error || 'An error occurred.', flags: [MessageFlags.Ephemeral]})
        }

    }
}
