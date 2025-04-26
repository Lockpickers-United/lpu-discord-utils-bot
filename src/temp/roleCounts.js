const {SlashCommandBuilder, EmbedBuilder} = require('discord.js')
const {beltRoles, beltRoleSort} = require('../../../../../Documents/GitHub/lpu-discord-utils-bot/src/util/belts.js')


module.exports = {
    category: 'data',
    data: new SlashCommandBuilder()
        .setName('rolecounts')
        .setDescription('Displays the count of members for each role on the server')
        .addStringOption(option =>
            option.setName('output')
                .setDescription('Output format')
                .setRequired(true)
                .addChoices(
                    {name: 'Table', value: 'Table'},
                    {name: 'Data', value: 'Data'}
                )),

    async execute(interaction) {
        const {options} = interaction
        const guild = interaction.guild
        const roleCounts = {}
        if (!guild) {
            return interaction.reply('I could not access the guild :-(')
        }
        const outputFormat = options.getString('output')

        const member = interaction.member
        if (!user.member.roles.cache.some(role => role.name === 'Mods')) {
            return interaction.reply({
                content: 'You can\'t do that.',
                flags: 64 // Setting the response as ephemeral using flags
            })
        }

        // Fetch all members to ensure we're not missing any
        await guild.members.fetch()

        // Iterate through the members and count them by role
        guild.members.cache.forEach(m => {
            m.roles.cache.forEach(role => {
                // Skip the '@everyone' role
                if (beltRoles.includes(role.name)) {
                    roleCounts[role.name] = roleCounts[role.name] ? roleCounts[role.name] + 1 : 1
                    if (!role.name.includes('Dan')) {
                        roleCounts['Total'] = roleCounts['Total'] ? roleCounts['Total'] + 1 : 1
                    }
                }
            })
        })


        // Create an embed to display the role counts
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Belt Counts')
            .setDescription('Current members for each role:')
            .addFields(
                {
                    name: 'Role Counts',
                    value: Object.entries(roleCounts)
                        .filter((role) => beltRoles.includes(role[0]))
                        .sort((a, b) => {
                            return beltRoleSort(a[0], b[0])
                                || a[0].localeCompare(b[0])
                        })
                        .map(([role, count]) => {
                            return outputFormat === 'Table'
                                ? role !== 'Black Belt'
                                    ? `\`${role.padEnd(13)}${count.toString().padEnd(5, ' ')}\``
                                    : `\`${role.padEnd(13)}${count.toString().padEnd(5, ' ')}\``
                                    + `\n\`${'Total'.padEnd(13)}${roleCounts['Total'].toString().padEnd(5, ' ')}\``
                                    + '\n\n**Dan Levels**'
                                : role !== 'Black Belt'
                                    ? `${role},${count.toString()}`
                                    : `${role},${count.toString()}` + '\n\n**Dan Levels**'
                        }).join('\n'),
                    inline: false
                }
            )

        // Send the embed as a reply
        await interaction.reply({embeds: [embed]})
    }
}
