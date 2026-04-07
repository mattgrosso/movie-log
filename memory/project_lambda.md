---
name: AWS Lambda AI Backend
description: Claude API integration via AWS Lambda + API Gateway — endpoints, URLs, deployment process
type: project
---

A serverless Claude AI backend was set up for Cinemaroll to avoid exposing API keys client-side.

**Infrastructure:**
- Lambda function: `cinemaroll-ai` (us-east-1, Node.js 22.x, x86_64)
- Lambda ARN: `arn:aws:lambda:us-east-1:298682183644:function:cinemaroll-ai`
- API Gateway: `cinemaroll-ai-api` (HTTP API, $default stage, auto-deploy enabled)
- Invoke URL: `https://2lyldox07e.execute-api.us-east-1.amazonaws.com`
- Lambda timeout: 30 seconds (increased from default 3s — Claude API needs it)
- CORS configured on API Gateway (not in Lambda code) — origin `*`, header `content-type`, methods `POST OPTIONS`

**Endpoints:**
- `POST /keywords` — returns Claude-generated keywords for a movie (`{ title, year }` → `{ keywords: [] }`)
- `POST /context` — returns brief critical/historical context for a movie (`{ title, year }` → `{ context: "" }`)

**Vue app integration:**
- Env var: `VUE_APP_AI_API_URL=https://2lyldox07e.execute-api.us-east-1.amazonaws.com`
- Keywords fetched in `RateMovie.vue` → `getChatGPTKeywords()` on mount, stored as `chatGPTKeywords` on the rating
- Context fetched in `RateMovie.vue` → `getMovieContext()` on button click, shown in a modal
- Field name kept as `chatGPTKeywords` in Firebase for backward compatibility with existing data

**Lambda code:** `aws-lambda/claude-ai.js` (uses `@anthropic-ai/sdk`)
**Old dead code:** `aws-lambda/chatgpt-keywords.js` — can be deleted

**Deployment process:**
1. Edit `aws-lambda/claude-ai.js`
2. `cd aws-lambda && zip -r claude-ai.zip claude-ai.js node_modules package.json`
3. Upload zip in Lambda console → Code tab → Upload from → .zip file
4. New routes also need to be added in API Gateway → Routes → Create, then attach the `cinemaroll-ai` integration

**Why:** ChatGPT API keys were being deleted because the app is client-side. Lambda keeps the `ANTHROPIC_API_KEY` server-side.
