const axios = require('axios');

const ALBION_API_BASE = 'https://gameinfo-sgp.albiononline.com/api/gameinfo';

class AlbionAPI {
    static async searchPlayers(playerName) {
        try {
            const response = await axios.get(`${ALBION_API_BASE}/search?q=${encodeURIComponent(playerName)}`);
            return response.data.players || [];
        } catch (error) {
            console.error('Search error:', error.response?.data || error.message);
            throw new Error('Failed to search players');
        }
    }

    static async getPlayerInfo(playerName) {
        try {
            const players = await this.searchPlayers(playerName);
            
            // Case-insensitive exact match
            const player = players.find(p => p.Name.toLowerCase() === playerName.toLowerCase());
            if (!player) throw new Error('Player not found');

            // Get detailed info
            const details = await axios.get(`${ALBION_API_BASE}/players/${player.Id}`);
            return {
                ...player,
                ...details.data
            };
        } catch (error) {
            console.error('Player info error:', error.response?.data || error.message);
            throw error;
        }
    }
	static async getGuildMembers(guildId) {
		try {
			const response = await axios.get(`${ALBION_API_BASE}/guilds/${guildId}/members`);
			return response.data;
		} catch (error) {
			console.error('Guild members error:', error.response?.data || error.message);
			throw new Error('Failed to fetch guild members');
		}
	}
    static async getGuildInfo(guildId) {
        try {
            const response = await axios.get(`${ALBION_API_BASE}/guilds/${guildId}`);
            return response.data;
        } catch (error) {
            console.error('Guild error:', error.response?.data || error.message);
            throw new Error('Failed to get guild info');
        }
    }
}

module.exports = AlbionAPI;