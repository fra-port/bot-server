const Telegraf = require('telegraf')
const Telegram = require('telegraf/telegram')
const axios = require('axios')
const fs = require('fs')
const emoji = require('node-emoji')
const CronJob = require('cron').CronJob
require('dotenv').config()

const vision = require('@google-cloud/vision')
const storage = require('@google-cloud/storage')

const bot = new Telegraf(process.env.BOT_TOKEN)
const telegram = new Telegram(process.env.BOT_TOKEN, {})

const client = new vision.ImageAnnotatorClient({
  projectId: process.env.PROJECT_ID,
  keyFilename: process.env.KEYFILE
})

const gcs = new storage.Storage({
  projectId: process.env.PROJECT_ID,
  keyFilename: process.env.KEYFILE
})
const bucket = gcs.bucket(process.env.BUCKET_NAME)

const server = process.env.SERVER

new CronJob('0 30 18 * * *', () => {
  axios.get(`${server}/users`)
    .then(response => {
      response.data.data.forEach(user => {
        telegram.sendMessage(user.idTelegram, `${emoji.get('fire')} Jangan lupa untuk mengirimkan report harian anda! ${emoji.get('fire')}`)
      })
    })
    .catch(err => {
      console.log('Failed to get users data')
    })
}, null, true, 'Asia/Jakarta')

async function checkUser(id) {
  let a = await axios.get(`${server}/users/one/${id}`)
                  .then(response => {
                    return true
                  })
                  .catch(err => {
                    return false
                  })
}

function downloadImage(img, reply, userId) {
  img.pipe(fs.createWriteStream('test.jpg'))
    .on('error', (err) => console.log(err))
    .on('finish', () => uploadImage(reply, userId))
}

function uploadImage(reply, userId) {
  const localReadStream = fs.createReadStream('test.jpg');
  const fileName = String(Date.now())
  const remoteWriteStream = bucket.file(fileName + '.jpg').createWriteStream();
  
  localReadStream.pipe(remoteWriteStream)
    .on('error', function(err) {})
    .on('finish', function() {
      getText(reply, fileName, userId)
    });
}

function getText(reply, fileName, userId) {
  client
    .documentTextDetection(`gs://${process.env.BUCKET_NAME}/${fileName}.jpg`)
      .then(results => {
        const text = results[0].fullTextAnnotation.text
        const splitted = text.split('\n')

        let hasil = []

        splitted.forEach(split => {
          if (split[0]) {
            let data = split.split(' ')

            if (data[0] === 'Paha' || data[0] === 'paha' || data[0] === 'PAHA') {
              let obj = {
                itemName: data[0] + ' ' + data[1],
                quantity: Number(data[2]),
                Total: Number(data[3].split('.').join(''))
              }

              hasil.push(obj)
            } else {
              let obj = {
                itemName: data[0],
                quantity: Number(data[1]),
                Total: Number(data[2].split('.').join(''))
              }

              hasil.push(obj)
            }
          }
         })

         isAlreadyReport(userId, hasil, reply)
      })
      .catch(err => {
        reply(`Gagal menyimpan report! Pastikan format sesuai dengan foto di bawah ${emoji.get('cry')}`)
        telegram.sendPhoto(userId, { source: './format.jpg' })
          .then(() => {
            reply('Gunakan applikasi note pada Gadget anda untuk membuat report!')
          })
      })
}

async function isAlreadyReport(userId, hasil, reply) {
  let a = await axios.get(`${server}/selling/today/${userId}`)
                  .then(response => {
                    if (response.data.result) {
                      reply(`Anda telah melakukan report di hari ini! ${emoji.get('+1')}`)                      
                    } else {
                        axios.post(`${server}/selling`, { idTelegram: userId, item: hasil })
                          .then(() => {
                            reply(`Report tersimpan! Terima kasih telah mengirimkan report hari ini ${emoji.get('+1')}`)
                          })
                          .catch(err => {
                            console.log(err)
                          })
                    }
                  })
                  .catch(err => {
                    console.log(err)
                  })
}

bot.start((ctx) => {
  ctx.reply('Selamat datang di applikasi FraAport! Ketik /help untuk bantuan, pastikan anda telah terdaftar sebagai agent kami!')
})

bot.help((ctx) => {
  ctx.reply(`
    ------------------- List Perintah -------------------
    /help Melihat list perintah yang tersedia
    /myId Melihat user id anda
    /harga Melihat harga menu
  `)
})

bot.on('photo', ({message, reply}) => {
  let userId = message.from.id

  if (checkUser(userId)) {
    reply(`${emoji.get('oncoming_automobile')} Sedang menyimpan report....... ${emoji.get('oncoming_automobile')}`)

    telegram.getFileLink(message.photo.pop().file_id)
      .then(async (link) => {
        let image = await axios.get(link, { responseType:"stream" })
                      .then(data => {
                        const img = data.data
                        downloadImage(img, reply, userId)
                      })
      })
      .catch(error => {
        console.log(err)
      })
  } else {
    reply(`${emoji.get('x')} Anda belum terdaftar! Silahkan hubungi admin!`)
  }
})

bot.command('myId', (ctx) => {
  ctx.reply(`${emoji.get('id')}: ${ctx.from.id}`)
})

bot.command('harga', (ctx) => {
  ctx.reply('Daftar Harga')

  axios.get(`${server}/items`)
    .then(response => {
      response.data.result.forEach(menu => {
        ctx.reply(`${menu.itemName} Rp. ${menu.price}`)
      })
    })
    .catch(err => {
      console.log('error')
    })
})

// Start polling
bot.startPolling()