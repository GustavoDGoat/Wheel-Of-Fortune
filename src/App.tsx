import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

function App() {
  // --- SCANNER STATE ---
  const [folderPath, setFolderPath] = useState("/home/");
  const [files, setFiles] = useState<string[]>([]);
  const [scanError, setScanError] = useState("");

  // --- IMPORT STATE ---
  const [sourceFile, setSourceFile] = useState("");
  const [vaultFolder, setVaultFolder] = useState("/home/WheelOfFortune_Vault");
  const [importMessage, setImportMessage] = useState("");

  // 1. The original scanner function
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

  // 2. The NEW import function
  async function handleImport() {
    setImportMessage("Copying...");
    try {
      // Notice how the argument names EXACTLY match the Rust parameter names
      // (Tauri automatically converts camelCase in TS to snake_case in Rust)
      const newPath: string = await invoke("copy_file_to_storage", {
        sourcePath: sourceFile,
        destinationFolder: vaultFolder,
      });

      setImportMessage(`Success! Safely vaulted at: ${newPath}`);
      // Clear the source input after a successful copy
      setSourceFile("");
    } catch (err) {
      console.error("Upload failed:", err);
      setImportMessage(`Error: ${err}`);
    }
  }

  return (
    <div className="flex h-screen w-full flex-col">
      <header className="border-b border-gray-800 bg-black p-4">
        <h1 className="text-2xl font-bold tracking-widest text-white uppercase">
          Wheel of Fortune
        </h1>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 border-r border-gray-800 bg-gray-950 p-4">
          <nav className="flex flex-col space-y-2">
            <button className="text-left text-white bg-gray-900 px-3 py-2 rounded focus:outline-none">
              Local Storage
            </button>
            <button className="text-left text-gray-400 hover:text-white hover:bg-gray-900 px-3 py-2 rounded transition-colors focus:outline-none">
              Cloud Links
            </button>
            <button className="text-left text-gray-400 hover:text-white hover:bg-gray-900 px-3 py-2 rounded transition-colors focus:outline-none">
              External Drives
            </button>
          </nav>
        </aside>

        <main className="flex-1 bg-black p-8 flex flex-col items-center overflow-y-auto">
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
                  className="text-gray-400 text-xs bg-gray-900 p-2 rounded truncate border border-gray-800"
                >
                  {file}
                </li>
              ))}
            </ul>
          </div>

          {/* --- IMPORT SECTION (NEW) --- */}
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
                  placeholder="e.g., /home/downloads/video.mp4"
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

            {/* Status Message */}
            {importMessage && (
              <div
                className={`mt-4 p-4 rounded text-sm ${importMessage.startsWith("Error") ? "bg-red-950/30 text-red-500 border border-red-900" : "bg-gray-900 text-white border border-gray-700"}`}
              >
                {importMessage}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
