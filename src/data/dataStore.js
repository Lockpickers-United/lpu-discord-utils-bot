import fs from 'fs'
import {fileURLToPath} from 'url'
import {dirname} from 'path'
import admin from 'firebase-admin'
import {getFirestore} from 'firebase-admin/firestore'
import {processUpdatedRecord} from '../functions/processUpdatedRecord.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const serviceAccount = JSON.parse(fs.readFileSync(`${__dirname}/../../keys/lpu-belt-explorer-firebase-adminsdk.json`, 'utf8'))
const app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://lpu-belt-explorer.firebaseio.com'
})
let db = getFirestore(app, 'lpubelts-dev')

function setDBEnvironment(environment) {
    db = getFirestore(app, environment === 'prod' ? '(default)' : 'lpubelts-dev')
}

setDBEnvironment('prod')

const activeDataStore = new Map()
let unsubscribe = null
let isShuttingDown = false
let loaded = false

export function getOpenBeltRequests() {
    return Array.from(activeDataStore.values())
}

function startSnapshotListener() {
    if (isShuttingDown) return

    console.log('Initializing Firestore snapshot listener...')

    unsubscribe = db.collection('belt-requests')
        .where('status', 'in', ['open', 'checked-out', 'incoming-approve', 'incoming-deny', 'processing-approve', 'processing-deny'])
        .onSnapshot(
            (snapshot) => {
                snapshot.docChanges().forEach(async (change) => {
                    const docId = change.doc.id
                    if (change.type === 'removed') {
                        activeDataStore.delete(docId)
                    } else {
                        activeDataStore.set(docId, {
                            id: docId,
                            ...change.doc.data()
                        })

                        await processUpdatedRecord(change.doc.data())
                    }
                })
                console.log(`Data set ${loaded ? 'updated' : 'loaded'}. Total records: ${activeDataStore.size}`)
                loaded = true
            },
            (error) => {
                console.error('Firestore snapshot stream broke:', error)
                handleListenerFailure()
            }
        )
}

export async function updateBeltRequest(update) {
    const docRef = db.collection('belt-requests').doc(update.id)
    const cleanUpdate = removeEmptyValues(update)
    try {
        const result = await db.runTransaction(async (transaction) => {
            const requestDoc = await transaction.get(docRef)
            const revision = (requestDoc.data()?.revision ?? 0) + 1
            if (!requestDoc.exists) {
                transaction.set(docRef, {...cleanUpdate, revision})
            } else {
                transaction.update(docRef, {...cleanUpdate, revision})
            }
            return {...requestDoc?.data(), ...cleanUpdate, revision}
        })
        console.log('Transaction successfully committed:', result)
        return result
    } catch (error) {
        console.error('Transaction failed or aborted:', error.message)
        throw new Error(`Update failed ${error.message}`)
    }
}

function removeEmptyValues(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([_key, value]) => value !== null && value !== undefined))
}

function handleListenerFailure() {
    if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
    }
    activeDataStore.clear()
    if (!isShuttingDown) {
        console.log('Attempting to reconnect in 5 seconds...')
        setTimeout(startSnapshotListener, 5000)
    }
}

function shutdown(signal) {
    if (isShuttingDown) return
    isShuttingDown = true

    console.log(`\n\nReceived ${signal}. Cleaning up...`)

    if (unsubscribe) {
        unsubscribe()
    }
    activeDataStore.clear()

    setTimeout(() => {
        process.exit(0)
    }, 500)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

startSnapshotListener()
