# 🎵 Bot de Música para Discord

Bot completo de música programado en **Node.js** con **discord.js v14** y **DisTube**. Soporta YouTube, Spotify, SoundCloud, enlaces directos, búsqueda por texto, controles interactivos con botones y cola de reproducción.

---

## 🚀 Guía Rápida de Configuración

### 1. Obtener el Token de Discord
1. Ve al [Discord Developer Portal](https://discord.com/developers/applications) e inicia sesión.
2. Haz clic en **"New Application"** y ponle un nombre a tu bot.
3. En el menú de la izquierda, entra a **"Bot"**:
   - En **"Privileged Gateway Intents"**, **activa los 3 switches**:
     - `PRESENCE INTENT`
     - `SERVER MEMBERS INTENT`
     - `MESSAGE CONTENT INTENT` (¡Muy importante para leer `.p`, `.s`, etc.!)
   - Haz clic en **"Reset Token"** / **"Copy"** para copiar el Token secreto de tu bot.
4. Abre el archivo [`.env`](file:///.env) en este proyecto y pega el token:
   ```env
   DISCORD_TOKEN=tu_token_aqui_sin_comillas
   PREFIX=.
   ```

### 2. Invitar el Bot a tu Servidor
1. En el Developer Portal, ve a **"OAuth2" -> "URL Generator"**.
2. En **SCOPES**, marca: `bot` y `applications.commands`.
3. En **BOT PERMISSIONS**, marca:
   - `Send Messages`
   - `Embed Links`
   - `Attach Files`
   - `Read Message History`
   - `Connect` (Conectar al canal de voz)
   - `Speak` (Hablar / Reproducir audio en el canal)
4. Copia el enlace generado abajo del todo, ábrelo en tu navegador e invita al bot a tu servidor.

### 3. Iniciar el Bot
Ejecuta en la terminal:
```bash
npm start
```
O para modo desarrollo con autoreinicio:
```bash
npm run dev
```

---

## 🎶 Lista de Comandos

| Comando | Alias | Descripción |
| :--- | :--- | :--- |
| `.p <canción o link>` | `.poner`, `.play` | Busca y reproduce de YouTube, Spotify o SoundCloud. |
| `.s` | `.stop`, `.detener` | Detiene la música, vacía la cola y sale del canal de voz. |
| `.sk` | `.skip`, `.saltar` | Salta a la siguiente canción de la cola. |
| `.pause` | `.pausar` | Pausa temporalmente la reproducción. |
| `.resume` | `.reanudar` | Continúa con la canción en pausa. |
| `.q` | `.queue`, `.cola` | Muestra la lista de canciones en espera. |
| `.np` | `.nowplaying` | Información de la canción actual con botones de control. |
| `.vol <1-100>` | `.volumen` | Ajusta el volumen del reproductor. |
| `.loop <off/cancion/cola>` | `.repetir` | Repite la canción actual o toda la lista. |
| `.shuffle` | `.mezclar` | Mezcla aleatoriamente las canciones en la cola. |
| `.ayuda` | `.help`, `.comandos` | Muestra la lista completa de comandos y ayuda. |

---

## 🎛️ Botones Interactivos
Cada vez que empieza una canción (`playSong` o `.np`), el bot enviará un mensaje enriquecido con botones para:
- ⏸️ / ▶️ Pausar o reanudar
- ⏭️ Saltar tema
- ⏹️ Detener
- 📜 Ver cola
