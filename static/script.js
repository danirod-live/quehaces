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

    console.log(items)

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

function requestLoop() {
    fetchData()
        .then((data) => {
            document.querySelector("#neterror").setAttribute("hidden", "hidden");
            renderData(data)
            setTimeout(() => requestLoop(), 1000)
        })
        .catch((err) => {
            document.querySelector("#neterror").removeAttribute("hidden");
            setTimeout(() => requestLoop(), 1000)
        })
}

requestLoop()
