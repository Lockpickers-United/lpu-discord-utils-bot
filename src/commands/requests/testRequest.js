const {SlashCommandBuilder, EmbedBuilder} = require('discord.js')


module.exports = {
    category: 'requests',
    data: new SlashCommandBuilder()
        .setName('test')
        .setDescription('Send test post'),

    async execute(interaction) {

        if (interaction.user.bot) return

        const embed = new EmbedBuilder()
            .setColor('#ff9900')
            .setTitle('New Belt Request')
            .addFields(
                {
                    name: 'username',
                    value: 'mgsecure',
                    inline: true
                },
                {
                    name: 'belt',
                    value: 'White Belt',
                    inline: true
                },
                {
                    name: 'redditUsername',
                    value: 'mgsecure',
                    inline: true
                },
                {
                    name: 'message',
                    value: 'Master Lock #3 - https://lpubelts.com/#/locks?tab=White',
                    inline: false
                }
            )
        const embeds = [embed]
        const flags = []

        try {
            await interaction.reply({embeds}, {flags})
        } catch (error) {
            console.error(error)
        }

    }
}
