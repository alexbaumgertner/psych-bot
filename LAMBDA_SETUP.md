# AWS Lambda Setup Guide for Telegram Bot

This guide will help you deploy your Telegram bot to AWS Lambda.

## Prerequisites

1. AWS Account with appropriate permissions
2. AWS CLI installed and configured
3. Node.js 20+ installed
4. Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
5. Google Generative AI API Key

## Option 1: Using AWS SAM (Recommended)

### Step 1: Install AWS SAM CLI

```bash
# macOS
brew install aws-sam-cli

# Or follow instructions at: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html
```

### Step 2: Build the Project

```bash
npm install
npm run build
```

### Step 3: Package and Deploy

```bash
# Package the application
sam build

# Deploy (first time - will create CloudFormation stack)
sam deploy --guided

# Follow the prompts:
# - Stack Name: psych-bot (or your preferred name)
# - AWS Region: us-east-1 (or your preferred region)
# - BotToken: Your Telegram bot token
# - AIApiKey: Your Google AI API key
# - Confirm changes: Y
# - Allow SAM CLI IAM role creation: Y
# - Disable rollback: N
# - Save arguments to configuration file: Y
```

### Step 4: Get Webhook URL

After deployment, SAM will output the webhook URL. It will look like:
```
https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/Prod/webhook
```

### Step 5: Set Telegram Webhook

Replace `YOUR_WEBHOOK_URL` with the URL from Step 4:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=YOUR_WEBHOOK_URL"
```

Or use the AWS CLI to get the URL:

```bash
aws cloudformation describe-stacks \
  --stack-name psych-bot \
  --query 'Stacks[0].Outputs[?OutputKey==`WebhookUrl`].OutputValue' \
  --output text
```

## Option 2: Using Serverless Framework

### Step 1: Install Serverless Framework

```bash
npm install -g serverless
npm install --save-dev serverless-plugin-typescript
```

### Step 2: Set Environment Variables

```bash
export BOT_TOKEN="your-telegram-bot-token"
export AI_API_KEY="your-google-ai-api-key"
```

### Step 3: Build and Deploy

```bash
npm install
npm run build
serverless deploy
```

### Step 4: Set Telegram Webhook

After deployment, Serverless will output the webhook URL. Use it to set the webhook:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<WEBHOOK_URL>"
```

## Option 3: Manual Deployment with AWS Console

### Step 1: Build the Project

```bash
npm install
npm run build
npm run package:lambda
```

This creates `lambda-deployment.zip` in the project root.

### Step 2: Create Lambda Function

1. Go to AWS Lambda Console
2. Click "Create function"
3. Choose "Author from scratch"
4. Function name: `telegram-psych-bot`
5. Runtime: `Node.js 20.x`
6. Architecture: `x86_64`
7. Click "Create function"

### Step 3: Upload Code

1. In the Lambda function page, scroll to "Code source"
2. Click "Upload from" → ".zip file"
3. Upload `lambda-deployment.zip`
4. Click "Save"

### Step 4: Configure Environment Variables

1. Go to "Configuration" → "Environment variables"
2. Add:
   - `BOT_TOKEN`: Your Telegram bot token
   - `AI_API_KEY`: Your Google AI API key
3. Click "Save"

### Step 5: Configure Function Settings

1. Go to "Configuration" → "General configuration"
2. Click "Edit"
3. Set:
   - Timeout: 30 seconds
   - Memory: 512 MB
4. Click "Save"

### Step 6: Create API Gateway

1. Go to API Gateway Console
2. Click "Create API" → "REST API" → "Build"
3. Choose "REST" protocol
4. Click "Create API"
5. Click "Actions" → "Create Resource"
   - Resource Name: `webhook`
   - Enable API Gateway CORS: No
   - Click "Create Resource"
6. Select the `/webhook` resource
7. Click "Actions" → "Create Method" → Select "POST"
8. Integration type: Lambda Function
9. Lambda Function: `telegram-psych-bot`
10. Click "Save" → "OK" (for permission)
11. Click "Actions" → "Deploy API"
    - Deployment stage: `prod`
    - Click "Deploy"
12. Copy the "Invoke URL" (e.g., `https://xxxxx.execute-api.us-east-1.amazonaws.com/prod`)

### Step 7: Set Telegram Webhook

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://xxxxx.execute-api.us-east-1.amazonaws.com/prod/webhook"
```

## Testing

Test your webhook:

```bash
# Check webhook info
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"

# Send a test message to your bot in Telegram
```

## Updating the Bot

After making code changes:

**With SAM:**
```bash
npm run build
sam build
sam deploy
```

**With Serverless:**
```bash
npm run build
serverless deploy
```

**Manual:**
```bash
npm run build
npm run package:lambda
# Then upload lambda-deployment.zip via AWS Console
```

## Troubleshooting

### Check Lambda Logs

```bash
# With AWS CLI
aws logs tail /aws/lambda/telegram-psych-bot --follow

# Or view in AWS Console: Lambda → Your Function → Monitor → View logs in CloudWatch
```

### Common Issues

1. **Timeout errors**: Increase timeout in Lambda configuration
2. **Memory errors**: Increase memory allocation
3. **Webhook not receiving updates**: Verify webhook URL is correct and accessible
4. **Environment variables not set**: Double-check in Lambda configuration

## Security Best Practices

1. Store secrets in AWS Secrets Manager or Parameter Store instead of environment variables
2. Use IAM roles with least privilege
3. Enable CloudWatch Logs encryption
4. Use VPC if you need private network access
5. Enable API Gateway request throttling

## Cost Estimation

- Lambda: Free tier includes 1M requests/month
- API Gateway: Free tier includes 1M API calls/month
- CloudWatch Logs: First 5GB free/month

For a small bot, you'll likely stay within the free tier.
