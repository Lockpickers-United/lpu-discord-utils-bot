const fs = require('node:fs/promises')
const {EmbedBuilder} = require('discord.js')
const {beltRoles, beltRoleSort} = require('../util/belts.js')
const {localUser, prodUser} = require('../../keys/users.js')
const {setDeepAdd, setDeepUnique} = require('../util/setDeep.js')


async function getRoleCounts(message, showEmbed = false) {
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

    // Fetch all members to ensure we're not missing any
    await guild.members.fetch()

    // Iterate through the members and count them by role

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
    const allRoles = guild.roles.cache.reduce((acc, role) => {
        acc[role.name] = userRoles[role.name] || 0
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

    const sortedRoleCountsCsv = 'Belt,Count\n'
        + Object.keys(sortedRoleCounts)
            .reduce((acc, role) => {
                return acc + `${role},${allBeltDanRoles[role]}\n`
            }, '')

    try {
        await fs.writeFile(`${serverDir}/discordBeltCounts.json`, JSON.stringify(sortedRoleCounts, null, 2))
        await fs.writeFile(`${serverDir}/discordBeltCounts.csv`, sortedRoleCountsCsv)

        await fs.writeFile(`${serverDir}/discordUserRoles.json`, JSON.stringify(userBeltRoles, null, 2))

    } catch (err) {
        console.log(err)
    }

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

    if (showEmbed) {
        await message.reply({embeds: [embed]})
    }
}

module.exports = getRoleCounts
