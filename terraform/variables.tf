variable "aws_region" {
  description = "Target AWS Region for cloud infrastructure"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Unique project namespace"
  type        = string
  default     = "market-regime-risk-engine"
}

variable "environment" {
  description = "Deployment environment tier (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "alert_email" {
  description = "Email address for SNS regime shift notifications and zero-cost budget alarms"
  type        = string
  default     = "devops.alerts@example.com"
}

variable "monthly_budget_limit" {
  description = "Cost threshold in USD for AWS Budget Alarm (Zero-cost free tier safeguard)"
  type        = string
  default     = "0.01"
}
