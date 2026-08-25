const {Events, MessageFlags} = require('discord.js')
const cleanMessage = require('../util/cleanMessage.js')
const getChannelInfo = require('../functions/getChannelInfo.js')
const {approvedChannels} = require('../data/approvedChannels.js')
const isValidEvent = require('../functions/isValidEvent')

const keywords = ['channel info']

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {

        const mentioned = message.mentions.has(message.client.user)
        if (mentioned) {
            console.log(`${message.author.username} mentioned me: ${messageContent}`)
        } else {
            return
        }

        const check = await isValidEvent(message)

        if (!check.valid) {
            console.error('error: ', check.reason)
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

        const messageContent = await cleanMessage(message)

        if (!keywords.some(substr => messageContent.includes(substr))) {
            console.log (`No keyword found in message: ${messageContent}`)
            return
        }

        const approvedServerChannels = Object.keys(approvedChannels).reduce((acc, channelId) => { //eslint-disable-line
                if (approvedChannels[channelId].serverID === message.guildId) {
                    acc[channelId] = approvedChannels[channelId]
                }
                return acc
            },{})

        if (!approvedServerChannels[message.channelId.toString()]) {
            console.log('Not in an approved channel')
            await message.reply({content: 'Not in an approved channel.', flags: [MessageFlags.Ephemeral]})
            return
        }

        if (mentioned && messageContent.includes('channel info')) {
            await getChannelInfo(message)
        }
    }
}

