import {updateBeltRequest} from '../data/dataStore.js'
import {FieldValue} from 'firebase-admin/firestore'
import dayjs from 'dayjs'
import {beltRoles} from '../util/belts.js'
import cleanMessage from '../util/cleanMessage.js'
import parseBeltRequest from '../util/parseBeltRequest.js'
import {getOpenBeltRequests} from '../data/dataStore.js'
import {handleReply, handleAnnounce} from './handleMessageRespond.js'
import setDiscordRole from './setDiscordRole.js'
import setRedditFlair from './setRedditFlair.js'
import {modmailReply} from './modmailReply.js'
import {processListRequest} from './processListRequest.js'
import {client} from '../client.js'
import {beltRequestsChannelId} from '../data/config.js'


export async function replacePreviousRequests({id, userId, belt, messageId}) {

    const beltRequests = getOpenBeltRequests()
    const existingRequests = beltRequests
        .filter(
            request => request.userId === userId
                && request.belt === belt
                && ['open', 'checked-out', 'incoming'].includes(request.status)
                && request.id !== id
        )

    let replaceText
    let warning

    if (existingRequests.length) {
        replaceText = `\nThis replaces your previous ${belt} requests.`
        for (const request of existingRequests) {
            const replaceUpdate = buildUpdate({
                request: request,
                status: 'replaced',
                fields: {
                    lastUpdateBy: 'LockyJr',
                    messageId: messageId,
                    updateMessageId: messageId
                }
            })
            try {
                await updateBeltRequest(replaceUpdate)
            } catch (error) {
                warning = `Error while replacing existing request ${request.id}: ${error.message}`
            }
        }
    }
    return {warning, replaceText}
}


export async function handleBeltRequest({message, params, incomingRecord}) {

    const id = incomingRecord?.id ?? genHexString(8)
    const belt = incomingRecord?.belt ?? params?.belt
    const userId = incomingRecord?.userId ?? params?.userId

    let update
    if (!incomingRecord) {
        update = buildUpdate({
            request: {id},
            status: 'open',
            fields: {
                ...params,
                dateAdded: dayjs().format(),
                messageId: message?.id
            }
        })
        try {
            await updateBeltRequest(update)
        } catch (error) {
            throw new Error(`Error while creating ${id}: ${error.message}`)
        }
    }

    const {warning, replaceText} = await replacePreviousRequests({
        id: id,
        userId: userId,
        belt: belt,
        messageId: message?.id
    })

    return {beltRequest: update || incomingRecord, warning, replaceText}
}

// APPROVE
export async function approveRequest({message, beltRequests, request, user, notes, force = false}) {

    const editBlocked = editIsBlocked(user, request)
    if (editBlocked && !force)
        throw new Error(editBlocked)

    const {
        source,
        platform,
        userId,
        username,
        belt,
        requestId,
        syncTo,
        syncUsername
    } = request

    let transaction = {}
    if (platform === 'Reddit') {
        transaction = await setRedditFlair('lockpicking', username, belt)
    } else if (!platform || platform === 'Discord') {
        transaction = await setDiscordRole(message, {username, belt})
    }
    if (transaction.error)
        throw new Error(`Failed to set belt on ${platform}: ${transaction.error}`)

    const update = buildUpdate({
        request,
        status: 'approved',
        fields: {
            reply: request.reply,
            checkoutBy: FieldValue.delete(),
            lastUpdateBy: user.name,
            lastUpdatePlatform: 'Discord',
            notes: request.notes ?? notes
        }
    })
    try {
        await updateBeltRequest(update)
    } catch (error) {
        throw new Error(`Error while updating request ${request.id}: ${error.message}`)
    }

    let warning = {}
    let syncResult = {}
    let syncMessage

    if (syncTo === 'Discord' && syncUsername) {

        console.log('Syncing Discord role placeholder')

        try {
            syncResult = await setDiscordRole(message, {username: syncUsername, belt})
            syncMessage = '\n  (You\'ve also been flagged on Discord.)'
            syncResult.result = syncResult.status === 'success'
                ? `(Also set ${belt} role for @${syncUsername} on Discord.)`
                : `Failed to set Discord role for @${syncUsername}`

        } catch (err) {
            console.error('Failed to set user flair', err)
            syncResult = {result: `Failed to set Discord role: ${err}`}
        }

    } else if (syncTo === 'Reddit' && syncUsername) {

        // TODO convert to err/try/catch

        try {
            syncResult = await setRedditFlair('lockpicking', syncUsername, belt)
            syncMessage = '\n  (You\'ve also been flaired on Reddit.)'
            syncResult.result = syncResult.status === 'success'
                ? `(Also set ${belt} flair for u/${syncUsername} on Reddit.)`
                : `Failed to set Reddit flair for u/${syncUsername}`
        } catch (err) {
            console.error('Failed to set user flair', err)
            syncResult = {result: `Failed to set Reddit flair ${err}`}
        }
    }

    /*
       syncResult: return {
        status: 'success',
        success: 'success',
        result: `Successfully set ${role} role for ${username} on Discord.`,
        statusMessages,
        alert
    }

     */

    // respond
    const notesText = notes?.length ? `\nNotes: ${notes}` : ''

    // TODO change reviewer string if no message.

    if (platform === 'Discord') {
        const announceNotes = notesText?.length ? notesText : getDefaultMessage(belt)
        const reviewerRef = message ? `<@${message?.author?.id}>` : `**${user.name}**`
        let announceText = `<@${userId}>, ${reviewerRef} has reviewed and `
            + `approved your request. Congrats on your ${belt}! ${announceNotes}`
        if (syncMessage) announceText += syncMessage
        try {
            await handleAnnounce({message, request, platform, announceText})
        } catch (err) {
            console.error(`Failed to announce approval. ${err}`)
            warning = {warning: 'Failed to announce approval.'}
        }
    } else if (source === 'Reddit') {
        const announceNotes = notesText?.length ? notesText : getDefaultMessage(belt).replace(/\s*<.*>/, '')
        let modmailMessage = `${belt} approved. Congratulations! ${announceNotes}`
        if (syncMessage) modmailMessage += syncMessage
        try {
            await modmailReply({conversationId: requestId, modmailMessage, archive: true, isAuthorHidden: true})
        } catch (err) {
            console.error('Failed to reply to modmail.', err)
            warning = {warning: 'Failed to reply to modmail.'}
        }
    }

    const currentBeltIndex = beltRoles.indexOf(request.belt)

    const lowerBeltRequests = beltRequests
        .filter(r => r.userId === request.userId && ['open', 'checked-out'].includes(r.status))
        .filter(r => beltRoles.indexOf(r.belt) < currentBeltIndex)

    const supersededResponses = []

    for (const index in lowerBeltRequests) {
        const update = buildUpdate({
            request, status: 'superseded', fields: {
                id: lowerBeltRequests[index].id,
                checkoutBy: FieldValue.delete(),
                lastUpdateBy: 'LockyJr',
                lastUpdatePlatform: 'Discord'
            }
        })
        const response = await updateBeltRequest(update)
        console.log('superseded response', response)
        supersededResponses.push(response)
    }

    const replyText = `Successfully set ${request.belt} for **${request.username}** on ${request.platform}.\n${syncResult.result}`
    return {...warning, supersededResponses, replyText, success: true}
}

// DENY
export async function denyRequest({message, request, user, force = false, notes}) {
    const {
        source,
        platform,
        userId,
        belt,
        //notes,
        requestId
    } = request

    const editBlocked = editIsBlocked(user, request)
    if (editBlocked && !force)
        throw new Error(editBlocked)

    const notesText = notes?.length ? `\nNotes: ${notes}` : ''

    const update = buildUpdate({
        request,
        status: 'denied',
        fields: {
            reply: request.reply,
            checkoutBy: FieldValue.delete(),
            lastUpdateBy: user.name,
            lastUpdatePlatform: 'Discord',
            notes: request?.notes ?? notes
        }
    })
    try {
        await updateBeltRequest(update)
    } catch (error) {
        throw new Error(`Error while updating request ${request.id}: ${error.message}`)
    }

    if (platform === 'Discord') {
        const reviewerRef = message ? `<@${message.author?.id}>` : user.name
        const announceText = `We're sorry <@${userId}>, ${reviewerRef} has reviewed and `
            + `denied your request for ${belt}. ${notesText}`
        try {
            await handleAnnounce({message, request, platform, announceText})
        } catch (err) {
            console.error('Failed to announce denial.', err)
            throw new Error('Failed to announce denial.')
        }
    } else if (source === 'Reddit') {
        const modmailMessage = `We're sorry, we have reviewed and denied your request for ${belt}. ${notesText}`
        try {
            await modmailReply({conversationId: requestId, modmailMessage, archive: true, isAuthorHidden: true})
        } catch (err) {
            console.error('Failed to reply to modmail.', err)
            throw new Error('Failed to reply to modmail.')
        }
    } else {
        console.error('Unknown source/platform.')
    }
    return `Denied ${request.belt} for **${request.username}** on ${request.platform}.`
}

// DELETE
async function deleteRequest({request, user, force = false}) {
    if (request.status === 'deleted') {
        throw new Error(`Request ${request.id} is already deleted.`)
    } else if (request.status === 'checked-out' && request.reviewerName !== user.name && !force) {
        throw new Error(`Request ${request.id} is being reviewed by ${request.reviewerName}.`)
    }
    const update = buildUpdate({request, status: 'deleted', fields: {checkoutBy: FieldValue.delete()}})
    try {
        await updateBeltRequest(update)
        return `${request.id} has been deleted`
    } catch (error) {
        throw new Error(`Error while deleting request ${request.id}: ${error.message}`)
    }
}

// CHECK OUT
async function checkoutRequest({request, user, force}) {
    if (request.status === 'checked-out' && request.reviewerName !== user.name && !force) {
        throw new Error(`Request ${request.id} is being reviewed by ${request.reviewerName}.`)
    }
    const update = buildUpdate({request, status: 'checked-out', fields: {checkoutBy: user.name}})
    try {
        await updateBeltRequest(update)
        return `${request.id} has been checked out`
    } catch (error) {
        throw new Error(`Error while checking out request ${request.id}: ${error.message}`)
    }
}

// CHECK IN
async function checkinRequest({request, user, force}) {
    if (request.status !== 'checked-out' || (request.checkoutBy !== user.name && !force)) {
        throw new Error(`You don't have ${request.id} checked out.`)
    }
    const update = buildUpdate({request, status: 'open', fields: {}})
    try {
        await updateBeltRequest(update)
        return `${request.id} has been checked back in.`
    } catch (error) {
        throw new Error(`Error while checking in request ${request.id}: ${error.message}`)
    }
}

export default async function processBeltMessage(message) {

    const messageContent = (await cleanMessage(message))?.replace(/^\[me] test/i, '[me]').trim()

    const isBotCommand = new RegExp('^\\[me]\\s+', 'i').exec(messageContent)
    if (!isBotCommand) return
    const reviewerRoles = ['Staff', 'Belt Reviewer']
    const isReviewer = message.member?.roles?.cache?.some(role => reviewerRoles.includes(role.name))

    const beltRequests = getOpenBeltRequests()

    const user = {id: message.author.id, name: message.author.username}
    const {action, id, belt, evidence, notes = '', syncUsername, syncTo} = parseBeltRequest(messageContent)

    console.log('parseBeltRequest(messageContent)', parseBeltRequest(messageContent))

    if (!belt && !isReviewer) {
        await handleReply({message, replyText: 'Invalid request, try `help` for commands'})
        return
    }

    const attachments = message.attachments?.map(attachment => attachment.url)

    // REQUEST
    if (action === 'request') {
        let replyText
        const params = {
            source: 'Discord',
            platform: 'Discord',
            username: message?.member?.displayName ?? message?.author?.username,
            userId: message.author.id,
            belt,
            messageContent,
            currentBelt: 'tk',
            requestId: message.id,
            syncTo,
            syncUsername,
            attachments
        }

        if (!belt || !evidence) {
            replyText = 'To request a belt, please use the format:\n'
                + '`@LockyJr request [Belt Color] [Lock model] https://image_or_video_link_here`\n'
        } else {
            try {
                await handleBeltRequest({message, params}).then(response => {
                    replyText = `<@${message.author.id}> thanks for your ${belt} request!`
                        + `${response.replaceText || ''}\n(id: ${response?.beltRequest?.id})`
                })
            } catch (error) {
                replyText = `Sorry <@${message.author.id}>, your ${belt} request didn't go through. (${error})`
            }
        }

        await handleReply({message, platform: 'Discord', replyText})

    } else if (action === 'retry') {
        // await retryRequest(id)
        try {
            const channel = await client.channels.fetch(beltRequestsChannelId)
            const message = await channel.messages.fetch(id)
            console.log('cleanMessage(message)', await cleanMessage(message))
            await processBeltMessage(message)
            return `${id} has tried again?`

        } catch (error) {
            throw new Error(`Error while retrying request ${id}: ${error.message}`)
        }


    } else if (['list', 'ls'].some(a => a === action)) {
        console.log('list')
        try {
            const replyEmbeds = await processListRequest({listType: 'embeds'})
            await handleReply({message, platform: 'Discord', replyEmbeds})
        } catch (error) {
            const replyText = `Sorry <@${message.author.id}>: an error occurred: ${error}`
            await handleReply({message, platform: 'Discord', replyText})
        }
    } else {
        let replyText

        const request = beltRequests.find(r => r.id === id)

        try {
            if (action !== 'request' && !request) {
                replyText = `Sorry <@${message.author.id}>: request ${id} not found.`

            } else if (['approve', 'ok'].some(a => a === action)) {
                await approveRequest({beltRequests, message, request, user, notes}).then(async response => {
                    replyText = response.replyText
                })

            } else if (['deny', 'reject'].some(a => a === action)) {
                replyText = await denyRequest({beltRequests, message, request, user, notes})

            } else if (['delete', 'rm'].some(a => a === action)) {
                replyText = await deleteRequest({request, user, force: false})

            } else if (action === 'reopen') {
                replyText = 'Can\'t re-open requests on Discord, please use the site.'

            } else if (action === 'checkout') {
                replyText = await checkoutRequest({request, user, force: false})

            } else if (action === 'checkin') {
                replyText = await checkinRequest({request, user, force: false})

            } else if (['moreinfo', 'info'].some(a => a === action)) {
                replyText = JSON.stringify(request, null, 2)

            } else if (action === 'sync') {
                //replyText = await sync({request, user, force: false})
            }
        } catch (error) {
            replyText = `Sorry <@${message.author.id}>: an error occurred: ${error}`
            console.error('action request error', replyText)
        } finally {
            await handleReply({message, platform: 'Discord', replyText})
        }
    }
}

// functions

function buildUpdate({request, status, fields = {}}) {
    return {
        id: request.id,
        status,
        lastUpdated: dayjs().format(),
        ...fields
    }
}

function editIsBlocked(user, existingRequest) {
    const id = existingRequest.id
    if (!existingRequest)
        return `Request ${id} not found`
    if (existingRequest.status === 'checked-out' && existingRequest.reviewerId !== user.id)
        return `Request ${id} is being reviewed by ${existingRequest.reviewerName}.`
    if (!['open', 'checked-out'].includes(existingRequest.status))
        return `Request ${id} is not pending (${existingRequest.status})`
    return false
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

function genHexString(len) {
    const hex = '0123456789ABCDEF'
    let output = ''
    for (let i = 0; i < len; ++i) {
        output += hex.charAt(Math.floor(Math.random() * hex.length))
    }
    return output.toLowerCase()
}
