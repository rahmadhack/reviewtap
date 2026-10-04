import { createAdminClient } from "@/lib/supabase/admin";

const MAX_FAILED_ATTEMPTS = 5;
const BLOCK_MINUTES = 15;

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");

  if (realIp) {
    return realIp.trim();
  }

  return "unknown";
}

export async function checkQrPinRateLimit(
  request: Request,
  code: string,
): Promise<RateLimitResult> {
  const supabase = createAdminClient();
  const ipAddress = getClientIp(request);

  const { data, error } = await supabase
    .from("qr_pin_attempts")
    .select(
      `
        failed_attempts,
        blocked_until
      `,
    )
    .eq("code", code)
    .eq("ip_address", ipAddress)
    .maybeSingle();

  if (error) {
    console.error(
      "QR PIN rate limit lookup error:",
      error,
    );

    // Jangan memblokir pengguna kalau sistem rate limit
    // sedang bermasalah.
    return {
      allowed: true,
    };
  }

  if (!data?.blocked_until) {
    return {
      allowed: true,
    };
  }

  const blockedUntil = new Date(data.blocked_until);
  const now = new Date();

  if (blockedUntil <= now) {
    await supabase
      .from("qr_pin_attempts")
      .update({
        failed_attempts: 0,
        blocked_until: null,
        updated_at: now.toISOString(),
      })
      .eq("code", code)
      .eq("ip_address", ipAddress);

    return {
      allowed: true,
    };
  }

  const retryAfterSeconds = Math.ceil(
    (blockedUntil.getTime() - now.getTime()) / 1000,
  );

  return {
    allowed: false,
    retryAfterSeconds,
  };
}

export async function recordQrPinFailure(
  request: Request,
  code: string,
) {
  const supabase = createAdminClient();
  const ipAddress = getClientIp(request);
  const now = new Date();

  const { data, error } = await supabase
    .from("qr_pin_attempts")
    .select(
      `
        failed_attempts
      `,
    )
    .eq("code", code)
    .eq("ip_address", ipAddress)
    .maybeSingle();

  if (error) {
    console.error(
      "QR PIN rate limit read error:",
      error,
    );
    return;
  }

  const failedAttempts =
    (data?.failed_attempts || 0) + 1;

  const shouldBlock =
    failedAttempts >= MAX_FAILED_ATTEMPTS;

  const blockedUntil = shouldBlock
    ? new Date(
        now.getTime() +
          BLOCK_MINUTES * 60 * 1000,
      ).toISOString()
    : null;

  const { error: upsertError } = await supabase
    .from("qr_pin_attempts")
    .upsert(
      {
        code,
        ip_address: ipAddress,
        failed_attempts: failedAttempts,
        blocked_until: blockedUntil,
        last_attempt_at: now.toISOString(),
        updated_at: now.toISOString(),
      },
      {
        onConflict: "code,ip_address",
      },
    );

  if (upsertError) {
    console.error(
      "QR PIN rate limit update error:",
      upsertError,
    );
  }
}

export async function clearQrPinFailures(
  request: Request,
  code: string,
) {
  const supabase = createAdminClient();
  const ipAddress = getClientIp(request);

  const { error } = await supabase
    .from("qr_pin_attempts")
    .delete()
    .eq("code", code)
    .eq("ip_address", ipAddress);

  if (error) {
    console.error(
      "QR PIN rate limit clear error:",
      error,
    );
  }
}