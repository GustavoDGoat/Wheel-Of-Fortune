import { useState, useEffect } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";

function App() {
  // --- SCANNER STATE ---
  const [folderPath, setFolderPath] = useState("/home/");
  const [files, setFiles] = useState<string[]>([]);
  const [scanError, setScanError] = useState("");

  // --- IMPORT STATE ---
  const [sourceFile, setSourceFile] = useState("");
  const [vaultFolder, setVaultFolder] = useState("/home/WheelOfFortune_Vault");
  const [importMessage, setImportMessage] = useState("");

  // --- PLAYER STATE ---
  const [activeMedia, setActiveMedia] = useState<string | null>(null);

  // --- VAULT STATE ---
  interface VaultFile {
    id: number;
    file_name: string;
    file_path: string;
  }
  const [vaultFiles, setVaultFiles] = useState<VaultFile[]>([]);

  // --- BOOT SEQUENCE ---
  useEffect(() => {
    async function loadVault() {
      try {
        const dbFiles: VaultFile[] = await invoke("get_vault_files");
        setVaultFiles(dbFiles);
      } catch (err) {
        console.error("Failed to load vault database:", err);
      }
    }
    loadVault();
  }, []);

  async function scanFolder() {
    setScanError("");
    try {
      const result: string[] = await invoke("get_local_files", {
        path: folderPath,
      });
      setFiles(result);
    } catch (err) {
      console.error(err);
      setScanError(err as string);
    }
  }

  async function handleImport() {
    setImportMessage("Copying...");
    try {
      const newPath: string = await invoke("copy_file_to_storage", {
        sourcePath: sourceFile,
        destinationFolder: vaultFolder,
      });
      setImportMessage(`Success! Safely vaulted at: ${newPath}`);
      setSourceFile("");

      // Optionally refresh the vault list here after a successful import!
      const dbFiles: VaultFile[] = await invoke("get_vault_files");
      setVaultFiles(dbFiles);
    } catch (err) {
      console.error("Upload failed:", err);
      setImportMessage(`Error: ${err}`);
    }
  }

  // Helper to determine what type of HTML tag to render
  function getMediaType(filePath: string) {
    const ext = filePath.split(".").pop()?.toLowerCase();
    if (["mp4", "webm", "ogg"].includes(ext || "")) return "video";
    if (["mp3", "wav", "flac"].includes(ext || "")) return "audio";
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext || ""))
      return "image";
    return "unknown";
  }

  return (
    <div className="flex h-screen w-full flex-col">
      <header className="border-b border-gray-800 bg-black p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-widest text-white uppercase">
          Wheel of Fortune
        </h1>
        {activeMedia && (
          <button
            onClick={() => setActiveMedia(null)}
            className="text-sm bg-white text-black px-4 py-1 rounded font-bold uppercase hover:bg-gray-300 transition-colors"
          >
            Close Player
          </button>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 border-r border-gray-800 bg-gray-950 p-4 flex flex-col">
          <nav className="flex flex-col space-y-2">
            <button
              onClick={() => setActiveMedia(null)}
              className="text-left text-white bg-gray-900 px-3 py-2 rounded focus:outline-none"
            >
              Local Storage
            </button>
            <button className="text-left text-gray-400 hover:text-white hover:bg-gray-900 px-3 py-2 rounded transition-colors focus:outline-none">
              Cloud Links
            </button>
            <button className="text-left text-gray-400 hover:text-white hover:bg-gray-900 px-3 py-2 rounded transition-colors focus:outline-none">
              External Drives
            </button>
          </nav>

          {/* VAULT MEMORY DEBUGGER */}
          <div className="mt-8 pt-4 border-t border-gray-800 flex-1 overflow-y-auto">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">
              Vault Memory
            </p>
            <ul className="space-y-1 pr-2">
              {vaultFiles.map((file) => (
                <li
                  key={file.id}
                  className="text-gray-400 text-xs truncate hover:text-white cursor-pointer transition-colors"
                  onClick={() => setActiveMedia(file.file_path)}
                  title={file.file_path}
                >
                  {file.file_name}
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <main className="flex-1 bg-black p-8 flex flex-col items-center overflow-y-auto">
          {activeMedia ? (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <h2 className="text-gray-500 uppercase tracking-widest text-xs mb-4 truncate w-full text-center">
                Playing: {activeMedia}
              </h2>

              <div className="border border-gray-800 bg-gray-950 p-2 rounded shadow-2xl max-w-4xl w-full">
                {getMediaType(activeMedia) === "video" && (
                  <video
                    controls
                    autoPlay
                    src={convertFileSrc(activeMedia)}
                    className="w-full h-auto rounded"
                  />
                )}
                {getMediaType(activeMedia) === "audio" && (
                  <audio
                    controls
                    autoPlay
                    src={convertFileSrc(activeMedia)}
                    className="w-full"
                  />
                )}
                {getMediaType(activeMedia) === "image" && (
                  <img
                    src={convertFileSrc(activeMedia)}
                    alt="Media View"
                    className="max-h-[70vh] object-contain mx-auto rounded"
                  />
                )}
              </div>
            </div>
          ) : (
            <>
              {/* --- SCANNER SECTION --- */}
              <div className="w-full max-w-2xl text-left border-b border-gray-800 pb-8 mb-8">
                <h2 className="text-white font-bold tracking-widest uppercase mb-4">
                  1. Scan Directory
                </h2>
                <div className="flex space-x-2 mb-4">
                  <input
                    type="text"
                    value={folderPath}
                    onChange={(e) => setFolderPath(e.target.value)}
                    placeholder="Enter folder path to scan..."
                    className="flex-1 bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded focus:outline-none focus:border-gray-500"
                  />
                  <button
                    onClick={scanFolder}
                    className="bg-white text-black px-6 py-2 rounded font-bold hover:bg-gray-200 transition-colors"
                  >
                    SCAN
                  </button>
                </div>
                {scanError && (
                  <div className="text-red-500 text-sm mb-4">
                    Error: {scanError}
                  </div>
                )}

                <ul className="space-y-2 max-h-40 overflow-y-auto pr-2">
                  {files.map((file, index) => (
                    <li
                      key={index}
                      onClick={() => setActiveMedia(file)}
                      className="text-gray-400 text-xs bg-gray-900 p-2 rounded truncate border border-gray-800 cursor-pointer hover:bg-white hover:text-black transition-colors"
                    >
                      ▶ {file}
                    </li>
                  ))}
                </ul>
              </div>

              {/* --- IMPORT SECTION --- */}
              <div className="w-full max-w-2xl text-left">
                <h2 className="text-white font-bold tracking-widest uppercase mb-4">
                  2. Import to Vault
                </h2>

                <div className="flex flex-col space-y-4 mb-4">
                  <div>
                    <label className="text-gray-500 text-xs uppercase tracking-widest mb-1 block">
                      Target File (Source)
                    </label>
                    <input
                      type="text"
                      value={sourceFile}
                      onChange={(e) => setSourceFile(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded focus:outline-none focus:border-gray-500"
                    />
                  </div>

                  <div>
                    <label className="text-gray-500 text-xs uppercase tracking-widest mb-1 block">
                      Vault Location (Destination)
                    </label>
                    <input
                      type="text"
                      value={vaultFolder}
                      onChange={(e) => setVaultFolder(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded focus:outline-none focus:border-gray-500"
                    />
                  </div>
                </div>

                <button
                  onClick={handleImport}
                  className="w-full bg-white text-black px-6 py-3 rounded font-bold tracking-widest hover:bg-gray-200 transition-colors uppercase"
                >
                  Execute Import
                </button>

                {importMessage && (
                  <div
                    className={`mt-4 p-4 rounded text-sm ${importMessage.startsWith("Error") ? "bg-red-950/30 text-red-500 border border-red-900" : "bg-gray-900 text-white border border-gray-700"}`}
                  >
                    {importMessage}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
