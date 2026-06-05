use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::Engine;
use rand::RngCore;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

const APP_DIR: &str = "synthesis-engine";
const JOURNAL_DIR: &str = "journal";
const KEY_FILE: &str = "master.key";
const KEYRING_SERVICE: &str = "synthesis-engine";
const KEYRING_USER: &str = "journal-master-key";

#[derive(Debug)]
pub struct StorageError {
    pub message: String,
}

impl std::fmt::Display for StorageError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for StorageError {}

impl From<std::io::Error> for StorageError {
    fn from(error: std::io::Error) -> Self {
        StorageError {
            message: format!("IO error: {}", error),
        }
    }
}

impl From<aes_gcm::Error> for StorageError {
    fn from(error: aes_gcm::Error) -> Self {
        StorageError {
            message: format!("Encryption error: {}", error),
        }
    }
}

impl From<keyring::Error> for StorageError {
    fn from(error: keyring::Error) -> Self {
        StorageError {
            message: format!("Keyring error: {}", error),
        }
    }
}

// Get or create the app data directory
fn get_app_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, StorageError> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|_| StorageError {
            message: "Could not resolve app data directory".to_string(),
        })?
        .join(APP_DIR);
    
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir)?;
    }
    
    Ok(app_dir)
}

// Get or create the journal directory
fn get_journal_dir(app_handle: &tauri::AppHandle) -> Result<PathBuf, StorageError> {
    let journal_dir = get_app_dir(app_handle)?.join(JOURNAL_DIR);
    
    if !journal_dir.exists() {
        fs::create_dir_all(&journal_dir)?;
    }
    
    Ok(journal_dir)
}

// Try to load the key from the OS keychain
fn load_key_from_keychain() -> Result<Option<[u8; 32]>, StorageError> {
    let entry = match keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER) {
        Ok(e) => e,
        Err(_) => return Ok(None),
    };

    match entry.get_password() {
        Ok(encoded) => {
            let decoded = base64::engine::general_purpose::STANDARD
                .decode(encoded)
                .map_err(|e| StorageError {
                    message: format!("Failed to decode key from keychain: {}", e),
                })?;
            if decoded.len() == 32 {
                let mut key = [0u8; 32];
                key.copy_from_slice(&decoded);
                Ok(Some(key))
            } else {
                Ok(None)
            }
        }
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

// Store the key in the OS keychain (best-effort; falls back to file on failure)
fn save_key_to_keychain(key: &[u8; 32]) -> Result<(), StorageError> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)?;
    let encoded = base64::engine::general_purpose::STANDARD.encode(key);
    entry.set_password(&encoded)?;
    Ok(())
}

// Fallback: load key from file
fn load_key_from_file(app_handle: &tauri::AppHandle) -> Result<Option<[u8; 32]>, StorageError> {
    let app_dir = get_app_dir(app_handle)?;
    let key_file = app_dir.join(KEY_FILE);

    if !key_file.exists() {
        return Ok(None);
    }

    let key_bytes = fs::read(&key_file)?;
    if key_bytes.len() == 32 {
        let mut key = [0u8; 32];
        key.copy_from_slice(&key_bytes);
        Ok(Some(key))
    } else {
        Ok(None)
    }
}

// Fallback: save key to file
fn save_key_to_file(app_handle: &tauri::AppHandle, key: &[u8; 32]) -> Result<(), StorageError> {
    let app_dir = get_app_dir(app_handle)?;
    let key_file = app_dir.join(KEY_FILE);
    fs::write(&key_file, key.as_slice())?;
    Ok(())
}

// Generate or load encryption key
// Prefers OS keychain; falls back to file-based storage if keychain is unavailable
fn get_or_create_key(app_handle: &tauri::AppHandle) -> Result<[u8; 32], StorageError> {
    // 1. Try OS keychain first
    if let Some(key) = load_key_from_keychain()? {
        return Ok(key);
    }

    // 2. Try legacy file fallback (for migration from older versions)
    if let Some(key) = load_key_from_file(app_handle)? {
        // Migrate to keychain if possible
        if let Err(e) = save_key_to_keychain(&key) {
            eprintln!("[synthesis-engine] Warning: Failed to migrate key to keychain: {}. Falling back to file storage.", e);
        }
        return Ok(key);
    }

    // 3. Generate new key
    let mut key = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut key);

    // 4. Store in keychain (preferred) or file (fallback)
    if let Err(e) = save_key_to_keychain(&key) {
        eprintln!("[synthesis-engine] Warning: Keychain unavailable ({}). Using file-based key storage. Consider installing a secret service (e.g., gnome-keyring) on Linux.", e);
        save_key_to_file(app_handle, &key)?;
    }

    Ok(key)
}

// Encrypt data using AES-256-GCM
fn encrypt(plaintext: &str, key: &[u8; 32]) -> Result<Vec<u8>, StorageError> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| StorageError {
            message: format!("Key initialization failed: {:?}", e),
        })?;
    
    // Generate random nonce
    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    
    // Encrypt
    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| StorageError {
            message: format!("Encryption failed: {:?}", e),
        })?;
    
    // Prepend nonce to ciphertext
    let mut result = Vec::with_capacity(nonce_bytes.len() + ciphertext.len());
    result.extend_from_slice(&nonce_bytes);
    result.extend_from_slice(&ciphertext);
    
    Ok(result)
}

// Decrypt data using AES-256-GCM
fn decrypt(ciphertext: &[u8], key: &[u8; 32]) -> Result<String, StorageError> {
    if ciphertext.len() < 12 {
        return Err(StorageError {
            message: "Invalid ciphertext: too short".to_string(),
        });
    }
    
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| StorageError {
            message: format!("Key initialization failed: {:?}", e),
        })?;
    
    // Extract nonce
    let nonce = Nonce::from_slice(&ciphertext[..12]);
    
    // Decrypt
    let plaintext = cipher
        .decrypt(nonce, &ciphertext[12..])
        .map_err(|e| StorageError {
            message: format!("Decryption failed: {:?}", e),
        })?;
    
    String::from_utf8(plaintext).map_err(|e| StorageError {
        message: format!("Invalid UTF-8: {}", e),
    })
}

// Sanitize entry_id to prevent path traversal
fn sanitize_entry_id(entry_id: &str) -> Result<String, StorageError> {
    // Remove any path separators and unsafe characters
    let sanitized: String = entry_id
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_' || *c == '.')
        .collect();
    
    if sanitized.is_empty() || sanitized.len() > 128 {
        return Err(StorageError {
            message: "Invalid entry ID".to_string(),
        });
    }
    
    Ok(sanitized)
}

// Save an encrypted journal entry
pub fn save_encrypted_entry(
    app_handle: &tauri::AppHandle,
    entry_id: &str,
    content: &str,
) -> Result<(), StorageError> {
    let sanitized_id = sanitize_entry_id(entry_id)?;
    let key = get_or_create_key(app_handle)?;
    let encrypted = encrypt(content, &key)?;
    
    let journal_dir = get_journal_dir(app_handle)?;
    let entry_file = journal_dir.join(format!("{}.enc", sanitized_id));
    
    fs::write(&entry_file, &encrypted)?;
    
    Ok(())
}

// Load and decrypt a journal entry
pub fn load_encrypted_entry(
    app_handle: &tauri::AppHandle,
    entry_id: &str,
) -> Result<String, StorageError> {
    let sanitized_id = sanitize_entry_id(entry_id)?;
    let key = get_or_create_key(app_handle)?;
    
    let journal_dir = get_journal_dir(app_handle)?;
    let entry_file = journal_dir.join(format!("{}.enc", sanitized_id));
    
    if !entry_file.exists() {
        return Err(StorageError {
            message: format!("Entry not found: {}", entry_id),
        });
    }
    
    let encrypted = fs::read(&entry_file)?;
    let decrypted = decrypt(&encrypted, &key)?;
    
    Ok(decrypted)
}

// List all journal entries
pub fn list_journal_entries(app_handle: &tauri::AppHandle) -> Result<Vec<String>, StorageError> {
    let journal_dir = get_journal_dir(app_handle)?;
    
    let mut entries = Vec::new();
    
    if journal_dir.exists() {
        for entry in fs::read_dir(&journal_dir)? {
            let entry = entry?;
            let path = entry.path();
            
            if path.extension().map_or(false, |ext| ext == "enc") {
                if let Some(stem) = path.file_stem() {
                    if let Some(id) = stem.to_str() {
                        entries.push(id.to_string());
                    }
                }
            }
        }
    }
    
    Ok(entries)
}

// Delete a journal entry
pub fn delete_journal_entry(
    app_handle: &tauri::AppHandle,
    entry_id: &str,
) -> Result<(), StorageError> {
    let sanitized_id = sanitize_entry_id(entry_id)?;
    let journal_dir = get_journal_dir(app_handle)?;
    let entry_file = journal_dir.join(format!("{}.enc", sanitized_id));
    
    if entry_file.exists() {
        fs::remove_file(&entry_file)?;
    }
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt() {
        let key = [0u8; 32];
        let plaintext = "Hello, World!";
        
        let encrypted = encrypt(plaintext, &key).unwrap();
        let decrypted = decrypt(&encrypted, &key).unwrap();
        
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_different_keys() {
        let key1 = [0u8; 32];
        let key2 = [1u8; 32];
        let plaintext = "Secret message";
        
        let encrypted = encrypt(plaintext, &key1).unwrap();
        let result = decrypt(&encrypted, &key2);
        
        assert!(result.is_err());
    }
}
