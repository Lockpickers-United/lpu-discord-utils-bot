const dayjs = require('dayjs')
const relativeTime = require('dayjs/plugin/relativeTime')
dayjs.extend(relativeTime)
const {beltRequestChannelIds} = require('../data/approvedChannels')
const {PermissionFlagsBits} = require('discord.js')

async function postSyncApproval(event) {

    const beltRequestChannelId = beltRequestChannelIds[event.guildId]
    if (!beltRequestChannelId) {
        return {status: 'error', error: `No belt request channel ID found for guildId: ${event.guildId}`}
    }

    const {options} = event
    const discordusername = options.getString('discordusername')
    const belt = options.getString('belt')
    const message = options.getString('message')

    const role = belt.includes('Dan') ? belt : `${belt} Belt`

    const debugLogging = false
    let statusMessages

    const members = await event.guild.members.fetch({query: discordusername, limit: 1})
    const member = members.first()

    const roleIds = event.guild.roles.cache.reduce((acc, role) => {
        acc[role.name] = role.id
        return acc
    }, {})

    if (!member) {
        const message = `User not found for ${discordusername}`
        console.log(message)
        return {status: 'error', error: message}
    }

    try {
        await member.roles.add(roleIds[role])
        console.log('Role added successfully!')
    } catch (err) {
        console.error('Failed add role', role, err)
        const message = `Failed add role ${role} for ${discordusername}`
        return {status: 'error', error: message}
    }

    console.log(`Successfully set ${role} role for ${discordusername}.`)

    if (debugLogging) {
        const logEntry = {
            discordusername,
            role,
            date: dayjs().toISOString(),
            message: message
        }
        try {
            const syncLog = JSON.parse(await readFile(`${dataDir}/syncLog.json`, 'utf8'))
            const newSyncLog = [...syncLog, logEntry]
            await writeFile(`${dataDir}/syncLog.json`, JSON.stringify(newSyncLog, null, 2), 'utf8')
            console.log(`Logged sync for ${discordusername}`)
        } catch (err) {
            console.error(`Set ${role} role for ${discordusername} but failed to write sync log.`, err)
            statusMessages = ' | failed to write sync log'
        }
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
        await beltRequestsChannel.send(
            `<@${member.id}>, <@${event.user.id}> has reviewed and synced your request. Congrats on your ${role}!`
        )
    } catch (err) {
        statusMessages = statusMessages + ' | failed to post announcement'
    }

    try {
        const logChannel = await event.client.channels.fetch('647550275631972362')
        if (!logChannel?.isTextBased()) return console.error('Log channel not text-based')

        const perms = logChannel.permissionsFor(event.client.user)
        if (!logChannel.viewable || !perms?.has(PermissionFlagsBits.SendMessages)) {
            console.error('Missing access to log channel')
            statusMessages = statusMessages + ' | Missing access to log channel'

        }
        await logChannel.send(
            `${event.user.username} successfully set ${role} role for ${discordusername}.`
        )
    } catch (err) {
        console.error('Failed to log:', err)
        statusMessages = statusMessages + ' | Failed to post log'
    }

    return {status: 'success', message: statusMessages}

}

module.exports = postSyncApproval
