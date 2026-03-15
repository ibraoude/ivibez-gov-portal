"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Deliverable = {
  id: string;
  file_path: string;
  created_at?: string;
};

export default function DeliverablesSection({ contractId }: { contractId: string }) {

  const supabase = createClient();

  const [files, setFiles] = useState<Deliverable[]>([]);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadFiles();
  }, [contractId]);

  async function loadFiles() {

    const { data, error } = await supabase
      .from("contract_deliverables")
      .select("*")
      .eq("contract_id", contractId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load deliverables:", error.message);
      return;
    }

    setFiles(data || []);
  }

  async function uploadFile(file: File) {

    try {

      setUploading(true);

      const path = `${contractId}/${Date.now()}-${file.name}`;

      const { error } = await supabase.storage
        .from("contract-deliverables")
        .upload(path, file);

      if (error) throw error;

      const { error: insertError } = await supabase
        .from("contract_deliverables")
        .insert({
          contract_id: contractId,
          file_path: path
        });

      if (insertError) throw insertError;

      await loadFiles();

    } catch (err) {

      console.error("Upload failed:", err);
      alert("Upload failed");

    } finally {

      setUploading(false);

    }
  }

  async function downloadFile(path: string) {

    try {

      setDownloading(path);

      const { data, error } = await supabase.storage
        .from("contract-deliverables")
        .createSignedUrl(path, 60); // expires in 60 seconds

      if (error) throw error;

      window.open(data.signedUrl, "_blank");

    } catch (err) {

      console.error("Download failed:", err);
      alert("Download failed");

    } finally {

      setDownloading(null);

    }
  }

  return (
    <div className="rounded-xl border bg-white p-6">

      <div className="flex items-center justify-between mb-4">

        <h3 className="font-semibold">Deliverables</h3>

        <button
          onClick={() => inputRef.current?.click()}
          className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
        >
          Upload File
        </button>

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadFile(f);
          }}
        />

      </div>

      <div className="space-y-2">

        {files.length === 0 && (
          <p className="text-sm text-gray-500">
            No deliverables uploaded yet.
          </p>
        )}

        {files.map((f) => (

          <div
            key={f.id}
            className="flex items-center justify-between border rounded p-2"
          >

            <span className="text-sm">
              {f.file_path.split("/").pop()}
            </span>

            <button
              onClick={() => downloadFile(f.file_path)}
              disabled={downloading === f.file_path}
              className="text-blue-600 text-xs hover:underline disabled:opacity-50"
            >
              {downloading === f.file_path ? "Preparing..." : "Download"}
            </button>

          </div>

        ))}

      </div>

      {uploading && (
        <p className="text-xs text-gray-500 mt-2">
          Uploading...
        </p>
      )}

    </div>
  );
}