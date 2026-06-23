use serde::Serialize;
use sqlx::Row;
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use std::fs;
use std::path::Path; //it allows me to upload files to the paht i want
use tauri::Manager;

struct DbState {
    pool: SqlitePool,
}

#[derive(Serialize)]
struct VaultFile {
    id: i64,
    file_name: String,
    file_path: String,
}

#[derive(Serialize)]
struct CloudLink {
    id: i64,
    title: String,
    url: String,
}

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

// Notice the 'async fn' and the new 'state' parameter!
#[tauri::command]
async fn copy_file_to_storage(
    source_path: String, // Changed to String for easier async handling
    destination_folder: String,
    state: tauri::State<'_, DbState>, // Grabbing the DB out of Tauri's memory
) -> Result<String, String> {
    let source = Path::new(&source_path);

    if !source.is_file() {
        return Err("Source is not a valid file".to_string());
    }

    // Extract the file name and save it as an owned String for the database
    let file_name = source
        .file_name()
        .ok_or("Could not extract file name")?
        .to_str()
        .ok_or("Invalid characters in file name")?
        .to_string();

    let dest_path = Path::new(&destination_folder).join(&file_name);

    if let Err(e) = fs::create_dir_all(&destination_folder) {
        return Err(format!("Failed to create destination folder: {}", e));
    }

    // Perform the file copy
    match fs::copy(source, &dest_path) {
        Ok(_) => {
            let final_path_str = dest_path.to_string_lossy().to_string();

            // --- THE NEW DATABASE HOOK ---
            // We use standard SQL syntax and bind our variables safely to prevent SQL injection
            let db_result =
                sqlx::query("INSERT INTO vault_files (file_name, file_path) VALUES (?, ?)")
                    .bind(&file_name)
                    .bind(&final_path_str)
                    .execute(&state.pool)
                    .await; // We await the async database call

            match db_result {
                Ok(_) => Ok(final_path_str),
                Err(e) => Err(format!(
                    "File copied, but failed to save to database: {}",
                    e
                )),
            }
        }
        Err(e) => Err(format!("Failed to copy file: {}", e)),
    }
}

#[tauri::command]
async fn get_vault_files(state: tauri::State<'_, DbState>) -> Result<Vec<VaultFile>, String> {
    // 1. Query the database for all saved files
    let rows = sqlx::query("SELECT id, file_name, file_path FROM vault_files")
        .fetch_all(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut files = Vec::new();

    // 2. Loop through the raw rows and map them to our VaultFile struct
    for row in rows {
        files.push(VaultFile {
            id: row.get("id"),
            file_name: row.get("file_name"),
            file_path: row.get("file_path"),
        });
    }

    // 3. Send the packaged data back to React
    Ok(files)
}

#[tauri::command]
async fn add_cloud_link(
    title: String,
    url: String,
    state: tauri::State<'_, DbState>,
) -> Result<String, String> {
    // Insert the new link into our database
    let db_result = sqlx::query("INSERT INTO cloud_links (title, url) VALUES (?, ?)")
        .bind(&title)
        .bind(&url)
        .execute(&state.pool)
        .await;

    match db_result {
        Ok(_) => Ok("Cloud link saved successfully!".to_string()),
        Err(e) => Err(format!("Failed to save link: {}", e)),
    }
}

#[tauri::command]
async fn get_cloud_links(state: tauri::State<'_, DbState>) -> Result<Vec<CloudLink>, String> {
    let rows = sqlx::query("SELECT id, title, url FROM cloud_links")
        .fetch_all(&state.pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut links = Vec::new();
    for row in rows {
        links.push(CloudLink {
            id: row.get("id"),
            title: row.get("title"),
            url: row.get("url"),
        });
    }

    Ok(links)
}

#[tauri::command]
async fn delete_vault_file(
    id: i64,
    file_path: String,
    state: tauri::State<'_, DbState>,
) -> Result<String, String> {
    // 1. Try to delete the physical file first
    // We check if it exists so the app doesn't panic if you already deleted it manually
    if Path::new(&file_path).exists() {
        if let Err(e) = fs::remove_file(&file_path) {
            return Err(format!("Failed to delete physical file: {}", e));
        }
    }

    // 2. Delete the permanent record from the SQLite database
    let db_result = sqlx::query("DELETE FROM vault_files WHERE id = ?")
        .bind(id)
        .execute(&state.pool)
        .await;

    match db_result {
        Ok(_) => Ok("File permanently deleted.".to_string()),
        Err(e) => Err(format!("Failed to delete from database: {}", e)),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // 2. THE BOOT SEQUENCE: This runs before the UI opens
        .setup(|app| {
            tauri::async_runtime::block_on(async move {
                let db_path = "sqlite:wheel.db";

                // If the database file doesn't exist locally, create a blank one
                if !Path::new("wheel.db").exists() {
                    fs::File::create("wheel.db").expect("Failed to create wheel.db file");
                }

                // Connect to SQLite
                let pool = SqlitePoolOptions::new()
                    .connect(db_path)
                    .await
                    .expect("Failed to connect to SQLite database");

                // Build our first schema
                sqlx::query(
                    "CREATE TABLE IF NOT EXISTS vault_files (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        file_name TEXT NOT NULL,
                        file_path TEXT NOT NULL UNIQUE
                    );",
                )
                .execute(&pool)
                .await
                .expect("Failed to create vault_files table");

                // --- NEW: Build our second schema for cloud links ---
                sqlx::query(
                    "CREATE TABLE IF NOT EXISTS cloud_links (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        title TEXT NOT NULL,
                        url TEXT NOT NULL UNIQUE
                    );",
                )
                .execute(&pool)
                .await
                .expect("Failed to create cloud_links table");

                // Hand the active pool over to Tauri so our commands can use it later
                app.manage(DbState { pool });
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_local_files,
            copy_file_to_storage,
            get_vault_files,
            add_cloud_link,  // <-- NEW
            get_cloud_links, // <-- NEW
            delete_vault_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

