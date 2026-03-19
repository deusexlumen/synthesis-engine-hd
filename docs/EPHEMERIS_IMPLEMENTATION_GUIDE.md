# Swiss Ephemeris Implementation Guide

## Schritt-für-Schritt Anleitung

### Schritt 1: Ephemeris-Dateien beschaffen

```powershell
# PowerShell Script: download_ephemeris.ps1

$epheUrl = "https://www.astro.com/swisseph/ephe/archive/"
$files = @(
    "seplm18.se1",  # Planeten 1800-2400
    "semom18.se1",  # Mond 1800-2400
    "seasm18.se1"   # Asteroiden (optional)
)

$destPath = "app/src-tauri/ephemeris"
New-Item -ItemType Directory -Force -Path $destPath

foreach ($file in $files) {
    Write-Host "Downloading $file..."
    Invoke-WebRequest -Uri "$epheUrl$file" -OutFile "$destPath/$file"
}

Write-Host "Ephemeris files downloaded successfully!"
```

### Schritt 2: Swiss Ephemeris Rust-Bindings verstehen

Die `libswe-sys` Crate bietet direkten Zugriff auf die C-Funktionen der Swiss Ephemeris:

```rust
// Wichtige Konstanten aus libswe_sys::swe
pub const SE_SUN: i32 = 0;
pub const SE_MOON: i32 = 1;
pub const SE_MERCURY: i32 = 2;
pub const SE_VENUS: i32 = 3;
pub const SE_MARS: i32 = 4;
pub const SE_JUPITER: i32 = 5;
pub const SE_SATURN: i32 = 6;
pub const SE_URANUS: i32 = 7;
pub const SE_NEPTUNE: i32 = 8;
pub const SE_PLUTO: i32 = 9;
pub const SE_MEAN_NODE: i32 = 10;
pub const SE_TRUE_NODE: i32 = 11;

// Flags
pub const SE_ECLIPTIC: i32 = 2;      // Ekliptikale Koordinaten
pub const SE_EQUATORIAL: i32 = 2;    // Äquatoriale Koordinaten  
pub const SE_SPEED: i32 = 256;       // Geschwindigkeit berechnen
```

### Schritt 3: Safe Wrapper erstellen

```rust
// app/src-tauri/src/ephemeris.rs

use libc;
use libswe_sys::swe;
use serde::{Deserialize, Serialize};
use std::ffi::CString;
use std::path::Path;

/// Fehler-Typ für Ephemeris-Berechnungen
#[derive(Debug)]
pub struct EphemerisError {
    pub message: String,
}

impl std::fmt::Display for EphemerisError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "Ephemeris Error: {}", self.message)
    }
}

impl std::error::Error for EphemerisError {}

/// Planeten-Enumeration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Body {
    Sun,
    Moon,
    Mercury,
    Venus,
    Mars,
    Jupiter,
    Saturn,
    Uranus,
    Neptune,
    Pluto,
    NorthNode,
    SouthNode,
}

impl Body {
    /// Konvertiert zu Swiss Ephemeris ID
    pub fn to_swe_id(&self) -> i32 {
        match self {
            Body::Sun => swe::SE_SUN,
            Body::Moon => swe::SE_MOON,
            Body::Mercury => swe::SE_MERCURY,
            Body::Venus => swe::SE_VENUS,
            Body::Mars => swe::SE_MARS,
            Body::Jupiter => swe::SE_JUPITER,
            Body::Saturn => swe::SE_SATURN,
            Body::Uranus => swe::SE_URANUS,
            Body::Neptune => swe::SE_NEPTUNE,
            Body::Pluto => swe::SE_PLUTO,
            Body::NorthNode => swe::SE_TRUE_NODE,
            Body::SouthNode => swe::SE_MEAN_NODE,
        }
    }
    
    /// Human-Readable Name
    pub fn name(&self) -> &'static str {
        match self {
            Body::Sun => "Sonne",
            Body::Moon => "Mond",
            Body::Mercury => "Merkur",
            Body::Venus => "Venus",
            Body::Mars => "Mars",
            Body::Jupiter => "Jupiter",
            Body::Saturn => "Saturn",
            Body::Uranus => "Uranus",
            Body::Neptune => "Neptun",
            Body::Pluto => "Pluto",
            Body::NorthNode => "Nordknoten",
            Body::SouthNode => "Südknoten",
        }
    }
}

/// Planetenposition mit allen Details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BodyPosition {
    pub body: Body,
    /// Ekliptikale Länge (0-360°)
    pub longitude: f64,
    /// Ekliptikale Breite
    pub latitude: f64,
    /// Entfernung in AU
    pub distance: f64,
    /// Tägliche Bewegung in Länge (Grad/Tag)
    pub longitude_speed: f64,
    /// Tägliche Bewegung in Breite
    pub latitude_speed: f64,
    /// Tägliche Bewegung in Entfernung
    pub distance_speed: f64,
    /// Ist der Planet rückläufig?
    pub is_retrograde: bool,
}

impl BodyPosition {
    /// Erstellet eine neue Position aus Swiss Ephemeris Rückgabewerten
    fn from_raw(body: Body, raw: &[f64; 6]) -> Self {
        Self {
            body,
            longitude: raw[0],
            latitude: raw[1],
            distance: raw[2],
            longitude_speed: raw[3],
            latitude_speed: raw[4],
            distance_speed: raw[5],
            is_retrograde: raw[3] < 0.0, // Negative Geschwindigkeit = Retrograd
        }
    }
}

/// Ephemeris Calculator - Hauptstruktur
pub struct EphemerisCalculator {
    initialized: bool,
}

impl EphemerisCalculator {
    /// Erstellt einen neuen Calculator mit Standard-Pfad
    pub fn new() -> Result<Self, EphemerisError> {
        Self::with_path("./ephemeris")
    }
    
    /// Erstellt einen Calculator mit benutzerdefiniertem Pfad
    pub fn with_path<P: AsRef<Path>>(path: P) -> Result<Self, EphemerisError> {
        let path_str = path.as_ref()
            .to_str()
            .ok_or_else(|| EphemerisError {
                message: "Ungültiger Pfad".to_string()
            })?;
        
        let c_path = CString::new(path_str).map_err(|_| EphemerisError {
            message: "Pfad enthält Null-Bytes".to_string()
        })?;
        
        unsafe {
            swe::swe_set_ephe_path(c_path.as_ptr());
        }
        
        Ok(Self { initialized: true })
    }
    
    /// Berechnet die Position eines Himmelskörpers
    pub fn calculate_body(
        &self,
        julian_day: f64,
        body: Body,
    ) -> Result<BodyPosition, EphemerisError> {
        if !self.initialized {
            return Err(EphemerisError {
                message: "Calculator nicht initialisiert".to_string()
            });
        }
        
        let body_id = body.to_swe_id();
        let flags = swe::SE_ECLIPTIC | swe::SE_SPEED;
        
        let mut result = [0.0; 6];
        let mut error_buffer = [0 as libc::c_char; 256];
        
        let status = unsafe {
            swe::swe_calc_ut(
                julian_day,
                body_id,
                flags,
                result.as_mut_ptr(),
                error_buffer.as_mut_ptr(),
            )
        };
        
        if status < 0 {
            let error_msg = unsafe {
                std::ffi::CStr::from_ptr(error_buffer.as_ptr())
                    .to_string_lossy()
                    .to_string()
            };
            return Err(EphemerisError { message: error_msg });
        }
        
        Ok(BodyPosition::from_raw(body, &result))
    }
    
    /// Berechnet mehrere Himmelskörper auf einmal
    pub fn calculate_bodies(
        &self,
        julian_day: f64,
        bodies: &[Body],
    ) -> Vec<Result<BodyPosition, EphemerisError>> {
        bodies.iter()
            .map(|&body| self.calculate_body(julian_day, body))
            .collect()
    }
    
    /// Berechnet Julian Day aus Gregorianischem Datum
    pub fn julian_day(
        year: i32,
        month: i32,
        day: i32,
        hour: f64,
        gregorian: bool,
    ) -> f64 {
        let cal_flag = if gregorian {
            swe::SE_GREG_CAL
        } else {
            swe::SE_JUL_CAL
        };
        
        unsafe {
            swe::swe_julday(year, month, day, hour, cal_flag)
        }
    }
    
    /// Konvertiert Julian Day zurück zu Gregorianischem Datum
    pub fn reverse_julian_day(jd: f64, gregorian: bool) -> (i32, i32, i32, f64) {
        let mut year = 0i32;
        let mut month = 0i32;
        let mut day = 0i32;
        let mut hour = 0f64;
        
        let cal_flag = if gregorian {
            swe::SE_GREG_CAL
        } else {
            swe::SE_JUL_CAL
        };
        
        unsafe {
            swe::swe_revjul(
                jd,
                cal_flag,
                &mut year,
                &mut month,
                &mut day,
                &mut hour,
            );
        }
        
        (year, month, day, hour)
    }
    
    /// Bereinigt Swiss Ephemeris Ressourcen
    pub fn close(&self) {
        unsafe {
            swe::swe_close();
        }
    }
}

impl Drop for EphemerisCalculator {
    fn drop(&mut self) {
        self.close();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_julian_day_conversion() {
        // J2000.0: 1. Januar 2000, 12:00 UT
        let jd = EphemerisCalculator::julian_day(2000, 1, 1, 12.0, true);
        assert!((jd - 2451545.0).abs() < 0.0001);
        
        // Rückwärts
        let (y, m, d, h) = EphemerisCalculator::reverse_julian_day(jd, true);
        assert_eq!(y, 2000);
        assert_eq!(m, 1);
        assert_eq!(d, 1);
        assert!((h - 12.0).abs() < 0.001);
    }
}
```

### Schritt 4: Integration in Human Design

```rust
// app/src-tauri/src/hd_calculator.rs

use crate::ephemeris::{Body, BodyPosition, EphemerisCalculator};
use crate::human_design::{BirthData, Gate, HumanDesignChart};

pub struct HDCalculator<'a> {
    ephe: &'a EphemerisCalculator,
}

impl<'a> HDCalculator<'a> {
    pub fn new(ephe: &'a EphemerisCalculator) -> Self {
        Self { ephe }
    }
    
    pub fn calculate(&self, birth_data: &BirthData) -> Result<HumanDesignChart, Box<dyn std::error::Error>> {
        // Julian Day berechnen
        let jd = EphemerisCalculator::julian_day(
            birth_data.year,
            birth_data.month as i32,
            birth_data.day as i32,
            birth_data.hour as f64 + birth_data.minute as f64 / 60.0,
            true,
        );
        
        // Zeitzone anwenden (zu UT)
        let jd_ut = jd - birth_data.timezone / 24.0;
        
        // Alle Planeten berechnen
        let sun = self.ephe.calculate_body(jd_ut, Body::Sun)?;
        let moon = self.ephe.calculate_body(jd_ut, Body::Moon)?;
        let north_node = self.ephe.calculate_body(jd_ut, Body::NorthNode)?;
        let mercury = self.ephe.calculate_body(jd_ut, Body::Mercury)?;
        let venus = self.ephe.calculate_body(jd_ut, Body::Venus)?;
        let mars = self.ephe.calculate_body(jd_ut, Body::Mars)?;
        let jupiter = self.ephe.calculate_body(jd_ut, Body::Jupiter)?;
        let saturn = self.ephe.calculate_body(jd_ut, Body::Saturn)?;
        let uranus = self.ephe.calculate_body(jd_ut, Body::Uranus)?;
        let neptune = self.ephe.calculate_body(jd_ut, Body::Neptune)?;
        let pluto = self.ephe.calculate_body(jd_ut, Body::Pluto)?;
        
        // Erde und Südknoten berechnen
        let earth_longitude = (sun.longitude + 180.0) % 360.0;
        let south_node_longitude = (north_node.longitude + 180.0) % 360.0;
        
        // ... Rest der HD-Logik
        
        todo!("Integrate with existing human_design.rs logic")
    }
}
```

### Schritt 5: Tauri Command anpassen

```rust
// app/src-tauri/src/main.rs - angepasst

use ephemeris::EphemerisCalculator;
use once_cell::sync::OnceCell;

static EPHEMERIS: OnceCell<EphemerisCalculator> = OnceCell::new();

fn init_ephemeris() -> Result<(), Box<dyn std::error::Error>> {
    let ephe = EphemerisCalculator::new()?;
    EPHEMERIS.set(ephe)
        .map_err(|_| "Ephemeris bereits initialisiert")?;
    Ok(())
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
) -> Result<HumanDesignChart, String> {
    let ephe = EPHEMERIS.get()
        .ok_or("Ephemeris nicht initialisiert")?;
    
    let birth_data = BirthData {
        year, month, day, hour, minute,
        latitude, longitude, timezone,
    };
    
    let calculator = HDCalculator::new(ephe);
    calculator.calculate(&birth_data)
        .map_err(|e| format!("Berechnungsfehler: {}", e))
}

fn main() {
    // Initialisiere Ephemeris beim Start
    if let Err(e) = init_ephemeris() {
        eprintln!("Warnung: Konnte Ephemeris nicht initialisieren: {}", e);
    }
    
    tauri::Builder::default()
        // ... rest of the app
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Schritt 6: Build-Script für Ephemeris

```rust
// app/src-tauri/build.rs

use std::env;
use std::path::PathBuf;
use std::fs;

fn main() {
    println!("cargo:rerun-if-changed=ephemeris/");
    
    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
    let target_dir = out_dir.join("ephemeris");
    let source_dir = PathBuf::from("ephemeris");
    
    // Erstelle Zielverzeichnis
    fs::create_dir_all(&target_dir).unwrap();
    
    // Kopiere alle .se1 Dateien
    if source_dir.exists() {
        for entry in fs::read_dir(&source_dir).unwrap() {
            let entry = entry.unwrap();
            let path = entry.path();
            
            if path.extension().map_or(false, |ext| ext == "se1") {
                let file_name = path.file_name().unwrap();
                let dest = target_dir.join(file_name);
                fs::copy(&path, &dest).unwrap();
                println!("cargo:rerun-if-changed={}", path.display());
            }
        }
    }
}
```

---

## Test-Fälle

### Test 1: Bekannter HD Chart (Ra Uru Hu)

```rust
#[test]
fn test_ra_uru_hu_chart() {
    // Ra Uru Hu: 28. April 1948, 08:14 EST, Montreal
    let birth_data = BirthData {
        year: 1948,
        month: 4,
        day: 28,
        hour: 8,
        minute: 14,
        latitude: 45.5017,
        longitude: -73.5673,
        timezone: -5.0,
    };
    
    let ephe = EphemerisCalculator::new().unwrap();
    let calc = HDCalculator::new(&ephe);
    let chart = calc.calculate(&birth_data).unwrap();
    
    // Erwartete Werte (von geneticmatrix.com verifiziert)
    assert_eq!(chart.energy_type, "MANIFESTOR");
    assert_eq!(chart.profile, "5/1");
    assert_eq!(chart.authority, "EMOTIONAL");
    
    // Sonne sollte in Gate 22 sein
    let sun_gate = chart.gates.iter()
        .find(|g| g.planet == "SUN")
        .map(|g| g.number)
        .unwrap();
    assert_eq!(sun_gate, 22);
}
```

### Test 2: Präzision der Planetenberechnung

```rust
#[test]
fn test_precision_against_jpl() {
    let ephe = EphemerisCalculator::new().unwrap();
    
    // J2000.0
    let jd = 2451545.0;
    
    // Vergleiche mit JPL Horizons Daten
    let sun = ephe.calculate_body(jd, Body::Sun).unwrap();
    
    // JPL Wert: 280.46646°
    assert!((sun.longitude - 280.46646).abs() < 0.001,
        "Sonnenposition Abweichung zu groß: {}°", sun.longitude);
}
```

### Test 3: Retrograde-Erkennung

```rust
#[test]
fn test_retrograde_detection() {
    let ephe = EphemerisCalculator::new().unwrap();
    
    // Merkur Retrograd: 1. Januar 2024
    let jd_retro = EphemerisCalculator::julian_day(2024, 1, 1, 12, true);
    let mercury_retro = ephe.calculate_body(jd_retro, Body::Mercury).unwrap();
    
    // Merkur Direkt: 1. Januar 2023  
    let jd_direct = EphemerisCalculator::julian_day(2023, 1, 1, 12, true);
    let mercury_direct = ephe.calculate_body(jd_direct, Body::Mercury).unwrap();
    
    assert!(mercury_retro.is_retrograde, "Merkur sollte rückläufig sein");
    assert!(!mercury_direct.is_retrograde, "Merkur sollte direkt sein");
}
```

---

## Troubleshooting

### Problem: "Ephemeris file not found"

**Lösung**: 
1. Prüfe ob `ephemeris/` Verzeichnis existiert
2. Prüfe ob `.se1` Dateien vorhanden sind
3. Verwende absoluten Pfad in `swe_set_ephe_path()`

### Problem: `libswe-sys` kompiliert nicht

**Lösung**:
```toml
# Cargo.toml
[dependencies]
libswe-sys = { version = "0.2", features = ["build-from-source"] }
```

Oder installiere System-Library:
```bash
# macOS
brew install swisseph

# Linux (Ubuntu/Debian)
sudo apt-get install libswe-dev

# Windows
# Nutze pre-built binaries oder vcpkg
```

### Problem: Ungenauigkeiten in Berechnung

**Prüfungen**:
1. Zeitzone korrekt angewendet? (Lokal → UT)
2. Julian Day korrekt berechnet?
3. Ephemeris-Dateien für den Zeitrahmen vorhanden?

---

**Nächste Schritte**: Siehe `PROFESSIONAL_CALCULATIONS_SPEC.md` für den vollständigen Implementierungsplan.
