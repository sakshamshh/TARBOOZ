const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

module.exports = {
  name: 'Update 12 — Telegram Bot Integration',
  apply: async () => {

    // 1. Add telegram webhook handler to api/index.js
    const apiPath = path.join(ROOT, 'api/index.js');
    let api = fs.readFileSync(apiPath, 'utf8');

    if (!api.includes('telegram')) {

      // Add telegram handler before the final 404
      api = api.replace(
        `    return res.status(404).json({ error: 'Not found' });`,
        `    // ── Telegram Webhook ──
    if (url === '/telegram/webhook') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const { message } = req.body;
      if (!message) return res.json({ ok: true });

      const chatId = message.chat.id.toString();
      const allowedChatId = process.env.TELEGRAM_CHAT_ID;
      const botToken = process.env.TELEGRAM_BOT_TOKEN;

      // Only respond to authorized user
      if (chatId !== allowedChatId) {
        await sendTelegram(botToken, chatId, '⛔ Unauthorized.');
        return res.json({ ok: true });
      }

      const text = message.text || '';
      const lower = text.toLowerCase().trim();

      try {
        // TASK: "task: buy groceries" or "todo: call mom"
        if (lower.startsWith('task:') || lower.startsWith('todo:') || lower.startsWith('t:')) {
          const content = text.split(':').slice(1).join(':').trim();
          await sbInsert('tasks_tg', { id: require('crypto').randomUUID(), content, done: false, created_at: new Date().toISOString() }).catch(()=>{});
          // Also call reminders API if available
          const reply = await groq(
            [{ role: 'user', content: \`The user wants to add this task: "\${content}". Confirm it's added in one short punchy sentence. Be Tarbooz — edgy, real, no fluff.\` }],
            'You are Tarbooz, a sharp AI assistant. Keep responses under 2 sentences.',
            128, 0.8
          );
          await sendTelegram(botToken, chatId, '✅ TASK LOGGED\\n' + reply);
        }

        // NOTE: "note: meeting was great"
        else if (lower.startsWith('note:') || lower.startsWith('n:')) {
          const content = text.split(':').slice(1).join(':').trim();
          await sbInsert('notes_tg', { id: require('crypto').randomUUID(), title: content.slice(0,50), body: content, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }).catch(()=>{});
          await sendTelegram(botToken, chatId, '📝 NOTE SAVED\\n"' + content.slice(0,100) + '"');
        }

        // MEMORY: "remember: I prefer dark mode"
        else if (lower.startsWith('remember:') || lower.startsWith('mem:') || lower.startsWith('log:')) {
          const content = text.split(':').slice(1).join(':').trim();
          await sbInsert('memories', { id: require('crypto').randomUUID(), content, tag: 'telegram', created_at: new Date().toISOString() });
          await sendTelegram(botToken, chatId, '🧠 LOGGED TO MEMORY\\n"' + content + '"');
        }

        // REMIND: "remind: dentist tomorrow at 3pm"
        else if (lower.startsWith('remind:') || lower.startsWith('r:')) {
          const content = text.split(':').slice(1).join(':').trim();
          // Use AI to parse the time
          const parsed = await groq(
            [{ role: 'user', content: \`Parse this reminder and extract title and datetime. Today is \${new Date().toISOString()}. Reminder: "\${content}". Reply ONLY with JSON: {"title": "...", "datetime": "ISO string"}\` }],
            'You are a datetime parser. Reply only with valid JSON.',
            128, 0.1
          );
          try {
            const { title, datetime } = JSON.parse(parsed.trim());
            await sbInsert('reminders_tg', { id: require('crypto').randomUUID(), title, datetime, notes: '', done: false, created_at: new Date().toISOString() }).catch(()=>{});
            const dt = new Date(datetime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            await sendTelegram(botToken, chatId, '⏰ REMINDER SET\\n' + title + ' @ ' + dt);
          } catch {
            await sendTelegram(botToken, chatId, '⏰ REMINDER LOGGED\\n"' + content + '"');
          }
        }

        // STATUS: "status" — show quick summary
        else if (lower === 'status' || lower === 'sup' || lower === 'hey') {
          const memories = await sbGet('memories').catch(()=>[]);
          const reply = await groq(
            [{ role: 'user', content: 'Give me a quick status update. What should I focus on?' }],
            'You are Tarbooz. ' + (memories.length ? 'What you know about the user:\\n' + memories.slice(0,5).map(m => '- ' + m.content).join('\\n') : '') + '\\nBe brief, edgy, useful. Max 3 sentences.',
            256, 0.8
          );
          await sendTelegram(botToken, chatId, '⚡ STATUS\\n' + reply);
        }

        // HELP: "help" or "?"
        else if (lower === 'help' || lower === '?') {
          await sendTelegram(botToken, chatId,
            '🍉 *TARBOOZ BOT COMMANDS*\\n\\n' +
            '*task:* Buy milk → logs a task\\n' +
            '*note:* Meeting went well → saves a note\\n' +
            '*remember:* I hate mornings → logs to memory\\n' +
            '*remind:* Call dad tomorrow 5pm → sets reminder\\n' +
            '*status* → quick AI briefing\\n' +
            '\\nOr just chat — I\\'ll respond as Tarbooz.'
          );
        }

        // DEFAULT: just chat with Tarbooz
        else {
          const memories = await sbGet('memories').catch(()=>[]);
          const memCtx = memories.length ? '\\n\\nWhat you remember about the user:\\n' + memories.slice(0,10).map(m => \`- [\${m.tag}] \${m.content}\`).join('\\n') : '';
          const reply = await groq(
            [{ role: 'user', content: text }],
            'You are Tarbooz, a sharp witty personal AI. Keep Telegram responses concise — max 3 sentences. Be direct and useful.' + memCtx,
            512, 0.8
          );
          await sendTelegram(botToken, chatId, reply);
          // Auto extract memory
          try {
            const raw = await groq(
              [{ role: 'user', content: \`User: "\${text}"\\nAI: "\${reply}"\\nExtract facts:\` }],
              'Extract memorable facts about the user. Return ONLY JSON array: [{"content":"fact","tag":"preference"}]. Max 2. If nothing return [].',
              128, 0.1
            );
            const facts = JSON.parse(raw.trim());
            for (const fact of facts) {
              await sbInsert('memories', { id: require('crypto').randomUUID(), content: fact.content, tag: fact.tag || 'telegram', created_at: new Date().toISOString() });
            }
          } catch {}
        }
      } catch(err) {
        console.error('[Telegram]', err.message);
        await sendTelegram(botToken, chatId, '// ERROR: ' + err.message);
      }

      return res.json({ ok: true });
    }

    // ── Telegram Send Helper (internal) ──
    if (url === '/telegram/send') {
      const { text: msgText } = req.body;
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      await sendTelegram(botToken, chatId, msgText);
      return res.json({ ok: true });
    }

    return res.status(404).json({ error: 'Not found' });`
      );

      // Add sendTelegram helper function after the WMO constant
      api = api.replace(
        `module.exports = async (req, res) => {`,
        `async function sendTelegram(token, chatId, text) {
  await axios.post(\`https://api.telegram.org/bot\${token}/sendMessage\`, {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown'
  });
}

module.exports = async (req, res) => {`
      );

      fs.writeFileSync(apiPath, api);
    }

    // 2. Update vercel.json to add telegram webhook route
    const vercelPath = path.join(ROOT, 'vercel.json');
    fs.writeFileSync(vercelPath,
      JSON.stringify({
        rewrites: [
          { source: '/api/(.*)', destination: '/api/index' },
          { source: '/(.*)', destination: '/public/index.html' }
        ]
      })
    );

    // 3. Create setup instructions file
    fs.writeFileSync(path.join(ROOT, 'TELEGRAM_SETUP.md'), `# Telegram Bot Setup

## Set Webhook
After deploying to Vercel, run this URL in your browser to connect Telegram to your server:

\`\`\`
https://api.telegram.org/botTOKEN/setWebhook?url=https://tarbooz.vercel.app/api/telegram/webhook
\`\`\`

Replace TOKEN with your actual bot token.

## Commands
- \`task: buy milk\` → logs a task
- \`note: meeting went well\` → saves a note  
- \`remember: I hate mornings\` → logs to memory
- \`remind: call dad tomorrow 5pm\` → sets reminder
- \`status\` → quick AI briefing
- \`help\` → show all commands
- Anything else → chat with Tarbooz

## How it works
1. You message the bot
2. Vercel receives it via webhook
3. Tarbooz processes it and responds
4. Memory is auto-extracted from conversations
`);

    console.log('  → Telegram webhook handler added to api/index.js');
    console.log('  → vercel.json updated');
    console.log('  → TELEGRAM_SETUP.md created');
    console.log('  ');
    console.log('  NEXT STEP after deploying:');
    console.log('  Set webhook by opening this URL in browser:');
    console.log('  https://api.telegram.org/botTOKEN/setWebhook?url=https://tarbooz.vercel.app/api/telegram/webhook');
  }
};
