const {Events, MessageFlags} = require('discord.js')
const cleanMessage = require('../util/cleanMessage.js')
const getChannelInfo = require('../functions/getChannelInfo.js')
const {approvedChannels} = require('../data/approvedChannels.js')

const keywords = ['channel info']

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {

        if (message.author.username !== 'mgsecure') {
            //console.log('request from', message.author.username)
            //return
        }

        if (message.author.bot) return
        if (message.partial) {
            try {
                await message.fetch()
            } catch (error) {
                console.error('Error fetching the message:', error)
                return
            }
        }


        if (!message.member.roles.cache.some(r => r.name === 'Mods')) {
            //console.log('User is not a mod')
            return
        }

        const lpuGuildId = ['140129091796992000']
        const mgGuildId = ['1364643341240897587']
        const allGuilds = [...lpuGuildId, ...mgGuildId] //eslint-disable-line

        if (!allGuilds.includes(message.guildId)) {
            console.log('Not in an active guild')
            return
        }

        const messageContent = await cleanMessage(message)

        if (!keywords.some(substr => messageContent.includes(substr))) {
            //console.log (`No keyword found in message: ${messageContent}`)
            return
        }

        const mentioned = message.mentions.has(message.client.user)
        if (mentioned) {
            console.log(`${message.author.username} mentioned me: ${messageContent}`)
        }

        const approvedServerChannels = Object.keys(approvedChannels).reduce((acc, channelId) => { //eslint-disable-line
                if (approvedChannels[channelId].serverID === message.guildId) {
                    acc[channelId] = approvedChannels[channelId]
                }
                return acc
            },{})

        if (!approvedServerChannels[message.channelId.toString()]) {
            console.log('Not in an active guild')
            await message.reply({content: 'Not in an approved channel.', flags: [MessageFlags.Ephemeral]})
            return
        }

        if (mentioned && messageContent.includes('channel info')) {
            await getChannelInfo(message)
        }
    }
}

