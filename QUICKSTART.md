# Quick Start - AWS Lambda Deployment

## 1. Install Dependencies

```bash
npm install
```

This will install `@types/aws-lambda` which is required for TypeScript compilation.

## 2. Build the Project

```bash
npm run build
```

## 3. Choose Deployment Method

See `LAMBDA_SETUP.md` for detailed instructions. Quick options:

### Option A: AWS SAM (Easiest)

```bash
# Install SAM CLI first: brew install aws-sam-cli
sam build
sam deploy --guided
```

### Option B: Serverless Framework

```bash
# Install: npm install -g serverless
export BOT_TOKEN="your-token"
export AI_API_KEY="your-key"
serverless deploy
```

### Option C: Manual ZIP Upload

```bash
npm run package:lambda
# Then upload lambda-deployment.zip via AWS Console
```

## 4. Set Telegram Webhook

After deployment, get your webhook URL and set it:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_WEBHOOK_URL>"
```

## 5. Test

Send a message to your bot in Telegram!
