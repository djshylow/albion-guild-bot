# Albion Guild Bot

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub last commit](https://img.shields.io/github/last-commit/djshylow/albion-guild-bot)](https://github.com/djshylow/albion-guild-bot/commits/main)

## 📝 Description

The Albion Guild Bot is a comprehensive Discord bot designed to streamline guild management for Albion Online. It provides robust features for raid organization, including flexible signup systems, and allows for extensive guild-specific configurations to tailor the bot's behavior to your community's needs.

## ✨ Features

* **Raid Management:**
    * **Create Raids:** Easily set up new raids with customizable dates, times, descriptions, gear requirements, and minimum item power.
    * **Preset-based Raids:** Utilize pre-defined raid compositions (presets) for quick and consistent raid setups.
    * **Dynamic Signups:** Players can sign up for specific roles (e.g., Tank, DPS, Healer, Support) via interactive buttons.
    * **Role Switching:** Players can seamlessly switch between roles, automatically being removed from their previous role.
    * **Full Slot Prevention:** Prevents signups for roles that have reached their maximum capacity.
    * **Signup Cancellation:** Players can easily cancel their signups.
    * **Raid Deletion:** Raid creators, server administrators, or designated moderators can delete raids.
    * **Live Embed Updates:** Raid embeds dynamically update to show current participants for each role.

* **Guild Configuration:**
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
    DISCORD_TOKEN=YOUR_DISCORD_BOT_TOKEN
    # Optional: If you're using a specific debug namespace
    DEBUG=bot:*
    ```
    Replace `YOUR_DISCORD_BOT_TOKEN` with your actual bot token from the Discord Developer Portal.

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

Once the bot is running and in your server, you can use slash commands:

* **`/raid`**: Creates a new raid event.
    * You'll be prompted to provide details like date, time, and to select a preset.
* **`/setup`**: Configures guild-specific settings for the bot, such as admin roles, moderator roles, and other preferences.

### Raid Interaction

After a raid is created, an embed message will appear with interactive buttons:

* **Role Buttons (e.g., `Tank`, `Melee DPS`, `Support`):** Click these to sign up for a specific role. If you're already signed up for another role, clicking a new role button will automatically switch you.
* **`Cancel Signup`:** Removes you from any role you're currently signed up for.
* **`Delete CTA`:** Deletes the raid event. This requires permission from the raid creator, an admin, or a designated moderator.

## ⚙️ Configuration

Beyond the `.env` file, the bot's behavior can be customized via Discord commands:

* **Raid Presets:** Define custom raid compositions (e.g., "5v5 H.G.", "ZvZ") using the `/raid preset` command (if implemented as a subcommand, or via direct database interaction). Each preset specifies the number of slots for each role (Tank, DPS, Healer, etc.).
* **Guild Settings:** Use the `/setup` command to configure:
    * `admin_role`: Role ID for administrators.
    * `mod_role`: Role ID for moderators.
    * `allowed_role`: Role ID for users generally allowed to interact with the bot.
    * `purge_users_on_leave`: (Boolean) Automatically remove data for users who leave the guild.
    * `edit_nick`: (Boolean) Allow the bot to edit user nicknames (for adding tags, etc.).
    * `show_guild_tag`: (Boolean) Display a guild tag in front of user names (requires `edit_nick` enabled).

## 🤝 Contributing

Contributions are welcome! If you find a bug or have a feature request, please open an issue. If you'd like to contribute code, please fork the repository and submit a pull request.

## ❤️ Support

If you find this bot helpful and would like to support its development, you can buy me a coffee!

* [**Ko-fi: djshylow**](https://ko-fi.com/djshylow)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📧 Contact

For any questions or inquiries, please open an issue on the GitHub repository.

* **GitHub:** [djshylow](https://github.com/djshylow)

---

Enjoy organizing your Albion Online guild with ease!