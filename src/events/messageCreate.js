const {Events} = require('discord.js')
const cleanMessage = require('../util/cleanMessage.js')
const getRoleCounts = require('../functions/getRoleCounts.js')
const getChannelInfo = require('../functions/getChannelInfo.js')
const {findSyncMessages} = require('../functions/getLPUBeltBotSyncRequests.js') //eslint-disable-line
const {findPreBotSyncMessages} = require('../functions/getPreBotSyncRequests.js') //eslint-disable-line
const keywords = ['belt counts', 'channel info', '@LPUBeltBot#5324 approve', 'sync requests']

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
            console.log (`No keyword found in message: ${messageContent}`)
            return
        }

        const mentioned = message.mentions.has(message.client.user)
        if (mentioned) {
            console.log(`${message.author.username} mentioned me: ${messageContent}`)
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
            '282173282546089985': {
                server: 'LPU',
                serverID: lpuGuildId[0],
                channelName: '#belt-requests'
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

        const approvedServerChannels = Object.keys(approvedChannels).reduce((acc, channelId) => { //eslint-disable-line
                if (approvedChannels[channelId].serverID === message.guildId) {
                    acc[channelId] = approvedChannels[channelId]
                }
                return acc
            },{})

        if (!approvedChannels[message.channelId.toString()]) {
            console.log('Not in an approved channel')
            /*
            await message.author.send('Not in an approved channel.\n'
                + 'Approved channels on this server are:\n'
                + Object.keys(approvedServerChannels).map(channelId => {
                    return `https://discord.com/channels/${approvedServerChannels[channelId].serverID}/${channelId}`
                }).join('\n')
            )
            */
            return
        }

        if (mentioned && messageContent.includes('belt counts')) {
            await getRoleCounts(message, true)
        } else if (messageContent.includes('@LPUBeltBot#5324 approve')) {
            await getRoleCounts(message, false)
        } else if (mentioned && messageContent.includes('channel info')) {
            await getChannelInfo(message)
        } else if (mentioned && messageContent.includes('sync requests')) {
            //await findSyncMessages(message, '282173282546089985')
            await findPreBotSyncMessages(message, '282173282546089985')
        }


    }
}

