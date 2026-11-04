import {approveRequest, denyRequest} from './processBeltMessage.js'
import {getOpenBeltRequests} from '../data/dataStore.js'


export async function processUpdatedRecord(record) {

    const beltRequests = getOpenBeltRequests()

    let replyText
    try {
        if (record.status === 'processing-approve') {
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
            await denyRequest({request: record, user, force: true})
        }
    } catch (error) {
        console.error('Error processing updated record:', error, record)
    }

}
