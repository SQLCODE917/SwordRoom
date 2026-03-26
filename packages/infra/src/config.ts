import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type DeployEnv = "staging" | "production";

export interface InfraConfig {
  readonly appName: string;
  readonly deployEnv: DeployEnv;
  readonly account: string;
  readonly region: string;
  readonly stackPrefix: string;
  readonly webDomainName: string;
  readonly webOrigin: string;
  readonly webCallbackUrl: string;
  readonly webLogoutUrl: string;
  readonly apiDomainName?: string;
  readonly hostedZoneName?: string;
  readonly certificateArnUsEast1?: string;
  readonly certificateArnRegion?: string;
  readonly cognitoDomainPrefix: string;
  readonly webAssetPath: string;
  readonly repoRoot: string;
  readonly isProduction: boolean;
  readonly tags: Record<string, string>;
}

const repoRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));

export function loadInfraConfig(env: NodeJS.ProcessEnv = process.env): InfraConfig {
  const appName = envOrDefault(env, "APP_NAME", "swordworld");
  const deployEnv = parseDeployEnv(envOrDefault(env, "DEPLOY_ENV", "staging"));
  const account = envOrDefault(env, "AWS_ACCOUNT_ID", "111111111111");
  const region = envOrDefault(env, "AWS_REGION", "us-east-1");
  const webDomainName = envOrDefault(env, "WEB_DOMAIN_NAME", `${appName}-${deployEnv}.example.com`);
  const requestedWebAssetPath = resolve(repoRoot, envOrDefault(env, "WEB_ASSET_PATH", "packages/web/dist"));
  const fallbackWebAssetPath = resolve(repoRoot, "packages/infra/static/web");
  const cognitoDomainPrefix = sanitizeDomainPrefix(
    envOrDefault(env, "COGNITO_DOMAIN_PREFIX", `${appName}-${deployEnv}`)
  );

  return {
    appName,
    deployEnv,
    account,
    region,
    stackPrefix: `${appName}-${deployEnv}`,
    webDomainName,
    webOrigin: `https://${webDomainName}`,
    webCallbackUrl: `https://${webDomainName}/auth/callback`,
    webLogoutUrl: `https://${webDomainName}/login`,
    apiDomainName: maybeEnv(env, "API_DOMAIN_NAME"),
    hostedZoneName: maybeEnv(env, "HOSTED_ZONE_NAME"),
    certificateArnUsEast1: maybeEnv(env, "CERTIFICATE_ARN_US_EAST_1"),
    certificateArnRegion: maybeEnv(env, "CERTIFICATE_ARN_REGION"),
    cognitoDomainPrefix,
    webAssetPath: existsSync(requestedWebAssetPath) ? requestedWebAssetPath : fallbackWebAssetPath,
    repoRoot,
    isProduction: deployEnv === "production",
    tags: {
      Application: appName,
      Environment: deployEnv,
      ManagedBy: "aws-cdk",
      SecurityBoundary: "idm-secure-aws",
    },
  };
}

function parseDeployEnv(value: string): DeployEnv {
  if (value !== "staging" && value !== "production") {
    throw new Error(`DEPLOY_ENV must be one of staging|production, received ${value}`);
  }
  return value;
}

function envOrDefault(env: NodeJS.ProcessEnv, name: string, fallback: string): string {
  const value = env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

function maybeEnv(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function sanitizeDomainPrefix(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "").slice(0, 63);
}
