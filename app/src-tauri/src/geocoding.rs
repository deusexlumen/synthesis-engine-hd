use reqwest;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

fn http_client() -> &'static reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT.get_or_init(|| reqwest::Client::new())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocationResult {
    pub name: String,
    pub latitude: f64,
    pub longitude: f64,
    pub country: String,
    pub admin1: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimezoneResult {
    pub timezone: String,
    pub offset: f64,
}

#[derive(Debug, Deserialize)]
struct GeocodingResponse {
    results: Vec<GeocodingResult>,
}

#[derive(Debug, Deserialize)]
struct GeocodingResult {
    name: String,
    latitude: f64,
    longitude: f64,
    country: String,
    admin1: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TimezoneResponse {
    timezone: String,
    #[serde(rename = "utc_offset_seconds")]
    utc_offset_seconds: i32,
}

pub async fn search_location(query: &str) -> Result<Vec<LocationResult>, Box<dyn std::error::Error>> {
    let url = format!(
        "https://geocoding-api.open-meteo.com/v1/search?name={}&count=10&language=de&format=json",
        urlencoding::encode(query)
    );
    
    let response = http_client()
        .get(&url)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await?;
    
    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()).into());
    }
    
    let data: GeocodingResponse = response.json().await?;
    
    let results = data.results.into_iter().map(|r| LocationResult {
        name: r.name,
        latitude: r.latitude,
        longitude: r.longitude,
        country: r.country,
        admin1: r.admin1,
    }).collect();
    
    Ok(results)
}

pub async fn get_timezone(latitude: f64, longitude: f64) -> Result<TimezoneResult, Box<dyn std::error::Error>> {
    let url = format!(
        "https://api.open-meteo.com/v1/forecast?latitude={}&longitude={}&timezone=auto",
        latitude, longitude
    );
    
    let response = http_client()
        .get(&url)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await?;
    
    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()).into());
    }
    
    let data: TimezoneResponse = response.json().await?;
    
    // Convert seconds to hours
    let offset_hours = data.utc_offset_seconds as f64 / 3600.0;
    
    Ok(TimezoneResult {
        timezone: data.timezone,
        offset: offset_hours,
    })
}
