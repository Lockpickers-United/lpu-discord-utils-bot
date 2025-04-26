const {beltRoles, beltRoleSort} = require('../util/belts.js')
const {EmbedBuilder} = require('discord.js')
const {localUser, prodUser} = require('../../keys/users.js')
const fs = require('node:fs/promises')

async function getRoleCounts(message) {
    const roleCounts = {}

    const production = process.env.USER !== localUser
    const serverDir = production
        ? `/home/${prodUser}/explore.lpubelts.com/public/data`
        : `/Users/${localUser}/Documents/LOCKPICK/LPU-Belt-Explorer/Locky bot/Locky Junior`

    const outputFormat = message.content.toLowerCase().includes('data')
        ? 'data'
        : 'table'

    const guild = message.guild
    if (!guild) {
        console.error('I could not access the guild :-(')
        return
    }

    const member = message.member
    if (!member.roles.cache.some(r => r.name === 'Mods')) {
        console.log('User is not a mod')
        return
    }


    // Fetch all members to ensure we're not missing any
    await guild.members.fetch()

    // Iterate through the members and count them by role
    guild.members.cache.forEach(m => {
        m.roles.cache.forEach(role => {
            // Skip the '@everyone' role
            roleCounts[role.name] = roleCounts[role.name] ? roleCounts[role.name] + 1 : 1
            if (!role.name.includes('Dan')) {
                roleCounts['Total'] = roleCounts['Total'] ? roleCounts['Total'] + 1 : 1
            }
        })
    })


    await guild.roles.fetch()
    const allRoles = guild.roles.cache.reduce((acc, role) => {
        acc[role.name] = roleCounts[role.name] || 0
        return acc
    }, {})

    const sortedAllRoleCounts = Object.keys(allRoles)
        .sort((a, b) => {
            return allRoles[b] - allRoles[a]
        })
        .reduce((acc, role) => {
            acc[role] = allRoles[role] || 0
            return acc
        }, {})

    message.content.toLowerCase().includes('all') && console.log(JSON.stringify(sortedAllRoleCounts, null, 2))

    const sortedRoleCounts = Object.keys(roleCounts)
        .filter((role) => beltRoles.includes(role))
        .sort((a, b) => {
            return beltRoleSort(a, b)
                || a.localeCompare(b)
        })
        .reduce((acc, role) => {
            acc[role] = roleCounts[role] || 0
            return acc
        }, {})

    const sortedRoleCountsCsv = 'Belt,Count\n'
        + Object.keys(sortedRoleCounts)
            .reduce((acc, role) => {
                return acc + `${role},${roleCounts[role]}\n`
            }, '')

    try {
        await fs.writeFile(`${serverDir}/discordRoleCounts.json`, JSON.stringify(sortedRoleCounts, null, 2))
        await fs.writeFile(`${serverDir}/discordRoleCounts.csv`, sortedRoleCountsCsv)
    } catch (err) {
        console.log(err)
    }

    // Check if the role counts are empty
    if (Object.keys(roleCounts).length === 0) {
        console.log('No roles found')
        return
    }

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
                        return outputFormat === 'table'
                            ? role !== 'Black Belt'
                                ? `\`${role.padEnd(13)}${count.toString().padEnd(5, ' ')}\``
                                : `\`${role.padEnd(13)}${count.toString().padEnd(5, ' ')}\``
                                + `\n\`${'Total'.padEnd(13)}${roleCounts['Total'].toString().padEnd(5, ' ')}\``
                                + '\n\n**Dan Levels**'
                            : `${role},${count.toString()}`
                    }).join('\n'),
                inline: false
            }
        )

    // Send the embed as a reply
    await message.reply({embeds: [embed]})
}

module.exports = getRoleCounts
