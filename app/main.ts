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

const args = process.argv;
const bencodedValue = args[3];

if (args[2] === "decode") {
    try {
        const decoded = decodeBencode(bencodedValue);
        console.log(JSON.stringify(decoded));
    } catch (error) {
        console.error(error.message);
    }
}
