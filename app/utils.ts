
import { readFileSync } from 'fs'
import {createHash, randomBytes} from 'crypto'
import { Socket } from 'net'
import type { BEncodeValue, DecodedFile } from './types';

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
export function decodeBencode(bencodedValue: string): BEncodeValue {
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
    
    throw new Error("Invalid Bencode string");
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

export function encodeObject(obj: {[key:string]: string | number | BEncodeValue}){
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

export function getDecodedTorrentFileAndInfoHash(filename: string){
    const decoded = parseTorrentFile(filename);
    if (!decoded['announce'] || !decoded['info']){
        throw new Error("Invalid encoded value")
    }
    const hash = getTorrentInfoHash(decoded['info'])
    return {
        decodedTorrentFile: decoded,
        hash
    }
}

export function getTorrentInfoHash(torrentInfo: DecodedFile['info']){
    const encodedInfo = encodeObject(torrentInfo)
    return createHash('sha1').update(new Uint8Array(Buffer.from(encodedInfo, 'latin1'))).digest('hex')
}

export function getStringSubsets(str: string, hashLength: number = 40, convertToHex: boolean = true){
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

export async function getPeers(hash:string, trackerUrl: string, left: string){
    const info_hash_encoded = hash.match(/.{1,2}/g)?.map(byte => `%${byte}`).join('');

    /// generate string of length 20 for peer id
    const peer_id = randomBytes(10).toString('hex')

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

export function makeHandshake(client: Socket, hash: string, message?: string){
    /// generate random 20 bytes for peer id
    const peer_id = randomBytes(20).toString('hex')

    const msg = message || Buffer.alloc(8).toString('hex')

    // length of protocol string
    let peerMessage = `${parseInt('19').toString(16)}${Buffer.from('BitTorrent protocol').toString('hex')}${msg}${hash}${peer_id}`

    client.write(new Uint8Array(Buffer.from(peerMessage, 'hex')))
}

export function decodedPeerMessage(buffer: Buffer){
    return{
        messageLength: buffer.readInt32BE(0),
        messageType: buffer.readIntBE(4, 1),
        payload: buffer.subarray(5)
    }
}

export function decodeMagnetLink(link: string){
    const magnetLinkParams = new URLSearchParams(link.substring(7))
    const trackerUrl =  magnetLinkParams.get('tr')
    const hash = magnetLinkParams.get('xt')?.substring(magnetLinkParams.get('xt')?.lastIndexOf(":")! + 1)!
    return {
        hash, trackerUrl
    }
}