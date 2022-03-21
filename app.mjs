import axios from "axios";
import * as fs from 'fs';
import express from 'express';
import tf, {linalg, log} from '@tensorflow/tfjs-node';
//import * as canvas from 'canvas';
import * as faceapi from '@vladmandic/face-api';
import dateFormat, {masks} from "dateformat";
import pino from 'pino'
import expressPino from 'express-pino-logger'

const logger = pino(
    {
        level: process.env.LOG_LEVEL || 'debug',
        prettyPrint: {
            colorize: true,
            levelFirst: true,
            translateTime: "yyyy-dd-mm, h:MM:ss TT",
        },
    },
    pino.destination("./pino-logger.log")
);
const expressLogger = expressPino({logger})
const app = express()

const PORT = 3000


await faceapi.nets.ssdMobilenetv1.loadFromDisk('./models')
await faceapi.nets.faceLandmark68Net.loadFromDisk('./models')
await faceapi.nets.faceRecognitionNet.loadFromDisk('./models')
//const {Canvas, Image, ImageData} = canvas
//faceapi.env.monkeyPatch({ Image, ImageData})


app.listen(PORT, () => {
    logger.info(`App is listening on port` + PORT)
})
app.use(expressLogger)


const instance = axios.create({
    baseURL: 'https://api-mh.ertelecom.ru/rest/v1/',
    headers: {
        authorization: 'Bearer yw7829r9qinkit2wabpkcpvq82n88a'
    },
    responseType: 'stream'
})


async function image(file) {
    const decoded = tf.node.decodeImage(file);
    //const decoded = tf.node.decodeJpeg(file)
    const casted = decoded.toFloat();
    const result = casted.expandDims(0);
    decoded.dispose();
    casted.dispose();
    return result;
}

const getDescriptors = async (proceedImage, name = 'Неизвестный человек') => {
    let descriptors = [];
    const results = await faceapi
        .detectAllFaces(proceedImage)
        .withFaceLandmarks()
        .withFaceDescriptors()
    if (!results.length) {
        return
    }
    results.forEach(res => {
        descriptors.push({
            labeledDescriptor: new faceapi.LabeledFaceDescriptors(name, [res.descriptor]),
            descriptors: res.descriptor
        })
    })
    return descriptors
}
const getControlDescriptors = async (dirName) => {
    let photoList = fs.readdirSync(dirName, {withFileTypes: 'jpeg'});
    let proceedPhotos = []
    let descriptors = []

    for (let photo of photoList) {
        proceedPhotos.push({
            photo: await image(fs.readFileSync(dirName + photo.name)),
            name: photo.name.split('.')[0]
        })
    }
    for (let photo of proceedPhotos) {
        descriptors.push(await getDescriptors(photo.photo, photo.name))
    }
    return descriptors.map(d => d[0].labeledDescriptor)
}

let controlDescriptors = await getControlDescriptors('./photos/');
const faceMatcher = new faceapi.FaceMatcher(controlDescriptors)

let Door = new class {
    isOpen = false

    openDoor() {
        instance.post('places/5626227/accesscontrols/63309/actions', {"name": "accessControlOpen"}).then(res => {
            if (res.status === 200) {
                logger.info('Дверь открыта')
            }
        })
    }

    closeDoor() {
        this.isOpen = false
    }
}

// const openDoorByFace = () => {
//     instance.get('places/5626227/accesscontrols/63309/videosnapshots').then(async res => {
//         console.log(res.status)
//     //     let photoName = dateFormat(new Date(), 'HH-MM-ss_dd-mm-yyyy')
//         //let stream = fs.createWriteStream(`./visitors/${photoName}.jpeg`)
//         let stream = []
//          res.data.pipe(stream)
//         stream.on('finish', async () => {
//             let visitor = await getDescriptors(await image(fs.readFileSync(stream.path)),`visitor_`+photoName)
//             //let visitor = await getDescriptors(await image(fs.readFileSync('./test1.jpeg')), `visitor_` + photoName)
//             if (visitor) {
//                 const bestMatch = faceMatcher.findBestMatch(visitor[0].descriptors)
//                 console.log(bestMatch.toString().split(' ')[0])
//                 if (bestMatch.toString().split(' ')[0] !== 'unknown' && !Door.isOpen) {
//                     Door.openDoor()
//                     Door.isOpen = true
//                     setTimeout(Door.closeDoor.bind(Door),5000)
//                     fs.rename(stream.path, stream.path + '_' + bestMatch._label + '.jpeg', () => {
//                     })
//                 }
//                 else if(bestMatch.toString().split(' ')[0] === 'unknown'){
//                     console.log('zahel')
//                     fs.unlink(stream.path, () => {})
//                 }
//             }
//             else {
//                 fs.unlink(stream.path, () => {})
//             }
//         })
//      })
//  }
const openDoorByFace = () => {
    try {
        instance.get('places/5626227/accesscontrols/63309/videosnapshots').then(async res => {
            let photoName = dateFormat(new Date(), 'HH-MM-ss_dd-mm-yyyy')
            let stream = fs.createWriteStream(`./visitors/${photoName}.jpeg`)
            res.data.pipe(stream)
            stream.on('finish', async () => {
                let visitor = await getDescriptors(await image(fs.readFileSync(stream.path)), `visitor_` + photoName)
                //let visitor = await getDescriptors(await image(fs.readFileSync('./test1.jpeg')), `visitor_` + photoName)
                if (visitor) {
                    const bestMatch = faceMatcher.findBestMatch(visitor[0].descriptors)
                    logger.info(`${bestMatch.toString().split(' ')[0]}`)
                    if (bestMatch.toString().split(' ')[0] !== 'unknown' && !Door.isOpen) {
                        Door.openDoor()
                        Door.isOpen = true
                        setTimeout(Door.closeDoor.bind(Door), 5000)
                        fs.rename(stream.path, stream.path + '_' + bestMatch._label + '.jpeg', () => {
                        })
                    } else if (bestMatch.toString().split(' ')[0] === 'unknown') {
                        fs.unlink(stream.path, () => {
                        })
                    }
                } else {
                    fs.unlink(stream.path, () => {
                    })
                }
            })
        })
    }
    catch(err){
       logger.info(`${err}`)
    }
}

setInterval(openDoorByFace, 1000)