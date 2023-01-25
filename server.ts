import {readFile, writeFile} from "fs"
import tmi from "tmi.js"
import express from "express"
import type { Request, Response } from "express"
import cors from "cors"

const state = {
  statuses: new Map(),
  juntas: new Set(),
  avatars: new Map(),
}

function loadState() {
  try {
    const { statuses, juntas, avatars } = require("./redis.json");
    state.statuses = new Map(statuses);
    state.juntas = new Set(juntas);
    state.avatars = new Map(avatars);
    console.log("State loaded", state);
  } catch (e) {
    console.error(e);
  }
}

function dumpState() {
  const serialized = JSON.stringify({
    statuses: [...state.statuses],
    juntas: [...state.juntas],
    avatars: [...state.avatars],
  });
  console.log("Serializing state", serialized);
  writeFile("redis.json", serialized, (err) => {
    if (err)
      console.error(err);
    else
      console.log("Serialized state into redis.json");
  });
}

let scheduler: number | null = null;

function scheduleDumpState() {
  if (scheduler) {
    console.log("Invalidating old schedule");
    clearTimeout(scheduler);
  }
  console.log("Scheduled state serialization");
  scheduler = setTimeout(() => dumpState(), 1000) as unknown as number;
}

let token: string | null = null;

async function assertToken(): Promise<void> {
  if (!token) {
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `client_id=${process.env.CLIENT_ID}&client_secret=${process.env.CLIENT_SECRET}&grant_type=client_credentials`,
    });
    const json = await response.json();
    token = json.access_token;
    setTimeout(() => {
      token = null;
    }, 59 * 60 * 1000);
  }
}

async function fetchAvatar(user: string) {
  if (!state.avatars.has(user)) {
    await assertToken();
    const response = await fetch("https://api.twitch.tv/helix/users?login=" + user, {
      headers: {
        'Authorization': 'Bearer ' + token,
        'Client-Id': process.env.CLIENT_ID as string,
      }
    });
    const body = await response.json();
    state.avatars.set(user, body.data[0].profile_image_url);
  }
  return state.avatars.get(user);
}


const actions: { [k: string]: (name: string, msg: string) => void } = {
  '!agendareset': (name, _) => {
    if (name === process.env.CHANNEL_NAME) {
      state.statuses.clear();
      state.juntas.clear();
      state.avatars.clear();
      scheduleDumpState();
    }
  },
  '!estoy': (name, msg) => {
    if (!msg) {
      state.statuses.delete(name)
      scheduleDumpState();
    } else {
      state.statuses.delete(name)
      state.statuses.set(name, msg)
      scheduleDumpState();
    }
  },
  '!yanotoy': (name, _) => {
    state.statuses.delete(name);
    scheduleDumpState();
  },
  '!junta': (name, _) => {
    state.juntas.add(name);
    scheduleDumpState();
  },
  '!finjunta': (name, _) => {
    state.juntas.delete(name);
    scheduleDumpState();
  },
  '!task': (name, msg) => {
    if (!msg) {
      state.statuses.delete(name)
      scheduleDumpState();
    } else {
      state.statuses.delete(name)
      state.statuses.set(name, msg)
      scheduleDumpState();
    }
  },
  '!endtask': (name, _) => {
    state.statuses.delete(name);
    scheduleDumpState();
  },
  '!meeting': (name, _) => {
    state.juntas.add(name);
    scheduleDumpState();
  },
  '!endmeeting': (name, _) => {
    state.juntas.delete(name);
    scheduleDumpState();
  },
}

loadState();
scheduleDumpState();
setInterval(() => scheduleDumpState(), 60000);
if (!process.env.CHANNEL_NAME) {
  throw new Error("Falta CHANNEL_NAME");
}
const client = new tmi.Client({
  channels: [process.env.CHANNEL_NAME],
})
client.on('message', (_c, tags, message, _s) => {
  const username = tags.username
  if (!username || !message || !message.startsWith("!"))
    return

  const args = message.trim().split(" ")
  const cmd = args.shift()?.toLowerCase();
  const msg = args.join(" ")

  if (!cmd)
    return
  actions[cmd]?.(username, msg)
})
client.connect()

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname + "/static"))

// Global endpoints and things used by the frontend.
app.get("/api/state", (req: Request, res: Response) => {
  const response = {
    statuses: Object.fromEntries(state.statuses),
    juntas: [...state.juntas],
  }
  return res.json(response)
});
app.get("/api/avatars/:id", async (req: Request, res: Response) => {
  const avatar = await fetchAvatar(req.params.id);
  return res.status(302).location(avatar).send();
});

// Manage tasks over HTTP.
app.put<{ task: string }>("/api/task/:id", (req: Request, res: Response) => {
  // TODO: very naif
  scheduleDumpState();
  const { task } = req.body;
  state.statuses.set(req.params.id, task);
  return res.status(201).send(task);
});
app.delete("/api/task/:id", (req: Request, res: Response) => {
  if (state.statuses.has(req.params.id)) {
    state.statuses.delete(req.params.id);
    scheduleDumpState();
    return res.status(204).send();
  } else {
    return res.status(404).send("Not found");
  }
});

// Manage meetings over HTTP.
app.put("/api/junta/:id", (req: Request, res: Response) => {
  state.juntas.add(req.params.id);
  scheduleDumpState();
  return res.status(201).send("Have fun");
});
app.delete("/api/junta/:id", (req: Request, res: Response) => {
  if (state.juntas.has(req.params.id)) {
    state.juntas.delete(req.params.id);
    return res.status(204).send();
  } else {
    return res.status(404).send("Not found");
  }
});
app.listen(7654)

console.log("tamo ready")
