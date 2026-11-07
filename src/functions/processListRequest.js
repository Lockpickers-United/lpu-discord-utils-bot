import belts, {beltRoleSortReverse} from '../util/belts.js'
import {EmbedBuilder} from 'discord.js'
import {randomResponse} from '../util/randomResponse.js'
import {getOpenBeltRequests} from '../data/dataStore.js'
import {setDeepPush} from '../util/setDeep.js'
import {getSortComparator} from '../util/sortComparators.js'
import dayjs from 'dayjs'

export async function processListRequest({listType = 'embeds'}) {

    let beltRequests = []
    try {
        beltRequests = getOpenBeltRequests()
    } catch (error) {
        console.error('Error fetching open belt requests:', error)
        return {content: 'An error occurred while fetching open belt requests.'}
    }

    if (beltRequests.length === 0) {
        const response = await randomResponse(2, 'hour') || 'Nice.'
        if (listType === 'text') {
            return {content: `**All Clear!**\n\n${response}`}
        } else {
            const rando = await randomResponse(2, 'hour')
            const response = rando || 'Nice.'
            const embed = new EmbedBuilder()
                .setColor('#00bb00')
                .setTitle('All Clear!')
                .addFields(
                    {
                        name: ' ',
                        value: response,
                        inline: false
                    }
                )
            return {embeds: [embed]}
        }
    }

    const embeds = []
    const flags = []

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

    if (listType === 'text') {

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
                requestsText += `   Date: ${dayjs(request.dateAdded).format('YYYY-MM-DD')}\n`
                requestsText += `   Link: https://discord.com/channels/140129091796992000/282173282546089985/${request.messageId}\n`
                requestsText += `   ID: ${request.id}\n\n`
            })
        })
        return { content: requestsText }

    } else if (listType === 'embeds') {
        if (beltRequests.length === 0) {
//
        } else {
            organizedRequests?.forEach(userRequests => {
                let requestText = ''
                userRequests.requests?.forEach(request => {
                    const errorText = request.status === 'error'
                        ? `**Error**: ${request.error}\n\n`
                        : ''
                    const reviewText = request.status === 'checked-out'
                        ? ` (checked out by ${request.checkoutBy ?? request.mgsecure ?? 'unknown'})`
                        : ''
                    requestText += errorText
                    requestText += `**${request.belt}**${reviewText}\n`
                    if (request.syncUsername && request.syncTo === 'Reddit')
                        requestText += `Sync to Reddit: u/${request.syncUsername}\n`
                    if (request.syncUsername && request.syncTo === 'Discord')
                        requestText += `Sync to Discord: @${request.syncUsername}\n`
                    requestText += `${dayjs(request.dateAdded).format('YYYY-MM-DD')} `
                    requestText += ` https://discord.com/channels/140129091796992000/282173282546089985/${request.messageId}\n`
                    requestText += `ID: ${request.id}\n\n`
                })

                const color = userRequests.requests[0].status !== 'error'
                    ? belts[userRequests.requests[0].belt?.replace(' Belt', '')]?.color ?? '#8eb354'
                    : '#bb0000'
                const embed = new EmbedBuilder()
                    .setColor(color)
                    .setTitle(userRequests.requests[0].username?.toString() ?? '<user>')
                    .addFields(
                        {
                            name: ' ',
                            value: requestText,
                            inline: false
                        }
                    )
                embeds.push(embed)
            })
            return {embeds, flags}
        }

    } else {
        return {content: JSON.stringify(beltRequests, null, 2)}
    }
}