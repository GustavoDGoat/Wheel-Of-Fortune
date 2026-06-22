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
fn copy_file_to_storage(source_path: &str, destination_folder: &str) -> Result<String, String> {
    let source = Path::new(source_path);

    // 1. Ensure the source actually exists and is a file
    if !source.is_file() {
        return Err("Source is not a valid file".to_string());
    }

    // 2. Extract just the file name (e.g., "my_song.mp3") from the full path
    let file_name = source
        .file_name()
        .ok_or("Could not extract file name")?
        .to_str()
        .ok_or("Invalid characters in file name")?;

    // 3. Safely join the destination folder with the file name
    let dest_path = Path::new(destination_folder).join(file_name);

    // 4. Create the destination folder if it doesn't exist yet!
    // This is crucial. If the folder is missing, create_dir_all builds it.
    if let Err(e) = fs::create_dir_all(destination_folder) {
        return Err(format!("Failed to create destination folder: {}", e));
    }

    // 5. Perform the actual file copy
    match fs::copy(source, &dest_path) {
        Ok(_) => {
            // Success! Return the NEW file path back to the frontend
            Ok(dest_path.to_string_lossy().to_string())
        }
        Err(e) => Err(format!("Failed to copy file: {}", e)),
    }
} // 2. THIS REGISTERS YOUR COMMAND
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // ADD YOUR NEW COMMAND HERE, separated by a comma:
        .invoke_handler(tauri::generate_handler![
            get_local_files,
            copy_file_to_storage
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
