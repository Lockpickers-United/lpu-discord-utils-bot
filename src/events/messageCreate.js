const {Events, MessageFlags, PermissionFlagsBits} = require('discord.js')
const cleanMessage = require('../util/cleanMessage.js')
const getChannelInfo = require('../functions/getChannelInfo.js')
const {beltRequestChannelIds, lpuBeltBotId} = require('../data/config.js')
const isValidEvent = require('../functions/isValidEvent.js')
const {processBeltMessage} = require('../functions/processBeltMessage.js')
const {helpText, modHelpText} = require('../data/helpText.js')
const {processBotRequest} = require('../functions/processBotRequest')

const keywords = ['channel info']
const beltKeywords = [
    'request', 'list',
    'approve', 'reject', 'deny', 'delete', 'pend', 'review', 'unreview', 'moreinfo', 'info', 'history',
    'sync', 'stats', 'delete_all', 'help'
]
const allKeywords = [...keywords, ...beltKeywords]
const warnResponse = true

module.exports = {
    name: Events.MessageCreate,

    async execute(message) {


        const fromMe = message.author?.id === message.client.user?.id
        const requestEmbed = message.embeds.find(embed => embed.data.title === 'New Belt Request')
        if (fromMe && requestEmbed) {

            await processBotRequest(message, requestEmbed)
            return
        }


        if (message.author?.bot) return

        const check = await isValidEvent(message)

        if (!check.valid) {
            //console.error('error: ', check.reason)
            //await message.reply({content: `Sorry. ${check.reason}`, flags: [MessageFlags.Ephemeral]})
            return
        }

        const beltRequestChannelId = beltRequestChannelIds[message.guildId]
        if (!beltRequestChannelId) {
            await message.reply({
                content: `No belt request channel ID found for guildId: ${message.guildId}`,
                flags: [MessageFlags.Ephemeral]
            })
            return
        }

        const messageContent = await cleanMessage(message)

        //console.log(`${message.author.username} sent message: ${messageContent}`)

        const lpuBeltBotMentioned = message.mentions.users?.has(lpuBeltBotId)
        const mentioned = message.mentions.has(message.client.user)
        if (mentioned) {
            console.log(`${message.author.username} mentioned me: ${messageContent}`)
        } else if (lpuBeltBotMentioned) {
            console.log(`${message.author.username} mentioned @LPUBeltBot.`)
        } else {
            return
        }

        if (warnResponse && lpuBeltBotMentioned
            && beltRequestChannelId === message.channelId.toString()
            //&& message.author?.username !== 'mgsecure'
        ) {
            await message.reply({
                content: '## I\'m sorry. LPUBeltBot is out for repairs, but Locky Jr. is filling in for a bit.'
                    + '\nTo request a belt, please use the format:\n  **@LockyJr** `request [Belt color] [Lock model] https://image_or_video_link_here`.'
                    + '\nTo have your belt synced to Reddit, include `u/[Your Reddit Username]` in your message.'

            })
            return
        }

        if (message.author?.username !== 'mgsecure') {
            console.log('request from', message.author?.username)
            //return false
        }

        if (message.partial) {
            try {
                await message.fetch()
            } catch (error) {
                console.error('Error fetching the message:', error)
                return
            }
        }

        //console.log('messageContent', messageContent)

        if (mentioned && messageContent.toLowerCase().includes('channel info')) {
            await getChannelInfo(message)
            return
        }

        const reviewerRoles = ['Staff', 'Belt Reviewer']
        const isReviewer = message.member?.roles?.cache?.some(role => reviewerRoles.includes(role.name))

        if (mentioned && messageContent.toLowerCase() === '[me] help') {
            try {
                await message.reply({
                    content: !isReviewer ? helpText : helpText + modHelpText
                })
            } catch (error) {
                console.error('Error replying to message', error)
            }
            return
        }

        if (!allKeywords.some(substr => messageContent.toLowerCase().includes(substr))) {
            return
        }

        if (mentioned && beltKeywords.some(keyword => messageContent.toLowerCase().includes(keyword))) {

            const replyText = await processBeltMessage(message)

            console.log('replyText', replyText)

            try {

                const beltRequestChannelId = beltRequestChannelIds[message.guildId]
                if (!beltRequestChannelId)
                    throw new Error(`No belt request channel ID found for guildId: ${message.guildId}`)

                const beltRequestsChannel = await message.client.channels.fetch(beltRequestChannelId)
                if (!beltRequestsChannel?.isTextBased())
                    throw new Error('Belt Requests channel not text-based')

                const perms = beltRequestsChannel.permissionsFor(message.client.user)
                if (!beltRequestsChannel.viewable || !perms?.has(PermissionFlagsBits.SendMessages))
                    throw new Error('Missing access to beltRequestsChannel')

                const permissions = message.channel.permissionsFor(message.client.user)
                if (!permissions?.has(PermissionFlagsBits.SendMessages))
                    throw new Error(`Missing access to ${message.channel.id}`)

                // , flags: [MessageFlags.Ephemeral]
                replyText && await message.reply({content: replyText.toString()})

            } catch (error) {
                console.error('Error sending message:', error)
            }
        }
    }
}

