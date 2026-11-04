import path from 'path'

/** @function caller.getFileName */
/** @function caller.getLineNumber */

const suffix = ' | test'
const originalLog = console.log

console.log = function(...args) {
    const originalPrepare = Error.prepareStackTrace

    // Change stack structure to return raw CallSite objects
    Error.prepareStackTrace = (_, stack) => stack

    const err = new Error()
    // err.stack[1] points to the caller function outside of this console.log override
    const caller = err.stack[1]

    Error.prepareStackTrace = originalPrepare // Restore original

    if (caller) {
        const filename = path.basename(caller.getFileName() || '')
        const lineNumber = caller.getLineNumber()

        // Prefix the original console log arguments with file and line info
        const prefix = `${filename.padEnd(20)}:${lineNumber.toString().padStart(3, ' ')}`.padEnd(30) + ' | '
        originalLog.apply(console, [prefix, ...args, suffix])
    } else {
        originalLog.apply(console, args)
    }
}
