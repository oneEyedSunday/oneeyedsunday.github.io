#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { promisify, format } = require('util')

const defaultOutputPath = path.join(__dirname, 'dump.csv')
const outPath = process.argv[3] ? path.resolve(process.argv[3]) : path.resolve(defaultOutputPath)
const entryCount = process.argv[2] ? Number(process.argv[2]) : 50000

console.info("Csv  generator for contacts")
console.log("Specify number of entries, default is 50k entries")
console.log(`Specify location to write file to, default is  ${defaultOutputPath}`)
console.log("Usage gen-csv.sh 200000 ~/files/dump.csv")


console.log(`Generating ${entryCount} entries and writing to ${outPath}`)


const seed = {
    first: ['Ali', 'Simbi', 'Chuks', 'Musa', 'Hegazi', 'Raymond', 'Sule', 'Samson', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Stefan', 'Kalus', 'Kitoshi'],
    second: ['Mikasa', 'Eren', 'Armin', 'Levi', '', '', '',, '', 'Luc', 'Oyebanjo', 'Dupont', 'Raymond', 'Clark', 'Stefan', '', '', 'Musatafa', 'Edmond', 'Tesfaye'],
    third: ['staten.island@michigan.co.uk', 'issa.sumnoni@example.co', 'alaye.monsuru@tidal.co', '', '', '', '', 'a@b', '', '', 'a@b.c', 'a@w.x', 'defo not an email', 'sssjsjsjs', 'stefan.@example.com', '', 'judith-reynolds@example.com', 'marisa.hilary@example.com', '', 'giorgios.karangianis@example.com', 'stefan.dupont@example.com', 'hilary.stevens@example.com', 'reynolds.mac@example.com', 'stephen.lee@example.com', 'retro-ziegler@example.com', 'stephen.henry@example.com', 'harry.kilmonger@mi6.co.uk', 'trelis.evans@co.uk', 'steven.lee@example.com', 'henry.gilarad@example.com', 'retro'],
    fourth: ['(+01) 200020202', '(+234) 700 1111 0000', '(+234) 890 0923 3456', '019203304', '00129201092', '8192202011', '91982290101', '020928281910', '0192822939381', '727211919191', '8828229300303', '91910222', '222922=290290029', '2782882-9292828', '(01) 902 3455', '09 7283 9921', '02 345 8904', '05 783 0234', '01 234 0023', '01 234 4234', '05 3920 0293', '01 2939 039393', '01 0293 93300', '01 2334 9948', '01 299304 0', 'sssshj', 'definitely nota phone number', 'eueuueeeyeyey'],
    fifth: Array(20).fill(0).map(() => Math.random().toString(36).replace(/[^a-z]+/g, '',).substr(0, 5))
}

console.log(outPath)
/**
 * @type {fs.WriteStream}
 */
let fHandle;




truncateFile(outPath)
.then(() => { fHandle = fs.createWriteStream(outPath, { flags: 'a' }); })
.then(() => appendToFile(fHandle, "first_row, second_row, thrid_row, fourth_row, fifth_row\n"))
.then(() => Promise.all(Array(entryCount).fill(0).map(() => {
    return appendToFile(fHandle, format("%s, %s, %s, %s, %s\n", ...getRow())).catch(err => {
        console.error('Failed to write: ', err.message)
    });
})))
.finally(() => fHandle.end())

/**
 * 
 * @returns {Array<string>}
 */
function getRow() {
    return Object.keys(seed).map(key => getRandomFromArray(seed[key]))
}

function getRandomFromArray(array = []) {
    return array[~~(Math.random() * array.length)]
}


/**
 * 
 * @param {string} filePath 
 * @returns 
 */
function truncateFile(filePath) {
    return promisify(fs.truncate)(filePath, 0);
}

/**
 * 
 * @param {fs.WriteStream} fileHandle
 * @param {Buffer | string} data 
 * @returns 
 */
function appendToFile(fileHandle, data) {
    return promisify(fileHandle.write.bind(fileHandle))(data);
}

