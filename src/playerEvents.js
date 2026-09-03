const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('./config');

/**
 * Crea la barra de controles interactivos (botones)
 */
function createControlButtons(queue) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('music_pause_resume')
      .setLabel(queue.paused ? '▶️ Reanudar' : '⏸️ Pausar')
      .setStyle(queue.paused ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('music_skip')
      .setLabel('⏭️ Saltar')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('music_stop')
      .setLabel('⏹️ Detener')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('music_queue')
      .setLabel('📜 Cola')
      .setStyle(ButtonStyle.Secondary)
  );
  return row;
}

/**
 * Registra los eventos del reproductor de DisTube
 */
function setupPlayerEvents(distube) {
  // Cuando empieza a reproducir una canción
  distube.on('playSong', (queue, song) => {
    const embed = new EmbedBuilder()
      .setColor(config.colors.music)
      .setTitle('🎶 Reproduciendo Ahora')
      .setDescription(`**[${song.name}](${song.url})**`)
      .addFields(
        { name: '⏱️ Duración', value: `\`${song.formattedDuration}\``, inline: true },
        { name: '👤 Solicitado por', value: `${song.user}`, inline: true },
        { name: '🔊 Volumen', value: `\`${queue.volume}%\``, inline: true }
      )
      .setThumbnail(song.thumbnail)
      .setFooter({ text: `Fuente: ${song.source.toUpperCase()} | Prefijo: ${config.prefix}` })
      .setTimestamp();

    queue.textChannel?.send({
      embeds: [embed],
      components: [createControlButtons(queue)]
    }).catch(console.error);
  });

  // Cuando se añade una canción a la cola
  distube.on('addSong', (queue, song) => {
    const embed = new EmbedBuilder()
      .setColor(config.colors.success)
      .setTitle('➕ Añadido a la Cola')
      .setDescription(`**[${song.name}](${song.url})**`)
      .addFields(
        { name: '⏱️ Duración', value: `\`${song.formattedDuration}\``, inline: true },
        { name: '📍 Posición', value: `#${queue.songs.length}`, inline: true },
        { name: '👤 Pedido por', value: `${song.user}`, inline: true }
      )
      .setThumbnail(song.thumbnail);

    queue.textChannel?.send({ embeds: [embed] }).catch(console.error);
  });

  // Cuando se añade una playlist completa
  distube.on('addList', (queue, playlist) => {
    const embed = new EmbedBuilder()
      .setColor(config.colors.success)
      .setTitle('📋 Playlist Añadida')
      .setDescription(`**[${playlist.name}](${playlist.url})**`)
      .addFields(
        { name: '🎵 Total canciones', value: `\`${playlist.songs.length}\``, inline: true },
        { name: '⏱️ Duración total', value: `\`${playlist.formattedDuration}\``, inline: true },
        { name: '👤 Pedido por', value: `${playlist.user}`, inline: true }
      )
      .setThumbnail(playlist.thumbnail);

    queue.textChannel?.send({ embeds: [embed] }).catch(console.error);
  });

  // Manejo de errores del reproductor
  distube.on('error', (channel, error) => {
    console.error('Error de DisTube:', error?.message || error);
    if (channel && typeof channel.send === 'function') {
      const embed = new EmbedBuilder()
        .setColor(config.colors.error)
        .setTitle('❌ Error de Reproducción')
        .setDescription(`\`${error?.message || error || 'Error desconocido'}\``);
      channel.send({ embeds: [embed] }).catch(console.error);
    }
  });

  // Cuando se termina la cola
  distube.on('finish', (queue) => {
    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setDescription('🏁 **La cola ha terminado.** ¡Añade más música con `.p <nombre/url>`!');
    queue.textChannel?.send({ embeds: [embed] }).catch(console.error);
  });

  // Cuando el canal de voz queda vacío
  distube.on('empty', (queue) => {
    const embed = new EmbedBuilder()
      .setColor(config.colors.warning)
      .setDescription('👋 El canal de voz se quedó vacío. Me he desconectado para ahorrar recursos.');
    queue.textChannel?.send({ embeds: [embed] }).catch(console.error);
  });

  // Cuando el bot es desconectado
  distube.on('disconnect', (queue) => {
    const embed = new EmbedBuilder()
      .setColor(config.colors.warning)
      .setDescription('🔌 Desconectado del canal de voz.');
    queue.textChannel?.send({ embeds: [embed] }).catch(console.error);
  });
}

module.exports = { setupPlayerEvents, createControlButtons };
