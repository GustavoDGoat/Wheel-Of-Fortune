import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";

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

  // --- LOCAL ACTIONS ---
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
      alert(`Could not delete file: ${err}`);
    }
  }

  // --- CLOUD ACTIONS ---
  async function handleSaveLink() {
    setCloudMessage("Saving link...");
    try {
      await invoke("add_cloud_link", { title: linkTitle, url: linkUrl });
      setCloudMessage("Link saved.");
      setLinkTitle("");
      setLinkUrl("");
      const dbLinks: CloudLink[] = await invoke("get_cloud_links");
      setCloudLinks(dbLinks);
    } catch (err) {
      setCloudMessage(`Error: ${err}`);
    }
  }

  // The Cloud-to-Vault Bridge
  async function handleTransfer(url: string, title: string) {
    setCloudMessage("Transferring to Vault...");
    try {
      // 1. Download and get the local path
      const localPath: string = await invoke("download_to_vault", {
        url,
        filename: `${title.replace(/\s+/g, "_")}.download`,
        destination: vaultFolder,
      });

      // 2. Refresh lists
      setCloudMessage(`Success! Vaulted at: ${localPath}`);
      const dbFiles: VaultFile[] = await invoke("get_vault_files");
      setVaultFiles(dbFiles);
    } catch (err) {
      setCloudMessage(`Transfer Failed: ${err}`);
    }
  }

  return (
    <div className="flex h-screen w-full flex-col">
      <header className="border-b border-gray-800 bg-black p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-widest text-white uppercase">
          Wheel of Fortune
        </h1>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 border-r border-gray-800 bg-gray-950 p-4 flex flex-col">
          <nav className="flex flex-col space-y-2">
            <button
              onClick={() => setActiveTab("local")}
              className={`text-left px-3 py-2 rounded ${activeTab === "local" ? "bg-gray-900 text-white" : "text-gray-400"}`}
            >
              Local Storage
            </button>
            <button
              onClick={() => setActiveTab("cloud")}
              className={`text-left px-3 py-2 rounded ${activeTab === "cloud" ? "bg-gray-900 text-white" : "text-gray-400"}`}
            >
              Cloud Links
            </button>
          </nav>

          <div className="mt-8 pt-4 border-t border-gray-800 flex-1 overflow-y-auto">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">
              Vault Memory
            </p>
            <ul className="space-y-1 pr-2">
              {vaultFiles.map((file) => (
                <li
                  key={file.id}
                  className="flex justify-between items-center group text-gray-400 text-xs p-1 rounded hover:bg-gray-900"
                >
                  <span
                    className="truncate flex-1 cursor-pointer hover:text-white"
                    onClick={() => openPath(file.file_path)}
                  >
                    {file.file_name}
                  </span>
                  <button
                    onClick={() =>
                      handleDeleteVaultFile(file.id, file.file_path)
                    }
                    className="opacity-0 group-hover:opacity-100 text-red-500"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <main className="flex-1 bg-black p-8 overflow-y-auto">
          {activeTab === "local" ? (
            <>
              <div className="w-full max-w-2xl border-b border-gray-800 pb-8 mb-8">
                <h2 className="text-white font-bold tracking-widest uppercase mb-4">
                  1. Scan Directory
                </h2>
                <div className="flex space-x-2 mb-4">
                  <input
                    type="text"
                    value={folderPath}
                    onChange={(e) => setFolderPath(e.target.value)}
                    className="flex-1 bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded"
                  />
                  <button
                    onClick={scanFolder}
                    className="bg-white text-black px-6 py-2 rounded font-bold"
                  >
                    SCAN
                  </button>
                </div>
                <ul className="space-y-2 max-h-40 overflow-y-auto">
                  {files.map((file, i) => (
                    <li
                      key={i}
                      onClick={() => openPath(file)}
                      className="text-gray-400 text-xs bg-gray-900 p-2 rounded cursor-pointer hover:text-white"
                    >
                      ▶ {file}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="w-full max-w-2xl">
                <h2 className="text-white font-bold tracking-widest uppercase mb-4">
                  2. Import to Vault
                </h2>
                <input
                  type="text"
                  value={sourceFile}
                  onChange={(e) => setSourceFile(e.target.value)}
                  placeholder="Source Path"
                  className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-2 mb-2 rounded"
                />
                <button
                  onClick={handleImport}
                  className="w-full bg-white text-black py-3 rounded font-bold uppercase"
                >
                  Execute Import
                </button>
                {importMessage && (
                  <p className="mt-4 text-sm text-gray-400">{importMessage}</p>
                )}
              </div>
            </>
          ) : (
            <div className="w-full max-w-2xl">
              <h2 className="text-white font-bold tracking-widest uppercase mb-4">
                Add Cloud Link
              </h2>
              <input
                type="text"
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                placeholder="Title"
                className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-2 mb-2 rounded"
              />
              <input
                type="text"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="URL"
                className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-2 mb-4 rounded"
              />
              <button
                onClick={handleSaveLink}
                className="w-full bg-white text-black py-3 rounded font-bold uppercase mb-8"
              >
                Save Link
              </button>

              {cloudMessage && (
                <p className="mb-8 text-sm text-blue-400">{cloudMessage}</p>
              )}

              <ul className="space-y-2">
                {cloudLinks.map((link) => (
                  <li
                    key={link.id}
                    className="bg-gray-900 border border-gray-800 p-4 rounded flex justify-between items-center"
                  >
                    <span
                      className="text-white font-bold cursor-pointer"
                      onClick={() => openUrl(link.url)}
                    >
                      {link.title}
                    </span>
                    <button
                      onClick={() => handleTransfer(link.url, link.title)}
                      className="bg-blue-600 text-white text-xs px-3 py-1 rounded font-bold"
                    >
                      TRANSFER
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
