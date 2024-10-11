// Examples:
// - decodeBencode("5:hello") -> "hello"
// - decodeBencode("10:hello12345") -> "hello12345"
type BEncodeValue = string | number | Array<BEncodeValue>
function decodeBencodeString(value: string): [string, string] { 
    const firstColonIndex = value.indexOf(":");
    if (firstColonIndex === -1) {
        throw new Error("Invalid encoded value");
    }
    const stringLength = parseInt(value.substring(0, firstColonIndex))
    if (isNaN(stringLength)) {
        throw new Error("Invalid encoded value")
    } 
    console.log(stringLength, firstColonIndex)
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
        if(arrayBencodedString[0] === 'e'){
            break
        }
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

    return [finalArrayBencode, arrayBencodedString]
}
function decodeBencode(bencodedValue: string): BEncodeValue {
    /* This function is used to decode a bencoded string
    The bencoded string is a string that is prefixed by the length of the string
    **/

    // Check if the first character is a digit
    if (!isNaN(parseInt(bencodedValue[0]))) {
        const [value, _] = decodeBencodeString(bencodedValue)
        console.log(value)
        return value
    } 
    if (bencodedValue[0] === 'i'){
        const [value, _] = decondeBencondeInt(bencodedValue)
        return value
    } else if (bencodedValue[0] === 'l') {
        let arrayBencodedString = bencodedValue.substring(1, bencodedValue.lastIndexOf('e'))
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
                if(restString[0] === 'e'){
                    restString = restString.substring(1) + 'e'
                }
                arrayBencodedString = restString
            }
        }
        return finalArrayBencode 

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
