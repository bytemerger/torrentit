export type BEncodeValue = string | number | Array<BEncodeValue> | { [key:string]: string | number | BEncodeValue } 
export type DecodedFile = {
    announce: string,
    info: {
        length: number,
        pieces: string,
        "piece length": number
    }
}
export type MetaInfo = {
    msg_type: number, 
    piece: 0, 
    total_size: number
}

export type ExtensionMetadata = {
    m:{
        'ut_metadata': number
    }
}