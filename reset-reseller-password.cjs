
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

function loadEnvFile() {
  const content = fs.readFileSync(".env.local", "utf8");

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;

    let value = match[2].trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[match[1]] = value;
  }
}

async function main() {
  loadEnvFile();

  const userId = "53714306-c4d7-42de-a76f-251bd863812f";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("URL atau service role key tidak ditemukan di .env.local");
  }

  const supabase = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error: lookupError } =
    await supabase.auth.admin.getUserById(userId);

  if (lookupError || !data.user) {
    throw new Error(lookupError?.message || "Akun tidak ditemukan.");
  }

  console.log("Akun target:", data.user.email);

  const password = await new Promise((resolve) => {
    const rl = require("readline").createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question("Masukkan password baru (minimal 6 karakter): ", (answer) => {
      rl.close();
      resolve(answer);
    });
  });

  if (typeof password !== "string" || password.length < 6) {
    throw new Error("Password minimal 6 karakter.");
  }

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    password,
  });

  if (error) throw new Error(error.message);

  console.log("Password akun reseller berhasil diubah.");
}

main().catch((error) => {
  console.error("Gagal:", error.message);
  process.exitCode = 1;
});
