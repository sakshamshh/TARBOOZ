# Telegram Bot Setup

## Set Webhook
After deploying to Vercel, run this URL in your browser to connect Telegram to your server:

```
https://api.telegram.org/botTOKEN/setWebhook?url=https://tarbooz.vercel.app/api/telegram/webhook
```

Replace TOKEN with your actual bot token.

## Commands
- `task: buy milk` → logs a task
- `note: meeting went well` → saves a note  
- `remember: I hate mornings` → logs to memory
- `remind: call dad tomorrow 5pm` → sets reminder
- `status` → quick AI briefing
- `help` → show all commands
- Anything else → chat with Tarbooz

## How it works
1. You message the bot
2. Vercel receives it via webhook
3. Tarbooz processes it and responds
4. Memory is auto-extracted from conversations
