import fs from 'node:fs/promises'
import dayjs from 'dayjs'
import snoowrap from 'snoowrap'
import {PermissionFlagsBits, MessageFlags} from 'discord.js'
import setDiscordRole from './setDiscordRole.js'
import setRedditFlair from './setRedditFlair.js'
import cleanMessage from '../util/cleanMessage.js'
import writeJsonFileAtomic from '../util/writeJsonFileAtomic.js'
import {beltRequestsFile} from '../../keys/botConfig.js'
import {beltRequestChannelIds} from '../data/config.js'
import {beltRoles, beltRoleSortReverse} from '../util/belts.js'
import {setDeepPush} from '../util/setDeep.js'
import {getSortComparator} from '../util/sortComparators.js'
import {client_id, client_secret, refresh_token} from '../../keys/reddit-keys.js'
import {buildRequestStats} from '../util/buildRequestStats.js'
import parseBeltRequest from '../util/parseBeltRequest.js'
import {modmailReply} from './modmailReply.js'
import {flairDetails} from '../util/flairs.js'

const beltStrings = beltRoles.reduce((acc, role) => {
    const alt = role.toLowerCase()
        .replace(/(\d+)(st|nd|rd|th) dan/i, 'dan $1')
    acc[role.toLowerCase()] = role
    acc[alt] = role
    return acc
}, {})
const shortBeltStrings = beltRoles.reduce((acc, role) => {
    const alt = role.toLowerCase()
        .replace(/\s*belt$/, '')
        .replace(/(\d+)(st|nd|rd|th) dan/i, 'dan $1')
    acc[role.toLowerCase()] = role
    acc[alt] = role
    return acc
}, {})
const alternatives = Object.keys(beltStrings)
    .map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')
const shortAlternatives = Object.keys(shortBeltStrings)
    .map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')

export async function announce(message, announcement) {
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

        await beltRequestsChannel.send(announcement)

        return {success: 'announcement posted'}
    } catch (err) {
        console.error(`Failed to post announcement: ${err}`)
        throw new Error(`Failed to post announcement: ${err}`)
    }
}

export async function saveAction(action) {
    try {
        const beltRequests = JSON.parse((await fs.readFile(beltRequestsFile, 'utf8')).toString())
        const existingRequest = beltRequests.findIndex(request => request.id === action.id)

        const newAction = {...beltRequests[existingRequest], ...action}

        if (existingRequest === -1 && ['requested', 'synced', 'error'].includes(action.status)) {
            beltRequests.unshift(action)
        } else if (existingRequest === -1) {
            return {error: `No request found with id ${action.id}`}
        } else if (['approved', 'rejected', 'deleted', 'superseded', 'replaced'].includes(action.status)) {
            if (beltRequests[existingRequest].status === action.status)
                return {error: 'Request status was already: ' + action.status}
            beltRequests[existingRequest] = newAction
        } else if (action.status === 'reviewing') {
            beltRequests[existingRequest] = newAction
        } else if (action.status === 'stopReviewing') {
            newAction.status = 'requested'
            delete newAction.reviewerId
            delete newAction.reviewerName
            beltRequests[existingRequest] = newAction
        } else if (action.status === 'pending') {
            newAction.status = 'requested'
            beltRequests[existingRequest] = newAction
        } else {
            return {error: 'Invalid action to save: ' + action.status}
        }

        await writeJsonFileAtomic(beltRequestsFile, beltRequests, {spaces: 2})
        return {...newAction, success: 'request saved'}

    } catch (e) {
        return {error: e}
    }
}

export async function handleList(requestsFile) {
    const beltRequests = JSON.parse((await fs.readFile(requestsFile, 'utf8')).toString())

    const requestsList = beltRequests.filter(request => ['requested', 'reviewing', 'error'].includes(request.status))
    if (requestsList.length === 0) {
        return {requestsText: 'Requests:\n\n**All clear!**', success: 'info retrieved'}
    }
    const requestsByUser = requestsList.reduce((acc, request) => {
        setDeepPush(acc, [request.userId], request)
        return acc
    }, {})
    const organizedRequests = requestsList
        .sort((getSortComparator('timeAddedAscending')))
        .reduce((acc, request) => {
            if (!acc.find(user => user.userId === request.userId)) {
                acc.push({
                    userId: request.userId,
                    requests: requestsByUser[request.userId]?.sort((a, b) => beltRoleSortReverse(a.belt, b.belt))
                })
            }
            return acc
        }, [])

    let requestsText = 'Requests:\n'

    organizedRequests.forEach(userRequests => {
        requestsText += `**${userRequests.requests[0].username}**\n`
        userRequests.requests.forEach(request => {
            const reviewText = request.status === 'reviewing'
                ? ` (${request.reviewerName} reviewing)`
                : ''
            requestsText += `   ${request.belt}${reviewText}\n`
            if (request.redditUsername)
                requestsText += `   Reddit: u/${request.redditUsername}\n`
            requestsText += `   Date: ${request.dateAdded}\n`
            requestsText += `   Link: https://discord.com/channels/140129091796992000/282173282546089985/${request.messageId}\n`
            requestsText += `   ID: ${request.id}\n\n`
        })
    })

    return {requestsText, organizedRequests, success: 'list retrieved'}
}


export async function handleBeltRequest({message, params}) {

    const {
        source,
        platform,
        userId,
        username,
        belt,
        messageContent,
        currentBelt,
        requestId,
        syncTo,
        syncUsername
    } = params

    const beltRequests = JSON.parse((await fs.readFile(beltRequestsFile, 'utf8')).toString())
    const existingRequest = beltRequests
        .find(
            request => request.userId === userId
                && request.belt === belt
                && request.status === 'requested'
        )

    const id = genHexString(8)
    const action = {
        status: 'requested',
        dateAdded: dayjs().format(),
        id,
        messageId: message.id,
        requestId,
        source,
        platform,
        userId,
        username,
        belt,
        messageContent,
        currentBelt,
        syncTo,
        syncUsername
    }
    const response = await saveAction(action)

    let replaceResponse = null
    if (existingRequest) {
        const action = {
            id: existingRequest.id,
            status: 'replaced',
            updatedAt: dayjs().toISOString(),
            lastUpdateBy: 'LockyJr',
            updateMessageId: message.id
        }
        replaceResponse = await saveAction(action)
    }

    return {...action, ...response, replaceResponse}
}

function editIsBlocked(message, existingRequest) {
    const id = existingRequest.id
    if (!existingRequest)
        return `Request ${id} not found`
    if (existingRequest.status === 'reviewing' && existingRequest.reviewerId !== message.author?.id)
        return `Request ${id} is being reviewed by ${existingRequest.reviewerName}.`
    if (!['requested', 'reviewing'].includes(existingRequest.status))
        return `Request ${id} is not pending (${existingRequest.status})`
    return false
}

async function setFlair(username, belt) {
    belt = belt.replace(/\sBelt/ig, '')
    const subredditName = 'lockpicking'

    const reddit = new snoowrap({
        userAgent: 'flair manager by u/mgsecure',
        clientId: client_id,
        clientSecret: client_secret,
        refreshToken: refresh_token
    })
    await reddit.getMe()

    try {
        await setRedditFlair(subredditName, username, belt)
        console.log(`Successfully set flair to ${belt}`)
        return {status: 'success', result: `Successfully set Reddit flair to ${belt}`}
    } catch (err) {
        const errorMessage = `Failed to set Reddit flair: ${err.message ?? err}`
        console.error(errorMessage)
        return {error: errorMessage, result: errorMessage}
    }
}

async function handleRequestApprove(message, id, notesText) {
    const beltRequests = JSON.parse((await fs.readFile(beltRequestsFile, 'utf8')).toString())
    const existingRequest = beltRequests.find(request => request.id === id)
    const currentBeltIndex = beltRoles.indexOf(existingRequest.belt)

    const blocked = editIsBlocked(message, existingRequest)
    if (blocked) return {error: blocked}

    const {source, platform, userId, username, belt, messageContent, currentBelt, requestId, syncTo, syncUsername} = existingRequest

    // flag on platform
    let transaction = {}
    if (platform === 'Reddit') {
        transaction = await setFlair(username, belt)
    } else if (!platform || platform === 'Discord') {
        transaction = await setDiscordRole(message, {username, belt})
    }
    if (transaction.error) return {error: `Failed to set belt on ${platform}: ${transaction.error}`}

    // sync i/a
    let redditResult = {}
    let warning = {}
    let syncMessage

    if (syncTo === 'Discord') {
        // set discord role, announce
        console.log('Syncing Discord role placeholder')

    } else if (syncTo === 'Reddit' && syncUsername) {
        try {
            redditResult = await setFlair(syncUsername, belt)
            syncMessage = '\n  (You\'ve also been flaired on Reddit.)'
        } catch (err) {
            console.error('Failed to set user flair', err)
            redditResult = {redditSynched: 'Failed to set Reddit flair'}
        }
    }

    // respond
    if (platform === 'Discord') {
        const announceNotes = notesText.length ? notesText : getDefaultMessage(belt)
        let announceMessage = `<@${userId}>, <@${message.author?.id}> has reviewed and `
            + `approved your request. Congrats on your ${belt}!${announceNotes}`
        if (syncMessage) announceMessage += syncMessage
        try {
            await announce(message, announceMessage)
        } catch (err) {
            console.error('Failed to announce approval.')
            warning = {warning: 'Failed to announce approval.'}
        }
    } else if (source === 'Reddit') {
        const announceNotes = notesText.length ? notesText : getDefaultMessage(belt).replace(/\s*<.*>/, '')
        let modmailMessage = `${belt} approved. Congratulations! ${announceNotes}`
        if (syncMessage) modmailMessage += syncMessage
        try {
            await modmailReply({conversationId: requestId, modmailMessage, archive: true, isAuthorHidden: true})
        } catch (err) {
            console.error('Failed to reply to modmail.', err)
            warning = {warning: 'Failed to reply to modmail.'}
        }
    }

    let replyText = `Successfully set ${belt} for **${username}** on ${platform}.`
    if (transaction.message) replyText += ('\n  messages: ' + transaction.message)
    if (transaction.alert) replyText += ('\n  ALERT: ' + transaction.alert)

    const action = {
        id,
        updatedAt: dayjs().format(),
        lastUpdateBy: message.author?.username,
        updateMessageId: message.id,
        ...redditResult,
        status: 'approved',
    }
    const response = await saveAction(action)

    const lowerBeltRequests = [...beltRequests]
        .filter(request => request.userId === existingRequest.userId && request.status === 'requested')
        .filter(request => beltRoles.indexOf(request.belt) < currentBeltIndex)

    const supersededResponses = []

    for (const index in lowerBeltRequests) {
        const action = {
            id: lowerBeltRequests[index].id,
            status: 'superseded',
            updatedAt: dayjs().format(),
            lastUpdateBy: message.author?.username,
            updateMessageId: message.id
        }
        const response = await saveAction(action)
        supersededResponses.push(response)
    }

    return {replyText, ...action, ...response, ...warning, supersededResponses, success: true}
}


async function handleRequestReject(message, id, notesText) {
    const beltRequests = JSON.parse((await fs.readFile(beltRequestsFile, 'utf8')).toString())
    const existingRequest = beltRequests.find(request => request.id === id)
    const {source, platform, userId, username, belt, messageContent, currentBelt, requestId, syncTo, syncUsername} = existingRequest

    const blocked = editIsBlocked(message, existingRequest)
    if (blocked) return {error: blocked}

    const action = {
        id,
        status: 'rejected',
        updatedAt: dayjs().format(),
        lastUpdateBy: message.author?.username,
        updateMessageId: message.id
    }
    const response = await saveAction(action)

    let warning = {}

    // respond
    if (platform === 'Discord') {
        try {
            await announce(message,
                `<@${existingRequest.userId}>, <@${message.author.id}> has reviewed and denied your request for ${existingRequest.belt}.`
                + `${notesText}`
            )
        } catch (err) {
            console.error('Failed to announce rejection.')
            warning = {warning: 'Failed to announce rejection.'}
        }
    } else if (source === 'Reddit') {
        const modmailMessage = `We've reviewed and denied your request for ${belt}. ${notesText}`
        try {
            await modmailReply({conversationId: requestId, modmailMessage, archive: true, isAuthorHidden: true})
        } catch (err) {
            console.error('Failed to reply to modmail.', err)
            warning = {warning: 'Failed to reply to modmail.'}
        }
    }

    return {...action, ...response, ...warning}
}

async function handleRequestDelete(message, id) {
    const beltRequests = JSON.parse((await fs.readFile(beltRequestsFile, 'utf8')).toString())
    const existingRequest = beltRequests.find(request => request.id === id)

    if (!existingRequest) return {error: `Request ${id} not found`}
    if (existingRequest.status === 'deleted') return {error: `Request ${id} is already deleted.`}
    if (existingRequest.status === 'reviewing' && existingRequest.reviewerId !== message.author?.id) {
        return {error: `Request ${id} is being reviewed by ${existingRequest.reviewerName}.`}
    }

    const action = {
        id,
        status: 'deleted',
        updatedAt: dayjs().format(),
        lastUpdateBy: message.author?.username,
        updateMessageId: message.id
    }
    const response = await saveAction(action)
    return {...action, ...response}
}

async function handleRequestPend(message, id) {
    const beltRequests = JSON.parse((await fs.readFile(beltRequestsFile, 'utf8')).toString())
    const existingRequest = beltRequests.find(request => request.id === id)

    if (!existingRequest) return {error: `Request ${id} not found`}
    if (existingRequest.status === 'requested') return {error: `Request ${id} is already pending.`}

    const action = {
        id,
        status: 'pending',
        updatedAt: dayjs().format(),
        lastUpdateBy: message.author?.username,
        updateMessageId: message.id
    }
    const response = await saveAction(action)
    return {...action, ...response}
}

async function handleRequestReview(message, id, deactivate = false) {
    const beltRequests = JSON.parse((await fs.readFile(beltRequestsFile, 'utf8')).toString())
    const existingRequest = beltRequests.find(request => request.id === id)

    if (!existingRequest) return {error: `Request ${id} not found`}
    if (!['requested', 'reviewing'].some(stat => existingRequest.status === stat)) return {error: `Request ${id} is not pending (it's been ${existingRequest.status})`}

    if (existingRequest.status === 'reviewing' && existingRequest.reviewerId !== message.author?.id) {
        return {error: `Request ${id} is being reviewed by ${existingRequest.reviewerName}.`}
    }
    if (!deactivate && existingRequest.status === 'reviewing' && existingRequest.reviewerId === message.author?.id) {
        return {error: `You are already reviewing request ${id}. Use \`unreview\` to stop.`}
    }
    if (deactivate && existingRequest.status !== 'reviewing') {
        return {error: `Request ${id} is not being reviewed.`}
    }

    const action = {
        id,
        status: !deactivate ? 'reviewing' : 'stopReviewing',
        updatedAt: dayjs().format(),
        lastUpdateBy: message.author?.username,
        updateMessageId: message.id,
        reviewerId: message.author?.id,
        reviewerName: message.author?.username
    }
    const response = await saveAction(action)

    return {...action, ...response}
}

async function handleSync(message) {
    const messageContent = await cleanMessage(message)

    const beltMatch = new RegExp(`\\sync\\s+(${alternatives})\\s+(\\S*)`, 'i').exec(messageContent)
    let belt = beltMatch?.[1] ? beltStrings[beltMatch[1].toLowerCase()] : null
    let username = beltMatch?.[2] ? beltMatch[2].replace('u/', '') : null

    if (!belt || !username) {
        const shortBeltMatch = new RegExp(`\\bsync\\s+(${shortAlternatives})\\s+(\\S*)`, 'i').exec(messageContent)
        belt = shortBeltMatch?.[1] ? shortBeltStrings[shortBeltMatch[1].toLowerCase()] : null
        username = shortBeltMatch?.[2] ? shortBeltMatch[2].replace('u/', '') : null
    }

    if (!belt || !username) {
        return {error: 'please use the format: `sync [Belt Color] [u/Reddit username]`\n'}
    }

    const redditUsername = username ? {redditUsername: username} : null

    if (!redditUsername) {
        return {error: 'please use the format: `sync [Belt Color] [u/Reddit username]`\n'}
    }

    let redditResult = {}
    try {
        redditResult = await setFlair(username, belt)

        console.log(`Successfully set flair to ${belt}`)
    } catch (err) {
        console.error('Failed to set user flair', err)
        return {error: 'Failed to set Reddit flair'}
    }

    const id = genHexString(8)
    const action = {
        status: 'synced',
        dateAdded: dayjs().format(),
        id,
        belt,
        username: message.author?.username,
        userId: message.author?.id,
        ...redditUsername,
        updatedAt: dayjs().format(),
        lastUpdateBy: message.author?.username,
        messageId: message.id
    }
    const response = await saveAction(action)

    return {...action, ...response, ...redditResult}
}

async function handleMoreInfo(requestId) {
    const beltRequests = JSON.parse((await fs.readFile(beltRequestsFile, 'utf8')).toString())
    const existingRequest = beltRequests.find(request => request.id === requestId)
    return existingRequest
        ? {info: JSON.stringify(existingRequest, null, 2), success: 'info retrieved'}
        : {error: `No request found for id ${requestId}`}
}

async function handleHistory(beltRequestsFile, target) {
    const beltRequests = JSON.parse((await fs.readFile(beltRequestsFile, 'utf8')).toString())
    const existingRequest =
        beltRequests.find(request => request.id === target)
        ?? beltRequests.find(request => request.username === target)
        ?? beltRequests.find(request => request.userId === target)

    const allRequests = beltRequests
        .filter(request => request.userId === existingRequest.userId)
        .sort((getSortComparator('timeAddedDescending')))
        .map(request => {
            return (
                `${request.belt.toUpperCase()} (${request.status?.toString()})\n`
                + ` ${'Requested'.padEnd(13)}${request.dateAdded?.toString()}\n`
                + `${request.updatedAt ? ` ${'Updated'.padEnd(13)}${request.updatedAt?.toString()}\n` : ''}`
                + `${request.lastUpdateBy ? ` ${'Reviewer'.padEnd(13)}${request.lastUpdateBy?.toString()}\n` : ''}`
                + ` ${'ID'.padEnd(13)}${request.id?.toString()}\n`
            )
        })

    return allRequests.length > 0
        ? {
            requestsText: `## ${existingRequest.username?.toString()}\n`
                + '```\n'
                + `${allRequests.join('```\n```\n')}`
                + '```',
            allRequests,
            success: 'info retrieved'
        }
        : {error: `No request found for id ${target}`}
}

export async function processBeltMessage(message) {

    //console.log = () => { /**/ }

    const messageContent = await cleanMessage(message)

    const isBotCommand = new RegExp('^\\[me]\\s+', 'i').exec(messageContent)
    if (!isBotCommand) return

    const member = await message.guild.members.fetch(message.author.id)

    const reviewerRoles = ['Staff', 'Belt Reviewer']
    const isReviewer = message.member?.roles?.cache?.some(role => reviewerRoles.includes(role.name))

    const {action, id, belt, evidence, notes, syncMatch} = parseBeltRequest(messageContent)
    const notesText = notes?.length ? `\nNotes: ${notes}` : ''

    if (!belt && !isReviewer) {
        return 'Invalid request, try `help` for commands'
    }

    let replyText = 'Invalid request, try `help` for commands'

    if (action === 'request') {
        const syncUsername = syncMatch
        const syncTo = syncMatch ? 'Reddit' : undefined

        const params = {
            source: 'Discord',
            platform: 'Discord',
            username: member.displayName ?? message.author.username,
            userId: message.author.id,
            belt,
            messageContent,
            currentBelt: 'tk',
            requestId: message.id,
            syncTo,
            syncUsername
        }

        if (!belt || !evidence) {
            replyText = 'To request a belt, please use the format:\n'
                + '`request [Belt Color] [Lock model] https://image_or_video_link_here`\n'
        } else {
            await handleBeltRequest({message, params}).then(response => {
                const replaceText = response.replaceResponse
                    ? `\nThis replaces your previous ${belt} request.`
                    : ''
                replyText = response.success
                    ? `<@${message.author.id}> thanks for your ${belt} request!${replaceText}\n(id: ${response.id})`
                    : `Sorry <@${message.author.id}>, your ${belt} request didn't go through. (${response.error})`
            })
        }

    } else if (!isReviewer) {
        replyText = `Sorry <@${message.author.id}>: you're not allowed to do that.`

    } else if (['list', 'ls'].some(a => a === action)) {
        await handleList(beltRequestsFile).then(response => {
            replyText = response.success
                ? response.requestsText
                : `Sorry <@${message.author.id}>: ${response.error}`
        })

    } else if (['approve', 'ok'].some(a => a === action)) {

        await handleRequestApprove(message, id, notesText).then(response => {
            console.log('response', response)
            const redditResult = response.redditUsername ? `\n${response.redditSynched}` : ''
            const supersededText = response.supersededResponses?.length > 0
                ? `\n${response.supersededResponses.length} lower belt request(s) were closed.`
                : ''
            replyText = response.success
                ? `@${response.username} set with role ${response.belt}.${redditResult}${supersededText}`
                : `Sorry <@${message.author.id}>: ${response.error}`
        })

    } else if (['reject', 'deny'].some(a => a === action)) {
        await handleRequestReject(message, id, notesText).then(response => {
            replyText = response.success
                ? `The request from @${response.username} for ${response.belt} was denied.`
                : `Sorry <@${message.author.id}>: ${response.error}`
        })

    } else if (['delete', 'rm'].some(a => a === action)) {
        await handleRequestDelete(message, id).then(response => {
            replyText = response.success
                ? `The request from @${response.username} for ${response.belt} was deleted.`
                : `Sorry <@${message.author.id}>: ${response.error}`
        })

    } else if (action === 'pend') {
        await handleRequestPend(message, id).then(response => {
            replyText = response.success
                ? `The request from @${response.username} for ${response.belt} in now pending.`
                : `Sorry <@${message.author.id}>: ${response.error}`
        })

    } else if (action === 'review') {
        await handleRequestReview(message, id, false).then(response => {
            replyText = response.success
                ? `You are now reviewing the request from @${response.username} for ${response.belt}.`
                : `Sorry <@${message.author.id}>: ${response.error}`
        })

    } else if (action === 'unreview') {
        await handleRequestReview(message, id, true).then(response => {
            replyText = response.success
                ? `You are no longer reviewing the ${response.belt} request from @${response.username}.`
                : `Sorry <@${message.author.id}>: ${response.error}`
        })

    } else if (['moreinfo', 'info'].some(a => a === action)) {
        await handleMoreInfo(id).then(response => {
            replyText = response.success
                ? `Request info:\n${response.info}`
                : `Sorry <@${message.author.id}>: ${response.error}`
        })

    } else if (action === 'sync') {
        await handleSync(message).then(response => {
            replyText = response.success
                ? `Successfully synced ${response.belt} for u/${response.redditUsername}.`
                : `Sorry <@${message.author.id}>: ${response.error}`
        })

    } else if (action === 'stats') {
        await buildRequestStats(beltRequestsFile).then(response => {
            replyText = response.success
                ? response.textBlocks.map(block => `${block.name}\n${block.text}`).join('\n\n')
                : `Sorry <@${message.author.id}>: ${response.error}`
        })

    } else if (action === 'history') {
        await handleHistory(beltRequestsFile, id).then(response => {
            replyText = response.success
                ? 'History\n' + response.requestsText
                : `Sorry <@${message.author.id}>: ${response.error}`
        })
    }

    // archive
    // purge
    // purge:all

    return replyText
}

function genHexString(len) {
    const hex = '0123456789ABCDEF'
    let output = ''
    for (let i = 0; i < len; ++i) {
        output += hex.charAt(Math.floor(Math.random() * hex.length))
    }
    return output.toLowerCase()
}

function getDefaultMessage(belt) {
    const defaultMessages = {
        'White Belt': ' Welcome to LPU! <:whitebelt:336531963634515972>',
        'Yellow Belt': ' Nice work! <:yellowbelt:336531963764539393>',
        'Orange Belt': ' Way to go! <:orangebelt:336531963877785601>',
        'Green Belt': ' Movin\' on up! <:greenbelt:336531963844362242>',
        'Blue Belt': ' Awesome! <:bluebelt:336531963835973632>',
        'Purple Belt': ' Big milestone! <:purplebelt:336531963521531913>',
        'Brown Belt': ' Great work! <:brownbelt:336531963525464065>',
        'Red Belt': ' When Black? <:redbelt:336531963869528067>',
        'Black Belt': ' What a tremendous accomlishment. <:lpu:585997905773461514>'
    }
    return defaultMessages[belt] || 'Nice work!'
}