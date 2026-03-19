// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ephemeris;
mod human_design;
mod numerology;
mod storage;
mod geocoding;
mod transit;

use human_design::{calculate_hd_chart, HumanDesignChart, BirthData};
use numerology::{calculate_millman_profile, MillmanProfile, PersonData};
use storage::{save_encrypted_entry, load_encrypted_entry, list_journal_entries, delete_journal_entry};
use geocoding::{search_location, get_timezone, LocationResult, TimezoneResult};
use transit::{TransitData, TransitComparison, calculate_daily_transit, compare_transit_to_natal, get_today_transit};
use tauri::{Manager, State};
use std::sync::Mutex;

// Global cache for calculations
struct CalculationCache {
    hd_cache: Mutex<std::collections::HashMap<String, HumanDesignChart>>,
    millman_cache: Mutex<std::collections::HashMap<String, MillmanProfile>>,
    transit_cache: Mutex<std::collections::HashMap<String, TransitData>>,
}

impl CalculationCache {
    fn new() -> Self {
        Self {
            hd_cache: Mutex::new(std::collections::HashMap::new()),
            millman_cache: Mutex::new(std::collections::HashMap::new()),
            transit_cache: Mutex::new(std::collections::HashMap::new()),
        }
    }
}

#[tauri::command]
fn calculate_human_design(
    year: i32,
    month: u32,
    day: u32,
    hour: u32,
    minute: u32,
    latitude: f64,
    longitude: f64,
    timezone: f64,
    cache: State<CalculationCache>,
) -> Result<HumanDesignChart, String> {
    // Create cache key
    let cache_key = format!("{}-{}-{}-{}-{}-{:.4}-{:.4}", 
        year, month, day, hour, minute, latitude, longitude);
    
    // Check cache first
    {
        let hd_cache = cache.hd_cache.lock().unwrap();
        if let Some(cached) = hd_cache.get(&cache_key) {
            return Ok(cached.clone());
        }
    }
    
    // Calculate
    let birth_data = BirthData {
        year, month, day, hour, minute,
        latitude, longitude, timezone,
    };
    
    let chart = calculate_hd_chart(birth_data)
        .map_err(|e| format!("Calculation error: {}", e))?;
    
    // Store in cache
    {
        let mut hd_cache = cache.hd_cache.lock().unwrap();
        hd_cache.insert(cache_key, chart.clone());
    }
    
    Ok(chart)
}

#[tauri::command]
fn calculate_numerology(
    birth_date: String,
    full_name: String,
    cache: State<CalculationCache>,
) -> Result<MillmanProfile, String> {
    // Create cache key
    let cache_key = format!("{}-{}", birth_date, full_name);
    
    // Check cache first
    {
        let millman_cache = cache.millman_cache.lock().unwrap();
        if let Some(cached) = millman_cache.get(&cache_key) {
            return Ok(cached.clone());
        }
    }
    
    // Calculate
    let person_data = PersonData {
        birth_date,
        full_name,
    };
    
    let profile = calculate_millman_profile(person_data)
        .map_err(|e| format!("Calculation error: {}", e))?;
    
    // Store in cache
    {
        let mut millman_cache = cache.millman_cache.lock().unwrap();
        millman_cache.insert(cache_key, profile.clone());
    }
    
    Ok(profile)
}

#[tauri::command]
fn save_journal_entry(
    entry_id: String,
    content: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    save_encrypted_entry(&app_handle, &entry_id, &content)
        .map_err(|e| format!("Save error: {}", e))
}

#[tauri::command]
fn load_journal_entry(
    entry_id: String,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    load_encrypted_entry(&app_handle, &entry_id)
        .map_err(|e| format!("Load error: {}", e))
}

#[tauri::command]
fn trigger_haptic(feedback_type: String) -> Result<(), String> {
    // Haptic feedback will be implemented per platform
    // For now, just log it
    println!("Haptic feedback: {}", feedback_type);
    Ok(())
}

#[tauri::command]
async fn search_location_command(query: String) -> Result<Vec<LocationResult>, String> {
    search_location(&query).await
        .map_err(|e| format!("Geocoding error: {}", e))
}

#[tauri::command]
async fn get_timezone_command(latitude: f64, longitude: f64) -> Result<TimezoneResult, String> {
    get_timezone(latitude, longitude).await
        .map_err(|e| format!("Timezone error: {}", e))
}

#[tauri::command]
fn get_daily_transit(
    year: i32,
    month: u32,
    day: u32,
    cache: State<CalculationCache>,
) -> Result<TransitData, String> {
    let cache_key = format!("{}-{}-{}", year, month, day);
    
    // Check cache first
    {
        let transit_cache = cache.transit_cache.lock().unwrap();
        if let Some(cached) = transit_cache.get(&cache_key) {
            return Ok(cached.clone());
        }
    }
    
    // Calculate
    let transit = calculate_daily_transit(year, month, day)
        .map_err(|e| format!("Transit calculation error: {}", e))?;
    
    // Store in cache
    {
        let mut transit_cache = cache.transit_cache.lock().unwrap();
        transit_cache.insert(cache_key, transit.clone());
    }
    
    Ok(transit)
}

#[tauri::command]
fn get_today_transit_command(cache: State<CalculationCache>) -> Result<TransitData, String> {
    let today = chrono::Utc::now().naive_utc().date();
    let cache_key = format!("{}-{}-{}", today.year(), today.month(), today.day());
    
    // Check cache first
    {
        let transit_cache = cache.transit_cache.lock().unwrap();
        if let Some(cached) = transit_cache.get(&cache_key) {
            return Ok(cached.clone());
        }
    }
    
    // Calculate
    let transit = get_today_transit()
        .map_err(|e| format!("Today's transit error: {}", e))?;
    
    // Store in cache
    {
        let mut transit_cache = cache.transit_cache.lock().unwrap();
        transit_cache.insert(cache_key, transit.clone());
    }
    
    Ok(transit)
}

#[tauri::command]
fn compare_transit_to_natal_command(
    year: i32,
    month: u32,
    day: u32,
    natal_gates: Vec<i32>,
) -> Result<TransitComparison, String> {
    compare_transit_to_natal((year, month, day), natal_gates)
        .map_err(|e| format!("Transit comparison error: {}", e))
}

#[tauri::command]
fn list_journal_entries_command(app_handle: tauri::AppHandle) -> Result<Vec<String>, String> {
    list_journal_entries(&app_handle)
        .map_err(|e| format!("List entries error: {}", e))
}

#[tauri::command]
fn delete_journal_entry_command(
    entry_id: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    delete_journal_entry(&app_handle, &entry_id)
        .map_err(|e| format!("Delete error: {}", e))
}

fn main() {
    tauri::Builder::default()
        .manage(CalculationCache::new())
        .invoke_handler(tauri::generate_handler![
            calculate_human_design,
            calculate_numerology,
            save_journal_entry,
            load_journal_entry,
            list_journal_entries_command,
            delete_journal_entry_command,
            trigger_haptic,
            search_location_command,
            get_timezone_command,
            get_daily_transit,
            get_today_transit_command,
            compare_transit_to_natal_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
