import { useState } from "react";
import { invoke } from "@tauri-apps/api/core"; // <-- The REAL Rust bridge!

function App() {
  const [folderPath, setFolderPath] = useState("/home/");
  const [files, setFiles] = useState<string[]>([]);
  const [error, setError] = useState("");

  async function scanFolder() {
    setError("");
    try {
      // This now talks directly to your Rust backend!
      const result: string[] = await invoke("get_local_files", {
        path: folderPath,
      });
      setFiles(result);
    } catch (err) {
      // If Rust's std::fs fails, it sends the error safely here
      console.error(err);
      setError(err as string);
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
          <div className="w-full max-w-2xl flex space-x-2 mb-8">
            <input
              type="text"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              placeholder="Enter folder path (e.g. /home/gustavodgoat/Videos)"
              className="flex-1 bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded focus:outline-none focus:border-gray-500"
            />
            <button
              onClick={scanFolder}
              className="bg-white text-black px-6 py-2 rounded font-bold hover:bg-gray-200 transition-colors"
            >
              SCAN
            </button>
          </div>

          {error && (
            <div className="text-red-500 border border-red-900 bg-red-950/30 p-4 rounded w-full max-w-2xl mb-4">
              <strong>Error reading folder:</strong> {error}
            </div>
          )}

          <div className="w-full max-w-2xl text-left">
            <h2 className="text-gray-500 uppercase tracking-widest text-sm border-b border-gray-800 pb-2 mb-4">
              {files.length > 0
                ? `Found ${files.length} Files`
                : "No files loaded yet"}
            </h2>
            <ul className="space-y-2">
              {files.map((file, index) => (
                <li
                  key={index}
                  className="text-gray-300 text-sm bg-gray-900 p-2 rounded truncate"
                >
                  {file}
                </li>
              ))}
            </ul>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
