require('dotenv').config();
const axios = require('axios');
const blessed = require('blessed');
const fs = require('fs');
const { HttpsProxyAgent } = require('https-proxy-agent');

const API_BASE_URL = 'https://api.thevapelabs.net/v1.0';

const HEADERS = {
    'accept': '*/*',
    'accept-language': 'en-US,en;q=0.7',
    'content-type': 'application/json',
    'sec-ch-ua': '"Brave";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'cross-site',
    'sec-gpc': '1',
    'Referer': 'https://app.thevapelabs.io/',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
};

const proxies = fs.existsSync('proxies.txt')
    ? fs.readFileSync('proxies.txt', 'utf-8')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
    : [];
if (proxies.length === 0) {
    console.warn('No proxies found in proxies.txt. Running without proxies.');
}

const accounts = [];
const tokenFile = 'tokens.txt';
if (fs.existsSync(tokenFile)) {
    const tokens = fs.readFileSync(tokenFile, 'utf-8')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    tokens.forEach((token, index) => {
        accounts.push({
            token,
            proxy: proxies.length > 0 ? proxies[Math.floor(Math.random() * proxies.length)] : null,
            id: `Account ${index + 1}`,
            batteryStatus: 'initial',
            batteryLevel: 0,
            autoTapping: false,
            timeLeftMinutes: 0
        });
    });
} else {
    for (let i = 1; ; i++) {
        const token = process.env[`TOKEN_${i}`];
        if (!token) break;
        accounts.push({
            token,
            proxy: proxies.length > 0 ? proxies[Math.floor(Math.random() * proxies.length)] : null,
            id: `Account ${i}`,
            batteryStatus: 'initial',
            batteryLevel: 0,
            autoTapping: false,
            timeLeftMinutes: 0
        });
    }
}
if (accounts.length === 0) {
    throw new Error('No valid tokens found in tokens.txt or .env file');
}

const screen = blessed.screen({
    smartCSR: true,
    title: 'VapeLabs AUTO Bot'
});

const headerBox = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: 3,
    content: '{center}VAPELABS AUTO BOT - AIRDROP INSIDERS{/center}',
    tags: true,
    style: { fg: 'cyan', bg: 'black' }
});

const modeBox = blessed.box({
    top: 3,
    left: 0,
    width: '100%',
    height: 3,
    content: `{center}CURRENT MODE: {green-fg}AUTO-TAPPING{/green-fg} | Account 1 of ${accounts.length}{/center}`,
    tags: true,
    style: { fg: 'yellow', bg: 'black', border: { fg: 'white' } },
    border: { type: 'line' }
});

const userInfoBox = blessed.box({
    top: 6,
    left: 0,
    width: '100%',
    height: 7,
    content: 'Loading user info...',
    tags: true,
    style: { fg: 'white', bg: 'black', border: { fg: 'white' } },
    border: { type: 'line' }
});

const tappingStatusBox = blessed.box({
    top: 13,
    left: 0,
    width: '100%',
    height: 9,
    content: 'Loading tapping status...',
    tags: true,
    style: { fg: 'white', bg: 'black', border: { fg: 'white' } },
    border: { type: 'line' }
});

const logBox = blessed.log({
    top: 22,
    left: 0,
    width: '100%',
    height: 60,
    content: '',
    tags: true,
    scrollable: true,
    mouse: true,
    style: { fg: 'white', bg: 'black', border: { fg: 'white' } },
    border: { type: 'line' },
    scrollbar: { ch: ' ', style: { bg: 'blue' } }
});

const statusBox = blessed.box({
    bottom: 0,
    left: 0,
    width: '100%',
    height: 3,
    content: '{center}Press [q] to Quit | [←] Prev Account | [→] Next Account{/center}',
    tags: true,
    style: { fg: 'white', bg: 'black', border: { fg: 'white' } },
    border: { type: 'line' }
});

screen.append(headerBox);
screen.append(modeBox);
screen.append(userInfoBox);
screen.append(tappingStatusBox);
screen.append(logBox);
screen.append(statusBox);

let currentAccountIndex = 0;

function logMessage(message, type = 'info', accountId = '') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = accountId ? `[${accountId}] ` : '';
    let coloredMessage;
    switch (type) {
        case 'error':
            coloredMessage = `{red-fg}[${timestamp}] ${prefix}${message}{/red-fg}`;
            break;
        case 'success':
            coloredMessage = `{green-fg}[${timestamp}] ${prefix}${message}{/green-fg}`;
            break;
        case 'warning':
            coloredMessage = `{yellow-fg}[${timestamp}] ${prefix}${message}{/yellow-fg}`;
            break;
        default:
            coloredMessage = `{white-fg}[${timestamp}] ${prefix}${message}{/white-fg}`;
    }
    logBox.log(coloredMessage);
    screen.render();
}

function normalizeProxy(proxy) {
    if (!proxy) return null;
    if (!proxy.startsWith('http://') && !proxy.startsWith('https://')) {
        proxy = `http://${proxy}`;
    }
    return proxy;
}

async function apiRequest(url, method = 'POST', data = null, token = null, proxy = null, accountId = '', retryCount = 0) {
    const config = {
        method,
        url,
        headers: { ...HEADERS, 'authorization': `Bearer ${token}` },
    };
    if (data) config.data = data;
    if (proxy) {
        config.httpsAgent = new HttpsProxyAgent(normalizeProxy(proxy));
    }
    try {
        const response = await axios(config);
        return response.data;
    } catch (error) {
        if (error.response && error.response.status === 429) {
            if (retryCount < 3) {
                const backoff = Math.pow(2, retryCount) * 10000; 
                logMessage(`Rate limit hit (429), retrying in ${backoff / 1000} seconds...`, 'warning', accountId);
                await new Promise(resolve => setTimeout(resolve, backoff));
                return apiRequest(url, method, data, token, proxy, accountId, retryCount + 1);
            } else {
                logMessage('Max retries reached for rate limit (429)', 'error', accountId);
            }
        } else {
            logMessage(`API error: ${error.message}`, 'error', accountId);
        }
        throw error;
    }
}

async function performTapOrGetInfo(account) {
    try {
        await apiRequest(
            `${API_BASE_URL}/user/info?`,
            'POST',
            { tab_number: 1, init_data: '' },
            account.token,
            account.proxy,
            account.id
        );

        await apiRequest(
            `${API_BASE_URL}/user/info?`,
            'POST',
            { tab_number: 0, init_data: '' },
            account.token,
            account.proxy,
            account.id
        );

        const response = await apiRequest(
            `${API_BASE_URL}/user/info?`,
            'POST',
            { init_data: '', tab_number: 0 },
            account.token,
            account.proxy,
            account.id
        );
        
        if (response && response.code === 200 && response.data) {
            return response.data;
        }
        logMessage('Unexpected response from user/info', 'error', account.id);
        return null;
    } catch (error) {
        logMessage(`Error in tap/user info: ${error.message}`, 'error', account.id);
        return null;
    }
}

async function performTapBurst(account) {
    if (account.batteryStatus !== 'tapping' || !account.autoTapping) {
        return;
    }

    for (let i = 1; i <= 5; i++) {
        try {
            if (!account.autoTapping || account.batteryStatus !== 'tapping') {
                logMessage(`Stopping tap burst as tapping is now disabled`, 'warning', account.id);
                break;
            }

            const tapResult = await performTapOrGetInfo(account);
            if (tapResult) {
                const newBatteryLevel = tapResult.battery || account.batteryLevel;
                const newPoints = tapResult.points || 0;
                const newTimeLeftMinutes = tapResult.time_leave || account.timeLeftMinutes;

                logMessage(`Tap ${i}/5 successful, Points: ${newPoints}, Battery: ${newBatteryLevel}%`, 'success', account.id);

                if (newBatteryLevel !== account.batteryLevel) {
                    logMessage(
                        newBatteryLevel > account.batteryLevel
                            ? `Battery increased: ${account.batteryLevel}% → ${newBatteryLevel}%`
                            : `Battery decreased: ${account.batteryLevel}% → ${newBatteryLevel}%`,
                        'info',
                        account.id
                    );
                    account.batteryLevel = newBatteryLevel;
                }

                account.timeLeftMinutes = newTimeLeftMinutes;

                if (newBatteryLevel >= 100) {
                    account.autoTapping = false;
                    account.batteryStatus = 'full';
                    logMessage('Battery full (100%), stopping auto-tapping, will wait until below 50%', 'warning', account.id);
                    break;
                }
            } else {
                logMessage(`Tap ${i}/5 failed`, 'error', account.id);
            }
        } catch (error) {
            logMessage(`Error during tap ${i}/5: ${error.message}`, 'error', account.id);
        }

        if (i < 5 && account.autoTapping && account.batteryStatus === 'tapping') {
            await new Promise(resolve => setTimeout(resolve, 4000));
        } else {
            break;  
        }
    }
}

async function completeMission(account, taskId, link = '') {
    try {
        const response = await apiRequest(
            `${API_BASE_URL}/missions/completed?`,
            'POST',
            { task_id: taskId, link },
            account.token,
            account.proxy,
            account.id
        );
        if (response && response.code === 200) {
            return true;
        }
        logMessage(`Failed to complete mission ${taskId}`, 'error', account.id);
        return false;
    } catch (error) {
        logMessage(`Error completing mission ${taskId}: ${error.message}`, 'error', account.id);
        return false;
    }
}

async function getTaskCategories(account, tabNumber) {
    try {
        const response = await apiRequest(
            `${API_BASE_URL}/missions/get?id=${tabNumber}`,
            'GET',
            null,
            account.token,
            account.proxy,
            account.id
        );
        if (response && response.code === 200 && response.data) {
            if (Array.isArray(response.data)) {
                logMessage(`Tasks in Tab ${tabNumber}:`, 'info', account.id);
                response.data.forEach(category => {
                    if (category.tasks && Array.isArray(category.tasks)) {
                        category.tasks.forEach(task => {
                            logMessage(
                                `  - Task ID: ${task.id}, Title: ${task.title}, Status: ${task.status === 0 ? 'Not Completed' : 'Completed/In Progress'}`,
                                'info',
                                account.id
                            );
                        });
                    }
                });
            }
            return response.data;
        }
        logMessage(`No tasks found for tab ${tabNumber}`, 'warning', account.id);
        return [];
    } catch (error) {
        logMessage(`Error getting tasks for tab ${tabNumber}: ${error.message}`, 'error', account.id);
        return [];
    }
}

async function getAllAvailableTasks(account) {
    const allTasks = [];
    for (let tabNumber = 1; tabNumber <= 3; tabNumber++) {
        const taskCategories = await getTaskCategories(account, tabNumber);
        if (Array.isArray(taskCategories)) {
            for (const category of taskCategories) {
                if (category.tasks && Array.isArray(category.tasks)) {
                    allTasks.push(...category.tasks);
                }
            }
        }
    }
    return allTasks;
}

async function updateUserInfo(account) {
    try {
        const userInfo = await performTapOrGetInfo(account);
        if (userInfo) {
            userInfoBox.setContent(
                `{yellow-fg}Account ID:{/yellow-fg} {green-fg}${account.id}{/green-fg}\n` +
                `{yellow-fg}Username:{/yellow-fg} {green-fg}${userInfo.info?.username || 'N/A'}{/green-fg}\n` +
                `{yellow-fg}Points:{/yellow-fg} {green-fg}${userInfo.points || 0}{/green-fg}\n` +
                `{yellow-fg}Battery:{/yellow-fg} {green-fg}${userInfo.battery || 0}%{/green-fg}`
            );
        } else {
            userInfoBox.setContent(
                `{yellow-fg}Account ID:{/yellow-fg} {green-fg}${account.id}{/green-fg}\n` +
                `{red-fg}Failed to fetch user info{/red-fg}`
            );
        }
    } catch (error) {
        logMessage(`Error updating user info: ${error.message}`, 'error', account.id);
        userInfoBox.setContent(
            `{yellow-fg}Account ID:{/yellow-fg} {green-fg}${account.id}{/green-fg}\n` +
            `{red-fg}Failed to fetch user info{/red-fg}`
        );
    }
    screen.render();
}

async function updateTappingStatus(account) {
    try {
        const userInfo = await performTapOrGetInfo(account);
        if (userInfo) {
            const proxyDisplay = account.proxy ? normalizeProxy(account.proxy) : 'None';
            const batteryLevel = userInfo.battery || 0;
            const timeLeftMinutes = userInfo.time_leave || 0;
            const hours = Math.floor(timeLeftMinutes / 60);
            const minutes = timeLeftMinutes % 60;
            const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

            let status = 'Idle';
            if (account.batteryStatus === 'full') {
                status = 'Battery Full (100%), Waiting for <50%';
            } else if (account.batteryStatus === 'tapping') {
                status = 'Auto-Tapping (5 taps/20s) until 100%';
            } else if (account.batteryStatus === 'waiting') {
                status = 'Waiting for battery to drop below 50%';
            }

            tappingStatusBox.setContent(
                `{yellow-fg}Account ID:{/yellow-fg} {green-fg}${account.id}{/green-fg}\n` +
                `{yellow-fg}Proxy:{/yellow-fg} {green-fg}${proxyDisplay}{/green-fg}\n` +
                `{yellow-fg}Tapping Status:{/yellow-fg} {green-fg}${status}{/green-fg}\n` +
                `{yellow-fg}Battery Level:{/yellow-fg} {green-fg}${batteryLevel}%{/green-fg}\n` +
                `{yellow-fg}Time Left:{/yellow-fg} {green-fg}${formattedTime}{/green-fg}`
            );

            if (!account.countdownInterval) {
                startCountdown(account);
            }
        } else {
            const proxyDisplay = account.proxy ? normalizeProxy(account.proxy) : 'None';
            tappingStatusBox.setContent(
                `{yellow-fg}Account ID:{/yellow-fg} {green-fg}${account.id}{/green-fg}\n` +
                `{yellow-fg}Proxy:{/yellow-fg} {green-fg}${proxyDisplay}{/green-fg}\n` +
                `{red-fg}Failed to fetch tapping status{/red-fg}`
            );
        }
    } catch (error) {
        logMessage(`Error updating tapping status: ${error.message}`, 'error', account.id);
        userInfoBox.setContent(
            `{yellow-fg}Account ID:{/yellow-fg} {green-fg}${account.id}{/green-fg}\n` +
            `{red-fg}Failed to fetch tapping status{/red-fg}`
        );
    }
    screen.render();
}

function startCountdown(account) {
    if (account.countdownInterval) {
        clearInterval(account.countdownInterval);
    }

    const updateCountdown = async () => {
        try {
            const userInfo = await performTapOrGetInfo(account);
            if (userInfo) {
                const timeLeftMinutes = userInfo.time_leave || 0;
                const batteryLevel = userInfo.battery || 0;

                account.timeLeftMinutes = timeLeftMinutes;

                if (batteryLevel !== account.batteryLevel) {
                    logMessage(
                        batteryLevel > account.batteryLevel
                            ? `Battery increased: ${account.batteryLevel}% → ${batteryLevel}%`
                            : `Battery decreased: ${account.batteryLevel}% → ${batteryLevel}%`,
                        'info',
                        account.id
                    );
                    account.batteryLevel = batteryLevel;

                    if (account.batteryStatus === 'full' && batteryLevel < 50) {
                        account.batteryStatus = 'tapping';
                        account.autoTapping = true;
                        logMessage('Battery below 50%, starting auto-tapping (5 taps/20s) until 100%', 'success', account.id);
                    }
                    else if (batteryLevel >= 100 && account.batteryStatus !== 'full') {
                        account.batteryStatus = 'full';
                        account.autoTapping = false;
                        logMessage('Battery full (100%), stopping auto-tapping, will wait until below 50%', 'warning', account.id);
                    }
                    else if (account.batteryStatus === 'waiting' && batteryLevel < 50) {
                        account.batteryStatus = 'tapping';
                        account.autoTapping = true;
                        logMessage('Battery dropped below 50%, starting auto-tapping (5 taps/20s) until 100%', 'success', account.id);
                    }
                }

                if (currentAccountIndex === accounts.indexOf(account)) {
                    await updateTappingStatus(account);
                }
            }
        } catch (error) {
            logMessage(`Error in countdown update: ${error.message}`, 'error', account.id);
        }
    };

    updateCountdown();

    account.countdownInterval = setInterval(updateCountdown, 30000); 
}

async function runBot() {
    logMessage(`Starting VapeLabs Auto-Tapping Bot for ${accounts.length} account(s)`, 'info');

    for (const account of accounts) {
        try {
            logMessage(`Using proxy: ${account.proxy || 'None'}`, 'info', account.id);

            const checkInResult = await completeMission(account, 247);
            if (checkInResult) {
                logMessage('Daily check-in completed successfully', 'success', account.id);
            } else {
                logMessage('Daily check-in failed or already completed', 'warning', account.id);
            }

            const availableTasks = await getAllAvailableTasks(account);
            if (availableTasks.length > 0) {
                logMessage(`Found ${availableTasks.length} tasks to process`, 'info', account.id);
                for (const task of availableTasks) {
                    if (task.status === 0) {
                        const result = await completeMission(account, task.id, task.link);
                        logMessage(
                            result ? `Completed task: ${task.title}` : `Failed to complete task: ${task.title}`,
                            result ? 'success' : 'error',
                            account.id
                        );
                        await new Promise(resolve => setTimeout(resolve, 3000));
                    } else {
                        logMessage(`Task already completed or in progress: ${task.title}`, 'info', account.id);
                    }
                }
            } else {
                logMessage('No tasks found to complete', 'info', account.id);
            }
        } catch (error) {
            logMessage(`Error initializing account: ${error.message}`, 'error', account.id);
        }
    }

    const firstAccount = accounts[currentAccountIndex];
    await updateUserInfo(firstAccount);
    await updateTappingStatus(firstAccount);

    for (const account of accounts) {
        try {
            const userInfo = await performTapOrGetInfo(account);
            if (userInfo) {
                const batteryLevel = userInfo.battery || 0;
                account.batteryLevel = batteryLevel;
                account.timeLeftMinutes = userInfo.time_leave || 0;

                if (batteryLevel >= 100) {
                    account.batteryStatus = 'full';
                    account.autoTapping = false;
                    logMessage('Battery full (100%), waiting until below 50%', 'warning', account.id);
                } else if (batteryLevel < 50) {
                    account.batteryStatus = 'tapping';
                    account.autoTapping = true;
                    logMessage('Battery below 50%, starting auto-tapping (5 taps/20s) until 100%', 'success', account.id);
                } else {
                    account.batteryStatus = 'waiting';
                    account.autoTapping = false;
                    logMessage('Battery between 50% and 100%, waiting until below 50%', 'info', account.id);
                }
            }
        } catch (error) {
            logMessage(`Error setting up battery status: ${error.message}`, 'error', account.id);
        }
    }

    for (const account of accounts) {
        startCountdown(account);
    }

    const tappingInterval = setInterval(async () => {
        for (const account of accounts) {
            try {
                if (account.batteryStatus === 'tapping' && account.autoTapping) {
                    await performTapBurst(account);
                }

                if (currentAccountIndex === accounts.indexOf(account)) {
                    await updateUserInfo(account);
                }
            } catch (error) {
                logMessage(`Error in tapping loop: ${error.message}`, 'error', account.id);
            }
        }
    }, 25000); 

    screen.key(['q', 'C-c'], () => {
        clearInterval(tappingInterval);
        accounts.forEach(account => {
            if (account.countdownInterval) clearInterval(account.countdownInterval);
        });
        logMessage('Shutting down bot...', 'warning');
        setTimeout(() => {
            process.exit(0);
        }, 1000);
    });

    screen.key(['left', 'h'], () => {
        currentAccountIndex = (currentAccountIndex - 1 + accounts.length) % accounts.length;
        const account = accounts[currentAccountIndex];
        modeBox.setContent(`{center}CURRENT MODE: {green-fg}AUTO-TAPPING{/green-fg} | Account ${currentAccountIndex + 1} of ${accounts.length}{/center}`);
        updateUserInfo(account);
        updateTappingStatus(account);
    });

    screen.key(['right', 'l'], () => {
        currentAccountIndex = (currentAccountIndex + 1) % accounts.length;
        const account = accounts[currentAccountIndex];
        modeBox.setContent(`{center}CURRENT MODE: {green-fg}AUTO-TAPPING{/green-fg} | Account ${currentAccountIndex + 1} of ${accounts.length}{/center}`);
        updateUserInfo(account);
        updateTappingStatus(account);
    });

    screen.on('resize', () => {
        screen.render();
    });

    screen.render();
}

runBot();