const {SlashCommandBuilder, EmbedBuilder} = require('discord.js')
const {approvedChannels, allGuilds} = require('../../data/approvedChannels.js')

module.exports = {
    data: new SlashCommandBuilder()
        .setName('privacy')
        .setDescription('View our Privacy Policy'),

    async execute(interaction) {

        if (interaction.user.bot) return

        if (!allGuilds.includes(interaction.guildId)) {
            console.log('Not in an active guild')
            await interaction.editReply({content: 'Not in an active guild.'})
            return
        }
        if (!approvedChannels[interaction.channelId.toString()]) {
            console.log('Not in an approved channel')
            await interaction.editReply({content: 'You are not in an approved channel.'})
            return
        }

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Privacy Policy')
            .setDescription('The Locky Junior Discord application does not collect or store any information about users who interact with it, beyond using your member roles to authenticate you to use the application at the time of request.')
            .addFields(
                {
                    name: 'Contact Us',
                    value: 'If you have any questions about this Privacy Policy, You can contact us by email: lockyjunior@lockpickersunited.com',
                    inline: false
                }
            )

        await interaction.reply({embeds: [embed]})

    }
}
