import {beltRoles} from './belts.js'

const beltStrings = beltRoles.reduce((acc, role) => {
    acc[role.toLowerCase()] = role
    const alt = role.toLowerCase()
        .replace(/(\d+)(st|nd|rd|th) dan/i, 'dan $1')
    const short = role.toLowerCase()
        .replace(/\s*belt$/, '')
    acc[alt] = role
    acc[short] = role
    return acc
}, {})

const allBeltStrings = Object.keys(beltStrings).sort((a, b) => b.length - a.length)
const alternatives = allBeltStrings
    .map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')

export default function parseBeltRequest(messageContent) {

    const actionMatch = new RegExp('(?:^|\\s)(\\[me]|@LockyJr|@LPUBeltBot#5324)\\s+(\\w+)\\s*(\\w*)\\s*(.*)', 'is').exec(messageContent)
    console.log('actionMatch', actionMatch)

    //const _whichBot = actionMatch?.[1]
    const action = actionMatch?.[2].toLowerCase()
    const id = actionMatch?.[3]
    const notes = actionMatch?.[4].trim()

    let beltMatch = new RegExp(`\\brequest\\s+(${alternatives})\\s*(\\S*)`, 'i').exec(messageContent)
    let belt = beltMatch?.[1] ? beltStrings[beltMatch?.[1].toLowerCase()] : null
    let evidence = beltMatch?.[2] ?? null
    let lockId

    let syncUsername
    let syncTo
    const redditSyncMatch = new RegExp('u\\/(\\S*)\\b', 'i').exec(messageContent)
    if (redditSyncMatch) {
        syncUsername = redditSyncMatch?.[1] ? redditSyncMatch[1] : null
        syncTo = 'Reddit'
    } else {
        const discordSyncMatch = new RegExp('.+@(\\S*)\\b', 'i').exec(messageContent)
        syncUsername = discordSyncMatch?.[1] ? discordSyncMatch[1] : null
        syncTo = discordSyncMatch?.[1] ? 'Discord' : null
    }

    if (action === 'vote') {
        beltMatch = new RegExp(`\\bvote\\s+(\\S{8})\\s+(${alternatives})\\s*(.*)`, 'is').exec(messageContent)
        lockId = beltMatch?.[1] ? beltStrings[beltMatch?.[1].toLowerCase()] : null
        belt = beltMatch?.[2] ? beltStrings[beltMatch?.[2].toLowerCase()] : null
        evidence = beltMatch?.[3] ?? null
    }
    lockId = lockId ? {lockId} : null

    return {
        action,
        id,
        belt,
        evidence,
        notes,
        syncUsername,
        syncTo,
        ...lockId
    }

}