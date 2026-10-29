import snoowrap from 'snoowrap'
import {client_id, client_secret, refresh_token} from '../../keys/reddit-keys.js'

export async function modmailReply({conversationId, modmailMessage, archive, modOnly = false, isAuthorHidden = true}) {

    const reddit = new snoowrap({
        userAgent: 'modmail-sync-checker by u/mgsecure',
        clientId: client_id,
        clientSecret: client_secret,
        refreshToken: refresh_token
    })
    await reddit.getMe()
    const token = reddit.accessToken

    try {
        const convo = await reddit.getNewModmailConversation(conversationId)
        await convo.reply(modmailMessage, modOnly, isAuthorHidden)
    } catch (error) {
        console.error(`Error replying to Modmail conversation ${conversationId}:`, error)
        throw new Error(`Error replying to Modmail conversation ${conversationId}: ` + error)
    }

    let alert
    if (archive) {
        await (await reddit.getNewModmailConversation(conversationId)).archive()
            .then(() => {
                console.log(`Modmail conversation ${conversationId} archived successfully.`)
            })
            .catch(error => {
                console.error(`Error archiving Modmail conversation ${conversationId}:`, error)
                alert = `Error archiving Modmail conversation ${conversationId}: ` + error
            })
    }

    return {status: 'success', alert}

}
