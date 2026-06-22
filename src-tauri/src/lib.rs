use std::fs;
use std::path::Path; //it allows me to upload files to the paht i want  

// 1. THIS IS YOUR COMMAND
#[tauri::command]
fn get_local_files(path: &str) -> Result<Vec<String>, String> {
    let mut file_paths = Vec::new();

    // Try to open the directory. If it fails, map the error to a String and bail out (?)
    let entries = fs::read_dir(path).map_err(|e| e.to_string())?;

    // Loop through everything found in the folder
    for entry in entries {
        // Unpacking the actual entry can also fail, so we handle that safely
        let entry = entry.map_err(|e| e.to_string())?;
        let entry_path = entry.path();

        // For this baby step, we only care about files, not sub-folders
        if entry_path.is_file() {
            //1.Extracts the extensitons and converts them into a lower case string
            if let Some(ext) = entry_path.extension().and_then(|e| e.to_str()) {
                let ext_lower = ext.to_lowercase();

                // 2. checks if the extension matches the allowed media types
                if matches!(
                    ext_lower.as_str(),
                    "mp4" | "mp3" | "wav" | "jpg" | "png" | "pdf"
                ) {
                    //if it is a match add it ito the list
                    if let Some(path_str) = entry_path.to_str() {
                        file_paths.push(path_str.to_string());
                    }
                }
            }
        }
    }

    // Return the successful list to React!
    Ok(file_paths)
}


#[tauri::command]
// 2. THIS REGISTERS YOUR COMMAND
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // Tell Tauri to expose our function to the frontend
        .invoke_handler(tauri::generate_handler![get_local_files])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

