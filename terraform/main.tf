terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "Terraform"
      Course      = "CCD-MiniProject"
      Students    = "Nandini-Sah_Prisha-Gupta"
    }
  }
}

# -----------------------------------------------------------------------------
# 1. Amazon S3 - Raw Financial Market Data Storage
# -----------------------------------------------------------------------------
resource "aws_s3_bucket" "market_data" {
  bucket_prefix = "${var.project_name}-data-"
  force_destroy = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "market_data_crypto" {
  bucket = aws_s3_bucket.market_data.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "market_data_privacy" {
  bucket = aws_s3_bucket.market_data.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# -----------------------------------------------------------------------------
# 2. Amazon SQS - Asynchronous Ingestion & Event Decoupling Queue
# -----------------------------------------------------------------------------
resource "aws_sqs_queue" "regime_dlq" {
  name                      = "${var.project_name}-dead-letter-queue"
  message_retention_seconds = 1209600 # 14 days
}

resource "aws_sqs_queue" "regime_events" {
  name                       = "${var.project_name}-ingestion-queue"
  delay_seconds              = 0
  max_message_size           = 262144
  message_retention_seconds  = 86400 # 1 day
  receive_wait_time_seconds  = 10    # Long polling to optimize costs
  visibility_timeout_seconds = 180   # Exceeds Lambda timeout to allow retries

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.regime_dlq.arn
    maxReceiveCount     = 3
  })
}

# -----------------------------------------------------------------------------
# 3. Amazon SNS - Real-Time Alerting on High-Risk Regime Transitions
# -----------------------------------------------------------------------------
resource "aws_sns_topic" "regime_alerts" {
  name = "${var.project_name}-regime-alerts"
}

resource "aws_sns_topic_subscription" "email_target" {
  topic_arn = aws_sns_topic.regime_alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# -----------------------------------------------------------------------------
# 4. Amazon DynamoDB - Managed NoSQL Database for Market Regimes & Portfolio Risk
# Strict Provisioned Mode: 5 RCU / 5 WCU (Always Free Tier limit is 25 RCU / 25 WCU)
# -----------------------------------------------------------------------------
resource "aws_dynamodb_table" "market_regimes" {
  name           = "MarketRegimes"
  billing_mode   = "PROVISIONED"
  read_capacity  = 5
  write_capacity = 5

  hash_key  = "ticker"
  range_key = "timestamp"

  attribute {
    name = "ticker"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  point_in_time_recovery {
    enabled = false
  }
}

# -----------------------------------------------------------------------------
# 5. Amazon CloudWatch - Centralized Logging & Observability
# -----------------------------------------------------------------------------
resource "aws_cloudwatch_log_group" "engine_logs" {
  name              = "/aws/market-regime/${var.project_name}"
  retention_in_days = 7 # Within free-tier ingestion limits
}

# -----------------------------------------------------------------------------
# 6. AWS Budgets - Zero-Cost Free Tier Safeguard ($0.01 Alert Threshold)
# -----------------------------------------------------------------------------
resource "aws_budgets_budget" "zero_cost_safeguard" {
  name              = "${var.project_name}-zero-cost-safeguard"
  budget_type       = "COST"
  limit_amount      = var.monthly_budget_limit
  limit_unit        = "USD"
  time_period_start = "2026-01-01_00:00"
  time_unit         = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.alert_email]
  }
}
