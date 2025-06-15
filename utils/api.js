const puppeteer = require('puppeteer');

let browser;

async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
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

class AlbionAPI {
  static async searchPlayers(playerName) {
    const url = `https://gameinfo-sgp.albiononline.com/api/gameinfo/search?q=${encodeURIComponent(playerName)}`;

    try {
      const browser = await getBrowser();
      const page = await browser.newPage();

      await page.setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36");

      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      const body = await page.evaluate(() => document.body.innerText);
      await page.close();

      if (!isJSON(body)) {
        console.error('❌ Non-JSON response from search:', body.slice(0, 300));
        throw new Error('Cloudflare or invalid response (search)');
      }

      const data = JSON.parse(body);
      return data.players || [];

    } catch (error) {
      console.error('Puppeteer search error:', error.message);
      throw new Error('Failed to search players (via Puppeteer)');
    }
  }

  static async getPlayerInfo(playerName) {
    try {
      const players = await this.searchPlayers(playerName);

      const player = players.find(p => p.Name.toLowerCase() === playerName.toLowerCase());
      if (!player) throw new Error('Player not found');

      const detailsUrl = `https://gameinfo-sgp.albiononline.com/api/gameinfo/players/${player.Id}`;
      const browser = await getBrowser();
      const page = await browser.newPage();

      await page.setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36");

      await page.goto(detailsUrl, { waitUntil: 'networkidle2', timeout: 60000 });
      const detailsText = await page.evaluate(() => document.body.innerText);
      await page.close();

      if (!isJSON(detailsText)) {
        console.error('❌ Non-JSON response from player info:', detailsText.slice(0, 300));
        throw new Error('Cloudflare or invalid response (player info)');
      }

      const details = JSON.parse(detailsText);
      return { ...player, ...details };

    } catch (error) {
      console.error('Puppeteer player info error:', error.message);
      throw error;
    }
  }

  static async closeBrowser() {
    if (browser) {
      await browser.close();
      browser = null;
    }
  }
}

module.exports = AlbionAPI;
