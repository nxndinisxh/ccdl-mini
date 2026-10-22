output "s3_bucket_name" {
  description = "Name of the market data S3 bucket"
  value       = aws_s3_bucket.market_data.id
}

output "sqs_queue_url" {
  description = "URL of the asynchronous ingestion SQS queue"
  value       = aws_sqs_queue.regime_events.id
}

output "sqs_queue_arn" {
  description = "ARN of the ingestion SQS queue"
  value       = aws_sqs_queue.regime_events.arn
}

output "sns_topic_arn" {
  description = "ARN of the SNS topic for regime transition alerts"
  value       = aws_sns_topic.regime_alerts.arn
}

output "dynamodb_table_name" {
  description = "Name of the DynamoDB table for market regime records"
  value       = aws_dynamodb_table.market_regimes.name
}

output "api_gateway_endpoint" {
  description = "Public HTTP endpoint for API Gateway"
  value       = aws_apigatewayv2_api.http_api.api_endpoint
}

output "budget_alarm_threshold" {
  description = "Cost limit setting for AWS zero-cost safeguard"
  value       = "$${var.monthly_budget_limit} USD"
}
