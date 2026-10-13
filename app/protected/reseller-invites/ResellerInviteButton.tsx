"use client";

import { useState } from "react";

export default function ResellerInviteButton() {
  const [loading, setLoading] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [message, setMessage] = useState("");

  async function createInvite() {
    setLoading(true);
    setMessage("");
    setInviteUrl("");

    try {
      const response = await fetch(
        "/api/reseller-invites",
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setMessage(
          result.error ||
            "Gagal membuat invite reseller."
        );

        setLoading(false);
        return;
      }

      setInviteUrl(result.invite_url);
    } catch (error) {
      console.error(
        "Create reseller invite error:",
        error
      );

      setMessage(
        "Terjadi kesalahan koneksi."
      );
    }

    setLoading(false);
  }

  async function copyInvite() {
    if (!inviteUrl) return;

    await navigator.clipboard.writeText(
      inviteUrl
    );

    setMessage("Link invite berhasil disalin.");
  }

  return (
    <div>
      <button
        type="button"
        onClick={createInvite}
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading
          ? "Membuat Invite..."
          : "Buat Invite Reseller"}
      </button>

      {inviteUrl && (
        <div className="mt-5">
          <label className="block text-sm font-medium text-gray-700">
            Link Invite
          </label>

          <input
            type="text"
            readOnly
            value={inviteUrl}
            className="mt-2 w-full rounded-lg border bg-gray-50 p-3 text-sm text-gray-700"
          />

          <button
            type="button"
            onClick={copyInvite}
            className="mt-3 w-full rounded-lg border border-blue-600 px-5 py-3 font-semibold text-blue-600 hover:bg-blue-50"
          >
            Salin Link Invite
          </button>
        </div>
      )}

      {message && (
        <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
          {message}
        </p>
      )}
    </div>
  );
}