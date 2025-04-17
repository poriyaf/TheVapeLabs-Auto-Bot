# VapeLabs Auto Bot

An automated bot for TheVapeLabs airdrop platform that handles battery tapping and daily missions automatically.

## Register

- Link https://app.thevapelabs.io/login?ref=225a8625-ae57-4cc6-8542-72f6e4e35225

## Features

- ✅ Auto-tapping battery when below 50% until it reaches 100%
- ✅ Multi-account support with token-based authentication
- ✅ Proxy support for rotating IPs
- ✅ Daily check-in automation
- ✅ Automatic mission completion
- ✅ Interactive terminal UI with real-time status updates
- ✅ Auto-switching between accounts for monitoring

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/airdropinsiders/TheVapeLabs-Auto-Bot.git
   cd TheVapeLabs-Auto-Bot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your tokens (see Configuration section below)

4. Run the bot:
   ```bash
   node index.js
   ```

## Configuration

### Token Setup

There are two ways to set up your VapeLabs tokens:

#### Option 1: Using tokens.txt file (Recommended)

Create a `tokens.txt` file in the root directory and add one token per line:

```
token1_here
token2_here
token3_here
```

#### Option 2: Using .env file

Create a `.env` file in the root directory and add your tokens:

```
TOKEN_1=your_first_token_here
TOKEN_2=your_second_token_here
TOKEN_3=your_third_token_here
```

### Proxy Setup (Optional)

Create a `proxies.txt` file in the root directory and add one proxy per line in the format `ip:port` or `ip:port:username:password`:

```
http://123.45.67.89:8080
http://username:password@ip:port
```

## Usage

The bot features an interactive terminal UI:

- Use **Arrow Keys** (← →) to navigate between accounts
- Press **Q** to quit the bot

### Battery Tapping Logic

- When battery is **below 50%**, the bot will automatically tap (5 taps every 20 seconds) until it reaches 100%
- When battery is **100%**, the bot will wait until it drops below 50% to start tapping again
- When battery is **between 50% and 100%**, the bot will wait until it drops below 50%

## Troubleshooting

- If you're experiencing rate limiting (429 errors), consider:
  - Adding more proxies to `proxies.txt`
  - Increasing the delay between requests

## Disclaimer

This project is for educational purposes only. Use at your own risk. The developers are not responsible for any consequences that may arise from using this bot.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Credits

Created by Airdrop Insiders