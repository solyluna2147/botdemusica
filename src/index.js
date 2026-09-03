const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActivityType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder
} = require('discord.js');
const fs = require('fs');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  StreamType,
  NoSubscriberBehavior,
  entersState
} = require('@discordjs/voice');
const yts = require('yt-search');
const youtubedl = require('yt-dlp-exec');
const ffmpeg = require('ffmpeg-static');
const http = require('http');
const path = require('path');
const cp = require('child_process');
const config = require('./config');

// Detección multiplataforma de yt-dlp (Render usa Linux, local usa Windows)
const isWin = process.platform === 'win32';
const ytdlBin = isWin
  ? path.join(__dirname, '..', 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp.exe')
  : path.join(__dirname, '..', 'node_modules', 'yt-dlp-exec', 'bin', 'yt-dlp');

// Servidor dummy para Render (Web Service 24/7)
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('✅ Bot de Música - Kevin Sanchez está activo 24/7 en Discord.');
});
server.listen(PORT, () => {
  console.log(`🌐 Servidor de Render iniciado en puerto ${PORT}`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const logoGifPath = path.join(__dirname, 'gifs', 'logo.gif');
const bannerGifPath = path.join(__dirname, 'gifs', 'banner.gif');

// Mapa de colas por servidor
const queues = new Map();

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function createProgressBar(currentMs, totalDurationStr) {
  let totalMs = 0;
  if (totalDurationStr && totalDurationStr.includes(':')) {
    const parts = totalDurationStr.split(':').map(Number);
    if (parts.length === 2) {
      totalMs = (parts[0] * 60 + parts[1]) * 1000;
    } else if (parts.length === 3) {
      totalMs = (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
    }
  }

  const currentStr = formatTime(currentMs);
  if (!totalMs || totalMs <= 0) {
    return `🔴 \`${currentStr}\` ▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬ 📡 \`EN DIRECTO\``;
  }

  const percentage = Math.min(Math.max(currentMs / totalMs, 0), 1);
  const totalBlocks = 16;
  const progressBlocks = Math.round(totalBlocks * percentage);
  const percentNumber = Math.floor(percentage * 100);

  // Barra de diseño Hi-Fi con bloques sólidos rojos/blancos y cursor de reproducción
  const filled = '█'.repeat(Math.max(progressBlocks - 1, 0));
  const pointer = progressBlocks > 0 ? '🔴' : '';
  const empty = '░'.repeat(Math.max(totalBlocks - progressBlocks, 0));

  return `\`${currentStr}\` [${filled}${pointer}${empty}] \`${totalDurationStr}\` \`(${percentNumber}%)\``;
}

/**
 * Genera el Embed y los Botones del Panel de Control Principal con banner GIF
 */
function buildDashboard(queue) {
  const isPlaying = queue && queue.playing && queue.currentSong;
  const isPaused = queue && queue.paused;
  const current = isPlaying ? queue.currentSong : null;

  const embed = new EmbedBuilder()
    .setColor(isPlaying ? config.colors.primary : 0xFFFFFF)
    .setTitle('🔴 BOT DE MUSICA | KEVIN SANCHEZ')
    .setImage('attachment://banner.gif')
    .setTimestamp();

  if (isPlaying) {
    const queuePreview = queue.songs.length > 0
      ? queue.songs.slice(0, 3).map((s, i) => `\`${i + 1}.\` [${s.title.slice(0, 35)}](${s.url}) (\`${s.duration}\`)`).join('\n') + (queue.songs.length > 3 ? `\n*...y ${queue.songs.length - 3} más.*` : '')
      : '*No hay canciones en espera.*';

    const currentMs = queue.songStartTime ? (Date.now() - queue.songStartTime) : 0;
    const progressBar = createProgressBar(currentMs, current.duration);

    embed.setDescription(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🎶 **EN REPRODUCCIÓN AHORA**\n` +
      `**[${current.title}](${current.url})**\n\n` +
      `${progressBar}\n\n` +
      `⏱️ **Duración:** \`${current.duration}\`  •  👤 **Añadida por:** ${current.requestedBy}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`
    )
    .addFields(
      { name: '📊 Estado', value: `\`${isPaused ? '⏸️ PAUSADO' : '▶️ EN DIRECTO'}\``, inline: true },
      { name: '🔊 Calidad', value: '`⚡ 320kbps HD`', inline: true },
      { name: '📑 Cola de Espera', value: queuePreview, inline: false }
    )
    .setThumbnail(current.thumbnail)
    .setFooter({ text: `Kevin Sanchez Music • Pistas en cola: ${queue.songs.length} • Prefijo: ${config.prefix}` });
  } else {
    embed.setDescription(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🎧 **CENTRO DE AUDIO EXCLUSIVO**\n` +
      `*El reproductor se encuentra en espera. Selecciona una opción abajo para comenzar a escuchar la mejor música en calidad ultra alta.*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`
    )
    .addFields(
      { name: '⚡ Iniciar Reproducción', value: `Pulsa **\`⚡ Poner Canción\`** para reproducir al instante o **\`➕ Añadir a la Cola\`** para poner en lista.`, inline: false },
      { name: '⌨️ Comandos Directos', value: `\`${config.prefix}p <canción>\`  •  \`${config.prefix}c <canción>\`  •  \`${config.prefix}h\` *(Menú)*  •  \`${config.prefix}borrarmensajes\``, inline: false }
    )
    .setFooter({ text: `Kevin Sanchez Music • Sistema listo • Prefijo: ${config.prefix}` });
  }

  // FILA 1: Poner Canción (Rojo/Directo) y Añadir a la Cola (Verde/Cola)
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('dash_add_direct')
      .setLabel('⚡ Poner Canción')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('dash_add_queue')
      .setLabel('➕ Añadir a la Cola')
      .setStyle(ButtonStyle.Success)
  );

  // FILA 2: Pausar / Reanudar y Quitar
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('dash_pause_resume')
      .setLabel(isPaused ? '▶️ Reanudar' : '⏸️ Pausar')
      .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(!isPlaying),
    new ButtonBuilder()
      .setCustomId('dash_stop')
      .setLabel('⏹️ Quitar')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!isPlaying)
  );

  // FILA 3: Anterior y Siguiente
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('dash_prev')
      .setLabel('⏮️ Anterior')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!queue || queue.previousSongs.length === 0),
    new ButtonBuilder()
      .setCustomId('dash_skip')
      .setLabel('⏭️ Siguiente')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!isPlaying)
  );

  // FILA 4: Ver Cola y Refrescar
  const row4 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('dash_view_queue')
      .setLabel(`📜 Ver Cola (${queue ? queue.songs.length : 0})`)
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('dash_refresh')
      .setLabel('🔄 Refrescar')
      .setStyle(ButtonStyle.Primary)
  );

  const files = [];
  if (fs.existsSync(bannerGifPath)) {
    files.push(new AttachmentBuilder(bannerGifPath, { name: 'banner.gif' }));
  }

  return { embeds: [embed], components: [row1, row2, row3, row4], files };
}

class MusicQueue {
  constructor(textChannel, voiceChannel) {
    this.textChannel = textChannel;
    this.voiceChannel = voiceChannel;
    this.connection = null;
    this.player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Play
      }
    });
    this.songs = [];
    this.previousSongs = []; // Historial de canciones para el botón ANTERIOR
    this.volume = 100;
    this.playing = false;
    this.paused = false;
    this.currentSong = null;
    this.currentYtdlProcess = null;
    this.currentFfmpegProcess = null;
    this.dashboardMessage = null; // Guarda el mensaje principal para editarlo

    this.player.on(AudioPlayerStatus.Playing, () => {
      console.log('▶️ [PLAYER] Reproductor de Discord en estado PLAYING (emitiendo voz activa).');
    });

    this.player.on(AudioPlayerStatus.Buffering, () => {
      console.log('⏳ [PLAYER] Buffering audio...');
    });

    this.player.on(AudioPlayerStatus.Idle, (oldState) => {
      if (oldState.status === AudioPlayerStatus.Playing) {
        console.log('⏹️ [PLAYER] Canción finalizada, pasando a la siguiente.');
        this.playNext();
      }
    });

    this.liveUpdateInterval = null;
  }

  startLiveUpdate() {
    this.stopLiveUpdate();
    this.liveUpdateInterval = setInterval(() => {
      if (this.playing && this.dashboardMessage && !this.paused) {
        this.updateDashboard().catch(() => {});
      }
    }, 6000);
  }

  stopLiveUpdate() {
    if (this.liveUpdateInterval) {
      clearInterval(this.liveUpdateInterval);
      this.liveUpdateInterval = null;
    }
  }

  killProcesses() {
    this.stopLiveUpdate();
    if (this.currentYtdlProcess) {
      try { this.currentYtdlProcess.kill(); } catch {}
      this.currentYtdlProcess = null;
    }
    if (this.currentFfmpegProcess) {
      try { this.currentFfmpegProcess.kill(); } catch {}
      this.currentFfmpegProcess = null;
    }
  }

  async updateDashboard() {
    if (!this.dashboardMessage) return;
    try {
      const data = buildDashboard(this);
      await this.dashboardMessage.edit(data);
    } catch {
      this.dashboardMessage = null;
    }
  }

  async playPrevious() {
    if (this.previousSongs.length === 0) return;
    const prevSong = this.previousSongs.pop();
    if (this.currentSong) {
      this.songs.unshift(this.currentSong); // Devuelve la actual al inicio de la cola
    }
    this.songs.unshift(prevSong); // Pone la anterior para ser la siguiente en playNext
    this.player.stop(true);
  }

  async playNext() {
    this.killProcesses();

    if (this.currentSong) {
      this.previousSongs.push(this.currentSong); // Guarda en historial
    }

    if (this.songs.length === 0) {
      this.playing = false;
      this.currentSong = null;
      await this.updateDashboard();
      return;
    }

    this.currentSong = this.songs.shift();
    this.playing = true;
    this.paused = false;

    try {
      // Asegurar permisos en Linux (Render)
      if (!isWin && fs.existsSync(ytdlBin)) {
        try { fs.chmodSync(ytdlBin, '755'); } catch {}
      }

      console.log(`[AUDIO] Transmitiendo audio en directo: ${this.currentSong.title}`);

      const isYouTube = this.currentSong.url.includes('youtube.com') || this.currentSong.url.includes('youtu.be');
      const isSoundcloud = this.currentSong.url.includes('soundcloud.com') || this.currentSong.url.startsWith('scsearch:');

      let targetUrl = this.currentSong.url;
      // Si es una búsqueda libre o el servidor de YouTube está bloqueado en Render, transmitimos mediante SoundCloud Stream
      if (!isYouTube && !isSoundcloud && !targetUrl.startsWith('http')) {
        targetUrl = `scsearch:${this.currentSong.title || targetUrl}`;
      }

      const ytdlArgs = [
        '-f', 'bestaudio/best',
        '-o', '-',
        '--no-playlist'
      ];

      if (isYouTube) {
        ytdlArgs.push(
          '--force-ipv4',
          '--extractor-args', 'youtube:player_client=android_vr,android',
          '--user-agent', 'com.google.android.youtube/19.29.37 (Linux; U; Android 14; es_ES; Pixel 8 Pro)'
        );
      }

      ytdlArgs.push(targetUrl);

      // 1. Proceso de extracción directa en streaming sin guardar en disco
      const ytdlProcess = cp.spawn(ytdlBin, ytdlArgs, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // 2. FFmpeg decodifica el flujo en tiempo real a formato Discord
      const ffmpegProcess = cp.spawn(ffmpeg, [
        '-i', 'pipe:0',
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        'pipe:1'
      ], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'ignore']
      });

      this.currentYtdlProcess = ytdlProcess;
      this.currentFfmpegProcess = ffmpegProcess;

      ytdlProcess.stdout.pipe(ffmpegProcess.stdin);

      ytdlProcess.stderr.on('data', d => {
        const str = d.toString();
        if (str.includes('ERROR:')) console.error('[YT-DLP ERR]:', str.trim());
      });

      ytdlProcess.on('error', (err) => console.error('[YT-DLP PROCESS ERROR]:', err));
      ffmpegProcess.on('error', (err) => console.error('[FFMPEG PROCESS ERROR]:', err));
      ffmpegProcess.stdin.on('error', () => {});

      const resource = createAudioResource(ffmpegProcess.stdout, {
        inputType: StreamType.Raw,
        inlineVolume: true
      });

      resource.volume?.setVolume(this.volume / 100);
      this.songStartTime = Date.now();
      this.player.play(resource);

      console.log('📡 [STREAMING ACTIVO] Audio reproduciéndose en el canal de voz.');

      if (this.dashboardMessage) {
        await this.updateDashboard();
      } else {
        const data = buildDashboard(this);
        this.dashboardMessage = await this.textChannel.send(data).catch(() => null);
      }

      this.startLiveUpdate();

    } catch (err) {
      console.error('[AUDIO ERROR]:', err.message || err);
      this.playNext();
    }
  }

  destroy() {
    this.killProcesses();
    this.player.stop(true);
    if (this.connection) {
      try { this.connection.destroy(); } catch {}
    }
    this.playing = false;
    this.songs = [];
    this.currentSong = null;
    this.updateDashboard();
    queues.delete(this.textChannel.guild.id);
  }
}

// ============================================================
// SISTEMA DE ACTIVIDAD ANIMADA ("JUGANDO A...")
// ============================================================
const presenceConfig = {
  name: "Kevin Sanchez | Audio HQ",
  loading: {
    enabled: true,
    text: "Sintonizando Audio HD...",
    start: 0,
    end: 100,
    step: 10,
    interval: 4.5
  },
  final_animation: {
    enabled: true,
    texts: [
      { text: "🔴 BOT DE MUSICA | KEVIN SANCHEZ", duration: 5 },
      { text: "⚡ Usa .h para el Menú Interactivo", duration: 5 },
      { text: "🎶 Calidad Ultra HD 320kbps 24/7", duration: 5 },
      { text: "👑 Desarrollado por Kevin Sanchez", duration: 5 },
      { text: "🚀 Música sin cortes ni anuncios", duration: 5 }
    ]
  },
  // Imagen animada y verificado de tu foto
  large_image: "https://cdn.discordapp.com/avatars/1308814761269395527/a_fe716a1a5c62b65cd0f6024b2911b061.webp?size=1024&animated=true",
  large_text: "🔴 Kevin Sanchez Music Oficial",
  small_image: "https://i.ibb.co/Mm7y46n/36m5Vn-E.gif",
  small_text: "Verificado Oficial"
};

// 187,081,208 segundos = ~132,017 horas de tu contador
const accumulatedMs = 187081208 * 1000;
const startTimestamp = Date.now() - accumulatedMs;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function setBotActivity(clientInstance, activityName) {
  try {
    clientInstance.user.setPresence({
      activities: [
        {
          name: activityName,
          type: ActivityType.Playing,
          timestamps: {
            start: startTimestamp
          }
        }
      ],
      status: 'online'
    });
  } catch (err) {
    console.error('Error al actualizar presencia:', err);
  }
}

async function startPresenceAnimation(clientInstance) {
  while (true) {
    try {
      // 1. Fase de Carga (0% -> 100%)
      if (presenceConfig.loading.enabled) {
        let progress = presenceConfig.loading.start;
        while (progress <= presenceConfig.loading.end) {
          const detail = `💖 ${presenceConfig.loading.text} (${progress}%) 💢`;
          await setBotActivity(clientInstance, detail);
          await sleep(presenceConfig.loading.interval * 1000);
          progress += presenceConfig.loading.step;
        }
      }

      // 2. Fase de Frases / Estados
      if (presenceConfig.final_animation.enabled) {
        for (const item of presenceConfig.final_animation.texts) {
          await setBotActivity(clientInstance, item.text);
          await sleep(item.duration * 1000);
        }
      }
    } catch (err) {
      console.error('Error en ciclo de presencia:', err);
      await sleep(5000);
    }
  }
}

client.once('ready', () => {
  console.log('====================================');
  console.log(`✅ Bot conectado como: ${client.user.tag}`);
  console.log(`🎛️ Menú interactivo (.h) y gestión sin spam lista`);
  console.log(`🎮 Estado 'Jugando a...' con GIFs y contador activo`);
  console.log(`🎵 Prefijo: ${config.prefix}`);
  console.log('====================================');

  startPresenceAnimation(client);
});

/**
 * Función auxiliar para añadir canciones desde texto o modal
 */
async function handleAddSong(query, messageOrInteraction, voiceChannel) {
  const isMessage = Boolean(messageOrInteraction.author);
  const author = isMessage ? messageOrInteraction.author : messageOrInteraction.user;
  const channel = messageOrInteraction.channel;
  const guild = messageOrInteraction.guild;

  if (query.includes('youtube.com/watch') && query.includes('&list=RD')) {
    query = query.split('&list=')[0];
  }

  let songInfo = null;

  if (query.startsWith('http://') || query.startsWith('https://')) {
    const search = await yts(query);
    if (search && search.videos && search.videos.length > 0) {
      const v = search.videos[0];
      songInfo = {
        title: v.title,
        url: v.url,
        duration: v.timestamp || 'Desconocida',
        thumbnail: v.thumbnail,
        requestedBy: author
      };
    } else {
      songInfo = {
        title: 'Canción en línea',
        url: query,
        duration: '03:30',
        thumbnail: 'https://i.ibb.co/Mm7y46n/36m5Vn-E.gif',
        requestedBy: author
      };
    }
  } else {
    const search = await yts(query);
    if (!search || !search.videos.length) {
      throw new Error(`No se encontró ninguna canción para: "${query}"`);
    }
    const v = search.videos[0];
    songInfo = {
      title: v.title,
      url: v.url,
      duration: v.timestamp || 'Desconocida',
      thumbnail: v.thumbnail,
      requestedBy: author
    };
  }

  songInfo.id = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);

  let queue = queues.get(guild.id);
  if (!queue) {
    queue = new MusicQueue(channel, voiceChannel);
    queues.set(guild.id, queue);
  } else {
    queue.textChannel = channel;
    queue.voiceChannel = voiceChannel;
  }

  // Si no hay conexión de voz activa, conectarse inmediatamente
  if (!queue.connection || queue.connection.state.status === VoiceConnectionStatus.Destroyed || queue.connection.state.status === VoiceConnectionStatus.Disconnected) {
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });

    queue.connection = connection;
    connection.subscribe(queue.player);

    try {
      await entersState(queue.connection, VoiceConnectionStatus.Ready, 15_000);
      console.log('🔊 [VOZ DISCORD] Conexión de voz READY confirmada.');
    } catch (err) {
      console.error('❌ [VOZ ERROR]: No se pudo conectar al canal de voz a tiempo:', err);
    }
  } else if (queue.connection) {
    queue.connection.subscribe(queue.player);
  }

  queue.songs.push(songInfo);

  if (!queue.playing) {
    queue.playNext();
  } else {
    queue.updateDashboard();
  }

  return { queue, songInfo };
}

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(config.prefix)) return;

  const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
  const command = args.shift().toLowerCase();
  const voiceChannel = message.member?.voice?.channel;

  // COMANDO DASHBOARD / MENÚ PRINCIPAL (.h, .menu, .panel)
  if (command === 'h' || command === 'menu' || command === 'panel' || command === 'dashboard') {
    if (!voiceChannel) {
      return message.reply('⚠️ ¡Debes estar en un canal de voz para abrir el panel de control!');
    }

    message.delete().catch(() => {}); // Borra el comando .h escrito por el usuario

    let queue = queues.get(message.guild.id);
    if (!queue) {
      queue = new MusicQueue(message.channel, voiceChannel);
      queues.set(message.guild.id, queue);
    } else {
      queue.textChannel = message.channel;
    }

    // Si ya existía un mensaje de menú anterior, lo borramos para que solo quede 1 activo abajo del todo
    if (queue.dashboardMessage) {
      try { await queue.dashboardMessage.delete(); } catch {}
      queue.dashboardMessage = null;
    }

    const data = buildDashboard(queue);
    const dashMsg = await message.channel.send(data);
    queue.dashboardMessage = dashMsg;
  }

  // COMANDO PLAY (.p, .c, .poner, .play, .add)
  else if (command === 'p' || command === 'c' || command === 'poner' || command === 'play' || command === 'add') {
    const query = args.join(' ');
    if (!query) {
      return message.reply(`⚠️ Escribe el nombre o link de la canción. Ejemplo: \`${config.prefix}p JC Reyes Messi\``);
    }
    if (!voiceChannel) {
      return message.reply('⚠️ ¡Debes estar en un canal de voz!');
    }

    const statusMsg = await message.channel.send(`🔍 Buscando **${query}** y conectando al canal de voz...`).catch(() => null);

    try {
      const { queue, songInfo } = await handleAddSong(query, message, voiceChannel);
      if (statusMsg) {
        statusMsg.delete().catch(() => {});
      }
    } catch (err) {
      if (statusMsg) {
        await statusMsg.edit(`❌ Error al reproducir: ${err.message}`).catch(() => {});
      } else {
        message.channel.send(`❌ Error: ${err.message}`).catch(() => {});
      }
    }
  }

  // COMANDO QUITAR DE LA COLA (.r, .remove, .quitar)
  else if (command === 'r' || command === 'remove' || command === 'quitar' || command === 'borrar') {
    const queue = queues.get(message.guild.id);
    if (!queue || queue.songs.length === 0) {
      return message.reply('⚠️ No hay canciones en espera en la cola.');
    }

    const index = parseInt(args[0]);
    if (isNaN(index) || index < 1 || index > queue.songs.length) {
      return message.reply(`⚠️ Indica un número válido (del 1 al ${queue.songs.length}).`);
    }

    const removedSong = queue.songs.splice(index - 1, 1)[0];
    queue.updateDashboard();
    message.delete().catch(() => {});

    const temp = await message.channel.send(`🗑️ Se quitó **${removedSong.title}** de la posición #${index}.`);
    setTimeout(() => temp.delete().catch(() => {}), 5000);
  }

  // COMANDO STOP (.s, .stop)
  else if (command === 's' || command === 'stop' || command === 'detener') {
    const queue = queues.get(message.guild.id);
    if (queue) queue.destroy();
    message.delete().catch(() => {});
  }
  // COMANDO PURGAR/BORRAR TODOS LOS MENSAJES DEL BOT (.borrarmensajes)
  else if (command === 'borrarmensajes' || command === 'limpiartodo' || command === 'purgebot') {
    message.delete().catch(() => {});
    const progressMsg = await message.channel.send('🧹 *Buscando y eliminando todos los mensajes del bot en el servidor...*');

    let totalDeleted = 0;
    try {
      const textChannels = message.guild.channels.cache.filter(
        c => c.isTextBased() && c.permissionsFor(client.user)?.has('ViewChannel') && c.permissionsFor(client.user)?.has('ReadMessageHistory')
      );

      for (const [, ch] of textChannels) {
        try {
          const messages = await ch.messages.fetch({ limit: 100 });
          const botMessages = messages.filter(m => m.author.id === client.user.id && m.id !== progressMsg.id);
          
          if (botMessages.size > 0) {
            for (const [, botMsg] of botMessages) {
              await botMsg.delete().catch(() => {});
              totalDeleted++;
            }
          }
        } catch {}
      }

      // Si había un dashboard registrado, limpiamos la referencia
      const queue = queues.get(message.guild.id);
      if (queue) queue.dashboardMessage = null;

      await progressMsg.edit(`✅ **Limpieza completada:** Se han eliminado **${totalDeleted}** mensajes del bot en todo el servidor.`);
      setTimeout(() => progressMsg.delete().catch(() => {}), 5000);

    } catch (err) {
      console.error(err);
      progressMsg.edit(`❌ Error al limpiar mensajes: ${err.message}`).catch(() => {});
      setTimeout(() => progressMsg.delete().catch(() => {}), 5000);
    }
  }

  // COMANDO SKIP (.sk, .skip)
  else if (command === 'sk' || command === 'skip' || command === 'saltar') {
    const queue = queues.get(message.guild.id);
    if (queue && queue.playing) queue.player.stop(true);
    message.delete().catch(() => {});
  }

  // COMANDO QUEUE (.q, .cola)
  else if (command === 'q' || command === 'queue' || command === 'cola') {
    const queue = queues.get(message.guild.id);
    if (!queue || !queue.playing) return message.reply('⚠️ La cola está vacía.');

    const list = queue.songs.slice(0, 10).map((s, i) => `**${i + 1}.** [${s.title}](${s.url}) - \`${s.duration}\``).join('\n');
    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle(`📜 Cola de Reproducción (${queue.songs.length + 1} temas)`)
      .setDescription(`▶️ **Sonando Ahora:** [${queue.currentSong.title}](${queue.currentSong.url})\n\n${list || '*No hay más canciones en espera.*'}`);

    const temp = await message.reply({ embeds: [embed] });
    setTimeout(() => {
      temp.delete().catch(() => {});
      message.delete().catch(() => {});
    }, 15000);
  }

  // COMANDO AYUDA (.ayuda)
  else if (command === 'ayuda' || command === 'help') {
    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle('🎵 Guía del Bot de Música')
      .setDescription(`Usa **\`${config.prefix}h\`** para abrir la interfaz con botones interactivos que no llena el chat de mensajes.`)
      .addFields(
        { name: '🎛️ Menú Interactivo', value: `\`${config.prefix}h\`` },
        { name: '▶️ Poner música', value: `\`${config.prefix}p <canción>\` o \`${config.prefix}c <canción>\`` },
        { name: '🗑️ Quitar de la cola', value: `\`${config.prefix}r <número>\`` },
        { name: '⏹️ Detener', value: `\`${config.prefix}s\`` },
        { name: '⏭️ Saltar', value: `\`${config.prefix}sk\`` }
      );
    message.reply({ embeds: [embed] });
  }
});

// INTERACCIONES CON BOTONES Y MODALS
client.on('interactionCreate', async (interaction) => {
  try {
    const queue = queues.get(interaction.guildId);
    const voiceChannel = interaction.member?.voice?.channel;

    // 1. Manejo del Modal para añadir canción DIRECTA (ignorando cola)
    if (interaction.isModalSubmit() && interaction.customId === 'modal_add_direct') {
      const query = interaction.fields.getTextInputValue('input_song_query');
      if (!voiceChannel) {
        return interaction.reply({ content: '⚠️ ¡Debes estar en un canal de voz!', ephemeral: true }).catch(() => {});
      }

      await interaction.deferReply({ ephemeral: true }).catch(() => {});

      try {
        const { songInfo, queue: q } = await handleAddSong(query, interaction, voiceChannel);
        if (q.playing && q.songs.length > 0) {
          const directSong = q.songs.pop();
          q.songs.unshift(directSong);
          q.player.stop(true);
        }
        await interaction.editReply({ content: `⚡ **Puesta directamente:** ${songInfo.title} (\`${songInfo.duration}\`)` }).catch(() => {});
        setTimeout(() => { interaction.deleteReply().catch(() => {}); }, 3000);
      } catch (err) {
        await interaction.editReply({ content: `❌ Error: ${err.message}` }).catch(() => {});
        setTimeout(() => { interaction.deleteReply().catch(() => {}); }, 4000);
      }
      return;
    }

    // 2. Manejo del Modal para añadir a la COLA
    if (interaction.isModalSubmit() && interaction.customId === 'modal_add_queue') {
      const query = interaction.fields.getTextInputValue('input_song_query');
      if (!voiceChannel) {
        return interaction.reply({ content: '⚠️ ¡Debes estar en un canal de voz!', ephemeral: true }).catch(() => {});
      }

      await interaction.deferReply({ ephemeral: true }).catch(() => {});

      try {
        const { songInfo, queue: q } = await handleAddSong(query, interaction, voiceChannel);
        await interaction.editReply({ content: `➕ **Añadida a la cola:** ${songInfo.title} (#${q.songs.length})` }).catch(() => {});
        setTimeout(() => { interaction.deleteReply().catch(() => {}); }, 3000);
      } catch (err) {
        await interaction.editReply({ content: `❌ Error: ${err.message}` }).catch(() => {});
        setTimeout(() => { interaction.deleteReply().catch(() => {}); }, 4000);
      }
      return;
    }

    if (!interaction.isButton()) return;

    // Abrir Modal de AÑADIR PISTA DIRECTA
    if (interaction.customId === 'dash_add_direct') {
      if (!voiceChannel) {
        return interaction.reply({ content: '⚠️ ¡Debes estar en un canal de voz!', ephemeral: true }).catch(() => {});
      }

      const modal = new ModalBuilder()
        .setCustomId('modal_add_direct')
        .setTitle('⚡ Poner Pista Directa (Sin Espera)');

      const input = new TextInputBuilder()
        .setCustomId('input_song_query')
        .setLabel('Canción o enlace a reproducir inmediatamente')
        .setPlaceholder('Ej: JC Reyes Messi o pega un link...')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal).catch(() => {});
    }

    // Abrir Modal de AÑADIR A LA COLA
    if (interaction.customId === 'dash_add_queue') {
      if (!voiceChannel) {
        return interaction.reply({ content: '⚠️ ¡Debes estar en un canal de voz!', ephemeral: true }).catch(() => {});
      }

      const modal = new ModalBuilder()
        .setCustomId('modal_add_queue')
        .setTitle('➕ Añadir Pista a la Cola');

      const input = new TextInputBuilder()
        .setCustomId('input_song_query')
        .setLabel('Canción o enlace para poner en cola')
        .setPlaceholder('Ej: Despacito o pega un link...')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal).catch(() => {});
    }

    if (!voiceChannel) {
      return interaction.reply({ content: '⚠️ ¡Debes estar en un canal de voz!', ephemeral: true }).catch(() => {});
    }

    // Pausar / Reanudar en el Dashboard
    if (interaction.customId === 'dash_pause_resume') {
      if (!queue || !queue.playing) return interaction.reply({ content: '⚠️ No hay música activa.', ephemeral: true }).catch(() => {});

      if (queue.paused) {
        queue.player.unpause();
        queue.paused = false;
      } else {
        queue.player.pause();
        queue.paused = true;
      }

      await interaction.update(buildDashboard(queue)).catch(() => {});
    }

    // Canción Anterior en el Dashboard
    else if (interaction.customId === 'dash_prev') {
      if (!queue || queue.previousSongs.length === 0) {
        return interaction.reply({ content: '⚠️ No hay canciones anteriores en el historial.', ephemeral: true }).catch(() => {});
      }
      interaction.deferUpdate().catch(() => {});
      queue.playPrevious();
    }

    // Canción Siguiente (Saltar) en el Dashboard
    else if (interaction.customId === 'dash_skip') {
      if (!queue || !queue.playing) return interaction.reply({ content: '⚠️ No hay música activa.', ephemeral: true }).catch(() => {});
      interaction.deferUpdate().catch(() => {});
      queue.player.stop(true);
    }

    // Quitar / Detener en el Dashboard
    else if (interaction.customId === 'dash_stop') {
      if (!queue || !queue.playing) return interaction.reply({ content: '⚠️ No hay música activa.', ephemeral: true }).catch(() => {});
      interaction.deferUpdate().catch(() => {});
      queue.destroy();
    }

    // Actualizar Dashboard
    else if (interaction.customId === 'dash_refresh') {
      await interaction.update(buildDashboard(queue)).catch(() => {});
    }

    // Ver Cola completa en ventana emergente (efímera con diseño premium rojo y blanco)
    else if (interaction.customId === 'dash_view_queue' || interaction.customId === 'music_queue') {
      if (!queue || (!queue.playing && queue.songs.length === 0)) {
        return interaction.reply({ content: '⚪ **La cola está vacía.** Pulsa `➕ AÑADIR COLA` para poner música.', ephemeral: true }).catch(() => {});
      }

      const current = queue.currentSong;
      const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle('🔴 LISTA DE REPRODUCCIÓN EN CURSO')
        .setDescription(`▶️ **Sonando Ahora:**\n**[${current ? current.title : 'Nada'}](${current ? current.url : ''})**\n⏱️ \`${current ? current.duration : '00:00'}\`  •  👤 ${current ? current.requestedBy : 'N/A'}`)
        .setThumbnail(current ? current.thumbnail : null)
        .setTimestamp();

      if (queue.songs.length > 0) {
        const songFields = queue.songs.slice(0, 8).map((s, i) => {
          return {
            name: `${i === 0 ? '▶️ Siguiente en sonar:' : `\`#${i + 1}\` Pista en espera:`}`,
            value: `🎵 **[${s.title}](${s.url})**\n⏱️ \`${s.duration}\` | 👤 ${s.requestedBy}`,
            inline: false
          };
        });

        embed.addFields(songFields);

        if (queue.songs.length > 8) {
          embed.setFooter({ text: `...y ${queue.songs.length - 8} pistas más en la cola. | Usa .r <número> para eliminar` });
        } else {
          embed.setFooter({ text: `Total en espera: ${queue.songs.length} pistas | Usa .r <número> para eliminar` });
        }
      } else {
        embed.addFields({ name: '📑 Cola de espera', value: '*No hay más pistas en espera. ¡Añade más con el botón de abajo!*', inline: false });
        embed.setFooter({ text: 'Fin de la lista | Prefijo: .' });
      }

      interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
    }
  } catch (err) {
    // Silenciar errores de colisión de instancias concurrentes (Unknown Interaction 10062)
  }
});

process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

client.login(config.token);
