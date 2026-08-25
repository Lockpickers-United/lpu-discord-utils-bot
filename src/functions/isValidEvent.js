const {allGuilds, approvedChannels} = require('../data/approvedChannels')

async function isValidEvent(event) {

    //console.log('isValidEvent', event)

    if (event.user?.username !== 'mgsecure') {
        //console.warn('request from', event.user.username)
        //return false
    }

    if (event.user && event.user.bot) {
        const message = `Bot request from ${event.user.username}`
        console.error(message)
        return {valid: false, reason: 'No Bots Allowed'}
    }

    const guild = event.guild
    if (!guild) {
        const message = 'I could not access the guild :-('
        console.error(message)
        return {valid: false, reason: message}
    }

    if (!allGuilds.includes(event.guildId)) {
        const message = 'Not in an active guild'
        console.error(message)
        return {valid: false, reason: message}
    }

    if (!approvedChannels[event.channelId.toString()]) {
        const message = 'Not in an approved channel'
        console.error(message)
        return {valid: false, reason: message}
    }

    return {valid: true}
}

module.exports = isValidEvent
