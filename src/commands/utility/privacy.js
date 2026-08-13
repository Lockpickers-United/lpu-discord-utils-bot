const {SlashCommandBuilder, EmbedBuilder, MessageFlags} = require('discord.js')

module.exports = {
    data: new SlashCommandBuilder()
        .setName('privacy')
        .setDescription('View our Privacy Policy'),

    async execute(interaction) {

        if (interaction.user.bot) return

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Privacy Policy')
            .setDescription('The Locky Junior Discord application does not collect or store any information about users who interact with it, beyond using your member roles to authenticate you to use the application at the time of request.')
            .addFields(
                {
                    name: 'Contact Us',
                    value: 'If you have any questions about this Privacy Policy, you can contact us by email: [lockyjunior@lockpickersunited.com](mailto://lockyjunior@lockpickersunited.com)',
                    inline: false
                }
            )

        await interaction.reply({embeds: [embed], flags: [MessageFlags.Ephemeral]})

    }
}
