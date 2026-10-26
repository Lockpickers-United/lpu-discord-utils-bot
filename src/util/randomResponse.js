import {projectRoot} from '../../keys/botConfig.js'
import fs from 'node:fs/promises'
import writeJsonFileAtomic from '../util/writeJsonFileAtomic.js'
import dayjs from 'dayjs'

export async function randomResponse(chance = 90, interval = 'hour') {

    const autoResponsesFile = `${projectRoot}/data/autoResponses.json`
    const respond = Math.floor(Math.random() * 100) >= (100 - chance)
    if (!respond) return false

    try {
        const autoResponses = JSON.parse((await fs.readFile(autoResponsesFile, 'utf8')).toString()) || {}

        let {remaining, used, last} = autoResponses
        const {all} = autoResponses

        if (last && dayjs().diff(last, interval) < 1) {
            console.log('diff', last, interval, dayjs().diff(last, interval))
            return false
        }

        if (!remaining.length) {
            remaining = [...all]
            used = []
        }

        const response = remaining.splice(Math.floor(Math.random() * remaining.length), 1)
        used.push(response[0])
        last = dayjs()

        await writeJsonFileAtomic(autoResponsesFile, {all, remaining, used, last}, {spaces: 2})
        return response[0]

    } catch (error) {
        console.error(error)
        return false
    }

}
