import {approveRequest, denyRequest} from './processBeltMessage.js'


export async function processUpdatedRecord(record) {
    try {
        if (record.status === 'processing-approve') {
            const user = {name: record.lastUpdateBy ?? 'LockyJr'}
            const response = await approveRequest({beltRequests: Array.from(activeDataStore.values()), request: record, user, force: true})
            if (response) {
                replyText = response.replyText
            }
        } else if (record.status === 'processing-deny') {
            const user = {name: record.lastUpdateBy ?? 'LockyJr'}
            await denyRequest({request: record, user, force: true})
        }
    } catch (error) {
        console.error('Error processing updated record:', error, record)
    }

}
