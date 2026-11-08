import {Events} from 'discord.js'
import cleanMessage from '../util/cleanMessage.js'
import getChannelInfo from '../functions/getChannelInfo.js'
import {beltRequestChannelIds, lpuBeltBotId, beltRequestConfig} from '../data/config.js'
import isValidEvent from '../functions/isValidEvent.js'
import {helpText, modHelpText} from '../data/helpText.js'
import {processIncomingRequest} from '../functions/processIncomingRequest.js'
import processBeltMessage from '../functions/processBeltMessage.js'
import {voteUsers} from '../../keys/users.js'
import processClassificationVote from '../functions/processClassificationVote.js'

const keywords = ['channel info']
const beltKeywords = [
    'test',
    'request',
    'list', 'ls',
    'approve', 'ok',
    'reject', 'deny',
    'review', 'unreview',
    'checkout', 'checkin',
    'delete', 'rm',
    'retry',
    'pend', 'moreinfo', 'info', 'history',
    'sync', 'stats', 'delete_all', 'help',
    'vote'
]
const allKeywords = [...keywords, ...beltKeywords]
const warnResponse = true

const testMode = false
const testOnly = false

export default {
    name: Events.MessageCreate,

    async execute(message) {

        if (message.author?.username !== 'mgsecure' && testMode) {
            //console.log('request from', message.author?.username)
            //return false
        }

        const check = await isValidEvent(message, true)
        if (!check.valid) {
            //console.error('error: ', check.reason)
            //await message.reply({content: `Sorry. ${check.reason}`, flags: [MessageFlags.Ephemeral]})
            return
        }

        const requestEmbed = message.embeds?.find(embed => embed.data?.title?.includes('New Belt Request'))

        const acceptedRequest = (
            beltRequestConfig.webhookIds.includes(message.webhookId)
            && message.guildId === beltRequestConfig.lpuGuildId
            && beltRequestConfig.channelIds.includes(message.channelId)
        )
        if (acceptedRequest && requestEmbed) {
            await processIncomingRequest({message, requestEmbed})
            return
        }

        if (message.author?.bot) return
        const messageContent = await cleanMessage(message)

        //console.log(`${message.author.username} sent message: ${messageContent}`)

        const lpuBeltBotMentioned = message.mentions.users?.has(lpuBeltBotId)
        const mentioned = message.mentions.has(message.client.user)
        if (mentioned) {
            //console.log(`${message.author.username} mentioned me: ${messageContent}`)
            //console.log('mentioned', message.attachments)
        } else if (lpuBeltBotMentioned) {
            console.log(`${message.author.username} mentioned @LPUBeltBot.`)
        } else {
            return
        }

        if (warnResponse && lpuBeltBotMentioned
            && beltRequestChannelIds[message.channelId.toString()]
            //&& message.author?.username !== 'mgsecure'
        ) {
            await message.reply({
                content: '### I\'m sorry. LPUBeltBot was the G.O.A.T, but Locky Jr. is filling in for a bit.'
                    + '\nTo request a belt, please use the format:\n  **@LockyJr** `request [Belt color] [Lock model] https://image_or_video_link_here`.'
                    + '\nTo have your belt synced to Reddit, include `u/[Your Reddit Username]` in your message.'

            })
            return
        }

        if (message.partial) {
            try {
                await message.fetch()
            } catch (error) {
                console.error('Error fetching the message:', error)
                return
            }
        }

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

        if (testMode && mentioned && messageContent.toLowerCase().includes('[me] test')) {
            processBeltMessage(message)
            return
        } else if (testOnly) {
            return
        }

        if (!allKeywords.some(substr => messageContent.toLowerCase().includes(substr))) {
            return
        }

        if (messageContent.toLowerCase().includes('[me] vote') && voteUsers.includes(message.author.id)) {
            processClassificationVote(message)
            return
        }

        if (mentioned && beltKeywords.some(keyword => messageContent.toLowerCase().includes(keyword))) {
            try {
                await processBeltMessage(message)
            } catch (error) {
                console.error('Error sending message:', error)
            }
        }

    }
}

