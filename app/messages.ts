import { Socket } from 'net'
import { decodeBencode, decodedPeerMessage, encodeObject, getStringSubsets } from './utils';
import { writeFileSync } from 'fs'
import { createHash } from 'crypto'
import type { DecodedFile, ExtensionMetadata, MetaInfo } from './types';

const BYTE_LENGTH = 16 * 1024

export function sendInterestedMessage(client: Socket){
    client.write(new Uint8Array(Buffer.from([0,0,0,1,2])));
    console.log("sent interested message")
}

export function handleMessages(client: Socket, commandType: string, trackerUrl?: string, torrentInfo?: DecodedFile['info'], outputFile?: string, pieceToDownload?: number){
    // To hold the downloaded file
    let fileData: Buffer[] = []
    // hold cut off buffer Handle Partial Messages
    let buffer = Buffer.alloc(0);

    // the peerExtension id from ut_metadata received
    let peerExtensionMessageId: number | undefined

    client.on('data', function(data){
        buffer = Buffer.concat([new Uint8Array(buffer), new Uint8Array(data)]);

        if ( buffer[0] === 19 && buffer.subarray(1, 20).toString() === "BitTorrent protocol") {
            const peerId = data.toString("hex", 48, 68);
            console.log("Peer ID:", peerId);
            if (commandType === 'handshake') {
                // end early
                client.end()
                process.exit(0)
            }
            
            // process extra mostly the case after magnetic link handshake to peerextensionId
            buffer = data.subarray(68)
            // the reserved bit is set
            const reservedBit = data[25]
            if (reservedBit === 16) {
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
                messageLen.writeUInt32BE(bitMsg.byteLength)
                const extMsg = Buffer.concat([new Uint8Array(messageLen), new Uint8Array(bitMsg)])
                client.write(new Uint8Array(extMsg))
                console.log("message sent")   
            }
        }
        
        while (buffer.length >= 4) {
            const messageLength = buffer.readInt32BE(0); // Read message length
            const totalLength = 4 + messageLength; // Total length of the message
            
            if (buffer.length < totalLength) {
                break; // Wait for more data
            }
            const msgBuffer = buffer.subarray(0, totalLength);
            buffer = buffer.subarray(totalLength);
            const message = decodedPeerMessage(msgBuffer)

            if (messageLength === 0) {
                // Keep-alive message
                continue;
            } else if (message.messageType === 1){
                if(torrentInfo){
                    const pieceHashes = getStringSubsets(torrentInfo['pieces'])
                    if (commandType === 'download_piece' || commandType === 'magnet_download_piece'){
                        sendRequestPieceDownloadMessage(client, torrentInfo, pieceToDownload || 0)    
                    }
                    if(commandType === 'download' || commandType === 'magnet_download'){
                        sendRequestDownloadMessage(client, torrentInfo, pieceHashes.length)
                    }
                }
            } else if (message.messageType === 5) {
                console.log("Received bitfield message");
            } else if(message.messageType === 7) {
                if(torrentInfo && outputFile){
                    if (commandType === 'download_piece' || commandType === 'magnet_download_piece'){
                        receivePieceDownloadMessage(message.payload, torrentInfo, pieceToDownload || 0, fileData, outputFile)    
                    }
                    if(commandType === 'download' || commandType === 'magnet_download'){
                        receiveDownloadMessage(message.payload, torrentInfo, fileData, outputFile)
                    }
                } 
            } else if (message.messageType === 20){
                if (peerExtensionMessageId){
                    const fullContent = message.payload.subarray(1)
                    const metaPieceInfo: MetaInfo = decodeBencode(fullContent.toString('latin1')) as MetaInfo
                    const pieceContentBencode = fullContent.subarray(fullContent.length - metaPieceInfo['total_size']).toString('latin1')
                    torrentInfo =  decodeBencode(pieceContentBencode) as DecodedFile['info']

                    const hash = createHash('sha1').update(new Uint8Array(Buffer.from(pieceContentBencode, 'latin1'))).digest('hex')
                    const pieceHashes = getStringSubsets(torrentInfo['pieces'])
                    console.log(`Tracker URL: ${trackerUrl} \nLength: ${torrentInfo['length']} \nInfo Hash: ${hash} \nPiece Length: ${torrentInfo['piece length']} \nPiece Hashes: ${pieceHashes.join('\n')}`) 
                    if (commandType === 'magnet_info'){
                        client.end()
                        process.exit(0)
                    }
                    //send intrested message
                    client.write(new Uint8Array(Buffer.from([0,0,0,1,2])));
                    console.log('sent intreseted message')
                    //client.end()
                } else {
                    const extensionMetadataObj: ExtensionMetadata = decodeBencode(message.payload.subarray(1).toString('latin1')) as ExtensionMetadata
                    console.log(extensionMetadataObj)
                    peerExtensionMessageId =  extensionMetadataObj['m']['ut_metadata']
                    if (commandType === 'magnet_handshake'){
                        console.log(`Peer Metadata Extension ID: ${peerExtensionMessageId}`)
                        client.end()
                        process.exit(0)
                    }
                    // send the meta data request message
                    const msg = {'msg_type': 0, 'piece': 0}
                    const payloadExt = Buffer.from(encodeObject(msg))
                    const bitMsgExt = Buffer.concat([new Uint8Array(Buffer.from([20])), new Uint8Array(Buffer.from([peerExtensionMessageId || 0])), new Uint8Array(payloadExt)])
                    const messageLen = Buffer.alloc(4)
                    messageLen.writeUInt32BE(bitMsgExt.byteLength) 
                    const fullMsg = Buffer.concat([new Uint8Array(messageLen), new Uint8Array(bitMsgExt)])
                    client.write(new Uint8Array(fullMsg))
                }
            }  else {
                //console.log(message.messageType)
                /* console.log(data)
                console.log('new ndata came in and is no tin message type 7 \n')
                console.log(data.toString()) */
            }
            

    
        }
    })
    client.on('error', function(err){
        console.log("%s", err)
    })

    client.on("close", function () {
        // console.log('Connection closed');
    });
}
function sendRequestPieceDownloadMessage(client: Socket, torrentInfo: DecodedFile['info'], pieceToDownload: number){
    const pieceLength  = Math.min((torrentInfo['length'] - (pieceToDownload * torrentInfo['piece length'])), torrentInfo['piece length'])

    let sendMessage = true
    // index of the block in this piece
    let currentBlockIndex = 0
    while (sendMessage){
        const remainingPayload = pieceLength - (currentBlockIndex * BYTE_LENGTH)
        let payloadMessage: Buffer = Buffer.alloc(17)
        //first part length of the message
        payloadMessage.writeInt32BE(13, 0)
        payloadMessage.writeInt8(6, 4) 
        payloadMessage.writeInt32BE(pieceToDownload, 5)
        payloadMessage.writeInt32BE(currentBlockIndex * BYTE_LENGTH, 9)
        if (remainingPayload > BYTE_LENGTH){
            // go for BYTE_LENGTH
            payloadMessage.writeInt32BE(BYTE_LENGTH, 13)

        } else {
            // go for the remainder of the bytes
            payloadMessage.writeInt32BE(Math.abs(remainingPayload === 0 ? BYTE_LENGTH : remainingPayload), 13)
            sendMessage = false
        }
        currentBlockIndex++
        client.write(new Uint8Array(payloadMessage))
    } 
}

function sendRequestDownloadMessage(client: Socket, torrentInfo: DecodedFile['info'], pieceLength: number){
    let currentPieceIndex = 0
    let currentBlockIndex = 0

    while (currentPieceIndex < pieceLength){
        const pieceLength  = Math.min((torrentInfo['length'] - (currentPieceIndex * torrentInfo['piece length'])), torrentInfo['piece length'])

        const remainingPayload = pieceLength - (currentBlockIndex * BYTE_LENGTH)
        let payloadMessage: Buffer = Buffer.alloc(17)
        //first part length of the message
        payloadMessage.writeInt32BE(13, 0)
        payloadMessage.writeInt8(6, 4) 
        payloadMessage.writeInt32BE(currentPieceIndex, 5)
        payloadMessage.writeInt32BE(currentBlockIndex * BYTE_LENGTH, 9)
        if (remainingPayload > BYTE_LENGTH){
            // go for BYTE_LENGTH
            payloadMessage.writeInt32BE(BYTE_LENGTH, 13)
            currentBlockIndex++

        } else {
            // go for the remainder of the bytes
            payloadMessage.writeInt32BE(Math.abs(remainingPayload === 0 ? BYTE_LENGTH : remainingPayload), 13)
            currentPieceIndex++
            currentBlockIndex = 0
        }
        client.write(new Uint8Array(payloadMessage))
    }
}

function receivePieceDownloadMessage(payload: Buffer, torrentInfo: DecodedFile['info'], pieceToDownload:number, saveFile: Buffer[], outputFile: string ){
    const pieceLength  = Math.min((torrentInfo['length'] - (pieceToDownload * torrentInfo['piece length'])), torrentInfo['piece length'])
    const returnedPieceIndex = payload.readInt32BE(0)
    const returnedPieceOffset = payload.readInt32BE(4)
    saveFile[returnedPieceOffset / BYTE_LENGTH] = payload.subarray(8)
    const currentDownloaded = returnedPieceOffset + payload.subarray(8).length
    console.log(currentDownloaded)
    if ( currentDownloaded === pieceLength){

        //lets try to compare the piece hash
        const pieceHashes = getStringSubsets(torrentInfo['pieces'])

        const finalBuf = Buffer.concat(saveFile as unknown as Uint8Array[])
        const downloadhash = createHash('sha1').update(new Uint8Array(finalBuf)).digest('hex')

        if (pieceHashes[pieceToDownload] === downloadhash){
            // piece is correctly downloaded and complete

            writeFileSync(outputFile, new Uint8Array(finalBuf));
        }
        process.exit(0);
    } 
}

function receiveDownloadMessage(payload: Buffer, torrentInfo: DecodedFile['info'], saveFile: Buffer[], outputFile: string){
    const returnedPieceIndex = payload.readInt32BE(0)
    const returnedPieceOffset = payload.readInt32BE(4)
    const currentDownloaded = (returnedPieceIndex * torrentInfo['piece length']) + returnedPieceOffset + payload.subarray(8).length
    saveFile[Math.ceil(currentDownloaded / BYTE_LENGTH)-1] = payload.subarray(8)
    if ( currentDownloaded === torrentInfo['length']){
        console.log("saving the file")

        //lets try to compare the piece hash

        // const downloadhash = createHash('sha1').update(Buffer.concat(fileData)).digest('hex')
        writeFileSync(outputFile, new Uint8Array(Buffer.concat(saveFile as unknown as Uint8Array[])));

        process.exit(0);
    }
}