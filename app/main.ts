// Examples:
// - decodeBencode("5:hello") -> "hello"
// - decodeBencode("10:hello12345") -> "hello12345"
function decodeBencodeString(value: string): [string, string] {
    const stringLength = parseInt(value[0])
    if (isNaN(stringLength)) {
        throw new Error("Invalid encoded value")
    }  
    const firstColonIndex = value.indexOf(":");
    if (firstColonIndex === -1) {
        throw new Error("Invalid encoded value");
    }
    return [value.substring(firstColonIndex + 1, firstColonIndex + stringLength + 1), value.substring(firstColonIndex + stringLength + 1)];
}

function decondeBencondeInt(value: string) : [number, string]{
    return [parseInt(value.substring(1, value.indexOf('e'))), value.substring( value.indexOf('e') + 1)] 
}

function decodeBencode(bencodedValue: string): string | number | (string | number)[] {
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
