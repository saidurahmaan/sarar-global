import "server-only";

type CloudflareApiResult = {
  success?: boolean;
  errors?: Array<{ code?: number; message?: string }>;
  messages?: string[];
};

export async function purgeCloudflareUrls(urls: string[]): Promise<void> {
  if (urls.length === 0) return;

  const zoneId = process.env.CF_ZONE_ID?.trim();
  const apiToken = process.env.CF_API_TOKEN?.trim();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!zoneId || !apiToken) {
    console.warn("[cloudflare-purge] skipped_missing_credentials", {
      reason: !zoneId ? "missing_CF_ZONE_ID" : "missing_CF_API_TOKEN",
      urlCount: urls.length,
    });
    return;
  }

  if (!siteUrl) {
    console.warn("[cloudflare-purge] skipped_missing_site_url");
    return;
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ files: urls }),
      },
    );

    let body: CloudflareApiResult = {};
    try {
      body = (await response.json()) as CloudflareApiResult;
    } catch {
      console.warn("[cloudflare-purge] invalid_json_response", {
        status: response.status,
        urls,
      });
      return;
    }

    if (body.success !== true) {
      console.warn("[cloudflare-purge] api_unsuccessful", {
        status: response.status,
        errors: body.errors,
        urls,
      });
      return;
    }

    console.info("[cloudflare-purge] purged", {
      urlCount: urls.length,
      urls,
      success: true,
    });
  } catch (err) {
    console.warn("[cloudflare-purge] network_error", {
      error: err instanceof Error ? err.message : String(err),
      urls,
    });
  }
}

