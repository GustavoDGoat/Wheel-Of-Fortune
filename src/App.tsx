import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openPath, openUrl } from "@tauri-apps/plugin-opener"; // <-- The updated v2 OS bridge!

function App() {
  // --- NAVIGATION STATE ---
  const [activeTab, setActiveTab] = useState<"local" | "cloud">("local");

  // --- LOCAL SCANNER STATE ---
  const [folderPath, setFolderPath] = useState("/home/");
  const [files, setFiles] = useState<string[]>([]);
  const [scanError, setScanError] = useState("");
  const [sourceFile, setSourceFile] = useState("");
  const [vaultFolder, setVaultFolder] = useState("/home/WheelOfFortune_Vault");
  const [importMessage, setImportMessage] = useState("");

  // --- CLOUD STATE ---
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [cloudMessage, setCloudMessage] = useState("");

  // --- DATABASE STATE ---
  interface VaultFile {
    id: number;
    file_name: string;
    file_path: string;
  }
  interface CloudLink {
    id: number;
    title: string;
    url: string;
  }

  const [vaultFiles, setVaultFiles] = useState<VaultFile[]>([]);
  const [cloudLinks, setCloudLinks] = useState<CloudLink[]>([]);

  // --- BOOT SEQUENCE ---
  useEffect(() => {
    async function loadDatabase() {
      try {
        const dbFiles: VaultFile[] = await invoke("get_vault_files");
        setVaultFiles(dbFiles);

        const dbLinks: CloudLink[] = await invoke("get_cloud_links");
        setCloudLinks(dbLinks);
      } catch (err) {
        console.error("Failed to load database:", err);
      }
    }
    loadDatabase();
  }, []);

  // --- LOCAL FUNCTIONS ---
  async function scanFolder() {
    setScanError("");
    try {
      const result: string[] = await invoke("get_local_files", {
        path: folderPath,
      });
      setFiles(result);
    } catch (err) {
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

      const dbFiles: VaultFile[] = await invoke("get_vault_files");
      setVaultFiles(dbFiles);
    } catch (err) {
      setImportMessage(`Error: ${err}`);
    }
  }

  async function handleDeleteVaultFile(id: number, filePath: string) {
    try {
      await invoke("delete_vault_file", { id, filePath });
      setVaultFiles(vaultFiles.filter((file) => file.id !== id));
    } catch (err) {
      console.error("Failed to delete file:", err);
      alert(`Could not delete file: ${err}`);
    }
  }

  // --- THE NATIVE OS LAUNCHER FUNCTION ---
  async function handleOpenFile(filePath: string) {
    try {
      // Tells your Linux OS to open the file with the user's default app
      await openPath(filePath);
    } catch (err) {
      console.error("Failed to launch OS app:", err);
      alert(`Could not open file: ${err}`);
    }
  }

  // --- CLOUD FUNCTIONS ---
  async function handleSaveLink() {
    setCloudMessage("Saving...");
    try {
      await invoke("add_cloud_link", { title: linkTitle, url: linkUrl });
      setCloudMessage("Success! Link locked in the vault.");
      setLinkTitle("");
      setLinkUrl("");

      const dbLinks: CloudLink[] = await invoke("get_cloud_links");
      setCloudLinks(dbLinks);
    } catch (err) {
      setCloudMessage(`Error: ${err}`);
    }
  }

  // Opens web URLs in the default browser
  async function handleOpenUrl(url: string) {
    try {
      await openUrl(url);
    } catch (err) {
      console.error("Failed to open browser:", err);
    }
  }

  return (
    <div className="flex h-screen w-full flex-col">
      {/* HEADER */}
      <header className="border-b border-gray-800 bg-black p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-widest text-white uppercase">
          Wheel of Fortune
        </h1>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
        <aside className="w-64 border-r border-gray-800 bg-gray-950 p-4 flex flex-col">
          <nav className="flex flex-col space-y-2">
            <button
              onClick={() => setActiveTab("local")}
              className={`text-left px-3 py-2 rounded focus:outline-none transition-colors ${activeTab === "local" ? "bg-gray-900 text-white" : "text-gray-400 hover:bg-gray-900 hover:text-white"}`}
            >
              Local Storage
            </button>
            <button
              onClick={() => setActiveTab("cloud")}
              className={`text-left px-3 py-2 rounded focus:outline-none transition-colors ${activeTab === "cloud" ? "bg-gray-900 text-white" : "text-gray-400 hover:bg-gray-900 hover:text-white"}`}
            >
              Cloud Links
            </button>
          </nav>

          {/* VAULT MEMORY DEBUGGER (WITH OS LAUNCHER) */}
          <div className="mt-8 pt-4 border-t border-gray-800 flex-1 overflow-y-auto">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">
              Vault Memory
            </p>
            <ul className="space-y-1 pr-2">
              {vaultFiles.map((file) => (
                <li
                  key={file.id}
                  className="flex justify-between items-center group text-gray-400 text-xs hover:text-white cursor-pointer transition-colors p-1 rounded hover:bg-gray-900"
                >
                  <span
                    className="truncate flex-1"
                    onClick={() => handleOpenFile(file.file_path)}
                    title={file.file_path}
                  >
                    {file.file_name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteVaultFile(file.id, file.file_path);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 px-2 font-bold transition-opacity"
                    title="Delete permanently"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 bg-black p-8 flex flex-col items-center overflow-y-auto">
          {activeTab === "local" ? (
            // --- LOCAL SCANNER & IMPORT UI ---
            <>
              <div className="w-full max-w-2xl text-left border-b border-gray-800 pb-8 mb-8">
                <h2 className="text-white font-bold tracking-widest uppercase mb-4">
                  1. Scan Directory
                </h2>
                <div className="flex space-x-2 mb-4">
                  <input
                    type="text"
                    value={folderPath}
                    onChange={(e) => setFolderPath(e.target.value)}
                    className="flex-1 bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded focus:outline-none focus:border-gray-500"
                  />
                  <button
                    onClick={scanFolder}
                    className="bg-white text-black px-6 py-2 rounded font-bold hover:bg-gray-200"
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
                      onClick={() => handleOpenFile(file)}
                      className="text-gray-400 text-xs bg-gray-900 p-2 rounded truncate border border-gray-800 cursor-pointer hover:bg-white hover:text-black"
                    >
                      ▶ {file}
                    </li>
                  ))}
                </ul>
              </div>

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
                      className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded"
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
                      className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded"
                    />
                  </div>
                </div>
                <button
                  onClick={handleImport}
                  className="w-full bg-white text-black px-6 py-3 rounded font-bold tracking-widest hover:bg-gray-200 uppercase"
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
          ) : (
            // --- CLOUD LINKS UI ---
            <div className="w-full max-w-2xl text-left">
              <h2 className="text-white font-bold tracking-widest uppercase mb-4 border-b border-gray-800 pb-2">
                Add Cloud Link
              </h2>

              <div className="flex flex-col space-y-4 mb-6">
                <div>
                  <label className="text-gray-500 text-xs uppercase tracking-widest mb-1 block">
                    Link Title
                  </label>
                  <input
                    type="text"
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    placeholder="e.g., Match Highlights"
                    className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded focus:outline-none focus:border-gray-500"
                  />
                </div>
                <div>
                  <label className="text-gray-500 text-xs uppercase tracking-widest mb-1 block">
                    URL
                  </label>
                  <input
                    type="text"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://youtube.com/..."
                    className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded focus:outline-none focus:border-gray-500"
                  />
                </div>
              </div>

              <button
                onClick={handleSaveLink}
                className="w-full bg-white text-black px-6 py-3 rounded font-bold tracking-widest hover:bg-gray-200 transition-colors uppercase mb-8"
              >
                Save to Database
              </button>

              {cloudMessage && (
                <div
                  className={`mb-8 p-4 rounded text-sm ${cloudMessage.startsWith("Error") ? "bg-red-950/30 text-red-500 border border-red-900" : "bg-gray-900 text-white border border-gray-700"}`}
                >
                  {cloudMessage}
                </div>
              )}

              <h2 className="text-white font-bold tracking-widest uppercase mb-4 border-b border-gray-800 pb-2">
                Saved Cloud Links
              </h2>
              <ul className="space-y-2">
                {cloudLinks.length === 0 ? (
                  <li className="text-gray-600 text-sm italic">
                    No links saved yet.
                  </li>
                ) : (
                  cloudLinks.map((link) => (
                    <li
                      key={link.id}
                      className="bg-gray-900 border border-gray-800 p-4 rounded flex flex-col cursor-pointer hover:bg-gray-800 transition-colors"
                      onClick={() => handleOpenUrl(link.url)}
                    >
                      <span className="text-white font-bold">{link.title}</span>
                      <span className="text-gray-500 text-xs truncate mt-1">
                        {link.url}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
