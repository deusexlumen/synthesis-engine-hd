use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::{
    password_hash::{rand_core::RngCore, SaltString},
    Argon2,
};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

const APP_DIR: &str = "synthesis-engine";
const JOURNAL_DIR: &str = "journal";
const KEY_FILE: &str = "master.key";

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

// Generate or load encryption key
// In production, this should use the OS keychain
fn get_or_create_key(app_handle: &tauri::AppHandle) -> Result<[u8; 32], StorageError> {
    let app_dir = get_app_dir(app_handle)?;
    let key_file = app_dir.join(KEY_FILE);
    
    if key_file.exists() {
        // Load existing key
        let key_bytes = fs::read(&key_file)?;
        if key_bytes.len() == 32 {
            let mut key = [0u8; 32];
            key.copy_from_slice(&key_bytes);
            return Ok(key);
        }
    }
    
    // Generate new key
    let mut key = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut key);
    
    // Save key (in production, use OS keychain instead)
    fs::write(&key_file, &key)?;
    
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

// Save an encrypted journal entry
pub fn save_encrypted_entry(
    app_handle: &tauri::AppHandle,
    entry_id: &str,
    content: &str,
) -> Result<(), StorageError> {
    let key = get_or_create_key(app_handle)?;
    let encrypted = encrypt(content, &key)?;
    
    let journal_dir = get_journal_dir(app_handle)?;
    let entry_file = journal_dir.join(format!("{}.enc", entry_id));
    
    fs::write(&entry_file, &encrypted)?;
    
    Ok(())
}

// Load and decrypt a journal entry
pub fn load_encrypted_entry(
    app_handle: &tauri::AppHandle,
    entry_id: &str,
) -> Result<String, StorageError> {
    let key = get_or_create_key(app_handle)?;
    
    let journal_dir = get_journal_dir(app_handle)?;
    let entry_file = journal_dir.join(format!("{}.enc", entry_id));
    
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
    let journal_dir = get_journal_dir(app_handle)?;
    let entry_file = journal_dir.join(format!("{}.enc", entry_id));
    
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
