const { WebClient } = require('@slack/web-api')
const fs = require('fs')
const archiver = require('archiver')

if (process.argv.length < 3) {
  throw new Error('Missing token')
}

if (process.argv.length < 4) {
  throw new Error('Missing channels')
}

const token = process.argv[2]
const channels = []

process.argv.forEach((val, index) => {
  if (index > 2) channels.push(val)
})

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function scrollData(method, key, params = {}) {
  let scroll = true
  const scrollParams = params
  let list = []
  while (scroll) {
    const data = await method(scrollParams)
    list = list.concat(data[key])
    if (data.has_more) {
      scrollParams.cursor = data.response_metadata.next_cursor
      await sleep(1000)
    } else {
      scroll = false
    }
  }
  return list
}

async function ensureDir(dirpath) {
  try {
    await fs.promises.mkdir(dirpath, { recursive: true })
  } catch (err) {
    if (err.code !== 'EEXIST') throw err
  }
}

async function writeFile(path, data) {
  try {
    await fs.promises.writeFile(path, data)
  } catch (err) {
    if (err.code !== 'EEXIST') throw err
  }
}


const web = new WebClient(token);

(async () => {
  try {
    await web.auth.test()
  } catch (err) {
    throw new Error('Invalid Token')
  }

  const timestamp = Date.now()

  const list = await web.conversations.list({
    types: 'private_channel',
  })

  const selectedChannels = list.channels.filter(channel => channels.indexOf(channel.name) >= 0)

  const chans = await selectedChannels.map(async (channel) => {
    const messagesChannel = await scrollData(web.conversations.history, 'messages', {
      channel: channel.id,
    })

    const formattedExport = {}
    messagesChannel.forEach((message) => {
      const messageDate = (new Date(parseInt(`${message.ts.split('.')[0]}000`, 10))).toJSON().split('T')[0]
      if (messageDate in formattedExport) formattedExport[messageDate].push(message)
      else formattedExport[messageDate] = [message]
    })

    try {
      await ensureDir(`${timestamp}/${channel.name}`)
      console.log(`Extracted ${channel.name}`)
    } catch (err) {
      console.error(err)
    }

    Object.keys(formattedExport).map(async (key) => {
      try {
        await writeFile(`${timestamp}/${channel.name}/${key}.json`, JSON.stringify(formattedExport[key]))
      } catch (err) {
        console.error(err)
      }
    })

    const chanInfos = await web.conversations.info({
      channel: channel.id,
      include_num_members: true,
    })

    const chanMembers = await web.conversations.members({
      channel: channel.id,
    })

    return {
      topic: chanInfos.channel.topic,
      is_general: false,
      name_normalized: chanInfos.channel.name_normalized,
      name: chanInfos.channel.name,
      is_channel: true,
      created: chanInfos.channel.created,
      is_member: chanInfos.channel.is_member,
      is_mpim: false,
      is_archived: chanInfos.channel.is_archived,
      creator: chanInfos.channel.creator,
      is_org_shared: chanInfos.channel.is_org_shared,
      num_members: chanInfos.channel.num_members,
      purpose: chanInfos.channel.topic,
      members: chanMembers.members,
      unlinked: 0,
      id: chanInfos.channel.id,
      is_private: false,
      is_shared: chanInfos.channel.is_shared,
    }
  })

  const data = await Promise.all(chans)

  await writeFile(`${timestamp}/channels.json`, JSON.stringify(data))

  const allUsers = await scrollData(web.users.list, 'members')

  await writeFile(`${timestamp}/users.json`, JSON.stringify(allUsers))

  const output = fs.createWriteStream(`${__dirname}/${timestamp}.zip`)
  const archive = archiver('zip', {
    zlib: { level: 9 },
  })
  archive.pipe(output)
  archive.directory(`${timestamp}/`, false)
  archive.finalize()
})()
