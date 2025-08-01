// solo escucha la informacion de server.ts

async function fetchData() {
  const response = await fetch("/api/state");
  const body = await response.json();
  return body;
}

function classifyStatus(message) {
  const msg = (message || "").trim().toLowerCase();
  if (!msg) return { cls: "task-idle", icon: "•" };
  if (
    msg.startsWith("acab") ||
    msg.startsWith("done") ||
    msg.startsWith("final")
  )
    return { cls: "task-done", icon: "✅" };
  if (
    msg.startsWith("est") ||
    msg.startsWith("hac") ||
    msg.startsWith("tra") ||
    msg.startsWith("work")
  )
    return { cls: "task-active", icon: "⏳" };
  return { cls: "task-idle", icon: "•" };
}

function parseMultipleTasksByUser(statuses) {
  // error para todo list
  const parsed = {};

  Object.entries(statuses).forEach(([name, tasks]) => {
    if (!Array.isArray(tasks)) return;
    parsed[name] = [...tasks];

    /*   const tasks = (raw || "")
      .split("\n")
      .map((msg) => msg.trim())
      .filter(Boolean);

    if (!parsed[name]) parsed[name] = [];

    parsed[name].push(...tasks);*/
  });

  return parsed;
}
// reanderizado de informacion
function renderData(data) {
  const list = document.querySelector("#list");
  list.innerHTML = "";

  const userTasks = parseMultipleTasksByUser(data.statuses);
  console.log({ userTasks });

  Object.entries(userTasks).forEach(([name, tasks]) => {
    tasks.forEach((task, index) => {
      const { cls, icon } = classifyStatus(task);

      const li = document.createElement("li");
      li.className = `task ${cls}`;
      li.dataset.author = name;

      const iconSpan = document.createElement("span");
      iconSpan.className = "task-icon";
      iconSpan.textContent = icon;

      const msgSpanItem = document.createElement("span");
      msgSpanItem.className = "task-item";
      msgSpanItem.textContent = `[${index + 1}] `;

      const msgSpan = document.createElement("span");
      msgSpan.className = "task-msg";
      msgSpan.textContent = `${task}`;

      const userSpan = document.createElement("span");
      userSpan.className = "task-user";
      userSpan.textContent = name;

      li.append(iconSpan, msgSpanItem, msgSpan, userSpan);
      list.appendChild(li);
    });
  });

  const juntas = document.querySelector("#junta");
  const avatares = document.querySelector("#avatarsjunta");
  avatares.innerHTML = "";
  juntas.setAttribute("hidden", "hidden");

  data.juntas.forEach((name) => {
    juntas.removeAttribute("hidden");
    const img = document.createElement("img");
    img.src = `/api/avatars/${name}`;
    const li = document.createElement("li");
    li.appendChild(img);
    avatares.appendChild(li);
  });

  window.scrollTo(0, document.body.scrollHeight);
}

fetchData().then((data) => renderData(data));

let protover = null;

async function connect() {
  const subscription = new EventSource("/api/state/lock");

  subscription.addEventListener("open", () => {
    console.log("lock established");
  });

  subscription.addEventListener("state", ({ data }) => {
    console.log({ data });
    document.getElementById("neterror").hidden = true;
    const state = JSON.parse(data);
    const response = {
      statuses: Object.fromEntries(state.statuses),
      juntas: [...state.juntas],
    };
    console.log("state", response);
    renderData(response);
  });

  subscription.addEventListener("protover", (data) => {
    const version = JSON.parse(data.data);
    if (protover == null) {
      console.log("protocol version set to", version);
      protover = version;
    } else if (version > protover) {
      console.log("reloading page because protocol version is now", version);
      window.location.reload();
    }
  });

  subscription.addEventListener("error", (e) => {
    document.getElementById("neterror").hidden = false;
    subscription.close();
    setTimeout(() => connect(), 3000);
  });
}

connect();
