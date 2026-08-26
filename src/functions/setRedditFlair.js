const {flairDetails} = require('../util/flairs.js')
const snoowrap = require('snoowrap')
const {client_id, client_secret, refresh_token} = require('../../keys/reddit-keys.js')

async function setRedditFlair(subredditName, username, belt) {

    const reddit = new snoowrap({
        userAgent: 'modmail-sync-checker by u/mgsecure',
        clientId: client_id,
        clientSecret: client_secret,
        refreshToken: refresh_token
    })
    await reddit.getMe()
    const token = reddit.accessToken

    const {id} = flairDetails[belt]

    const url = `https://oauth.reddit.com/r/${subredditName}/api/selectflair`
    const body = new URLSearchParams({
        api_type: 'json',
        name: username,
        flair_template_id: id
    })

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'User-Agent': reddit._config.userAgent,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString()
    })

    const json = await res.json()
    if (!res.ok || (json.json?.errors?.length)) {
        return {status: 'error', error: `Flair API error: ${JSON.stringify(json.json?.errors || res.status)}`}
    }

    return {status: 'success'}
}

module.exports = setRedditFlair
