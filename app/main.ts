import {createConnection, Socket} from 'net'
import { decodeBencode, getDecodedTorrentFileAndInfoHash, getPeers, getStringSubsets, makeHandshake } from './utils';
import { handleMessages, sendInterestedMessage } from './messages';

const args = process.argv;

if (args[2] === "decode") {
    try {
        const bencodedValue = args[3];
        const decoded = decodeBencode(bencodedValue);
        console.log(JSON.stringify(decoded));
    } catch (error) {
        console.error((error as { message: string }).message);
    }
}

if (args[2] === "info") {
    try {
        const fileName = args[3];
        const { decodedTorrentFile: decoded, hash } = getDecodedTorrentFileAndInfoHash(fileName)
        const pieceHashes = getStringSubsets(decoded['info']['pieces'])
        console.log(`Tracker URL: ${decoded['announce']} \nLength: ${decoded['info'].length} \nInfo Hash: ${hash} \nPiece Length: ${decoded['info']['piece length']} \nPiece Hashes: ${pieceHashes.join('\n')}`)
    } catch (error) {
        console.error((error as { message: string }).message);
    }
}

if (args[2] === "peers"){
    try {
        const fileName = args[3];

        const { decodedTorrentFile: decoded, hash } = getDecodedTorrentFileAndInfoHash(fileName)
        const ipsWithPort = await getPeers(hash, decoded["announce"], decoded['info'].length.toString())

        ipsWithPort.forEach(e=> console.log(e))
    } catch (error) {
        console.error((error as { message: string }).message);
    } 
}

if (args[2] === "handshake"){
    try {
        const fileName = args[3];
        const [peerIp, port] = args[4].split(':')
        
        const { decodedTorrentFile: decoded, hash } = getDecodedTorrentFileAndInfoHash(fileName)

        const client = createConnection(parseInt(port), peerIp, function(){
            // console.log('Connected to peer');
            makeHandshake(client, hash)
            handleMessages(client, args[2])
        })

    } catch (error) {
        console.error((error as { message: string }).message);
    } 
}
  
if (args[2] === "download_piece"){
    const outputFile = args[4]
    const torrentFileName = args[5];
    const pieceToDownload = parseInt(args[6]);

    try {
        const { decodedTorrentFile: decoded, hash } = getDecodedTorrentFileAndInfoHash(torrentFileName)
        
        const ipsWithPort = await getPeers(hash, decoded["announce"], decoded['info'].length.toString())
        
        const [peerIp, port] = ipsWithPort[0].split(':')
                
        const client = createConnection(parseInt(port), peerIp, function(){
            // console.log('Connected to peer');
            makeHandshake(client, hash)
            sendInterestedMessage(client)
            handleMessages(client, args[2], decoded['announce'], decoded['info'], outputFile, pieceToDownload)
        })
        
    } catch (error) {
        console.error((error as { message: string }).message);
    } 
}

if (args[2] === "download"){
    const outputFile = args[4]
    const torrentFileName = args[5];

    try {
        const { decodedTorrentFile: decoded, hash } = getDecodedTorrentFileAndInfoHash(torrentFileName)

        const ipsWithPort = await getPeers(hash, decoded["announce"], decoded['info'].length.toString())
        
        const [peerIp, port] = ipsWithPort[0].split(':')
                
        const client = createConnection(parseInt(port), peerIp, function(){
            // console.log('Connected to peer');
            makeHandshake(client, hash)
            sendInterestedMessage(client)
            handleMessages(client, args[2], decoded['announce'], decoded['info'], outputFile)
        })

    } catch (error) {
        console.error((error as { message: string }).message);
    } 
}


if (args[2] === "magnet_parse"){
    try {
        const magnet_link = args[3];
        const magnetLinkParams = new URLSearchParams(magnet_link.substring(7))
        console.log(`Tracker URL: ${magnetLinkParams.get('tr')}`)
        console.log(`Info Hash: ${magnetLinkParams.get('xt')?.substring(magnetLinkParams.get('xt')?.lastIndexOf(":")! + 1)}`)
    } catch (error) {
        console.error((error as { message: string }).message);
    } 
}

if (args[2] === "magnet_handshake"){
    try {
        const magnet_link = args[3];
        const magnetLinkParams = new URLSearchParams(magnet_link.substring(7))
        const trackerUrl =  magnetLinkParams.get('tr')
        const hash = magnetLinkParams.get('xt')?.substring(magnetLinkParams.get('xt')?.lastIndexOf(":")! + 1)!
        if(trackerUrl){
            const ipsWithPort =  await getPeers(hash, trackerUrl, "999")
            const [peerIp, port] = ipsWithPort[0].split(':') 
            const extensionReservedBit = Buffer.alloc(8)
            extensionReservedBit.writeUInt8(16, 5)
            const client = createConnection(parseInt(port), peerIp, function(){
                // console.log('Connected to peer');
                makeHandshake(client, hash, extensionReservedBit.toString('hex'))
                handleMessages(client, args[2], trackerUrl)
            })
        }
    } catch (error) {
        console.error(error);
    } 
}

if (args[2] === "magnet_info"){
    try {
        const magnet_link = args[3];
        const magnetLinkParams = new URLSearchParams(magnet_link.substring(7))
        const trackerUrl =  magnetLinkParams.get('tr')
        const hash = magnetLinkParams.get('xt')?.substring(magnetLinkParams.get('xt')?.lastIndexOf(":")! + 1)!
        if(trackerUrl){
            const ipsWithPort =  await getPeers(hash, trackerUrl, "999")
            const [peerIp, port] = ipsWithPort[0].split(':') 
            const extensionReservedBit = Buffer.alloc(8)
            extensionReservedBit.writeUInt8(16, 5)
            const client = createConnection(parseInt(port), peerIp, function(){
                // console.log('Connected to peer');
                makeHandshake(client, hash, extensionReservedBit.toString('hex'))
                handleMessages(client, args[2], trackerUrl)
            })
        }
    } catch (error) {
        console.error(error);
    } 
}

if (args[2] === "magnet_download_piece"){
    try {
        const magnet_link = args[5];
        const outputFile = args[4]
        const pieceToDownload = parseInt(args[6]);

        const magnetLinkParams = new URLSearchParams(magnet_link.substring(7))
        const trackerUrl =  magnetLinkParams.get('tr')
        const hash = magnetLinkParams.get('xt')?.substring(magnetLinkParams.get('xt')?.lastIndexOf(":")! + 1)!
        if(trackerUrl){
            const ipsWithPort =  await getPeers(hash, trackerUrl, "999")
            const [peerIp, port] = ipsWithPort[0].split(':') 
            const extensionReservedBit = Buffer.alloc(8)
            extensionReservedBit.writeUInt8(16, 5)
            const client = createConnection(parseInt(port), peerIp, function(){
                // console.log('Connected to peer');
                makeHandshake(client, hash, extensionReservedBit.toString('hex'))
                handleMessages(client, args[2], trackerUrl, undefined, outputFile, pieceToDownload)
            })
        }
    } catch (error) {
        console.error(error);
    } 
}