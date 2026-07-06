import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

type PackageInfo = {
  name?: string;
  version?: string;
};

const readJsonPackage = (path: string): PackageInfo => JSON.parse(readFileSync(path, 'utf8')) as PackageInfo;

export type VersionInfo = {
  service: string;
  responses: string;
};

export const getVersionInfo = (): VersionInfo => {
  const servicePackage = readJsonPackage(join(process.cwd(), 'package.json'));
  const requireFromHere = createRequire(__filename);
  const responsesPackagePath = requireFromHere.resolve('@iqb/responses/package.json');
  const responsesPackage = readJsonPackage(responsesPackagePath);

  return {
    service: servicePackage.version ?? 'unknown',
    responses: responsesPackage.version ?? 'unknown'
  };
};
