import {approveRequest, denyRequest} from './processBeltMessage.js'
import {getOpenBeltRequests, updateBeltRequest} from '../data/dataStore.js'
import {processIncomingRequest} from './processIncomingRequest.js'
import dayjs from 'dayjs'

export async function processUpdatedRecord(record) {

    const beltRequests = getOpenBeltRequests()

    let replyText
    try {
        if (record.status === 'incoming') {
            const response = await processIncomingRequest({incomingRecord: record})
            const update = buildUpdate({
                request: record,
                status: 'open',
                fields: response.messageId
                    ? {messageId: response.messageId, requestId: response.messageId}
                    : {}
            })
            try {
                await updateBeltRequest(update)
            } catch (error) {
                throw new Error(`Error while updating request ${record.id}: ${error.message}`)
            }

        } else if (record.status === 'processing-approve') {
            const user = {name: record.lastUpdateBy ?? 'LockyJr'}
            const response = await approveRequest(
                {beltRequests, request: record, user, notes: record.notes, force: true}
            )
            if (response) {
                replyText = response.replyText
                console.log('Reply text:', replyText)
            }

        } else if (record.status === 'processing-deny') {
            const user = {name: record.lastUpdateBy ?? 'LockyJr'}
            await denyRequest(
                {request: record, user, notes: record.notes, force: true}
            )
        }
    } catch (error) {
        console.error('Error processing updated record:', error, record)
    }
}

function buildUpdate({request, status, fields = {}}) {
    return {
        id: request.id,
        status,
        lastUpdated: dayjs().format(),
        ...fields
    }
}
