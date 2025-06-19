const puppeteer = require('puppeteer');
const axios = require('axios');
const { createLogger, transports } = require('winston');

// Configure logging
const logger = createLogger({
  level: 'debug',
  transports: [
    new transports.Console({
      format: require('winston').format.combine(
        require('winston').format.colorize(),
        require('winston').format.simple()
      )
    }),
    new transports.File({ filename: 'albion-api.log' })
  ]
});

const ALBION_API_BASE = 'https://gameinfo-sgp.albiononline.com/api/gameinfo';

// Puppeteer browser instance
let browser;
let isPuppeteerEnabled = true;

async function getBrowser() {
  if (!browser && isPuppeteerEnabled) {
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        timeout: 30000
      });
      logger.info('Puppeteer browser launched successfully');
    } catch (error) {
      logger.error('Failed to launch Puppeteer, falling back to axios', error);
      isPuppeteerEnabled = false;
    }
  }
  return browser;
}

function isJSON(str) {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

async function fetchWithPuppeteer(url) {
  const browser = await getBrowser();
  if (!browser) {
    throw new Error('Puppeteer not available');
  }

  const page = await browser.newPage();
  try {
    await page.setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36");
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });

    logger.debug(`Fetching with Puppeteer: ${url}`);
    await page.goto(url, { 
      waitUntil: 'networkidle2', 
      timeout: 60000 
    });

    const body = await page.evaluate(() => document.body.innerText);
    if (!isJSON(body)) {
      throw new Error('Non-JSON response');
    }

    return JSON.parse(body);
  } finally {
    await page.close().catch(e => logger.warn('Page close error:', e));
  }
}

async function fetchWithAxios(url) {
  try {
    logger.debug(`Fetching with Axios: ${url}`);
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    return response.data;
  } catch (error) {
    logger.debug(`Axios request failed: ${error.message}`);
    throw error;
  }
}

async function fetchWithFallback(url) {
  // First try with Axios (faster)
  try {
    return await fetchWithAxios(url);
  } catch (axiosError) {
    logger.debug(`Axios failed, trying Puppeteer: ${axiosError.message}`);
    
    // Fall back to Puppeteer if enabled
    if (isPuppeteerEnabled) {
      try {
        return await fetchWithPuppeteer(url);
      } catch (puppeteerError) {
        logger.error(`Both Axios and Puppeteer failed for ${url}`);
        throw new Error(`API request failed: ${puppeteerError.message}`);
      }
    }
    
    throw new Error(`API request failed and Puppeteer not available: ${axiosError.message}`);
  }
}

class AlbionAPI {
  static async searchPlayers(playerName) {
    const url = `${ALBION_API_BASE}/search?q=${encodeURIComponent(playerName)}`;
    logger.info(`Searching players: ${playerName}`);

    try {
      const data = await fetchWithFallback(url);
      logger.debug(`Found ${data.players?.length || 0} players matching "${playerName}"`);
      return data.players || [];
    } catch (error) {
      logger.error(`Player search failed for "${playerName}": ${error.message}`);
      throw new Error(`Failed to search players: ${error.message}`);
    }
  }

  static async getPlayerInfo(playerName) {
    logger.info(`Getting player info: ${playerName}`);
    
    try {
      const players = await this.searchPlayers(playerName);
      const player = players.find(p => p.Name.toLowerCase() === playerName.toLowerCase());
      
      if (!player) {
        throw new Error(`Player "${playerName}" not found in search results`);
      }

      const detailsUrl = `${ALBION_API_BASE}/players/${player.Id}`;
      const details = await fetchWithFallback(detailsUrl);
      
      logger.debug(`Player info retrieved for ${playerName}: ${player.Id}`);
      return { ...player, ...details };
    } catch (error) {
      logger.error(`Failed to get player info for "${playerName}": ${error.message}`);
      throw error;
    }
  }

  static async getGuildMembers(guildId) {
    if (!guildId) {
      throw new Error('Guild ID is required');
    }

    const url = `${ALBION_API_BASE}/guilds/${guildId}/members`;
    logger.info(`Fetching guild members: ${guildId}`);

    try {
      const members = await fetchWithFallback(url);
      logger.debug(`Found ${members.length} members in guild ${guildId}`);
      return members;
    } catch (error) {
      logger.error(`Failed to get guild members for ${guildId}: ${error.message}`);
      throw new Error(`Failed to fetch guild members: ${error.message}`);
    }
  }

  static async getGuildInfo(guildId) {
    const url = `${ALBION_API_BASE}/guilds/${guildId}`;
    logger.info(`Fetching guild info: ${guildId}`);

    try {
      const guildInfo = await fetchWithFallback(url);
      logger.debug(`Guild info retrieved for ${guildId}: ${guildInfo.Name}`);
      return guildInfo;
    } catch (error) {
      logger.error(`Failed to get guild info for ${guildId}: ${error.message}`);
      throw new Error(`Failed to fetch guild info: ${error.message}`);
    }
  }

  static async close() {
    if (browser) {
      await browser.close().catch(e => logger.warn('Browser close error:', e));
      browser = null;
    }
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await AlbionAPI.close();
  process.exit();
});

module.exports = AlbionAPI;