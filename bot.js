const Telegraf = require('telegraf')
const Telegram = require('telegraf/telegram')
const Markup = require('telegraf/markup')
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

        splitted.forEach((split, index) => {
          let data = split.split(' ')

            if (!Number(data[1]) && data[1]) {
              if (!Number(splitted[index + 1][0]) && index%2 === 0) {
                if (data.length >= 3) {
                  let obj = {
                    itemName: data[0] + ' ' + data[1],
                    quantity: Number(data[2])
                  }
  
                  hasil.push(obj)
                } else if (data.length === 1) {
                    if (splitted[index + 2][1] === ' ') {
                      let obj = {
                        itemName: data[0],
                        quantity: Number(splitted[index + 2][0])
                      }
    
                      hasil.push(obj)
                    } else {
                        let angka = splitted[index + 2][0] + splitted[index + 2][1]
  
                        let obj = {
                          itemName: data[0],
                          quantity: Number(angka)
                        }
  
                        hasil.push(obj)
                    }
                }
              } else if (Number(splitted[index + 1][0]) && index%2 === 1) {
                  if (data.length >= 3) {
                    let obj = {
                      itemName: data[0] + ' ' + data[1],
                      quantity: Number(data[2])
                    }
      
                    hasil.push(obj)
                  } else if (data.length === 1) {
                      if (splitted[index + 2][1] === ' ') {
                        let obj = {
                          itemName: data[0],
                          quantity: Number(splitted[index + 2][0])
                        }
    
                        hasil.push(obj)
                      } else {
                          let angka = splitted[index + 2][0] + splitted[index +2][1]
    
                          let obj = {
                            itemName: data[0],
                            quantity: Number(angka)
                          }
    
                          hasil.push(obj)
                      }
                  }
              } else {
                  let obj = {
                    itemName: data[0] + ' ' + data[1],
                    quantity: Number(data[2])
                  }
    
                  hasil.push(obj)
              }
            } else if (!Number(data[0]) && data[0]) {
                if (!Number(splitted[index + 1][0]) && index%2 === 0) {
                  if (data.length >= 3) {
                    let obj = {
                      itemName: data[0],
                      quantity: Number(data[1])
                    }
      
                    hasil.push(obj)
                  } else if (data.length === 1) {
                      if (splitted[index + 2][1] === ' ') {
                        let obj = {
                          itemName: data[0],
                          quantity: Number(splitted[index + 2][0])
                        }
    
                        hasil.push(obj)
                      } else {
                          let angka = splitted[index + 2][0] + splitted[index + 2][1]
    
                          let obj = {
                            itemName: data[0],
                            quantity: Number(angka)
                          }
    
                          hasil.push(obj)
                      }
                  }
                } else if (Number(splitted[index + 1][0]) && index%2 === 1) {
                    if (data.length >= 3) {
                      let obj = {
                        itemName: data[0],
                        quantity: Number(data[1])
                      }
        
                      hasil.push(obj)
                    } else if (data.length === 1) {
                        if (splitted[index + 2][1] === ' ') {
                          let obj = {
                            itemName: data[0],
                            quantity: Number(splitted[index + 2][0])
                          }
    
                          hasil.push(obj)
                        } else {
                            let angka = splitted[index + 2][0] + splitted[index +2][1]
    
                            let obj = {
                              itemName: data[0],
                              quantity: Number(angka)
                            }
    
                            hasil.push(obj)
                        }
                    }
                } else {
                    let obj = {
                      itemName: data[0],
                      quantity: Number(data[1])
                    }
      
                    hasil.push(obj)
                }
            }
        })

        checkNull(hasil, userId, reply)
          .then(a => {
            sendToServer(hasil, reply, userId)
          })
          .catch(err => {
            reply(`Gagal menyimpan report! Pastikan format sesuai dengan foto di bawah ${emoji.get('cry')}`)
            telegram.sendPhoto(userId, { source: './format.jpg' })
              .then(() => {
                reply('Gunakan applikasi note pada Gadget anda untuk membuat report!')
                reply(`Atau anda dapat mengetik report manual dengan format\n
                /report [nama barang]<spasi>[quantity]<koma>[nama barang]<spasi>[quantity]\n
                contoh:
                /report dada 2, sayap 2`)
              })
          })
      })
      .catch(err => {
        reply(`Gagal menyimpan report! Pastikan format sesuai dengan foto di bawah ${emoji.get('cry')}`)
        telegram.sendPhoto(userId, { source: './format.jpg' })
          .then(() => {
            reply('Gunakan applikasi note pada Gadget anda untuk membuat report!')
            reply(`Atau anda dapat mengetik report manual dengan format\n
            /report [nama barang]<spasi>[quantity]<koma>[nama barang]<spasi>[quantity]\n
            contoh:
            /report dada 2, sayap 2`)
          })
      })
}

function checkNull(hasil, userId, reply) {
  return new Promise((resolve, reject) => {
    hasil.forEach(item => {
      if (item.quantity == null || item.quantity == NaN) {
        reject ('Null detected')
      }
    })

    resolve(true)
  })
}

async function sendToServer(hasil, reply, userId) {
  let a = await axios.post(`${server}/selling`, { idTelegram: userId, item: hasil })
                  .then(() => {
                    reply(`Report tersimpan! Terima kasih telah mengirimkan report hari ini ${emoji.get('+1')}`)
                      .then( () => {
                        let product = `Saved report today : `
                        hasil.forEach(element => {
                          product += `\n${element.itemName} = ${element.quantity} pcs`
                        })

                        reply(`${product}`)
                      })
                      .catch(err => {
                        console.log(err)
                      })
                  })
                  .catch(err => {
                    console.log(err)
                  })
}

bot.start((ctx) => {
  ctx.reply('Selamat datang di applikasi omZetBot! Ketik /help untuk bantuan, pastikan anda telah terdaftar sebagai agent kami!')
})

bot.help((ctx) => {
  ctx.reply(`List Perintah:`,
    Markup.inlineKeyboard([
      [
        Markup.callbackButton("My ID", 'myId'),
        Markup.callbackButton("My Report", 'myReport')
      ], [
        Markup.callbackButton("Harga", 'harga'),
        Markup.callbackButton("Report", 'report')
      ]
    ]).extra()
  )
})

bot.on('photo', ({message, reply}) => {
  let userId = message.from.id

  reply(`${emoji.get('oncoming_automobile')} Sedang menyimpan report.......`)

  axios.get(`${server}/users/one/${userId}`)
    .then(() => {
      axios.get(`${server}/selling/today/${userId}`)
        .then(response => {
          if (!response.data.result) {
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
              reply(`Anda telah melakukan report di hari ini! ${emoji.get('+1')}`)
          }
        }) 
    })
    .catch(err => {
      reply(`${emoji.get('x')} Anda belum terdaftar! Silahkan hubungi admin!`)
    })
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

bot.command('myReport', (ctx) => {
  let userId = ctx.message.from.id

  axios.get(`${server}/users/one/${userId}`)
    .then(response => {
      axios.get(`${server}/selling/telegram/${userId}`)
        .then(({ data }) => {
          data.forEach(item => {
            let total = 0
            let product = `List item sold ${item.createdAt.toString().slice(0, 10)}`
            item.selling.forEach(element => {
              total += Number(element.Total)
              product += `\n${element.itemName} = ${element.quantity} pcs = Rp.${element.Total.toLocaleString()}`
            });
            ctx.reply(`${product} \nTotal : Rp.${total.toLocaleString()}`)
          });
        })
        .catch(err => {
          console.log(err)
        })
    })
    .catch(err => {
      ctx.reply(`${emoji.get('x')} Anda belum terdaftar! Silahkan hubungi admin!`)
    })
})

bot.action('myId', (ctx) => {
  ctx.editMessageText(`${emoji.get('id')}: ${ctx.from.id}`)
})

bot.action('harga', (ctx) => {
  axios.get(`${server}/items`)
    .then(response => {
      response.data.result.forEach((menu, index) => {
        if (index === response.data.result.length - 1) {
          ctx.reply(`${menu.itemName} Rp. ${menu.price}`)
          ctx.editMessageText('Daftar Harga:')
        } else {
          ctx.reply(`${menu.itemName} Rp. ${menu.price}`)
        }
      })
    })
    .catch(err => {
      console.log('error')
    })
})

bot.action('report', ctx => {
  ctx.editMessageText(`Format report manual:\n
  /report [nama barang]<spasi>[quantity]<koma>[nama barang]<spasi>[quantity]\n
  contoh:
  /report dada 2, sayap 2`)
})

bot.action('myReport', (ctx) => {
  let userId = ctx.from.id

  axios.get(`${server}/users/one/${userId}`)
    .then(response => {
      axios.get(`${server}/selling/telegram/${userId}`)
        .then(({ data }) => {
          data.forEach((item, index) => {
            let total = 0
            let product = `List item sold ${item.createdAt.toString().slice(0, 10)}`
            item.selling.forEach(element => {
              total += Number(element.Total)
              product += `\n${element.itemName} = ${element.quantity} pcs = Rp.${element.Total.toLocaleString()}`
            });
            
            if (index === data.length - 1) {
              ctx.editMessageText(`${product} \nTotal : Rp.${total.toLocaleString()}`)
            } else {
              ctx.reply(`${product} \nTotal : Rp.${total.toLocaleString()}`)
            }
          });
        })
        .catch(err => {
          console.log(err)
        })
    })
    .catch(err => {
      ctx.reply(`${emoji.get('x')} Anda belum terdaftar! Silahkan hubungi admin!`)
    })
})

bot.hears(/report (.+)/, (ctx) => {
  let reply = ctx.reply
  let userId = ctx.message.from.id
  let splitted = ctx.match[1].split(', ')
  let hasil = []

  ctx.reply(`${emoji.get('oncoming_automobile')} Sedang menyimpan report.......`)

  axios.get(`${server}/users/one/${userId}`)
    .then(() => {
      axios.get(`${server}/selling/today/${userId}`)
        .then(response => {
          if (!response.data.result) {
            splitted.forEach(item => {
              let data = item.split(' ')
              
              if (!Number(data[1])) {
                let obj = {
                  itemName: data[0] + ' ' + data[1],
                  quantity: data[2] ? Number(data[2]) : null
                }

                hasil.push(obj)
              } else if (!Number(data[0])) {
                  let obj = {
                    itemName: data[0],
                    quantity: data[1] ? Number(data[1]) : null
                  }

                  hasil.push(obj)
              }
            })

            checkNull(hasil, userId, reply)
              .then(a => {
                sendToServer(hasil, ctx.reply, userId)
              })
              .catch(err => {
                ctx.reply(`Atau anda dapat mengetik report manual dengan format\n
                /report [nama barang]<spasi>[quantity]<koma>[nama barang]<spasi>[quantity]\n
                contoh:
                /report dada 2, sayap 2`)
              })
          } else {
              reply(`Anda telah melakukan report di hari ini! ${emoji.get('+1')}`)
          }
        }) 
    })
    .catch(err => {
      reply(`${emoji.get('x')} Anda belum terdaftar! Silahkan hubungi admin!`)
    })
})

// Start polling
bot.startPolling()