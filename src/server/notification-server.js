
import debug from 'debug'
import net from 'net'
import FileWatcher from './file-watcher'
import {EventEmitter} from 'events'
const P = f => new Promise(f)
const ____ = debug('faster-titanium:NotificationServer')
const ___x = debug('faster-titanium:NotificationServer:error')

/**
 * Server connecting continuously with Titanium App.
 * Restrict connection: only one device can connect to the server.
 */
export default class NotificationServer extends EventEmitter {

    /**
     * @param {string} [port]
     */
    constructor(port, token) {
        super()
        this.port = port
        this.token = token
        this.client = null
        this.server = net.createServer(::this.verifyClient)
        this.server.on('error', err => ___x(err) || this.emit('error', err))
        /** @type {string} received pre-parsed text */
        this.received = ''
    }


    /** @type {boolean} */
    get connected() {
        return !!(this.client && this.client.writable)
    }


    get running() {
        return this.server.listening
    }

    /**
     * listen
     * @public
     * @return {Promise}
     */
    listen() {
        return P(y => this.server.listen(this.port, y)).then(x =>{
            ____(`start listening ${this.port}`)
        })
    }

    /**
     * close server
     * @public
     * @return {Promise}
     */
    close() {
        ____(`terminating...`)
        this.client && this.client.destroy()

        return P(y => this.server.close(y)).then(x => {
            ____(`terminated`)
        })
    }

    /**
     * check the client has the right access token
     * @param {net.Socket} socket
     */
    verifyClient(socket) {
        socket.setEncoding('utf8')
        socket.once('data', (clientToken) => {
            if (clientToken === this.token) {
                this.addClient(socket)
            }
            else {
                ____(`Token doesn't match. client: ${clientToken}, server: ${this.token}.
                     For most case, this is caused by older app retrying connection to the server. Ignore it.`)
                socket.end()
            }
        })
    }

    /**
     * add a client socket
     * @param {net.Socket} socket
     */
    addClient(socket) {
        if (this.client) {
            ____(`New connection, Overwrite existing connection.`)
            if (this.client.writable) { this.client.end() }
        }
        else {
            ____(`New connection. Set client.`)
        }
        socket.on('data', ::this.onData)
        this.client = socket
        this.send({event: 'connected'})
    }


    /**
     * send payload to the client
     * @param {object} [payload={}]
     */
    send(payload = {}) {
        if (!this.client) {
            return ____(`sending message suppressed: No client.`)
        }
        if (!this.client.writable) {
            this.client = null
            return ____(`sending message suppressed: Socket is not writable.`)
        }

        ____(`sending payload: ${JSON.stringify(payload)}\n`)
        // as payloads are sometimes joined with previous one, the client should split them with "\n" separator
        // (see src/titanium/socket.js)
        this.client.write(JSON.stringify(payload) + '\n')
    }

    /**
     * Called when data comes from client
     * Split into multiple payloads
     * @param {string} chunk
     */
    onData(chunk) {
        this.received += chunk
        const payloads = this.received.split('\n')
        this.received = payloads.pop()

        payloads.map(JSON.parse).forEach(::this.readPayload)
    }

    /**
     * read payload sent by client
     * @param {Object} payload
     */
    readPayload(payload) {

        switch (payload.type) {
            case 'log':
                this.emit('log', payload)
                break
            default:
                // console.log(payload)
                break
        }
    }
}
