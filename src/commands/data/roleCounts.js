const {SlashCommandBuilder, EmbedBuilder} = require('discord.js')


module.exports = {
    category: 'data',
    data: new SlashCommandBuilder()
        .setName('rolecounts')
        .setDescription('Displays the count of members for each role on the server'),

    async execute(interaction) {
        const guild = interaction.guild
        const roleCounts = {}

        if (!guild) {
            return interaction.reply('I could not access the guild. Please check the bot permissions.')
        }

        // Fetch all members to ensure we're not missing any
        await guild.members.fetch()

        // Iterate through the members and count them by role
        guild.members.cache.forEach(member => {
            member.roles.cache.forEach(role => {
                // Skip the '@everyone' role
                if (role.name !== '@everyone') {
                    if (!roleCounts[role.name]) {
                        roleCounts[role.name] = 0
                    }
                    roleCounts[role.name] += 1
                }
            })
        })

        // Create an embed to display the role counts
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Role Member Counts')
            .setDescription('Here is the count of members for each role')
            .addFields(
                {
                    name: 'Role Counts',
                    value: Object.entries(roleCounts)
                        .filter((role) => role[0].includes('Belt') || role[0].includes('Dan'))
                        .map(([role, count]) => (role + ',' + count.toString())).join('\n'),
                    inline: false
                }
            )

        // Send the embed as a reply
        await interaction.reply({embeds: [embed]})
    }
}
