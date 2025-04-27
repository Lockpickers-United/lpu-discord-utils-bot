const {Events} = require('discord.js')
const cleanMessage = require('../util/cleanMessage.js')
const getRoleCounts = require('../functions/getRoleCounts.js')
const getChannelInfo = require('../functions/getChannelInfo.js')

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot) return
        if (message.partial) {
            try {
                await message.fetch()
            } catch (error) {
                console.error('Error fetching the message:', error)
                return
            }
        }

        const messageContent = await cleanMessage(message)

        if (message.mentions.has(message.client.user) && !message.author.bot) {
            console.log(`${message.author.username} mentioned me: ${messageContent}`)
        } else {
            //console.log('Not a mention')
            return
        }

        if (!message.member.roles.cache.some(r => r.name === 'Mods')) {
            console.log('User is not a mod')
            return
        }

        const lpuGuildId = ['140129091796992000']
        const mgGuildId = ['1364643341240897587']
        const allGuilds = [...lpuGuildId, ...mgGuildId] //eslint-disable-line

        if (!allGuilds.includes(message.guildId)) {
            console.log('Not in an active guild')
            return
        }

        const approvedChannels = {
            '1360395141822812311': {
                server: 'LPU',
                serverID: lpuGuildId[0],
                channelName: '#announcement-reactions'
            },
            '628607205419253781': {
                server: 'LPU',
                serverID: lpuGuildId[0],
                channelName: '#bot-spam'
            },
            '1364738104640147509': {
                server: 'mgsecure',
                serverID: mgGuildId[0],
                channelName: '#one'
            },
            '1364738135749169172': {
                server: 'mgsecure',
                serverID: mgGuildId[0],
                channelName: '#two'
            }
        }

        const approvedServerChannels = Object.keys(approvedChannels).reduce((acc, channelId) => {
                if (approvedChannels[channelId].serverID === message.guildId) {
                    acc[channelId] = approvedChannels[channelId]
                }
                return acc
            },{})

        if (!approvedChannels[message.channelId.toString()]) {
            console.log('Not in an approved channel')
            await message.author.send('Not in an approved channel.\n'
                + 'Approved channels on this server are:\n'
                + Object.keys(approvedServerChannels).map(channelId => {
                    return `https://discord.com/channels/${approvedServerChannels[channelId].serverID}/${channelId}`
                }).join('\n')
            )
            return
        }

        if (message.author.username !== 'mgsecure') {
            console.log('request from', message.author.username)
            //return
        }

        if (messageContent.includes('belt counts')) {
            await getRoleCounts(message)
        } else if (messageContent.includes('channel info')) {
            await getChannelInfo(message)
        }


    }
}

