import { ethers } from "ethers";
import fs from "fs";
import crypto from "crypto";
import chalk from "chalk";
import fetch from "node-fetch";
import ora from "ora";
import prompt from "prompt-sync";
import cfonts from "cfonts";
import { v4 as uuidv4 } from "uuid";

// Set to true for debugging purposes
const DEBUG = false;
const BASE_URL = "https://api1-pp.klokapp.ai";
const messagesFile = "seguro-prompt.txt";
const privateKeysFile = "privatekeys.txt";
const promptSync = prompt();
const REFERRAL_CODE = "X9MMCGGF";

function prettyPrint(obj, indent = 0) {
  const spacing = "  ".repeat(indent);
  for (const key in obj) {
    if (typeof obj[key] === "object" && obj[key] !== null) {
      console.log(`${spacing}\x1b[36m${key}:\x1b[0m`);
      prettyPrint(obj[key], indent + 1);
    } else {
      console.log(`${spacing}\x1b[36m${key}:\x1b[0m ${obj[key]}`);
    }
  }
}

function centerText(text, color = "cyanBright") {
  const terminalWidth = process.stdout.columns || 80;
  const textLength = text.length;
  const padding = Math.max(0, Math.floor((terminalWidth - textLength) / 2));
  return " ".repeat(padding) + chalk[color](text);
}

function akunDelay(minMs, maxMs) {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  console.log(chalk.bold.grey(`\n⏳ Menunggu ${delay / 1000} seconds before switching to the next account...\n`));
  return new Promise((resolve) => setTimeout(resolve, delay));
}

function taskDelay(minMs, maxMs) {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  console.log(chalk.bold.grey(`\n⏳ Menunggu ${delay / 1000} seconds before the next chat...\n`));
  return new Promise((resolve) => setTimeout(resolve, delay));
}

function printSection(title, content, icon = "✨") {
  console.log(`\n\x1b[35m${icon} =========================================== ${title} ========================================== ${icon}\x1b[0m`);
  if (typeof content === "object") {
    prettyPrint(content);
  } else {
    console.log(`\x1b[32m${content}\x1b[0m`);
  }
}

function formatResetTime(resetTime) {
  const resetDate = new Date(Date.now() + resetTime * 1000);
  return resetDate.toLocaleString();
}

async function typeOutText(text, delay = 1) {
  for (const char of text) {
    process.stdout.write(char);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

async function typeOutResponse(text) {
  printSection("Chat API Response", "");
  await typeOutText(text, 1);
  console.log("\n\x1b[35m==============================================================================================================\x1b[0m\n");
}

async function fetchWithoutRetry(url, options, spinner, noTimeout = false) {
  try {
    let controller, timeout;
    if (!noTimeout) {
      controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), 10000);
      options.signal = controller.signal;
    }
    const response = await fetch(url, options);
    if (!noTimeout) clearTimeout(timeout);
    if (!response.ok) throw new Error(`Request failed`);
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch (error) {
    spinner.fail(chalk.redBright(` ${error.message}`));
    return null;
  }
}

async function checkChatConnectivity(headers) {
  const spinner = ora("⏳ Checking Chat API connectivity...").start();
  try {
    await fetch(`${BASE_URL}/v1/chat`, { method: "HEAD", headers });
    spinner.succeed(chalk.greenBright(" Chat API connectivity is good 🚀"));
    return true;
  } catch (error) {
    spinner.fail(chalk.redBright(" Chat API connectivity issue."));
    return false;
  }
}

if (!fs.existsSync(messagesFile)) {
  console.error(`❌ Error: File "${messagesFile}" not found!`);
  process.exit(1);
}

let messages = fs.readFileSync(messagesFile, "utf-8")
                .split("\n")
                .filter((line) => line.trim() !== "");

if (!fs.existsSync(privateKeysFile)) {
  console.error(`❌ Error: File "${privateKeysFile}" not found!`);
  process.exit(1);
}

const PRIVATE_KEYS = fs.readFileSync(privateKeysFile, "utf-8")
                      .split("\n")
                      .map((line) => line.trim())
                      .filter((line) => line !== "");

if (PRIVATE_KEYS.length === 0) {
  console.error("❌ Error:  No private keys found!");
  process.exit(1);
}

cfonts.say("Seguro Node", {
  font: "block",
  align: "center",
  colors: ["cyan", "magenta"],
  background: "black",
  letterSpacing: 1,
  lineHeight: 1,
  space: true,
  maxLength: "0",
});
console.log(centerText("=== Telegram Channel 🚀 : Seguro Node (@seguronode) ==="));
console.log(centerText("⌞👤 Mod : @qxb1000 & @kaoru69 ⌝ \n"));
const loopCount = parseInt(promptSync("📝 How many times should each account chat with the AI? (enter prompt count) "), 10);

async function signAndVerify(privateKey) {
  try {
    const wallet = new ethers.Wallet(privateKey);
    const nonce = crypto.randomBytes(32).toString("hex");
    const issuedAt = new Date().toISOString();
    const message = `klokapp.ai wants you to sign in with your Ethereum account:\n${wallet.address}\n\n\nURI: https://klokapp.ai/\nVersion: 1\nChain ID: 1\nNonce: ${nonce}\nIssued At: ${issuedAt}`;
    const signature = await wallet.signMessage(message);

  
    if (DEBUG) {
      console.log(chalk.green("Generated Signature:"), signature);
      console.log(chalk.green("New Nonce:"), nonce);
      console.log(chalk.green("Issued Date:"), issuedAt);
    }

    const payload = { signedMessage: signature, message, referral_code: REFERRAL_CODE };

    if (DEBUG) {
      console.log(chalk.blue("Sending verification request..."));
    }

    let response, result;
    const headers = {
      "Content-Type": "application/json",
      Accept: "*/*",
      Origin: "https://klokapp.ai",
      Referer: "https://klokapp.ai/",
      "User-Agent": "Mozilla/5.0"
    };

    for (let i = 0; i < 3; i++) {
      response = await fetch(`${BASE_URL}/v1/verify`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });
      if (DEBUG) {
        console.log(chalk.blue("Status Code:"), response.status);
        console.log(chalk.blue("Content-Type:"), response.headers.get("content-type"));
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Request failed with status ${response.status}: ${text}`);
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        result = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`Expected JSON but received: ${text}`);
      }

      if (DEBUG) {
        console.log(chalk.blue("Full Verification Response:"), result);
      }
      if (result.session_token) {
        if (DEBUG) {
          console.log(chalk.green("Session Token Obtained:"), result.session_token);
        }
        return { sessionToken: result.session_token, wallet };
      }
      console.warn(chalk.yellow(`ttempt ${i + 1} failed. Retrying...`));
      await new Promise((res) => setTimeout(res, 2000));
    }

    throw new Error("Failed to obtain session token");
  } catch (error) {
    console.error(chalk.red("Error in signAndVerify:"), error);
    return null;
  }
}

async function makeRequests(sessionToken, runNumber) {
  const headers = {
    accept: "*/*",
    "content-type": "application/json",
    origin: "https://klokapp.ai",
    referer: "https://klokapp.ai/",
    "user-agent": "Mozilla/5.0",
    "x-session-token": sessionToken
  };

  let spinner = ora(`💬 [Run ${runNumber}] Checking remaining rate limit...`).start();
  const rateCheck = await fetchWithoutRetry(`${BASE_URL}/v1/rate-limit`, {
    method: "GET",
    headers
  }, spinner);
  spinner.stop();

  if (!rateCheck) {
    console.log(chalk.red("Network error detected!!"));
    return { counted: false, dailyLimitReached: false, failed: true };
  }

  if (rateCheck.remaining <= 0) {
    console.log(chalk.bold.redBright(`🚫 Daily limit reached for this account.`));
    spinner = ora(`📊 [Run ${runNumber}] Fetching account statistics...`).start();
    const rateLimitResponse = await fetchWithoutRetry(`${BASE_URL}/v1/rate-limit`, {
      method: "GET",
      headers
    }, spinner);
    const pointsResponse = await fetchWithoutRetry(`${BASE_URL}/v1/points`, {
      method: "GET",
      headers
    }, spinner);
    if (rateLimitResponse && pointsResponse) {
      spinner.stop();
      const dailyLimit = rateLimitResponse.limit;
      const limitRemaining = rateLimitResponse.remaining;
      const usageToday = rateLimitResponse.current_usage;
      const totalPoints = pointsResponse.total_points;
      const resetTime = rateLimitResponse.reset_time;
      const formattedResetTime = formatResetTime(resetTime);

      console.log(chalk.yellowBright(`★★★★★★★★★★★★★★ Account Statistic ★★★★★★★★★★★★★★`));
      console.log(`🎯 Chat Daily Limit     : \x1b[32m${dailyLimit}\x1b[0m`);
      console.log(`🔎 Chat Limit Remaining : \x1b[32m${limitRemaining}\x1b[0m`);
      console.log(`🔢 Chat Usage Today     : \x1b[32m${usageToday}\x1b[0m`);
      console.log(`🔄 Total Points         : \x1b[32m${totalPoints}\x1b[0m`);
      console.log(`⏱️ Reset Time ( UTC )   : \x1b[32m${formattedResetTime}\x1b[0m`);
      console.log(chalk.yellowBright(`★ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ★`));
    }
    return { counted: false, dailyLimitReached: true, failed: false };
  }

  const connectivityOk = await checkChatConnectivity(headers);
  if (!connectivityOk) {
    console.log(chalk.red("Chat API connectivity issue"));
    return { counted: false, dailyLimitReached: false, failed: true };
  }

  spinner = ora(`💬 [Run ${runNumber}] Sending request to Chat API...`).start();
  const randomMessage = messages[Math.floor(Math.random() * messages.length)];
  const postData = {
    id: uuidv4(),
    messages: [{ role: "user", content: randomMessage }],
    model: "llama-3.3-70b-instruct",
    created_at: new Date().toISOString(),
    language: "english"
  };

  const chatResponse = await fetchWithoutRetry(`${BASE_URL}/v1/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify(postData)
  }, spinner, true);

  if (!chatResponse) {
    spinner.fail(chalk.redBright(` Request Chat API failed`));
    return { counted: false, dailyLimitReached: false, failed: true };
  } else {
    spinner.succeed(chalk.greenBright(` Chat API response received 📝`));
    const chatText =
      typeof chatResponse === "object"
        ? JSON.stringify(chatResponse, null, 2)
        : chatResponse;
    await typeOutResponse(chatText);
  }

  spinner = ora(`📊 [Run ${runNumber}] Fetching account statistics...`).start();
  const rateLimitResponse = await fetchWithoutRetry(`${BASE_URL}/v1/rate-limit`, {
    method: "GET",
    headers
  }, spinner);
  const pointsResponse = await fetchWithoutRetry(`${BASE_URL}/v1/points`, {
    method: "GET",
    headers
  }, spinner);
  if (rateLimitResponse && pointsResponse) {
    spinner.stop();
    const dailyLimit = rateLimitResponse.limit;
    const limitRemaining = rateLimitResponse.remaining;
    const usageToday = rateLimitResponse.current_usage;
    const totalPoints = pointsResponse.total_points;
    const resetTime = rateLimitResponse.reset_time;
    const formattedResetTime = formatResetTime(resetTime);

    console.log(chalk.yellowBright(`★★★★★★★★★★★★★★ Account Statistics ★★★★★★★★★★★★★★`));
    console.log(`🎯 Chat Daily Limit     : \x1b[32m${dailyLimit}\x1b[0m`);
    console.log(`🔎 Chat Limit Remaining : \x1b[32m${limitRemaining}\x1b[0m`);
    console.log(`🔢 Chat Usage Today     : \x1b[32m${usageToday}\x1b[0m`);
    console.log(`🔄 Total Points         : \x1b[32m${totalPoints}\x1b[0m`);
    console.log(`⏱️ Reset Time ( UTC )   : \x1b[32m${formattedResetTime}\x1b[0m`);
    console.log(chalk.yellowBright(`★ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ ★`));

    if (limitRemaining <= 0) {
      console.log(chalk.bold.redBright(`🚫 Daily limit has been reached for this account`));
      return { counted: true, dailyLimitReached: true, failed: false };
    }
  } else {
    if (!rateLimitResponse) spinner.fail(` Request rate limit failed`);
    if (!pointsResponse) spinner.fail(` Request points failed`);
  }
  return { counted: true, dailyLimitReached: false, failed: false };
}

async function runLoop() {
  while (true) {
    for (let i = 0; i < PRIVATE_KEYS.length; i++) {
      console.log(chalk.bold.cyanBright(`\n=====================================================================`));
      const verifyResult = await signAndVerify(PRIVATE_KEYS[i]);
      if (!verifyResult) {
        console.error(chalk.red("Failed to obtain session token, moving to the next account."));
        continue;
      }
      const { sessionToken, wallet } = verifyResult;
      console.log(chalk.bold.whiteBright(`🚀 Starting run for account: \x1b[32m${wallet.address}\x1b[0m`));
      console.log(chalk.bold.cyanBright(`=====================================================================`));

      let successfulRuns = 0;
      while (successfulRuns < loopCount) {
        const result = await makeRequests(sessionToken, successfulRuns + 1);
        if (result.dailyLimitReached) break;
        if (result.failed) {
          console.warn(chalk.yellow(`⚠️ Chat request failed.. `));
          successfulRuns++;
          if (successfulRuns < loopCount) {
            await taskDelay(5000, 10000);
          }
          continue;
        }

        successfulRuns++;
        if (successfulRuns < loopCount) {
          await taskDelay(5000, 10000);
        }
      }
      if (i < PRIVATE_KEYS.length - 1) {
        await akunDelay(3000, 5000);
      }
    }
    console.log(chalk.bold.greenBright("\n✅  All tasks have been completed.."));
    console.log(chalk.bold.yellowBright("⏳ Waiting 24 hours before restarting..."));
    await akunDelay(86400000, 86400000); // Waiting 24 hours
  }
}

runLoop();
