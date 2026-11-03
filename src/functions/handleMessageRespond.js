import {client} from '../client.js'
import {MessageFlags, PermissionFlagsBits} from 'discord.js'
import {beltRequestChannelIds, beltRequestsChannelId} from '../data/config.js'

export async function handleReply({message, beltRequest, platform = 'log', replyText}) {

    if (!message) throw new Error('No message to reply to.')
    if (!replyText) throw new Error('No reply text provided.')

    if (platform === 'Discord' && message) {
        console.log('handleReply => discord:', replyText)
        await message.reply({content: replyText.toString()})
    } else if (platform === 'log') {
        console.log('handleReply => log:', replyText)
    } else {
        console.log('handleReply =>', platform, replyText)
    }
}

export async function handleAnnounce({message, beltRequest, platform = 'log', announceText}) {
    try {
        if (platform === 'Discord') {
            await channelAnnounce(message, announceText)
            console.log('handleAnnounce => discord:', announceText)
        } else if (platform === 'log') {
            console.log('handleAnnounce => log:', announceText)
        } else {
            console.log('handleAnnounce =>', platform, announceText)
        }
    } catch (err) {
        console.error('Error in handleAnnounce:', err)
        throw new Error(`Error in handleAnnounce: ${err}`)
    }
}

export async function channelAnnounce(message, announceText) {
    try {
        const announcementChannel = await getAnnouncementChannel({message})
        await announcementChannel.send(announceText)
        return {success: 'announcement posted'}
    } catch (err) {
        console.error(`Failed to post announcement: ${err}`)
        throw new Error(`Failed to post announcement: ${err}`)
    }
}

async function getAnnouncementChannel({message}) {
    if (message) {
        const beltRequestChannelId = beltRequestChannelIds[message.guildId]
        if (!beltRequestChannelId)
            throw new Error(`No belt request channel ID found for guildId: ${message.guildId}`)
        const beltRequestsChannel = await message.client.channels.fetch(beltRequestChannelId)
        if (!beltRequestsChannel?.isTextBased())
            throw new Error('Belt Requests channel not text-based')
        const perms = beltRequestsChannel.permissionsFor(message.client.user)
        if (!beltRequestsChannel.viewable || !perms?.has(PermissionFlagsBits.SendMessages))
            throw new Error('Missing access to beltRequestsChannel')
        return beltRequestsChannel

    } else {
        const beltRequestsChannel = await client.channels.fetch(beltRequestsChannelId)
        if (!beltRequestsChannel?.isTextBased())
            throw new Error('Belt Requests channel not text-based')
        const perms = beltRequestsChannel.permissionsFor(client.user)
        if (!beltRequestsChannel.viewable || !perms?.has(PermissionFlagsBits.SendMessages))
            throw new Error('Missing access to beltRequestsChannel')
        return beltRequestsChannel
    }
}
