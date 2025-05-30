# Albion Guild Bot

[![License](https://img.shields.io/badge/License-Unlicense-blue.svg)](LICENSE)
[![GitHub last commit](https://img.shields.io/github/last-commit/djshylow/albion-guild-bot)](https://github.com/djshylow/albion-guild-bot/commits/main)

## ❤️ Support This Project

If you find this bot helpful and would like to support its continued development, you can buy me a coffee!

<a href="https://ko-fi.com/djshylow" target="_blank">
  <img src="https://storage.ko-fi.com/cdn/brandasset/kofi_button_dark.png" height="36" alt="Buy Me a Coffee at ko-fi.com" style="border:0px;height:36px;">
</a>

---

## 📝 Description

The Albion Guild Bot is a comprehensive Discord bot designed to streamline guild management for Albion Online. It provides robust features for raid organization, including flexible signup systems, and allows for extensive guild-specific configurations to tailor the bot's behavior to your community's needs.

## ✨ Features

* **Raid Management:**
    * **Create Raids:** Easily set up new raids with customizable dates, times, descriptions, gear requirements, and minimum item power using `/raid setup`.
    * **Preset-based Raids:** Utilize pre-defined raid compositions (presets) for quick and consistent raid setups.
    * **Dynamic Signups:** Players can sign up for specific roles (e.g., Tank, DPS, Healer, Support) via interactive buttons.
    * **Role Switching:** Players can seamlessly switch between roles, automatically being removed from their previous role.
    * **Full Slot Prevention:** Prevents signups for roles that have reached their maximum capacity.
    * **Signup Cancellation:** Players can easily cancel their signups using the `Cancel Signup` button.
    * **Raid Deletion:** Raid creators, server administrators, or designated moderators can delete raids using the `Delete CTA` button.
    * **Live Embed Updates:** Raid embeds dynamically update to show current participants for each role.

* **Guild Management:**
    * **Register Users:** Manually register a user using `/admin register`.
    * **Unregister Users:** Manually unregister a user using `/admin unregister`.
    * **Add Guilds:** Add an Albion Online guild to the database using `/guild add`.
    * **View Members:** View members of a registered Albion Online guild using `/guildmembers`.
    * **Register Character:** Users can register their own Albion Online character using `/register`.

* **Raid Preset Management:**
    * **Create Presets:** Create new raid presets using `/raid preset_create`.
    * **Delete Presets:** Delete existing presets using `/raid preset_delete`.
    * **List Presets:** List all saved raid presets using `/raid preset_list`.

* **Guild Configuration:**
    * **Configure Bot Settings:** Configure guild-specific bot settings using `/setup config`.
    * Define admin and moderator roles for bot command permissions.
    * Set allowed roles for general bot usage.
    * Options for purging users on leave, editing nicknames, and showing guild tags (if implemented).

* **Database Integration:**
    * Uses **MySQL** for persistent data storage via Sequelize ORM.

## 🚀 Installation

To set up and run the bot on your own server, follow these steps:

### Prerequisites

* Node.js (v16.x or higher recommended)
* npm (Node Package Manager)
* A Discord Bot Token (from [Discord Developer Portal](https://discord.com/developers/applications))
* A **MySQL** database.

### Steps

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/djshylow/albion-guild-bot.git](https://github.com/djshylow/albion-guild-bot.git)
    cd albion-guild-bot
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Database Setup:**
    The bot uses Sequelize for database management.

    * **Configure `config/config.json`:** Adjust the database connection settings (`username`, `password`, `database`, `host`, `dialect`) for your `development` and `production` environments. Ensure the `dialect` is set to `'mysql'`.
    * **Run Migrations:**
        ```bash
        npx sequelize db:migrate
        ```
        This will create the necessary tables in your database (e.g., `raid_setups`, `raid_presets`, `guild_configs`).

4.  **Environment Variables (`.env` file):**
    Create a file named `.env` in the root directory of your project and add the following:

    ```env
    # Discord Bot Token & OAuth2 Credentials
    DISCORD_TOKEN=YOUR_BOT_TOKEN_HERE # Get this from your Discord Developer Portal -> Bot -> Token
    DISCORD_CLIENT_ID=YOUR_CLIENT_ID_HERE # Get this from your Discord Developer Portal -> OAuth2 -> General
    DISCORD_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE # Get this from your Discord Developer Portal -> OAuth2 -> General
    DISCORD_CALLBACK_URL=YOUR_REDIRECT_URL # This is usually for OAuth2 flows (e.g., website login). Set this in Discord Developer Portal -> OAuth2 -> Redirects. If not using a website, a placeholder like http://localhost/callback might be sufficient, but ensure it's allowed in Discord's settings.
    SESSION_SECRET=A_VERY_LONG_RANDOM_STRING_HERE # A strong, random string for session encryption. Generate one using a tool or method like 'openssl rand -base64 32'.

    REGISTER_COMMANDS=true # Set to 'true' to register slash commands on bot startup.

    # Guild ID (for development/testing specific guilds, or if commands are guild-scoped)
    GUILD_ID=YOUR_GUILD_ID # Replace with the ID of your Discord Guild (Server).

    # MySQL Database Configuration
    DB_HOST=127.0.0.1
    DB_USER=user
    DB_PASSWORD=password
    DB_NAME=databasename
    ```

    **Where to get Discord credentials:**
    * Go to the [Discord Developer Portal](https://discord.com/developers/applications).
    * Select your application (or create a new one).
    * **`DISCORD_TOKEN`**: Under the "Bot" section, click "Reset Token" (if needed) and copy the token. **Keep this secret!**
    * **`DISCORD_CLIENT_ID`**: Under the "OAuth2" -> "General" section, copy the "Client ID".
    * **`DISCORD_CLIENT_SECRET`**: Under the "OAuth2" -> "General" section, click "Reset Secret" (if needed) and copy the "Client Secret". **Keep this secret!**
    * **`DISCORD_CALLBACK_URL`**: If your bot uses an OAuth2 flow (e.g., for a web dashboard or linking accounts), you'll need to set up "Redirects" under "OAuth2" -> "General" in the Developer Portal. The URL you add there should match this variable. If your bot is purely command-based and doesn't use web logins, this might not be strictly necessary for basic bot functionality, but it's good practice to include a placeholder or remove if confirmed unused.

    **`SESSION_SECRET`**:
    This is a cryptographic key used to sign session cookies, often used in web applications or OAuth2 flows to ensure sessions are secure and untampered. It should be a long, random, and complex string.
    **How to generate a `SESSION_SECRET`**:
    You can generate a suitable string using various methods:
    * **Online Tool:** Search for "random string generator" or "generate UUID".
    * **Command Line (Linux/macOS):** `openssl rand -base64 32` (generates a 32-byte base64 encoded string, which is quite secure).
    * **Node.js Console:** `require('crypto').randomBytes(32).toString('hex')`

5.  **Run the bot:**
    ```bash
    node index.js
    ```
    Or, for development with auto-restarts (requires `nodemon`):
    ```bash
    nodemon index.js
    ```

## 🎮 Usage

### Inviting the Bot

Invite your bot to your Discord server using the OAuth2 URL generated from the Discord Developer Portal (under your bot's application settings -> OAuth2 -> URL Generator). Ensure it has the necessary permissions (e.g., `Read Messages`, `Send Messages`, `Manage Messages`, `Embed Links`, `Manage Roles`, `Use Application Commands`).

### Commands

Once the bot is running and in your server, you can use the following slash commands:

* **`/admin register`**: Manually registers a user.
* **`/admin unregister`**: Manually unregisters a user.
* **`/guild add`**: Adds an Albion Online guild to the database.
* **`/guildmembers`**: Views members of a registered Albion Online guild.
* **`/raid cancel`**: Cancels a raid.
* **`/raid preset_create`**: Creates a new raid preset.
* **`/raid preset_delete`**: Deletes a preset.
* **`/raid preset_list`**: Lists all saved raid presets.
* **`/raid setup`**: Creates a new raid CTA (Call to Action).
* **`/register`**: Registers your Albion Online character.
* **`/setup config`**: Configures the bot settings.

### Raid Interaction

After a raid is created (e.g., using `/raid setup`), an embed message will appear with interactive buttons:

* **Role Buttons (e.g., `Tank`, `Melee DPS`, `Support`):** Click these to sign up for a specific role. If you're already signed up for another role, clicking a new role button will automatically switch you.
* **`Cancel Signup`:** Removes you from any role you're currently signed up for.
* **`Delete CTA`:** Deletes the raid event. This requires permission from the raid creator, an admin, or a designated moderator.

## ⚙️ Configuration

Beyond the `.env` file, the bot's behavior can be customized via Discord commands:

* **Raid Presets:** Define custom raid compositions (e.g., "5v5 H.G.", "ZvZ") using the `/raid preset_create` command. Each preset specifies the number of slots for each role (Tank, DPS, Healer, etc.).
* **Guild Settings:** Use the `/setup config` command to configure:
    * `admin_role`: Role ID for administrators.
    * `mod_role`: Role ID for moderators.
    * `allowed_role`: Role ID for users generally allowed to interact with the bot.
    * `purge_users_on_leave`: (Boolean) Automatically remove data for users who leave the guild.
    * `edit_nick`: (Boolean) Allow the bot to edit user nicknames (for adding tags, etc.).
    * `show_guild_tag`: (Boolean) Display a guild tag in front of user names (requires `edit_nick` enabled).

## 🤝 Contributing

Contributions are welcome! If you find a bug or have a feature request, please open an issue. If you'd like to contribute code, please fork the repository and submit a pull request.

## 📄 License

This project is released under the **Unlicense**. This means it is free and unencumbered software released into the public domain. You are free to copy, modify, publish, use, compile, sell, or distribute this software for any purpose, commercial or non-commercial, and by any means. For more information, please refer to <https://unlicense.org>.

## 📧 Contact

For any questions or inquiries, please open an issue on the GitHub repository.

* **GitHub:** [djshylow](https://github.com/djshylow)

---

Enjoy organizing your Albion Online guild with ease!