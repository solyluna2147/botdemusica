require('dotenv').config();

module.exports = {
  token: process.env.DISCORD_TOKEN || '',
  prefix: process.env.PREFIX || '.',
  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID || undefined,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || undefined,
  },
  colors: {
    primary: 0xEE1133,   // Rojo brillante / Carmesí
    success: 0xFF2244,   // Rojo vivo
    warning: 0xFFFFFF,   // Blanco puro
    error: 0x990011,     // Rojo oscuro
    music: 0xDC143C      // Crimson / Rojo música premium
  }
};
