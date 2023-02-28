# quehaces

a.k.a. un widget interactivo para mostrar una lista de tareas en streams tipo SWM. Este es el widget que he estado usando para mis coworks. Ahora que no hago, lo subo a GitHub para no perderlo y por si alguien quiere una base sobre la que trabajar.

**NOTA**: Está escrito bastante mal porque es un prototipo. No me parecería mal hacerlo de cero, pero ahora mismo no tengo tiempo. Si se te ocurren ideas para mejorar este repo, ábreme un issue o un PR, estaría dispuesto a ayudar o coordinar un intento por mejorar la aplicación.

## Cómo ejecutar la aplicación

Primero tienes que [registrar una aplicación](https://dev.twitch.tv/console/apps). Con eso te darán un CLIENT_ID y un CLIENT_SECRET. Debes tenerlos a mano en las variables de entorno `CLIENT_ID` y `CLIENT_SECRET` para que lo pille el bot. Por ejemplo, exportalos desde bash.

También tienes que exportar la variable `CHANNEL_NAME` con el nombre de tu canal. Se usa para dos cosas:

* Para decirle al bot a qué canal se tiene que conectar cuando se abra.
* Para saber a qué usuario del chat debe respetar cuando lance un comando privilegiado. Algunos comandos borran la memoria del bot, así que necesitamos comprobar que no las manden desconocidos.

Yo tengo un archivo .env para guardar estas cosas:

```
CLIENT_ID=12341234
CLIENT_SECRET=12341234
CHANNEL_NAME=danirod_
```

Luego utilizo el script run.cmd para exportar el contenido del archivo .env y lanzar la aplicación. Podría haber usado un buildscript y podría estar usando dotenv, pero... no lo estoy haciendo.

**TODO**: ¿Y por qué?

## Arquitectura

## Modelo de datos

La variable `state` contiene el estado de la aplicación.

* `statuses`: el map que asocia la tarea con la que está cada persona que envía una tarea.
* `juntas`: el array de personas que se encuentran en modo junta / AFK.
* `avatars`: el map que memoiza las URLs a los avatares de las personas a medida que hacen falta. Estos avataraes se sacan de la API de Twitch, así que los estamos guardando en caché para no pedirlos todo el rato.

### El bot

Es la típica aplicación tmi.js que se conecta de forma anónima a un chat de Twitch y que escucha a mensajes que comienzan con un token específico. Las siguientes acciones se pueden usar:

* !estoy: para mandar una tarea a la lista. Sólo se puede tener una tarea por persona.
* !yanotoy: para retirar tu tarea de la lista.
* !junta: para indicar que entras en junta o que pasas a AFK.
* !finjunta: para salir del modo junta o salir del modo AFK.
* !task, !endtask, !meeting, !endmeeting: son alias respectivamente del !estoy, !yanotoy, !junta y !finjunta, para los streams que eran en inglés.
* !agendareset: un comando privilegiado que solo puede ser mandado por el operador del stream y que hace que se borre la memoria, ideal para mandar por la mañana después de olvidar apagar el bot la noche anterior.

### El servidor web

Sirve para dos cosas:

* Para servir el frontend HTML que se tiene que agergar como widget al OBS.
* Para servir el endpoint de los avatares, necesario para pintar las fotos de perfil de la gente que está en AFK o en junta.
* Para servir el resto de la API REST que permite controlar la memoria de una forma posiblemente más efectiva y rápida que mediante comandos, además de discreta.

### La persistencia

La persistencia es un setInterval que cada poco tiempo vuelca el modelo de datos en un archivo JSON. A la vez, cuando se carga el programa, lo primero que hace es cargar este JSON para servir los datos de la ejecución anterior.

A la vez, las operaciones que modifican el estado (los comandos y los métodos de API) también se ocupan de forzar un a sincronización a disco para persistir instantáneamente lo que ha cambiado.

Esto se hizo para poder reiniciar en caliente el programa durante un stream sin perder la información de las personas que ya hayan mandado comandos ese día durante el stream.

## Servidor HTTP

Se sirve a través del puerto http://localhost:7654. Agrega http://localhost:7654/index.html a tu stream como un widget de tipo browsersource para mostrar el frontend.

* GET /api/state: sirve todo el estado de la memoria. El front utiliza este endpoint para repintar la aplicación cada pocos segundos.
* GET /api/avatars/<user>: devuelve un HTTP 302 a la URL del avatar de la persona <user>. Posiblemente tarde un poco más si tiene que usar la API de Twitch para sacar la información de la cuenta, pero en siguientes ocasiones tardará menos.
* PUT /api/task/<name>: se usa para cambiar la tarea del usuario <name>. Como payload JSON, se le manda:
  - task (string): la tarea que se quiere guardar.
* DELETE /api/task/<name>: se usa para borrar la tarea del usuario <name>. (Creeme, a veces hace falta borrar discretamente una tarea inapropiada que se ha podido mandar y que se muestra por pantalla.)
* PUT /api/junta/<name>: pone al usuario <name> en junta o en AFK.
* DELETE /api/junta/<name>: quita al usaurio <name> de la lista de junta o AFK.

El frontend no usa ningún framework, es literalmente un bucle for que hace poll cada pocos segundos del endpoint /api/state para sacar el estado de la aplicación y que repinta toda la aplicación de golpe. Muy eficiente y muy orgulloso de esto.
