const {SlashCommandBuilder, EmbedBuilder} = require('discord.js')
const {beltRoleSort} = require('../../util/belts.js')


module.exports = {
    category: 'data',
    data: new SlashCommandBuilder()
        .setName('rolecounts')
        .setDescription('Displays the count of members for each role on the server'),

    async execute(interaction) {
        const guild = interaction.guild
        const roleCounts = {}

        const member = interaction.member;
        if (!member.roles.cache.some(role => role.name === 'Mods')) {
            return interaction.reply({
                content: 'You can\'t do that.',
                flags: 64 // Setting the response as ephemeral using flags
            });
        }

        if (!guild) {
            return interaction.reply('I could not access the guild :-(')
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
            .setDescription('Here is the count of members for each role:')
            .addFields(
                {
                    name: 'Role Counts',
                    value: Object.entries(roleCounts)
                        .filter((role) => role[0].includes(' Belt') || role[0].includes(' Dan'))
                        .sort((a, b) => {
                            return beltRoleSort(a[0], b[0])
                                || a[0].localeCompare(b[0])
                        })
                        .map(([role, count]) => {
                            return `\`${role.padEnd(13)}${count.toString().padEnd(4, ' ')}\``
                        }).join('\n'),
                    inline: false
                }
            )

        // Send the embed as a reply
        await interaction.reply({embeds: [embed]})
    }
}
