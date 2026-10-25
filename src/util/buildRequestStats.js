import fs from 'node:fs/promises'
import dayjs from 'dayjs'
import {setDeepAdd} from './setDeep.js'
import {beltRoleSort} from './belts.js'

export async function buildRequestStats(requestsFile) {
    const beltRequests = JSON.parse((await fs.readFile(requestsFile, 'utf8')).toString())

    const statusList = [
        'approved',
        'rejected',
        'requested',
        'synced',
        'replaced',
        'superseded'
    ]

    const sevenDaysAgo = dayjs().subtract(7, 'day')

    const stats = beltRequests
        .filter(request => request.status !== 'deleted')
        .reduce((acc, request) => {
            const last7Days = dayjs(request.dateAdded).isAfter(sevenDaysAgo)

            setDeepAdd(acc, ['total', 'status', request.status], 1)
            setDeepAdd(acc, ['total', 'belt', request.belt], 1)
            setDeepAdd(acc, ['total', 'userName', request.userName], 1)
            setDeepAdd(acc, ['total', 'reviewer', request.lastUpdateBy], 1)
            setDeepAdd(acc, ['total', 'reddit', 'total'], request.redditUsername ? 1 : 0)
            setDeepAdd(acc, ['total', 'reddit', request.belt], request.redditUsername ? 1 : 0)

            setDeepAdd(acc, ['lastSeven', 'status', request.status], last7Days ? 1 : 0)
            setDeepAdd(acc, ['lastSeven', 'belt', request.belt], last7Days ? 1 : 0)
            request.lastUpdateBy && setDeepAdd(acc, ['lastSeven', 'reviewer', request.lastUpdateBy], last7Days ? 1 : 0)
            setDeepAdd(acc, ['lastSeven', 'redditTotal'], (last7Days && request.redditUsername) ? 1 : 0)
            return acc
        }, {})

    const lastSevenReviewerStats = Object.keys(stats.lastSeven.reviewer).map(reviewer => {
        return {name: reviewer, count: stats.lastSeven.reviewer[reviewer]}
    }).sort((a, b) => b.count - a.count)

    const lastSevenBeltStats = Object.keys(stats.lastSeven.belt).map(belt => {
        return {name: belt, count: stats.lastSeven.belt[belt]}
    }).sort((a, b) => beltRoleSort(a.name, b.name))


    const textBlocks = []
    let sevenBlocks = []
    if (Object.keys(stats.lastSeven)?.length) {

        let lastSevenBlock = ''

        sevenBlocks = [
            {
                title: 'Request Status',
                text: '```\n'
                    + statusList.map(key => stats.lastSeven.status?.[key] && `${(key === 'requested' ? '(Open)' : initialCap(key)).padEnd(13)}${stats.lastSeven.status?.[key].toString().padEnd(5)}`).join('\n')
                    + '\n```\n'
            },
            {
                title: 'By Belt',
                text: '```\n'
                    + lastSevenBeltStats.map(belt => `${belt.name.padEnd(13)}${belt.count.toString().padEnd(5)}`).join('\n')
                    + '\n```\n'
            },
            {
                title: 'Reviewer',
                text: '```\n'
                    + lastSevenReviewerStats.map(reviewer => `${reviewer.name.padEnd(13)}${reviewer.count.toString().padEnd(5)}`).join('\n')
                    + '\n```\n'
            }
        ]

        sevenBlocks.forEach(block => {
            lastSevenBlock += `${block.title}\n${block.text}`
        })


        lastSevenBlock += '**Reddit Syncs**\n```\n'
        lastSevenBlock += `${'Total'.padEnd(13)}${stats.lastSeven.redditTotal.toString().padEnd(5)}\n`
        lastSevenBlock += '```\n'

        textBlocks.push({name: 'Last Seven Days', text: lastSevenBlock})

    }


    return {stats, textBlocks, sevenBlocks, success: 'stats retrieved'}

}

function initialCap(str) {
    if (!str) return ''
    return str.charAt(0).toUpperCase() + str.slice(1)
}