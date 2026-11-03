import {PermissionFlagsBits} from 'discord.js'
import {updateBeltRequest} from '../data/dataStore.js'
import {FieldValue} from 'firebase-admin/firestore'
import dayjs from 'dayjs'
import {beltRoles, beltRoleSortReverse} from '../util/belts.js'
import cleanMessage from '../util/cleanMessage.js'
import parseBeltRequest from '../util/parseBeltRequest.js'
import {setDeepPush} from '../util/setDeep.js'
import {getSortComparator} from '../util/sortComparators.js'
import {getOpenBeltRequests} from '../data/dataStore.js'
import {handleReply, handleAnnounce} from './handleMessageRespond.js'
import setDiscordRole from './setDiscordRole.js'
import setRedditFlair from './setRedditFlair.js'
import {modmailReply} from './modmailReply.js'
import {announce, saveAction} from './processBeltMessage.js'
import fs from 'node:fs/promises'
import {beltRequestsFile} from '../../keys/botConfig.js'

export async function handleList(beltRequests) {
    if (beltRequests.length === 0) {
        return {requestsText: 'Requests:\n\n**All clear!**', success: 'info retrieved'}
    }
    const requestsByUser = beltRequests.reduce((acc, request) => {
        setDeepPush(acc, [request.userId], request)
        return acc
    }, {})
    const organizedRequests = beltRequests
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
            const reviewText = request.status === 'checked-out'
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
    return {requestsText, organizedRequests}
}


async function approveRequest({message, beltRequests, request, user, notes, force = false}) {
    console.log('approveRequest start', request)

    const editBlocked = editIsBlocked(user, request)
    if (editBlocked && !force)
        throw new Error(editBlocked)

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
    } = request

    // flag on platform
    console.log('flag on platform', platform)

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
            notes
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
        } catch (err) {
            console.error('Failed to set user flair', err)
            syncResult = {syncResult: 'Failed to set Discord role'}
        }

    } else if (syncTo === 'Reddit' && syncUsername) {
        try {
            syncResult = await setRedditFlair('lockpicking', syncUsername, belt)
            syncMessage = '\n  (You\'ve also been flaired on Reddit.)'
        } catch (err) {
            console.error('Failed to set user flair', err)
            syncResult = {syncResult: 'Failed to set Reddit flair'}
        }
    }

    // respond
    const notesText = notes?.length ? `\nNotes: ${notes}` : ''

    if (platform === 'Discord') {
        const announceNotes = notesText?.length ? notesText : getDefaultMessage(belt)
        let announceText = `<@${userId}>, <@${message.author?.id}> has reviewed and `
            + `approved your request. Congrats on your ${belt}! ${announceNotes}`
        if (syncMessage) announceText += syncMessage
        try {
            await handleAnnounce({message, request, platform, announceText})
        } catch (err) {
            console.error('Failed to announce approval.')
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

    const lowerBeltRequests = [...beltRequests]
        .filter(r => r.userId === request.userId && r.status === 'open')
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

    return {...warning, supersededResponses, success: true}
}


export async function denyRequest({message, request, user, force = false}) {

    const {
        status,
        source,
        platform,
        userId,
        username,
        belt,
        notes,
        messageContent,
        currentBelt,
        requestId,
        syncTo,
        syncUsername
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
            notes
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
            console.error('Failed to announce denial.')
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
    } else {}


    return true
}


export default async function handleBeltMessage(message) {

    const messageContent = (await cleanMessage(message))?.replace('[me] test', '[me]').trim()

    const isBotCommand = new RegExp('^\\[me]\\s+', 'i').exec(messageContent)
    if (!isBotCommand) return
    const reviewerRoles = ['Staff', 'Belt Reviewer']
    const isReviewer = message.member?.roles?.cache?.some(role => reviewerRoles.includes(role.name))
    if (!isReviewer) {
        await handleReply({message, replyText: `Sorry <@${message.author.id}>: you're not allowed to do that.`})
        return
    }

    const beltRequests = getOpenBeltRequests()

    const {action, id, belt, evidence, notes, syncMatch} = parseBeltRequest(messageContent)

    console.log(parseBeltRequest(messageContent))

    const user = {id: message.author.id, name: message.author.username}

    if (['list', 'ls'].some(a => a === action)) {
        try {
            await handleList(beltRequests).then(async response => {
                await handleReply({message, platform: 'Discord', replyText: response?.requestsText})
            })
        } catch (error) {
            const replyText = `Sorry <@${message.author.id}>: an error occurred: ${error}`
            await handleReply({message, platform: 'Discord', replyText})
        }
    } else {
        const request = beltRequests.find(r => r.id === id)
        if (!request) {
            await handleReply({
                message,
                platform: 'Discord',
                replyText: `Sorry <@${message.author.id}>: request ${id} not found.`
            })
            return
        }

        if (['approve', 'ok'].some(a => a === action)) {
            try {
                await approveRequest({beltRequests, message, request, user, notes}).then(async response => {
                    let replyText = `Successfully set ${request.belt} for **${request.username}** on ${request.platform}.`
                    await handleReply({message, platform: 'Discord', replyText: replyText})
                })
            } catch (error) {
                const errorText = `Sorry <@${message.author.id}>: an error occurred: ${error}`
                console.error('approve request error', errorText)
                await handleReply({message, platform: 'Discord', replyText: errorText})
            }

        } else if (['deny', 'reject'].some(a => a === action)) {
            try {
                await denyRequest({beltRequests, message, request, user, notes}).then(async response => {
                    let replyText = `Denied ${request.belt} for **${request.username}** on ${request.platform}.`
                    await handleReply({message, platform: 'Discord', replyText: replyText})
                })
            } catch (error) {
                const errorText = `Sorry <@${message.author.id}>: an error occurred: ${error}`
                console.error('deny request error', errorText)
                await handleReply({message, platform: 'Discord', replyText: errorText})
            }

        } else if (action === 'delete') {
            //await deleteRequest(request, force)
        } else if (action === 'reopen') {
            //await reopenRequest(request)
        } else if (action === 'checkout') {
            //await checkoutRequest(request)
        } else if (action === 'checkin') {
            //await checkinRequest(request)
        }
    }
}

// functions

function buildUpdate({request, status, fields = {}}) {
    return {
        id: request.id,
        status,
        lastUpdated: dayjs().format(),
        //lastUpdateBy: profile.displayName,
        //lastUpdatePlatform: 'Site',
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