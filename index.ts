import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import config from './config.json';

function parseLink(link: string) {
  const match = link.match(/\?c=([a-zA-Z0-9]+)/);
  if (match) return match[1];
  return link;
}

async function start(code: string, i: number) {
  const headers = {
    Accept: '*/*',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    Origin: 'https://garticphone.com',
    Pragma: 'no-cache',
    TE: 'trailers',
    'Upgrade-Insecure-Requests': '1',
    Referer: `https://garticphone.com/?c=${code}`,
    Cookie: '',
  };
  const userId = uuidv4();
  function generateID() {
    const prefix = 'PLM'; // fixed prefix
    const randomPart = Math.random().toString(36).substring(2, 7); // random value
    const timestampPart = Date.now().toString(36).substring(5); // base 36 timestamp

    return prefix + randomPart + timestampPart;
  }

  function log(...args: any[]) {
    console.log(`[#${i}]`, ...args);
  }

  async function getServer(code: string) {
    return await fetch(`https://garticphone.com/api/server?code=${code}`, { headers }).then((res) => res.text());
  }

  async function getSocketInfo(server: string): Promise<{
    sid: string,
    pingTimeout: number,
    pingInterval: number,
    upgrades: 'websocket'[],
  }> {
    const url = `${server}/socket.io/?EIO=3&transport=polling&t=${generateID()}`;
    const res = await fetch(url, { headers }).then(res => res.text());
    const json = res.slice(4, -4);
    return JSON.parse(json);
  }

  async function sendPlayerInfo(server: string, sessionId: string, code: string) {
    const url = `${server}/socket.io/?EIO=3&transport=polling&t=${generateID()}&sid=${sessionId}`;
    // A random username is generated because the game does not allow multiple players with the same username
    const username = config.username + Math.floor(Math.random() * 10000);
    //         payload length:42[1, uuid, username, avatar, lang, viewer, access, modCode, invite]
    const data = JSON.stringify([1, userId, username, 12, 'en', false, code, null, null]);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
        ...headers
      },
      body: `${data.length + 2}:42${data}`,
    });
    return res.ok && await res.text() === 'ok';
  }

  async function getGameInfo(server: string, sessionId: string) {
    const url = `${server}/socket.io/?EIO=3&transport=polling&t=${generateID()}&sid=${sessionId}`;
    const res = await fetch(url, { headers }).then(res => res.text());
    if (res === '1:61:1') return null;
    try {
      const start = res.indexOf('[');
      if (start === -1) throw new Error(res);
      const jsonRes = res.slice(start);
      const json = JSON.parse(jsonRes)[1];
      if (json.error) {
        if (json.error === 4) throw new Error('Game is full');
        throw new Error('Unknown error');
      }
      return json;
    } catch (e) {
      if (e instanceof SyntaxError) console.error('Invalid JSON response:', e.message);
      return null;
    }
  }

  const server = await getServer(code);

  const socketInfo = await getSocketInfo(server);
  headers['Cookie'] = `io=${socketInfo.sid}`;

  const ok = await sendPlayerInfo(server, socketInfo.sid, code);
  if (!ok) throw new Error('Failed to send player info');

  await getGameInfo(server, socketInfo.sid);

  const io = new WebSocket(`${server.replace('https:', 'wss:')}/socket.io/?EIO=3&transport=websocket&sid=${socketInfo.sid}`, {
    headers: {
      Cookie: `io=${socketInfo.sid}`,
      Origin: 'https://garticphone.com',
      // For some reason, this UA is not blocked by Cloudflare
      'User-Agent': 'insomnia/2023.6.0',
    },
    perMessageDeflate: true,
  });
  await fetch(`${server}/socket.io/?EIO=3&transport=polling&t=${generateID()}&sid=${socketInfo.sid}`, { headers });

  io.addEventListener('open', () => {
    log('Connected to game session!');
    io.send('2probe');

    setInterval(() => {
      io.send('2');
    }, socketInfo.pingInterval);
  });

  io.addEventListener('message', (e) => {
    const data = e.data;
    // console.log(data);
    if (data === '3probe') {
      io.send('5');
    }
  });

  io.addEventListener('close', (e) => {
    console.log(e.code, e.reason);
  });

  io.addEventListener('error', (e) => {
    console.log(e);
  });
}

const botsCount = process.argv[3];
const link = process.argv[2];
if (!link || !botsCount) {
  console.log('Usage: node . <link> <bots>');
  process.exit(1);
} else if (isNaN(parseInt(botsCount))) {
  console.log('Bots count must be a number');
  process.exit(1);
}
console.log(`Starting to join ${botsCount} bots to the game. This may take a moment...`);
for (let i = 0; i < parseInt(botsCount); i++) {
  start(parseLink(link), i + 1);
}
