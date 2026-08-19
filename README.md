# Enke Bet

Casino virtual de entretenimiento (sin dinero real). Incluye salas reales
con código para jugar con amigos, gestionadas por un pequeño servidor
Node + Socket.io.

## Estructura

```
enke-bet-app/
├── server.js        servidor Express + Socket.io (sirve la web y gestiona las salas)
├── package.json
└── public/
    ├── index.html    toda la app (interfaz + juegos)
    └── ads.txt       requerido por Google AdSense
```

## Ejecutar en local

```
npm install
npm start
```

Luego abre http://localhost:3000

## Desplegar en Render

1. Sube esta carpeta a un repositorio de GitHub.
2. En Render, crea un **Web Service** nuevo apuntando a ese repositorio.
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Entorno: Node (Render detecta el `package.json` automáticamente).
6. Una vez desplegado, tendrás una URL pública tipo `https://tu-app.onrender.com`.

Importante: el sistema de salas usa **WebSockets** (Socket.io), por lo que
necesita un servicio que mantenga el proceso vivo (Web Service normal),
no un sitio estático. Con el plan gratuito de Render el servicio "duerme"
tras un rato de inactividad y tarda unos segundos en despertar con la
primera visita — es normal.

## Anuncio de Google AdSense

El banner aparece en la página principal, justo debajo de la rejilla de
juegos y antes del bloque de texto explicativo. No verás un anuncio real
hasta que:

1. La web esté desplegada en una URL pública (no vale abrir el HTML en local).
2. Ese dominio esté añadido y verificado en tu cuenta de AdSense.
3. Google haya revisado y aprobado el sitio (puede tardar días).
4. El archivo `public/ads.txt` sea accesible en `tu-dominio/ads.txt`
   (ya incluido, con tu ID de publisher `pub-9987094435031407`).

Mientras tanto, ese hueco puede verse vacío o mostrar un espacio en blanco:
es el comportamiento normal antes de la aprobación.

## Salas con amigos: cómo funciona ahora

- "Crear sala" pide al servidor un código real de 6 caracteres.
- "Unirme con código" comprueba contra el servidor si ese código existe,
  si la sala no está llena (máx. 4) y si la partida no ha empezado ya.
- La lista de jugadores del lobby se actualiza en tiempo real para todos
  los conectados a esa sala (sin relleno automático ni jugadores falsos).
- El anfitrión decide cuándo empezar la partida (botón "Empezar partida",
  disponible en cuanto haya al menos 2 jugadores reales).
- Si alguien cierra la sala o pierde la conexión, se libera su hueco.

Nota: esto sincroniza la sala/lobby de verdad (código, jugadores conectados,
inicio de partida). La mesa de juego en sí (cartas, tiradas, etc.) sigue
jugándose de forma local en cada dispositivo una vez arranca la partida —
sincronizar también las cartas y turnos entre jugadores en tiempo real es
un paso más grande que se puede añadir después si lo necesitas.
