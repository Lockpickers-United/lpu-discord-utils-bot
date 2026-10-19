export const lpuGuildId = '140129091796992000'
export const mgGuildId = '1364643341240897587'
export const allGuilds = [lpuGuildId, mgGuildId]

export const beltRequestsChannelId = '282173282546089985'
export const lpuBeltBotId = '541073446839517194'
export const lockyJrId = '1364621479131746396'
export const mgsecureId = '671828049540677682'
export const allBotIds = [lpuBeltBotId, lockyJrId, mgsecureId]
export const adminAuthorId = '1046777741963440178'
export const modIds = [
    '97475530953068544',
    '352428596461043713',
    '164126373588238337',
    '458324127477137418',
    '539288580758175744',
    '274252922647216129'
]

export const beltRequestChannelIds = {
    //'140129091796992000': '1360395141822812311', //lpu server, #announcement-reactions
    '140129091796992000': beltRequestsChannelId, //lpu server, #belt-requests
    '1364643341240897587': '1364738104640147509' // mg server
}
export const approvedChannels = {
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