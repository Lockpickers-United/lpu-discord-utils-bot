const lpuGuildId = '140129091796992000'
const mgGuildId = '1364643341240897587'
const allGuilds = [lpuGuildId, mgGuildId]

const beltRequestsChannelId = '282173282546089985'
const announcementReactionsId = '1360395141822812311'
const botSpamId = '628607205419253781'

const beltRequestConfig = {
    lpuGuildId,
    channelIds: [botSpamId, beltRequestsChannelId, announcementReactionsId],
    webhookIds: ['1562548930791739543', '1562162476009660489']
}

const lpuBeltBotId = '541073446839517194'
const lockyJrId = '1364621479131746396'
const mgsecureId = '671828049540677682'
const allBotIds = [lpuBeltBotId, lockyJrId, mgsecureId]
const adminAuthorId = '1046777741963440178'
const modIds = [
    '97475530953068544',
    '352428596461043713',
    '164126373588238337',
    '458324127477137418',
    '539288580758175744',
    '274252922647216129'
]

const beltRequestChannelIds = {
    //'140129091796992000': '1360395141822812311', //lpu server, #announcement-reactions
    '140129091796992000': beltRequestsChannelId, //lpu server, #belt-requests
    '1364643341240897587': '1364738104640147509' // mg server
}

const approvedChannels = {
    '1360395141822812311': {
        server: 'LPU',
        serverID: lpuGuildId,
        channelName: '#announcement-reactions'
    },
    '628607205419253781': {
        server: 'LPU',
        serverID: lpuGuildId,
        channelName: '#bot-spam'
    },
    '282173282546089985': {
        server: 'LPU',
        serverID: lpuGuildId,
        channelName: '#belt-requests'
    },
    '1508481843995869184': {
        server: 'LPU',
        serverID: lpuGuildId,
        channelName: '#belt-reviewers'
    },
    '1364738104640147509': {
        server: 'mgsecure',
        serverID: mgGuildId,
        channelName: '#one'
    },
    '1364738135749169172': {
        server: 'mgsecure',
        serverID: mgGuildId,
        channelName: '#two'
    }
}

module.exports = {
    lpuGuildId,
    mgGuildId,
    allGuilds,
    beltRequestsChannelId,
    announcementReactionsId,
    botSpamId,
    beltRequestConfig,
    lpuBeltBotId,
    lockyJrId,
    mgsecureId,
    allBotIds,
    adminAuthorId,
    modIds,
    beltRequestChannelIds,
    approvedChannels
}
