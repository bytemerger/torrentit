import {readFileSync} from 'fs'
import {createHash} from 'crypto'
// Examples:
// - decodeBencode("5:hello") -> "hello"
// - decodeBencode("10:hello12345") -> "hello12345"
type BEncodeValue = string | number | Array<BEncodeValue> | { [key:string]: string | number | BEncodeValue } 
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
    let arrayBencodedString = value.substring(1, value.lastIndexOf('e'))
    const finalArrayBencode = []

    while (arrayBencodedString.length > 0){
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
        if(arrayBencodedString[0] === 'e'){
            arrayBencodedString = arrayBencodedString.substring(1) + 'e'
            // if there is a trailing e then bencode is not encoded properly
            if (arrayBencodedString.length < 2){
                throw new Error("Invalid encoded value")
            }
            break
        } 
    }

    return [finalArrayBencode, arrayBencodedString]
}

function decodeBencodeObject(value: string){
    //d3:foo3:bar5:helloi52ee
    let bencodedString = value.substring(1, value.lastIndexOf('e'));
    const finalObjectBencode: {
        [key:string]: string | number | BEncodeValue
    } = {}

    while (bencodedString.length > 0){
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
    return [finalObjectBencode, bencodedString]
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
    return decodeBencode(file) as {
        announce: string,
        info: {
            length: number,
            pieces: string,
            "piece length": number
        }
    }
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

function getHashes(str: string){
    let hashHex = Buffer.from(str, 'latin1').toString('hex')
    let list = []
    while (hashHex.length > 0){
        const sub = hashHex.substring(0, 40)
        const rem = hashHex.substring(40)
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
        const decoded = parseTorrentFile(fileName);
        if (!decoded['announce'] || !decoded['info']){
            throw new Error("Invalid encoded value")
        }
        const encodedInfo = encodeObject(decoded['info'])
        const pieceHashes = getHashes(decoded['info']['pieces'])
        const hash = createHash('sha1').update(Buffer.from(encodedInfo, 'latin1')).digest('hex')
        console.log(`Tracker URL: ${decoded['announce']} \nLength: ${decoded['info'].length} \nInfo Hash: ${hash} \nPiece Length: ${decoded['info']['piece length']} \nPiece Hashes: ${pieceHashes.join('\n')}`)
    } catch (error) {
        console.error(error.message);
    }
}
