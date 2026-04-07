const MANIFEST_URL = process.env.MODEL_MANIFEST_URL ?? 'https://models.truestream.app/manifest.json';

const BUNDLED_VERSIONS: Record<string, string> = {
  'video-efficientnet-b0': '1.0.0',
  'audio-rawnet2-lite': '1.0.0',
};

interface ManifestEntry {
  id: string;
  version: string;
}

function isNewer(remote: string, local: string): boolean {
  const r = remote.split('.').map(Number);
  const l = local.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((r[i] ?? 0) > (l[i] ?? 0)) return true;
    if ((r[i] ?? 0) < (l[i] ?? 0)) return false;
  }
  return false;
}

async function main() {
  const res = await fetch(MANIFEST_URL);
  if (!res.ok) {
    console.error(`Failed to fetch manifest: ${res.status}`);
    process.exit(1);
  }

  const manifest = await res.json() as { models: ManifestEntry[] };
  let hasUpdate = false;

  for (const entry of manifest.models) {
    const current = BUNDLED_VERSIONS[entry.id] ?? '0.0.0';
    if (isNewer(entry.version, current)) {
      console.log(`Update available: ${entry.id} ${current} -> ${entry.version}`);
      hasUpdate = true;
    }
  }

  if (hasUpdate) {
    process.exit(1); // Non-zero signals update available
  } else {
    console.log('All models are up to date.');
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
