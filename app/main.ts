import {readFileSync, writeFileSync} from 'fs'
import {createHash, randomBytes} from 'crypto'
import {createConnection, Socket} from 'net'
// Examples:
// - decodeBencode("5:hello") -> "hello"
// - decodeBencode("10:hello12345") -> "hello12345"
type BEncodeValue = string | number | Array<BEncodeValue> | { [key:string]: string | number | BEncodeValue } 
type DecodedFile = {
    announce: string,
    info: {
        length: number,
        pieces: string,
        "piece length": number
    }
}
function decodeBencodeString(value: string): [string, string] { 
    const firstColonIndex = value.indexOf(":");
    if (firstColonIndex === -1) {
        throw new Error("Invalid encoded value");
    }
    const stringLength = parseInt(value.substring(0, firstColonIndex))
    if (isNaN(stringLength)) {
        throw new Error("Invalid encoded value")
    } 
    return [value.substring(firstColonIndex + 1, firstColonIndex + stringLength + 1), value.substring(firstColonIndex + stringLength + 1)];
}

function decondeBencondeInt(value: string) : [number, string]{
    return [parseInt(value.substring(1, value.indexOf('e'))), value.substring( value.indexOf('e') + 1)] 
}

function decodeBencodeArray(value: string): [BEncodeValue, string]{
    let arrayBencodedString = value.substring(1)
    const finalArrayBencode = []

    while (arrayBencodedString[0] !== 'e'){
        //if the first string is integer get the string
        if (!isNaN(parseInt(arrayBencodedString[0]))){
            const [value, restString] = decodeBencodeString(arrayBencodedString)
            finalArrayBencode.push(value)
            arrayBencodedString = restString
        }
        if (arrayBencodedString[0] === 'i'){
            const [value, restString] = decondeBencondeInt(arrayBencodedString)
            finalArrayBencode.push(value)
            arrayBencodedString = restString
        }
        if (arrayBencodedString[0] === 'l'){
            let [value, restString] = decodeBencodeArray(arrayBencodedString)
            finalArrayBencode.push(value)
            arrayBencodedString = restString
        }
    }

    return [finalArrayBencode, arrayBencodedString.substring(1)]
}

function decodeBencodeObject(value: string){
    //d3:foo3:bar5:helloi52ee
    let bencodedString = value.substring(1);
    const finalObjectBencode: {
        [key:string]: string | number | BEncodeValue
    } = {}

    while (bencodedString[0] !== 'e'){
        //if the first string is integer get the string
        if(isNaN(parseInt(bencodedString[0]))){
            throw new Error("invalid object key")
        }
        const [key, rest] = decodeBencodeString(bencodedString)
        if (!isNaN(parseInt(rest[0]))){
            const[value, restString] = decodeBencodeString(rest)
            finalObjectBencode[key] = value
            bencodedString = restString
        }
        if (rest[0] === 'i'){
            const[value, restString] = decondeBencondeInt(rest)
            finalObjectBencode[key] = value
            bencodedString = restString
        }
        if (rest[0] === 'l'){
            let [value, restString] = decodeBencodeArray(rest)
            finalObjectBencode[key] = value
            bencodedString = restString
        }
        if (rest[0] === 'd') {
            let [value, restString] = decodeBencodeObject(rest)
            finalObjectBencode[key] = value
            if(typeof restString === 'string')
            bencodedString = restString
        } 
    }
    return [finalObjectBencode, bencodedString.substring(1)]
}
function decodeBencode(bencodedValue: string): BEncodeValue {
    /* This function is used to decode a bencoded string
    The bencoded string is a string that is prefixed by the length of the string
    **/

    // Check if the first character is a digit
    if (!isNaN(parseInt(bencodedValue[0]))) {
        const [value, _] = decodeBencodeString(bencodedValue)
        return value
    } 
    if (bencodedValue[0] === 'i'){
        const [value, _] = decondeBencondeInt(bencodedValue)
        return value
    } else if (bencodedValue[0] === 'l') {
        const [finalArrayBencode, _] = decodeBencodeArray(bencodedValue)
        return finalArrayBencode 

    } else if (bencodedValue[0] === 'd') {
        const [object, _] = decodeBencodeObject(bencodedValue)
        return object
    } 
    
    throw new Error("Only strings are supported at the moment");
}

function parseTorrentFile(fileName: string){
    const file = readFileSync(fileName, {encoding: 'latin1'})
    return decodeBencode(file) as DecodedFile
}

function encodeNumber(num: number){
    return `i${num}e`
}
function encodeString(str: string){
    return `${str.length}:${str}`
}

function encodeList(arr: Array<BEncodeValue>){
    let string = 'l'
    for(const value of arr){
        if (typeof value === 'string'){
            string = string + `${encodeString(value)}`
        }
        if (typeof value === 'number'){
            string = string +`${encodeNumber(value)}`
        }
        if (Array.isArray(value)){
            string = string + encodeList(value)
        }
        if (typeof value === 'object' && value !== null && !Array.isArray(value) && typeof value !== 'function'){
            string = string + encodeObject(value)
        }
    } 
    string = string + 'e'
    return string
}

function encodeObject(obj: {[key:string]: string | number | BEncodeValue}){
    let string = ''
    for(const key in obj){
        const keyEncoded = encodeString(key)
        const value = obj[key]
        if (typeof value === 'string'){
            string += `${keyEncoded}${encodeString(value)}`
        }
        if (typeof value === 'number'){
            string += `${keyEncoded}${encodeNumber(value)}`
        }
        if (Array.isArray(value)){
            string += `${keyEncoded}${encodeList(value)}`
        }
        if (typeof value === 'object' && !Array.isArray(value) && typeof value !== 'function'){
            string += `${keyEncoded}${encodeObject(value)}`
        }
    }

    return `d${string}e`;
}

function getStringSubsets(str: string, hashLength: number = 40, convertToHex: boolean = true){
    let hashHex = convertToHex ? Buffer.from(str, 'latin1').toString('hex') : str
    let list = []
    while (hashHex.length > 0){
        const sub = hashHex.substring(0, hashLength)
        const rem = hashHex.substring(hashLength)
        if (!sub){
            list.push(hashHex)
            break
        }
        list.push(sub)
        hashHex = rem
    }
    return list
}

const args = process.argv;

function getDecodedAndInfoHash(filename: string){
    const decoded = parseTorrentFile(filename);
    if (!decoded['announce'] || !decoded['info']){
        throw new Error("Invalid encoded value")
    }
    const encodedInfo = encodeObject(decoded['info'])
    const hash = createHash('sha1').update(Buffer.from(encodedInfo, 'latin1')).digest('hex') 
    return {
        decodedTorrentFile: decoded,
        hash
    }
}

function decodedPeerMessage(buffer: Buffer){
    return{
        messageLength: buffer.readInt32BE(0),
        messageType: buffer.readIntBE(4, 1),
        payload: buffer.subarray(5)
    }
}

async function getPeers(hash:string, trackerUrl: string, left: string, peer_id: string){
    const info_hash_encoded = hash.match(/.{1,2}/g)?.map(byte => `%${byte}`).join('');

    const searchParams = new URLSearchParams({
        port: "6881",
        peer_id,
        uploaded: "0",
        downloaded: "0",
        left,
        compact: "1"
    })

    const requestRes = await fetch(`${trackerUrl}?${searchParams.toString()}&info_hash=${info_hash_encoded}`)
    const responseData = Buffer.from(await requestRes.arrayBuffer()).toString('latin1')
    const resObjDecoded = decodeBencode(responseData) as { peers: string }
    
    const ipsLatin1 = getStringSubsets(resObjDecoded['peers'], 6, false)
    const ipsWithPort = ipsLatin1.map((ip) => 
        // get the ip buffer no and join with .
        `${Array.from(Buffer.from(ip, 'latin1').subarray(0,4)).join('.')}:${Buffer.from(ip, 'latin1').readUint16BE(4)}`) // port number needs to use the two 16bytes
    return ipsWithPort
}

function makeHandshake(client: Socket, hash: string, message?: string){
    /// generate random 20 bytes for peer id
    const peer_id = randomBytes(20).toString('hex')

    const msg = message || Buffer.alloc(8).toString('hex')

    // length of protocol string
    let peerMessage = `${parseInt('19').toString(16)}${Buffer.from('BitTorrent protocol').toString('hex')}${msg}${hash}${peer_id}`

    client.write(new Uint8Array(Buffer.from(peerMessage, 'hex')))
}

if (args[2] === "decode") {
    try {
        const bencodedValue = args[3];
        const decoded = decodeBencode(bencodedValue);
        console.log(JSON.stringify(decoded));
    } catch (error) {
        console.error(error.message);
    }
}

if (args[2] === "info") {
    try {
        const fileName = args[3];
        const { decodedTorrentFile: decoded, hash } = getDecodedAndInfoHash(fileName)
        const pieceHashes = getStringSubsets(decoded['info']['pieces'])
        console.log(`Tracker URL: ${decoded['announce']} \nLength: ${decoded['info'].length} \nInfo Hash: ${hash} \nPiece Length: ${decoded['info']['piece length']} \nPiece Hashes: ${pieceHashes.join('\n')}`)
    } catch (error) {
        console.error(error.message);
    }
}

if (args[2] === "peers"){
    try {
        const fileName = args[3];

        const { decodedTorrentFile: decoded, hash } = getDecodedAndInfoHash(fileName)
        const baseUrl = decoded['announce']
        /// generate random 20 bytes for peer id
        const peer_id = randomBytes(10).toString('hex')

        const ipsWithPort = await getPeers(hash, decoded["announce"], decoded['info'].length.toString(), peer_id)

        ipsWithPort.forEach(e=> console.log(e))
    } catch (error) {
        console.error(error.message);
    } 
}

if (args[2] === "handshake"){
    try {
        const fileName = args[3];
        const [peerIp, port] = args[4].split(':')
        
        const { decodedTorrentFile: decoded, hash } = getDecodedAndInfoHash(fileName)

        const client = createConnection(parseInt(port), peerIp, function(){
            // console.log('Connected to peer');
        })

        console.log("reached here")
        
        makeHandshake(client, hash)

        client.on('data', function(data){
            const peerId = data.toString("hex", data.byteLength - 20);
            console.log("Peer ID:", peerId);
            client.end()
        })
        client.on('error', function(err){
            console.log("%s", err)
        })

        client.on("close", function () {
            // console.log('Connection closed');
        });

    } catch (error) {
        console.error(error.message);
    } 
}
  
if (args[2] === "download_piece"){
    const outputFile = args[4]
    const torrentFileName = args[5];
    const pieceToDownload = parseInt(args[6]);

    try {
        
        const { decodedTorrentFile: decoded, hash } = getDecodedAndInfoHash(torrentFileName)

        /// generate string of length 20 for peer id
        const peer_id1 = randomBytes(10).toString('hex')
        const ipsWithPort = await getPeers(hash, decoded["announce"], decoded['info'].length.toString(), peer_id1)
        
        const [peerIp, port] = ipsWithPort[0].split(':')
                
        const client = createConnection(parseInt(port), peerIp, function(){
            // console.log('Connected to peer');
        })
        
        makeHandshake(client, hash)

        client.once('data', function(data){
            const peerId = data.toString("hex", data.byteLength - 20);
            console.log("Peer ID:", peerId);

            // send interested message for the piece
            client.write(new Uint8Array(Buffer.from([0,0,0,1,2])));

            (function (){
                let fileData: Buffer[] = []
                const BYTE_LENGTH = 16 * 1024
                // hold cut off buffer Handle Partial Messages
                let buffer = Buffer.alloc(0);

                client.on('data', function(data){
                    // console.log("data entered")
                    buffer = Buffer.concat([new Uint8Array(buffer), new Uint8Array(data)]);
                    while (buffer.length >= 5) {
                        const messageLength = buffer.readInt32BE(0); // Read message length
                        const totalLength = 4 + messageLength; // Total length of the message
                        
                        if (buffer.length < totalLength) {
                            break; // Wait for more data
                        }
                        const msgBuffer = buffer.subarray(0, totalLength);
                        buffer = buffer.subarray(totalLength);
                        const message = decodedPeerMessage(msgBuffer)
                        const pieceLength  = Math.min((decoded.info['length'] - (pieceToDownload * decoded.info['piece length'])), decoded.info['piece length'])

                        // unchoke
                        if(message.messageType === 1){
                            let sendMessage = true
                            let currentPieceIndex = 0
                            while (sendMessage){
                                const remainingPayload = pieceLength - (currentPieceIndex * BYTE_LENGTH)
                                let payloadMessage: Buffer = Buffer.alloc(17)
                                //first part length of the message
                                payloadMessage.writeInt32BE(13, 0)
                                payloadMessage.writeInt8(6, 4) 
                                payloadMessage.writeInt32BE(pieceToDownload, 5)
                                payloadMessage.writeInt32BE(currentPieceIndex * BYTE_LENGTH, 9)
                                if (remainingPayload > BYTE_LENGTH){
                                    // go for bytelength
                                    payloadMessage.writeInt32BE(BYTE_LENGTH, 13)

                                } else {
                                    // go for the remainder of the bytes
                                    payloadMessage.writeInt32BE(Math.abs(remainingPayload === 0 ? BYTE_LENGTH : remainingPayload), 13)
                                    sendMessage = false
                                }
                                currentPieceIndex++
                                client.write(new Uint8Array(payloadMessage))
                            }
                        } else if (message.messageType === 5) {
                            console.log("Received bitfield message");
                        } else if(message.messageType === 7) {
                            const returnedPieceIndex = message.payload.readInt32BE(0)
                            const returnedPieceOffset = message.payload.readInt32BE(4)
                            fileData[returnedPieceOffset / BYTE_LENGTH] = message.payload.subarray(8)
                            const currentDownloaded = returnedPieceOffset + message.payload.subarray(8).length
                            if ( currentDownloaded === pieceLength){

                                //lets try to compare the piece hash
                                const pieceHashes = getStringSubsets(decoded['info']['pieces'])

                                const downloadhash = createHash('sha1').update(Buffer.concat(fileData)).digest('hex')

                                if (pieceHashes[pieceToDownload] === downloadhash){
                                    // piece is correctly downloaded and complete

                                    writeFileSync(outputFile, Buffer.concat(fileData));
                                }
                                process.exit(0);
                            }
                        } else {
                            //console.log(message.messageType)
                            /* console.log(data)
                            console.log('new ndata came in and is no tin message type 7 \n')
                            console.log(data.toString()) */
                        }
                    }
                })
            })()
        })

        
        client.on('error', function(err){
            console.log("%s", err)
        })

        client.on("close", function () {
            // console.log('Connection closed');
        });

    } catch (error) {
        console.error(error.message);
    } 
}

if (args[2] === "download"){
    const outputFile = args[4]
    const torrentFileName = args[5];

    try {
        
        const { decodedTorrentFile: decoded, hash } = getDecodedAndInfoHash(torrentFileName)

        const peer_id1 = randomBytes(10).toString('hex')
        const ipsWithPort = await getPeers(hash, decoded["announce"], decoded['info'].length.toString(), peer_id1)
        
        const [peerIp, port] = ipsWithPort[0].split(':')
                
        const client = createConnection(parseInt(port), peerIp, function(){
            // console.log('Connected to peer');
        })
        
        makeHandshake(client, hash)        
        
        client.once('data', function(data){
            const peerId = data.toString("hex", data.byteLength - 20);
            console.log("Peer ID:", peerId);

            // send interested message for the piece
            client.write(new Uint8Array(Buffer.from([0,0,0,1,2])));

            (function (){
                let fileData: Buffer[] = []
                const BYTE_LENGTH = 16 * 1024
                // hold cut off buffer Handle Partial Messages
                let buffer = Buffer.alloc(0);

                const pieceHashes = getStringSubsets(decoded['info']['pieces'])

                client.on('data', function(data){
                    // console.log("data entered")
                    buffer = Buffer.concat([buffer, data]);
                    while (buffer.length >= 5) {
                        const messageLength = buffer.readInt32BE(0); // Read message length
                        const totalLength = 4 + messageLength; // Total length of the message
                        
                        if (buffer.length < totalLength) {
                            break; // Wait for more data
                        }
                        const msgBuffer = buffer.subarray(0, totalLength);
                        buffer = buffer.subarray(totalLength);
                        const message = decodedPeerMessage(msgBuffer)
                        // unchoke
                        if(message.messageType === 1){
                            let currentPieceIndex = 0
                            let currentBlockIndex = 0

                            while (currentPieceIndex < pieceHashes.length){
                                const pieceLength  = Math.min((decoded.info['length'] - (currentPieceIndex * decoded.info['piece length'])), decoded.info['piece length'])

                                const remainingPayload = pieceLength - (currentBlockIndex * BYTE_LENGTH)
                                let payloadMessage: Buffer = Buffer.alloc(17)
                                //first part length of the message
                                payloadMessage.writeInt32BE(13, 0)
                                payloadMessage.writeInt8(6, 4) 
                                payloadMessage.writeInt32BE(currentPieceIndex, 5)
                                payloadMessage.writeInt32BE(currentBlockIndex * BYTE_LENGTH, 9)
                                if (remainingPayload > BYTE_LENGTH){
                                    // go for bytelength
                                    payloadMessage.writeInt32BE(BYTE_LENGTH, 13)
                                    currentBlockIndex++

                                } else {
                                    // go for the remainder of the bytes
                                    payloadMessage.writeInt32BE(Math.abs(remainingPayload === 0 ? BYTE_LENGTH : remainingPayload), 13)
                                    currentPieceIndex++
                                    currentBlockIndex = 0
                                }
                                client.write(payloadMessage)
                            }
                        } else if (message.messageType === 5) {
                            console.log("Received bitfield message");
                        } else if(message.messageType === 7) {
                            const returnedPieceIndex = message.payload.readInt32BE(0)
                            const returnedPieceOffset = message.payload.readInt32BE(4)
                            const currentDownloaded = (returnedPieceIndex * decoded.info['piece length']) + returnedPieceOffset + message.payload.subarray(8).length
                            fileData[Math.ceil(currentDownloaded / BYTE_LENGTH)-1] = message.payload.subarray(8)
                            if ( currentDownloaded === decoded.info['length']){
                                console.log("saving the file")

                                //lets try to compare the piece hash

                                // const downloadhash = createHash('sha1').update(Buffer.concat(fileData)).digest('hex')
                                writeFileSync(outputFile, Buffer.concat(fileData));

                                process.exit(0);
                            }
                        } else {
                            //console.log(message.messageType)
                            /* console.log(data)
                            console.log('new ndata came in and is no tin message type 7 \n')
                            console.log(data.toString()) */
                        }
                    }
                })
            })()
        })

        
        client.on('error', function(err){
            console.log("%s", err)
        })

        client.on("close", function () {
            // console.log('Connection closed');
        });

    } catch (error) {
        console.error(error.message);
    } 
}



if (args[2] === "magnet_parse"){
    try {
        const magnet_link = args[3];
        const magnetLinkParams = new URLSearchParams(magnet_link.substring(7))
        console.log(`Tracker URL: ${magnetLinkParams.get('tr')}`)
        console.log(`Info Hash: ${magnetLinkParams.get('xt')?.substring(magnetLinkParams.get('xt')?.lastIndexOf(":")! + 1)}`)
    } catch (error) {
        console.error(error.message);
    } 
}

if (args[2] === "magnet_handshake"){
    try {
        const magnet_link = args[3];
        const magnetLinkParams = new URLSearchParams(magnet_link.substring(7))
        const trackerUrl =  magnetLinkParams.get('tr')
        const hash = magnetLinkParams.get('xt')?.substring(magnetLinkParams.get('xt')?.lastIndexOf(":")! + 1)!
        if(trackerUrl){
            const peer_id = randomBytes(10).toString('hex')

            
            const ipsWithPort =  await getPeers(hash, trackerUrl, "16384", peer_id)
            const [peerIp, port] = ipsWithPort[0].split(':') 
            const extensionReservedBit = Buffer.alloc(8)
            extensionReservedBit.writeUInt8(16, 5)
            const client = createConnection(parseInt(port), peerIp, function(){
                // console.log('Connected to peer');
                
            })
            makeHandshake(client, hash, extensionReservedBit.toString('hex'))
            client.once('data', function(data){
                const peerId = data.toString("hex", 48, 68);
                console.log("Peer ID:", peerId);
                // the reserved bit is set
                const reservedBit = data[25]
                if(reservedBit === 16){
                    console.log("there is reserved bit")
                    // send the extension handshake
                    const msg = {
                        m: {
                            "ut_metadata": 10,
                            ut_pex: 2,
                        }
                    }
                    const payload = Buffer.from(encodeObject(msg))
                    const bitMsg = Buffer.concat([new Uint8Array(Buffer.from([20])), new Uint8Array(Buffer.from([0])), new Uint8Array(payload)])
                    const messageLen = Buffer.alloc(4)
                    messageLen.writeUInt32BE(bitMsg.length)
                    const extMsg = Buffer.concat([messageLen, bitMsg])
                    client.write(extMsg)
                    console.log("message sent")
                }
                (function(){
                    // hold cut off buffer Handle Partial Messages
                    let buffer = Buffer.alloc(0);
                    client.on('data', function(data){
                        // the peer id is within 48 and 68th byte
                        // data.subarray(48,68)
                        console.log("received extra data")
                        buffer = Buffer.concat([buffer, data]);
                        while (buffer.length >= 5) {
                            const messageLength = buffer.readInt32BE(0); // Read message length
                            const totalLength = 4 + messageLength; // Total length of the message
                            
                            if (buffer.length < totalLength) {
                                break; // Wait for more data
                            }
                            const msgBuffer = buffer.subarray(0, totalLength);
                            buffer = buffer.subarray(totalLength);
                            const message = decodedPeerMessage(msgBuffer) 
                            if (message.messageType === 5) {
                                console.log("Received bitfield message");
                            } else if (message.messageType === 20){
                                const extensionMetadataObj = decodeBencode(message.payload.subarray(1).toString('latin1'))
                                console.log(`Peer Metadata Extension ID: ${extensionMetadataObj['m']['ut_metadata']}`)
                                client.end()
                            }
                        }
                    })
                }()) 
            }) 
            
            client.on('error', function(err){
                console.log("%s", err)
            })
        }
    } catch (error) {
        console.error(error);
    } 
}
