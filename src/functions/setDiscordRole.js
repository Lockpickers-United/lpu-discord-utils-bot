import {beltRequestChannelIds, defaults} from '../data/config.js'
import {beltRoles} from '../util/belts.js'
import {PermissionFlagsBits} from 'discord.js'
import {client} from '../client.js'

async function setDiscordRole(event = {}, eventOptions) {

    // transaction = await setDiscordRole(message, {username, belt})

    const guildId = event.guildId ?? defaults.guildId
    let guild
    try {
        guild = await client.guilds.fetch(guildId);
        console.log(`Fetched guild: ${guild.name}`);
    } catch (error) {
        throw new Error(`Could not find or access the guild: ${error}`);
    }

    console.log('event.options', event.options)

    const beltRequestChannelId = beltRequestChannelIds[guildId] ?? defaults.beltRequestsId
    const options = eventOptions || event.options
    const username = options.username?.toString()
    const userId = options.userId
    const belt = options.belt?.toString()

    const role = ['Dan', 'Belt'].some(text => belt.includes(text)) ? belt : `${belt} Belt`

    let statusMessages = ''

    let member

    if (userId) {
        try {
            member = await guild.members.fetch(userId)
            console.log(`Found member: ${member.displayName}`)
        } catch (error) {
            throw new Error(`Member not found for id ${userId} or an error occurred: ` + error)
        }
    } else if (username) {
        const members = await guild.members.fetch({query: username, limit: 1})
        member = members.first()
        if (!member) {
            const error = `Member not found for username ${username}`
            console.error('Error:', error)
            throw new Error(error);
        }
    } else {
        throw new Error('Neither userId nor username provided')
    }

    const roleIds = guild.roles.cache.reduce((acc, role) => {
        acc[role.name] = role.id
        return acc
    }, {})

    const allBeltRoleIds = beltRoles.filter(role => role !== 'Black Belt').map(role => roleIds[role]).filter(x => x)
    allBeltRoleIds.push(roleIds['Chatter'])

    const currentRoleNames = member.roles.cache
        .filter(role => role.name !== '@everyone')
        .map(role => role.name).filter(x => x)

    const currentBeltRoles = currentRoleNames.filter(role => beltRoles.includes(role))
    const maxBeltRole = currentBeltRoles.reduce((acc, role) => beltRoles.indexOf(role) > beltRoles.indexOf(acc) ? role : acc, null)

    if (member.roles.cache.has(roleIds[role])) {
        console.log(`User is already flagged with ${role}`)
        statusMessages = statusMessages + ` | FYI: user was already flagged with ${role}`
    }

    //TODO: don't apply lower belts? (except testing)

    const alert = beltRoles.indexOf(role) < beltRoles.indexOf(maxBeltRole)
        ? `New belt: ${role} is lower than previous belt: ${maxBeltRole}`
        : null
    if (alert) console.warn('ALERT:', alert)

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
        const beltRequestsChannel = await client.channels.fetch(beltRequestChannelId)
        if (!beltRequestsChannel?.isTextBased()) {
            console.error('beltRequestsChannel not text-based')
            statusMessages = statusMessages + ' | beltRequestsChannel not text-based'
        }

        const perms = beltRequestsChannel.permissionsFor(client.user)
        if (!beltRequestsChannel.viewable || !perms?.has(PermissionFlagsBits.SendMessages)) {
            console.error('Missing access to beltRequestsChannel')
            statusMessages = statusMessages + ' | Missing access to beltRequestsChannel'
        }
    } catch (err) {
        statusMessages = statusMessages + ' | failed to post announcement'
    }

    return {
        status: 'success',
        success: 'success',
        result: `Successfully set ${role} role for ${username} on Discord.`,
        statusMessages,
        alert
    }

}

export default setDiscordRole
