const {beltRequestChannelIds} = require('../data/config.js')
const {beltRoles} = require('../util/belts.js')
const {PermissionFlagsBits} = require('discord.js')

async function setDiscordRole(event, eventOptions) {

    const beltRequestChannelId = beltRequestChannelIds[event.guildId]
    if (!beltRequestChannelId) {
        return {status: 'error', error: `No belt request channel ID found for guildId: ${event.guildId}`}
    }

    if (!event.user) event.user = event.author

    const options = eventOptions || event.options
    const username = options.username.toString()
    const belt = options.belt.toString()

    const role = ['Dan', 'Belt'].some(text => belt.includes(text)) ? belt : `${belt} Belt`

    let statusMessages = ''

    const members = await event.guild.members.fetch({query: username, limit: 1})
    const member = members.first()

    if (!member) {
        const message = `User not found for ${username}`
        console.log(message)
        return {status: 'error', error: message}
    }

    const roleIds = event.guild.roles.cache.reduce((acc, role) => {
        acc[role.name] = role.id
        return acc
    }, {})

    const allBeltRoleIds = beltRoles.map(role => roleIds[role]).filter(x => x)
    allBeltRoleIds.push(roleIds['Chatter'])

    // TODO: preserve black belt

    const currentRoleNames = member.roles.cache
        .filter(role => role.name !== '@everyone')
        .map(role => role.name).filter(x => x)

    const currentBeltRoles = currentRoleNames.filter(role => beltRoles.includes(role))
    const maxBeltRole = currentBeltRoles.reduce((acc, role) => beltRoles.indexOf(role) > beltRoles.indexOf(acc) ? role : acc, null)

    if (member.roles.cache.has(roleIds[role])) {
        console.log(`User is already flagged with ${role}`)
        statusMessages = statusMessages + ` | FYI: user was already flagged with ${role}`
    }

    const alert = beltRoles.indexOf(role) < beltRoles.indexOf(maxBeltRole)
        ? `New belt: ${role} is lower than previous belt: ${maxBeltRole}`
        : null
    if (alert) console.log('ALERT:', alert)

    try {
        await member.roles.remove(allBeltRoleIds)
        console.log('Existing Belt Roles removed successfully!')
        await member.roles.add(roleIds[role])
        console.log('Role added successfully!')
    } catch (err) {
        console.error('Failed add role', role, err)
        const message = `Failed add role ${role} for ${username}`
        return {status: 'error', error: message}
    }

    try {
        const beltRequestsChannel = await event.client.channels.fetch(beltRequestChannelId)
        if (!beltRequestsChannel?.isTextBased()) {
            console.error('beltRequestsChannel not text-based')
            statusMessages = statusMessages + ' | beltRequestsChannel not text-based'
        }

        const perms = beltRequestsChannel.permissionsFor(event.client.user)
        if (!beltRequestsChannel.viewable || !perms?.has(PermissionFlagsBits.SendMessages)) {
            console.error('Missing access to beltRequestsChannel')
            statusMessages = statusMessages + ' | Missing access to beltRequestsChannel'
        }
    } catch (err) {
        statusMessages = statusMessages + ' | failed to post announcement'
    }

    return {status: 'success', success: 'success', result: `Successfully set ${role} role for ${username} on Discord.`, statusMessages, alert}

}

module.exports = setDiscordRole
