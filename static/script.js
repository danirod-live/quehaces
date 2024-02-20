async function fetchData() {
    const response = await fetch("/api/state")
    const body = await response.json();
    return body
}

function renderData(data) {
    // { name, message, junta }
    const items = []
    const getItem = function(name) {
        const x = items.find((i) => i.name === name)
        if (x) {
            return x
        }
        const newItem = { name }
        items.push(newItem)
        return newItem
    }

    Object.entries(data.statuses).forEach(st => {
        const [name, message] = st
        const key = getItem(name)
        key.message = message
    })
    data.juntas.forEach((j) => {
        getItem(j).junta = true
    })

    const listItems = items.filter((i) => !i.junta).map((i) => {
        const node = document.createElement("li");
        node.setAttribute("data-author", i.name)
        if (i.message) node.innerText = i.message
        if (i.junta) {
            node.classList.add("junta")
            node.innerText = "en una junta"
        }
        return node
    })

    const list = document.querySelector("#list")
    list.innerHTML = "";
    listItems.forEach((l) => list.appendChild(l))

    const juntas = document.querySelector("#junta")
    const avatares = document.querySelector("#avatarsjunta")
    avatares.innerHTML = "";
    juntas.setAttribute("hidden", "hidden");
    items.filter((i) => i.junta).forEach((i) => {
        juntas.removeAttribute("hidden");
        const img = document.createElement("img");
        img.src = `/api/avatars/${i.name}`
        const li = document.createElement("li");
        li.appendChild(img)
        avatares.appendChild(li)
    });

    window.scrollTo(0, document.body.scrollHeight);
}

fetchData().then((data) => renderData(data));

let protover = null;

async function connect() {
    const subscription = new EventSource("/api/state/lock");
    subscription.addEventListener('open', () => {
        console.log('lock established');
    });
    subscription.addEventListener('state', ({ data }) => {
        document.getElementById('neterror').hidden = true;
        const state = JSON.parse(data);
        const response = {
            statuses: Object.fromEntries(state.statuses),
            juntas: [...state.juntas],
        }
        console.log('state', response);
        renderData(response);
    });
    subscription.addEventListener('protover', (data) => {
        console.log(data);
        const version = JSON.parse(data.data);
        if (protover == null) {
            console.log("protocol version set to", version);
            protover = version;
        } else if (version > protover) {
            console.log("reloading page because protocol version is now", version)
            window.location.reload();
        }
    })
    subscription.addEventListener('error', (e) => {
        document.getElementById('neterror').hidden = false;
        subscription.close();
        setTimeout(() => connect(), 3000);
    });
}

connect();