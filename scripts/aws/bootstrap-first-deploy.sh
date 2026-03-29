#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

export AWS_PAGER=""

SCRIPT_NAME="$(basename "$0")"
APP_NAME="${APP_NAME:-swordworld}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-}"
AWS_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-}}"
GITHUB_ORG="${GITHUB_ORG:-}"
GITHUB_REPO="${GITHUB_REPO:-}"
STAGING_ENVIRONMENT="${STAGING_ENVIRONMENT:-staging}"
PRODUCTION_ENVIRONMENT="${PRODUCTION_ENVIRONMENT:-production}"
STAGING_ROLE_NAME="${STAGING_ROLE_NAME:-${APP_NAME}-github-deploy-staging}"
PRODUCTION_ROLE_NAME="${PRODUCTION_ROLE_NAME:-${APP_NAME}-github-deploy-production}"
BOOTSTRAP_STACK_NAME="${BOOTSTRAP_STACK_NAME:-CDKToolkit}"
CDK_QUALIFIER="${CDK_QUALIFIER:-hnb659fds}"
BOOTSTRAP_EXECUTION_POLICY_ARN="${BOOTSTRAP_EXECUTION_POLICY_ARN:-arn:aws:iam::aws:policy/AdministratorAccess}"
SHARED_POLICY_NAME="${SHARED_POLICY_NAME:-${APP_NAME}-github-cdk-bootstrap-${AWS_REGION:-region}}"
STAGING_WEB_DOMAIN_NAME="${STAGING_WEB_DOMAIN_NAME:-${APP_NAME}-staging.example.com}"
PRODUCTION_WEB_DOMAIN_NAME="${PRODUCTION_WEB_DOMAIN_NAME:-${APP_NAME}-production.example.com}"
STAGING_COGNITO_DOMAIN_PREFIX="${STAGING_COGNITO_DOMAIN_PREFIX:-${APP_NAME}-staging}"
PRODUCTION_COGNITO_DOMAIN_PREFIX="${PRODUCTION_COGNITO_DOMAIN_PREFIX:-${APP_NAME}-production}"
STAGING_API_DOMAIN_NAME="${STAGING_API_DOMAIN_NAME:-}"
PRODUCTION_API_DOMAIN_NAME="${PRODUCTION_API_DOMAIN_NAME:-}"
STAGING_HOSTED_ZONE_NAME="${STAGING_HOSTED_ZONE_NAME:-}"
PRODUCTION_HOSTED_ZONE_NAME="${PRODUCTION_HOSTED_ZONE_NAME:-}"
STAGING_CERTIFICATE_ARN_US_EAST_1="${STAGING_CERTIFICATE_ARN_US_EAST_1:-}"
PRODUCTION_CERTIFICATE_ARN_US_EAST_1="${PRODUCTION_CERTIFICATE_ARN_US_EAST_1:-}"
STAGING_CERTIFICATE_ARN_REGION="${STAGING_CERTIFICATE_ARN_REGION:-}"
PRODUCTION_CERTIFICATE_ARN_REGION="${PRODUCTION_CERTIFICATE_ARN_REGION:-}"
OUTPUT_FILE="${OUTPUT_FILE:-.local/aws/bootstrap-${APP_NAME}.json}"
SKIP_OIDC_PROVIDER=0
SKIP_ROLES=0
SKIP_CDK_BOOTSTRAP=0
DRY_RUN=0

usage() {
  cat <<USAGE
Usage: ${SCRIPT_NAME} [options]

Idempotent first-time AWS bootstrap for this monorepo.
It can:
- ensure the GitHub Actions OIDC provider exists in IAM
- ensure staging and production GitHub deploy roles exist with environment-scoped trust policies
- ensure a shared policy exists that lets those roles assume same-account CDK bootstrap roles
- bootstrap the target account and region for AWS CDK
- write a manifest of GitHub environment variables to ${OUTPUT_FILE}

Required:
  --github-org <org>         GitHub organization or owner
  --github-repo <repo>       GitHub repository name

Optional:
  --app-name <name>          Default: ${APP_NAME}
  --aws-account-id <id>      Default: resolve from aws sts get-caller-identity
  --aws-region <region>      Default: AWS_REGION, AWS_DEFAULT_REGION, or aws configure get region
  --staging-role-name <name> Default: ${STAGING_ROLE_NAME}
  --production-role-name <name>
                             Default: ${PRODUCTION_ROLE_NAME}
  --bootstrap-stack-name <name>
                             Default: ${BOOTSTRAP_STACK_NAME}
  --cdk-qualifier <value>    Default: ${CDK_QUALIFIER}
  --bootstrap-execution-policy-arn <arn>
                             Default: ${BOOTSTRAP_EXECUTION_POLICY_ARN}
  --output-file <path>       Default: ${OUTPUT_FILE}
  --skip-oidc-provider       Do not create or update the GitHub OIDC provider
  --skip-roles               Do not create or update GitHub deploy roles or policies
  --skip-cdk-bootstrap       Do not run CDK bootstrap
  --dry-run                  Print commands that would run
  --help                     Show this help

Environment overrides are also supported for every option above.
USAGE
}

log() {
  printf '[aws-bootstrap] %s\n' "$*" >&2
}

warn() {
  printf '[aws-bootstrap][warn] %s\n' "$*" >&2
}

die() {
  printf '[aws-bootstrap][error] %s\n' "$*" >&2
  exit 1
}

require_command() {
  local cmd
  for cmd in "$@"; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      die "required command not found: ${cmd}"
    fi
  done
}

run() {
  if (( DRY_RUN == 1 )); then
    printf '+ '
    printf '%q ' "$@"
    printf '\n'
    return 0
  fi
  "$@"
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --app-name)
        APP_NAME="$2"
        shift 2
        ;;
      --aws-account-id)
        AWS_ACCOUNT_ID="$2"
        shift 2
        ;;
      --aws-region)
        AWS_REGION="$2"
        shift 2
        ;;
      --github-org)
        GITHUB_ORG="$2"
        shift 2
        ;;
      --github-repo)
        GITHUB_REPO="$2"
        shift 2
        ;;
      --staging-role-name)
        STAGING_ROLE_NAME="$2"
        shift 2
        ;;
      --production-role-name)
        PRODUCTION_ROLE_NAME="$2"
        shift 2
        ;;
      --bootstrap-stack-name)
        BOOTSTRAP_STACK_NAME="$2"
        shift 2
        ;;
      --cdk-qualifier)
        CDK_QUALIFIER="$2"
        shift 2
        ;;
      --bootstrap-execution-policy-arn)
        BOOTSTRAP_EXECUTION_POLICY_ARN="$2"
        shift 2
        ;;
      --output-file)
        OUTPUT_FILE="$2"
        shift 2
        ;;
      --skip-oidc-provider)
        SKIP_OIDC_PROVIDER=1
        shift
        ;;
      --skip-roles)
        SKIP_ROLES=1
        shift
        ;;
      --skip-cdk-bootstrap)
        SKIP_CDK_BOOTSTRAP=1
        shift
        ;;
      --dry-run)
        DRY_RUN=1
        shift
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      *)
        die "unknown argument: $1"
        ;;
    esac
  done
}

resolve_region() {
  if [[ -n "$AWS_REGION" ]]; then
    return
  fi

  AWS_REGION="$(aws configure get region 2>/dev/null || true)"
  AWS_REGION="${AWS_REGION//[$'\r\n\t ']/}"
  if [[ -z "$AWS_REGION" ]]; then
    die "AWS region is required. Set AWS_REGION or pass --aws-region."
  fi
}

resolve_account_id() {
  local current_account
  current_account="$(aws sts get-caller-identity --query 'Account' --output text)"
  if [[ -z "$AWS_ACCOUNT_ID" ]]; then
    AWS_ACCOUNT_ID="$current_account"
    return
  fi

  if [[ "$AWS_ACCOUNT_ID" != "$current_account" ]]; then
    die "AWS account mismatch: requested ${AWS_ACCOUNT_ID}, but caller identity is ${current_account}"
  fi
}

policy_arn_for_name() {
  local policy_name="$1"
  printf 'arn:aws:iam::%s:policy/%s\n' "$AWS_ACCOUNT_ID" "$policy_name"
}

role_arn() {
  local role_name="$1"
  printf 'arn:aws:iam::%s:role/%s\n' "$AWS_ACCOUNT_ID" "$role_name"
}

bootstrap_role_arn() {
  local kind="$1"
  printf 'arn:aws:iam::%s:role/cdk-%s-%s-role-%s-%s\n' "$AWS_ACCOUNT_ID" "$CDK_QUALIFIER" "$kind" "$AWS_ACCOUNT_ID" "$AWS_REGION"
}

bootstrap_version_parameter_arn() {
  printf 'arn:aws:ssm:%s:%s:parameter/cdk-bootstrap/%s/version\n' "$AWS_REGION" "$AWS_ACCOUNT_ID" "$CDK_QUALIFIER"
}

subject_for_environment() {
  local env_name="$1"
  printf 'repo:%s/%s:environment:%s\n' "$GITHUB_ORG" "$GITHUB_REPO" "$env_name"
}

get_oidc_provider_arn() {
  local candidate url
  while IFS= read -r candidate; do
    [[ -z "$candidate" || "$candidate" == "None" ]] && continue
    url="$(aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$candidate" --query 'Url' --output text 2>/dev/null || true)"
    if [[ "$url" == "token.actions.githubusercontent.com" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done < <(aws iam list-open-id-connect-providers --query 'OpenIDConnectProviderList[].Arn' --output text 2>/dev/null | tr '\t' '\n')
  return 1
}

ensure_github_oidc_provider() {
  local provider_arn client_ids has_sts
  if provider_arn="$(get_oidc_provider_arn)"; then
    log "GitHub OIDC provider already exists: ${provider_arn}"
  else
    log "Creating GitHub OIDC provider"
    provider_arn="arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
    run aws iam create-open-id-connect-provider \
      --url https://token.actions.githubusercontent.com \
      --client-id-list sts.amazonaws.com \
      --tags Key=ManagedBy,Value=bootstrap-first-deploy Key=Application,Value=${APP_NAME} \
      --query 'OpenIDConnectProviderArn' \
      --output text >/dev/null
    if (( DRY_RUN == 1 )); then
      printf "%s\n" "$provider_arn"
      return 0
    fi
  fi

  client_ids="$(aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$provider_arn" --query 'ClientIDList' --output json)"
  has_sts="$(jq -r 'index("sts.amazonaws.com") != null' <<<"$client_ids")"
  if [[ "$has_sts" != "true" ]]; then
    log "Adding sts.amazonaws.com audience to ${provider_arn}"
    run aws iam add-client-id-to-open-id-connect-provider \
      --open-id-connect-provider-arn "$provider_arn" \
      --client-id sts.amazonaws.com >/dev/null
  fi

  printf '%s\n' "$provider_arn"
}

write_trust_policy() {
  local provider_arn="$1"
  local env_name="$2"
  local output_file="$3"
  jq -n \
    --arg provider_arn "$provider_arn" \
    --arg subject "$(subject_for_environment "$env_name")" \
    '{
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { Federated: $provider_arn },
          Action: "sts:AssumeRoleWithWebIdentity",
          Condition: {
            StringEquals: {
              "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
              "token.actions.githubusercontent.com:sub": $subject
            }
          }
        }
      ]
    }' > "$output_file"
}

ensure_role() {
  local role_name="$1"
  local env_name="$2"
  local provider_arn="$3"
  local trust_doc
  trust_doc="$(mktemp)"
  trap 'rm -f "$trust_doc"' RETURN

  write_trust_policy "$provider_arn" "$env_name" "$trust_doc"

  if aws iam get-role --role-name "$role_name" >/dev/null 2>&1; then
    log "Updating assume-role policy for ${role_name}"
    run aws iam update-assume-role-policy \
      --role-name "$role_name" \
      --policy-document "file://${trust_doc}" >/dev/null
  else
    log "Creating role ${role_name}"
    run aws iam create-role \
      --role-name "$role_name" \
      --description "GitHub Actions deploy role for ${APP_NAME} ${env_name}" \
      --max-session-duration 3600 \
      --assume-role-policy-document "file://${trust_doc}" \
      --tags Key=ManagedBy,Value=bootstrap-first-deploy Key=Application,Value=${APP_NAME} Key=Environment,Value=${env_name} >/dev/null
  fi

  trap - RETURN
  rm -f "$trust_doc"
}

write_web_publish_policy_document() {
  local env_name="$1"
  local output_file="$2"
  local bucket_prefix="${APP_NAME}-${env_name}-app-websitewebbucket"

  jq -n \
    --arg bucket_arn "arn:aws:s3:::${bucket_prefix}*" \
    --arg object_arn "arn:aws:s3:::${bucket_prefix}*/*" \
    --arg distribution_arn "arn:aws:cloudfront::${AWS_ACCOUNT_ID}:distribution/*" \
    '{
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "PublishWebBucket",
          Effect: "Allow",
          Action: [
            "s3:ListBucket",
            "s3:GetBucketLocation",
            "s3:ListBucketMultipartUploads"
          ],
          Resource: $bucket_arn
        },
        {
          Sid: "ManageWebBucketObjects",
          Effect: "Allow",
          Action: [
            "s3:GetObject",
            "s3:PutObject",
            "s3:DeleteObject",
            "s3:AbortMultipartUpload",
            "s3:ListMultipartUploadParts"
          ],
          Resource: $object_arn
        },
        {
          Sid: "InvalidateWebDistribution",
          Effect: "Allow",
          Action: [
            "cloudfront:CreateInvalidation",
            "cloudfront:GetDistribution"
          ],
          Resource: $distribution_arn
        }
      ]
    }' > "$output_file"
}

write_shared_policy_document() {
  local output_file="$1"
  jq -n \
    --arg deploy_role_arn "$(bootstrap_role_arn deploy)" \
    --arg file_role_arn "$(bootstrap_role_arn file-publishing)" \
    --arg image_role_arn "$(bootstrap_role_arn image-publishing)" \
    --arg lookup_role_arn "$(bootstrap_role_arn lookup)" \
    --arg bootstrap_version_parameter_arn "$(bootstrap_version_parameter_arn)" \
    '{
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "AssumeBootstrapRoles",
          Effect: "Allow",
          Action: ["sts:AssumeRole"],
          Resource: [$deploy_role_arn, $file_role_arn, $image_role_arn, $lookup_role_arn]
        },
        {
          Sid: "ReadBootstrapVersion",
          Effect: "Allow",
          Action: ["ssm:GetParameter", "ssm:GetParameters"],
          Resource: $bootstrap_version_parameter_arn
        },
        {
          Sid: "ReadCloudFormationState",
          Effect: "Allow",
          Action: [
            "cloudformation:DescribeStacks",
            "cloudformation:DescribeStackEvents",
            "cloudformation:DescribeChangeSet",
            "cloudformation:GetTemplate",
            "cloudformation:ListStacks"
          ],
          Resource: "*"
        },
        {
          Sid: "IdentifyCaller",
          Effect: "Allow",
          Action: ["sts:GetCallerIdentity"],
          Resource: "*"
        }
      ]
    }' > "$output_file"
}

policy_document_matches() {
  local policy_arn="$1"
  local desired_doc="$2"
  local default_version current_doc

  default_version="$(aws iam get-policy --policy-arn "$policy_arn" --query 'Policy.DefaultVersionId' --output text)"
  current_doc="$(aws iam get-policy-version --policy-arn "$policy_arn" --version-id "$default_version" --query 'PolicyVersion.Document' --output json)"

  diff -u <(jq -S . <<<"$current_doc") <(jq -S . "$desired_doc") >/dev/null
}

prune_policy_versions_if_needed() {
  local policy_arn="$1"
  local versions_json version_count oldest_non_default

  versions_json="$(aws iam list-policy-versions --policy-arn "$policy_arn" --query 'Versions' --output json)"
  version_count="$(jq 'length' <<<"$versions_json")"
  if (( version_count < 5 )); then
    return
  fi

  oldest_non_default="$(jq -r 'map(select(.IsDefaultVersion == false)) | sort_by(.CreateDate) | .[0].VersionId // empty' <<<"$versions_json")"
  if [[ -n "$oldest_non_default" ]]; then
    log "Deleting oldest non-default version ${oldest_non_default} for ${policy_arn}"
    run aws iam delete-policy-version --policy-arn "$policy_arn" --version-id "$oldest_non_default" >/dev/null
  fi
}

ensure_shared_policy() {
  local policy_arn policy_doc
  policy_arn="$(policy_arn_for_name "$SHARED_POLICY_NAME")"
  policy_doc="$(mktemp)"
  trap 'rm -f "$policy_doc"' RETURN

  write_shared_policy_document "$policy_doc"

  if aws iam get-policy --policy-arn "$policy_arn" >/dev/null 2>&1; then
    if policy_document_matches "$policy_arn" "$policy_doc"; then
      log "Shared deploy policy already up to date: ${policy_arn}"
    else
      prune_policy_versions_if_needed "$policy_arn"
      log "Updating shared deploy policy ${policy_arn}"
      run aws iam create-policy-version \
        --policy-arn "$policy_arn" \
        --policy-document "file://${policy_doc}" \
        --set-as-default >/dev/null
    fi
  else
    log "Creating shared deploy policy ${policy_arn}"
    run aws iam create-policy \
      --policy-name "$SHARED_POLICY_NAME" \
      --description "Allows GitHub deploy roles to assume same-account CDK bootstrap roles for ${APP_NAME}" \
      --policy-document "file://${policy_doc}" \
      --tags Key=ManagedBy,Value=bootstrap-first-deploy Key=Application,Value=${APP_NAME} >/dev/null
  fi

  trap - RETURN
  rm -f "$policy_doc"
  printf '%s\n' "$policy_arn"
}

ensure_role_policy_attachment() {
  local role_name="$1"
  local policy_arn="$2"
  local attached

  attached="$(aws iam list-attached-role-policies --role-name "$role_name" --query "AttachedPolicies[?PolicyArn=='${policy_arn}'].PolicyArn" --output text 2>/dev/null || true)"
  if [[ "$attached" == "$policy_arn" ]]; then
    log "Policy ${policy_arn} already attached to ${role_name}"
    return
  fi

  log "Attaching ${policy_arn} to ${role_name}"
  run aws iam attach-role-policy --role-name "$role_name" --policy-arn "$policy_arn" >/dev/null
}

ensure_inline_role_policy() {
  local role_name="$1"
  local policy_name="$2"
  local policy_doc="$3"

  log "Ensuring inline role policy ${policy_name} on ${role_name}"
  run aws iam put-role-policy \
    --role-name "$role_name" \
    --policy-name "$policy_name" \
    --policy-document "file://${policy_doc}" >/dev/null
}

run_cdk_bootstrap() {
  local env_target="aws://${AWS_ACCOUNT_ID}/${AWS_REGION}"
  log "Bootstrapping CDK environment ${env_target}"
  run pnpm --filter @starter/infra cdk bootstrap \
    "$env_target" \
    --toolkit-stack-name "$BOOTSTRAP_STACK_NAME" \
    --qualifier "$CDK_QUALIFIER" \
    --cloudformation-execution-policies "$BOOTSTRAP_EXECUTION_POLICY_ARN" \
    --public-access-block-configuration true \
    --termination-protection true \
    --tags "Application=${APP_NAME}" \
    --tags "ManagedBy=bootstrap-first-deploy" \
    --tags "SecurityBoundary=idm-secure-aws"
}

write_manifest() {
  local oidc_provider_arn="$1"
  local staging_role_arn="$2"
  local production_role_arn="$3"

  mkdir -p "$(dirname "$OUTPUT_FILE")"
  jq -n \
    --arg app_name "$APP_NAME" \
    --arg aws_account_id "$AWS_ACCOUNT_ID" \
    --arg aws_region "$AWS_REGION" \
    --arg github_repository "${GITHUB_ORG}/${GITHUB_REPO}" \
    --arg oidc_provider_arn "$oidc_provider_arn" \
    --arg bootstrap_stack_name "$BOOTSTRAP_STACK_NAME" \
    --arg cdk_qualifier "$CDK_QUALIFIER" \
    --arg bootstrap_execution_policy_arn "$BOOTSTRAP_EXECUTION_POLICY_ARN" \
    --arg staging_env "$STAGING_ENVIRONMENT" \
    --arg production_env "$PRODUCTION_ENVIRONMENT" \
    --arg staging_role_arn "$staging_role_arn" \
    --arg production_role_arn "$production_role_arn" \
    --arg staging_web_domain_name "$STAGING_WEB_DOMAIN_NAME" \
    --arg production_web_domain_name "$PRODUCTION_WEB_DOMAIN_NAME" \
    --arg staging_cognito_domain_prefix "$STAGING_COGNITO_DOMAIN_PREFIX" \
    --arg production_cognito_domain_prefix "$PRODUCTION_COGNITO_DOMAIN_PREFIX" \
    --arg staging_api_domain_name "$STAGING_API_DOMAIN_NAME" \
    --arg production_api_domain_name "$PRODUCTION_API_DOMAIN_NAME" \
    --arg staging_hosted_zone_name "$STAGING_HOSTED_ZONE_NAME" \
    --arg production_hosted_zone_name "$PRODUCTION_HOSTED_ZONE_NAME" \
    --arg staging_certificate_arn_us_east_1 "$STAGING_CERTIFICATE_ARN_US_EAST_1" \
    --arg production_certificate_arn_us_east_1 "$PRODUCTION_CERTIFICATE_ARN_US_EAST_1" \
    --arg staging_certificate_arn_region "$STAGING_CERTIFICATE_ARN_REGION" \
    --arg production_certificate_arn_region "$PRODUCTION_CERTIFICATE_ARN_REGION" \
    '{
      account: {
        appName: $app_name,
        awsAccountId: $aws_account_id,
        awsRegion: $aws_region,
        githubRepository: $github_repository,
        oidcProviderArn: $oidc_provider_arn,
        bootstrapStackName: $bootstrap_stack_name,
        cdkQualifier: $cdk_qualifier,
        bootstrapExecutionPolicyArn: $bootstrap_execution_policy_arn
      },
      githubEnvironments: {
        staging: {
          name: $staging_env,
          vars: {
            APP_NAME: $app_name,
            AWS_ACCOUNT_ID: $aws_account_id,
            AWS_REGION: $aws_region,
            DEPLOY_ROLE_ARN: $staging_role_arn,
            WEB_DOMAIN_NAME: $staging_web_domain_name,
            COGNITO_DOMAIN_PREFIX: $staging_cognito_domain_prefix,
            API_DOMAIN_NAME: $staging_api_domain_name,
            HOSTED_ZONE_NAME: $staging_hosted_zone_name,
            CERTIFICATE_ARN_US_EAST_1: $staging_certificate_arn_us_east_1,
            CERTIFICATE_ARN_REGION: $staging_certificate_arn_region
          }
        },
        production: {
          name: $production_env,
          vars: {
            APP_NAME: $app_name,
            AWS_ACCOUNT_ID: $aws_account_id,
            AWS_REGION: $aws_region,
            DEPLOY_ROLE_ARN: $production_role_arn,
            WEB_DOMAIN_NAME: $production_web_domain_name,
            COGNITO_DOMAIN_PREFIX: $production_cognito_domain_prefix,
            API_DOMAIN_NAME: $production_api_domain_name,
            HOSTED_ZONE_NAME: $production_hosted_zone_name,
            CERTIFICATE_ARN_US_EAST_1: $production_certificate_arn_us_east_1,
            CERTIFICATE_ARN_REGION: $production_certificate_arn_region
          }
        }
      },
      remainingHumanSteps: [
        "Create or confirm GitHub environments named staging and production, and set required reviewers on production.",
        "Copy the vars from this manifest into the matching GitHub environments.",
        "Configure IAM Identity Center permission sets and MFA for human AWS operators.",
        "Create or validate Cognito domains, DNS records, and ACM certificates before the first real deploy.",
        "After the first deploy, bootstrap initial PlatformEntitlement ADMIN records using the template in packages/infra/AGENTS.md."
      ]
    }' > "$OUTPUT_FILE"
}

main() {
  parse_args "$@"

  require_command aws jq pnpm
  resolve_region
  resolve_account_id

  [[ -n "$GITHUB_ORG" ]] || die "GitHub org is required. Set GITHUB_ORG or pass --github-org."
  [[ -n "$GITHUB_REPO" ]] || die "GitHub repo is required. Set GITHUB_REPO or pass --github-repo."

  SHARED_POLICY_NAME="${APP_NAME}-github-cdk-bootstrap-${AWS_REGION}"

  log "Using AWS account ${AWS_ACCOUNT_ID} in region ${AWS_REGION}"
  log "Using GitHub repository ${GITHUB_ORG}/${GITHUB_REPO}"

  local oidc_provider_arn=""
  local shared_policy_arn=""
  local staging_role_arn="$(role_arn "$STAGING_ROLE_NAME")"
  local production_role_arn="$(role_arn "$PRODUCTION_ROLE_NAME")"

  if (( SKIP_OIDC_PROVIDER == 0 )); then
    oidc_provider_arn="$(ensure_github_oidc_provider)"
  else
    oidc_provider_arn="$(get_oidc_provider_arn || true)"
    [[ -n "$oidc_provider_arn" ]] || die "--skip-oidc-provider was set but no existing GitHub OIDC provider was found"
  fi

  if (( SKIP_ROLES == 0 )); then
    local staging_web_publish_doc
    local production_web_publish_doc
    staging_web_publish_doc="$(mktemp)"
    production_web_publish_doc="$(mktemp)"
    trap 'rm -f "$staging_web_publish_doc" "$production_web_publish_doc"' RETURN

    ensure_role "$STAGING_ROLE_NAME" "$STAGING_ENVIRONMENT" "$oidc_provider_arn"
    ensure_role "$PRODUCTION_ROLE_NAME" "$PRODUCTION_ENVIRONMENT" "$oidc_provider_arn"
    shared_policy_arn="$(ensure_shared_policy)"
    ensure_role_policy_attachment "$STAGING_ROLE_NAME" "$shared_policy_arn"
    ensure_role_policy_attachment "$PRODUCTION_ROLE_NAME" "$shared_policy_arn"

    write_web_publish_policy_document "$STAGING_ENVIRONMENT" "$staging_web_publish_doc"
    write_web_publish_policy_document "$PRODUCTION_ENVIRONMENT" "$production_web_publish_doc"
    ensure_inline_role_policy "$STAGING_ROLE_NAME" "${APP_NAME}-github-web-publish" "$staging_web_publish_doc"
    ensure_inline_role_policy "$PRODUCTION_ROLE_NAME" "${APP_NAME}-github-web-publish" "$production_web_publish_doc"

    trap - RETURN
    rm -f "$staging_web_publish_doc" "$production_web_publish_doc"
  fi

  if (( SKIP_CDK_BOOTSTRAP == 0 )); then
    run_cdk_bootstrap
  fi

  write_manifest "$oidc_provider_arn" "$staging_role_arn" "$production_role_arn"

  log "Bootstrap complete"
  log "Staging deploy role: ${staging_role_arn}"
  log "Production deploy role: ${production_role_arn}"
  log "GitHub environment manifest written to ${OUTPUT_FILE}"

  warn "This script intentionally does not automate GitHub environment creation, GitHub required reviewers, IAM Identity Center assignments, or ACM/DNS validation. Those remain human-verified steps."
}

main "$@"
