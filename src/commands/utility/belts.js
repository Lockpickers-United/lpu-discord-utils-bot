const {SlashCommandBuilder, EmbedBuilder, MessageFlags} = require('discord.js')
const {approvedChannels} = require('../../data/config.js')
const {setDeepUnique, setDeepAdd} = require('../../util/setDeep')
const {beltRoles, beltRoleSort} = require('../../util/belts')
const fs = require('node:fs/promises')
const {localUser, prodUser} = require('../../../keys/users')

module.exports = {
    data: new SlashCommandBuilder()
        .setName('belts')
        .setDescription('View User Belt Counts'),

    async execute(interaction) {

        const debugLogging = true

        const production = process.env.USER !== localUser
        const debugDir = production
            ? `/home/${prodUser}/lpu-discord-utils-bot/src/dataOut`
            : `/Users/${localUser}/Documents/LOCKPICK/LPU-Belt-Explorer/Locky bot/Locky Junior`

        const serverDir = production
            ? `/home/${prodUser}//explore.lpubelts.com/public/data`
            : `/Users/${localUser}/Documents/LOCKPICK/LPU-Belt-Explorer/Locky bot/Locky Junior`

        if (interaction.user.bot) return
        const roles = interaction.member.roles.cache
        if (!roles.some(role => (role.name === 'Mods' || role.name === 'Staff'))) {
            console.log('User is not a mod or staff')
            await interaction.reply({content: 'You do not have permission to use this command.', flags: [MessageFlags.Ephemeral]})
            return
        }
        if (!approvedChannels[interaction.channelId.toString()]) {
            console.log('Not in an approved channel')
            await interaction.reply({content: 'You are not in an approved channel.', flags: [MessageFlags.Ephemeral]})
            return
        }

        const guild = interaction.guild
        if (!guild) {
            console.error('I could not access the guild :-(')
            return
        }

        // Fetch all members to ensure we're not missing any
        await guild.members.fetch()

        const userRoles = guild.members.cache.reduce((acc, member) => {
            member.roles.cache.forEach(role => {
                if (role.name === '@everyone') return
                setDeepUnique(acc, [member.user.username], role.name)
            })
            return acc
        }, {})

        if (Object.keys(userRoles).length === 0) {
            console.log('No roles found')
            return
        }

        const userBeltRoles = Object.keys(userRoles).reduce((acc, username) => {
            const allBeltRoles = userRoles[username]
                .filter(role => beltRoles.includes(role) && role.includes('Belt'))
            const beltRole = allBeltRoles
                .sort((a, b) => {
                    return beltRoleSort(a[0], b[0])
                })[allBeltRoles.length - 1]
            if (beltRole) {
                acc[username] = beltRole
            }
            return acc
        }, {})

        const beltRoleCounts = Object.keys(userBeltRoles).reduce((acc, username) => {
            setDeepAdd(acc, [userBeltRoles[username]], 1)
            return acc
        }, {})

        const userDanRoles = Object.keys(userRoles).reduce((acc, username) => {
            const allDanRoles = userRoles[username]
                .filter(role => beltRoles.includes(role) && role.includes('Dan'))
            const danRole = allDanRoles
                .sort((a, b) => {
                    return beltRoleSort(a[0], b[0])
                })[allDanRoles.length - 1]
            if (danRole) {
                acc[username] = danRole
            }
            return acc
        }, {})

        const danRoleCounts = Object.keys(userDanRoles).reduce((acc, username) => {
            setDeepAdd(acc, [userDanRoles[username]], 1)
            setDeepAdd(acc, ['Total'], 1)
            return acc
        }, {})

        const allBeltDanRoles = {...beltRoleCounts, ...danRoleCounts}

        const usersWithRoles = Object.keys(userRoles).length
        const usersWithBeltRoles = Object.keys(userBeltRoles).length
        const usersWithDanRoles = Object.keys(userDanRoles).length
        console.log('totals', 'with roles', usersWithRoles, 'with belts', usersWithBeltRoles, 'with dans', usersWithDanRoles)

        await guild.roles.fetch()

        const sortedRoleCounts = Object.keys(allBeltDanRoles)
            .filter((role) => beltRoles.includes(role))
            .sort((a, b) => {
                return beltRoleSort(a, b)
                    || a.localeCompare(b)
            })
            .reduce((acc, role) => {
                acc[role] = allBeltDanRoles[role] || 0
                return acc
            }, {})

        console.log('belts', JSON.stringify(sortedRoleCounts, null, 2))

        try {
            await fs.writeFile(`${serverDir}/discordBeltCounts.json`, JSON.stringify(sortedRoleCounts, null, 2))
        } catch (err) {
            console.log(err)
        }

        if (debugLogging) {
            try {
                await fs.writeFile(`${debugDir}/discordUserRoles.json`, JSON.stringify(userBeltRoles, null, 2))
                await fs.writeFile(`${debugDir}/discordUserRolesAll.json`, JSON.stringify(userRoles, null, 2))
                await fs.writeFile(`${debugDir}/discordBeltCounts.json`, JSON.stringify(sortedRoleCounts, null, 2))
            } catch (err) {
                console.log(err)
            }
        }
        const outputFormat = 'table'

        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Belt Counts')
            .setDescription('Current members for each role:')
            .addFields(
                {
                    name: 'Role Counts',
                    value: Object.entries(allBeltDanRoles)
                            .filter((role) => beltRoles.includes(role[0]))
                            .sort((a, b) => {
                                return beltRoleSort(a[0], b[0])
                                    || a[0].localeCompare(b[0])
                            })
                            .map(([role, count]) => {
                                return outputFormat === 'table'
                                    ? role !== 'Black Belt'
                                        ? `\`${role.padEnd(13)}${count.toString().padEnd(5, ' ')}\``
                                        : `\`${role.padEnd(13)}${count.toString().padEnd(5, ' ')}\``
                                        + `\n\`${'Total'.padEnd(13)}${usersWithBeltRoles.toString().padEnd(5, ' ')}\``
                                        + '\n\n**Dan Levels**'
                                    : `${role},${count.toString()}`
                            }).join('\n')
                        + `\n\`${'Total'.padEnd(13)}${usersWithDanRoles.toString().padEnd(5, ' ')}\``,
                    inline: false
                }
            )

        await interaction.reply({embeds: [embed], flags: [MessageFlags.Ephemeral]})

    }
}
