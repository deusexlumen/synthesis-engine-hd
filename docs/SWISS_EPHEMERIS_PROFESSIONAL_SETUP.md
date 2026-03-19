# Professionelle Swiss Ephemeris Einrichtung

## Übersicht

Für die **höchstmögliche Genauigkeit** (±0.0001° = 0.36 Bogensekunden) müssen wir die komprimierten Swiss Ephemeris Dateien (.se1) verwenden statt der Moshier-Formeln.

## Genauigkeits-Vergleich

| Methode | Genauigkeit | Datenquelle | Verwendung |
|---------|-------------|-------------|------------|
| **Moshier Formeln** | ±0.1° | Analytische Berechnung | Fallback, Tests |
| **SE Dateien (.se1)** | ±0.0001° | NASA JPL DE431/DE441 | Produktion |
| **JPL DE441** | ±0.00001° | Direkte NASA Daten | Optional |

> **Wichtig:** Bei Human Design ist jedes Gate 5.625° groß. Mit ±0.1° Genauigkeit kann ein Planet im falschen Gate liegen!

---

## Benötigte Dateien

### Minimal-Set (1800-2400 CE)

Für die meisten Human Design Berechnungen (Geburten 1900-2100):

```
sepl_18.se1    # Planeten (Sonne, Merkur, Venus, Mars, Jupiter, Saturn, Uranus, Neptun, Pluto)
semo_18.se1    # Mond
seas_18.se1    # Asteroiden & weitere Körper (optional aber empfohlen)
sefstars.txt   # Fixsterne (optional)
```

### Erweiterte Sets

| Datei | Zeitraum | Größe | Nutzung |
|-------|----------|-------|---------|
| `sepl_18.se1` | 1800-2400 | ~400 KB | Standard |
| `seplm18.se1` | 3000 BCE - 3000 CE | ~3 MB | Historische Charts |
| `seplm54.se1` | 13200 BCE - 17191 CE | ~36 MB | Archäo-Astronomie |
| `semo_18.se1` | 1800-2400 | ~800 KB | Standard Mond |
| `semom18.se1` | 3000 BCE - 3000 CE | ~6 MB | Historisch |

### Download-Quellen

1. **GitHub Repository** (empfohlen):
   ```
   https://github.com/aloistr/swisseph/tree/master/ephe
   ```

2. **Dropbox** (alle Dateien):
   ```
   https://www.dropbox.com/scl/fo/y3naz62gy6f6qfrhquu7u/h?rlkey=ejltdhb262zglm7eo6yfj2940&dl=0
   ```

3. **FTP Direkt**:
   ```
   https://www.astro.com/ftp/swisseph/ephe/
   ```

---

## Installation

### 1. Dateien herunterladen

```powershell
# PowerShell (Windows)
# Erstelle ephemeris Verzeichnis
mkdir -p "app/src-tauri/ephemeris"

# Lade Dateien herunter (1800-2400, ausreichend für HD)
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/aloistr/swisseph/master/ephe/sepl_18.se1" -OutFile "app/src-tauri/ephemeris/sepl_18.se1"
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/aloistr/swisseph/master/ephe/semo_18.se1" -OutFile "app/src-tauri/ephemeris/semo_18.se1"
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/aloistr/swisseph/master/ephe/seas_18.se1" -OutFile "app/src-tauri/ephemeris/seas_18.se1"

# Optional: Fixsterne
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/aloistr/swisseph/master/ephe/sefstars.txt" -OutFile "app/src-tauri/ephemeris/sefstars.txt"
```

```bash
# Linux/macOS
mkdir -p app/src-tauri/ephemeris
cd app/src-tauri/ephemeris

wget https://raw.githubusercontent.com/aloistr/swisseph/master/ephe/sepl_18.se1
wget https://raw.githubusercontent.com/aloistr/swisseph/master/ephe/semo_18.se1
wget https://raw.githubusercontent.com/aloistr/swisseph/master/ephe/seas_18.se1
```

### 2. Rust-Code anpassen

Die `ephemeris.rs` Datei muss den Pfad korrekt setzen:

```rust
// In ephemeris.rs - init_ephemeris Funktion

/// Initialisiert die Swiss Ephemeris mit .se1 Dateien
/// 
/// # Arguments
/// * `ephe_path` - Pfad zum Verzeichnis mit .se1 Dateien
pub fn init_ephemeris(ephe_path: Option<&str>) -> Result<(), EphemerisError> {
    INIT.call_once(|| {
        unsafe {
            if let Some(path) = ephe_path {
                let c_path = CString::new(path).expect("Invalid path string");
                swe::swe_set_ephe_path(c_path.as_ptr());
                EPHE_PATH_SET = true;
                
                // Optional: Version prüfen
                let version = get_version();
                eprintln!("Swiss Ephemeris v{} initialisiert", version);
                eprintln!("Ephemeris Pfad: {}", path);
            } else {
                // Moshier fallback (weniger genau)
                swe::swe_set_ephe_path(std::ptr::null());
                EPHE_PATH_SET = false;
                eprintln!("WARNUNG: Keine .se1 Dateien - verwende Moshier Formeln (±0.1°)");
            }
        }
    });
    Ok(())
}

/// Gibt die Swiss Ephemeris Version zurück
pub fn get_version() -> String {
    unsafe {
        let mut version = [0i8; 256];
        swe::swe_version(version.as_mut_ptr());
        let c_str = std::ffi::CStr::from_ptr(version.as_ptr());
        c_str.to_string_lossy().into_owned()
    }
}

/// Prüft ob Ephemeris-Dateien gefunden wurden
pub fn check_ephemeris_available() -> bool {
    unsafe { EPHE_PATH_SET }
}
```

### 3. Pfad-Handling im main.rs

```rust
// In main.rs

fn get_ephemeris_path() -> Option<String> {
    // Versuche verschiedene Pfade (für Dev vs. Produktion)
    
    // 1. Environment Variable
    if let Ok(path) = std::env::var("SE_EPHE_PATH") {
        if std::path::Path::new(&path).exists() {
            return Some(path);
        }
    }
    
    // 2. Relativer Pfad (Entwicklung)
    let dev_paths = [
        "./ephemeris",
        "../ephemeris",
        "./src-tauri/ephemeris",
        "../src-tauri/ephemeris",
    ];
    
    for path in &dev_paths {
        if std::path::Path::new(path).exists() {
            return Some(path.to_string());
        }
    }
    
    // 3. Standard-Systempfade
    let system_paths = [
        "/usr/share/sweph/ephe",
        "/usr/local/share/sweph/ephe",
        "C:\\sweph\\ephe",
    ];
    
    for path in &system_paths {
        if std::path::Path::new(path).exists() {
            return Some(path.to_string());
        }
    }
    
    None
}

fn main() {
    // Initialisiere Ephemeris vor dem Start
    let ephe_path = get_ephemeris_path();
    
    if let Some(ref path) = ephe_path {
        if let Err(e) = ephemeris::init_ephemeris(Some(path)) {
            eprintln!("Fehler beim Initialisieren der Ephemeris: {}", e);
        }
    } else {
        eprintln!("Keine Ephemeris-Dateien gefunden - verwende Moshier (weniger genau)");
        let _ = ephemeris::init_ephemeris(None);
    }
    
    // Rest der main()...
}
```

---

## Validierung der Genauigkeit

### 1. Test mit bekannten Daten

```rust
#[test]
fn test_jpl_horizons_accuracy() {
    init_ephemeris(Some("./ephemeris")).unwrap();
    
    // J2000.0 Referenzwerte von NASA JPL Horizons
    // 1. Januar 2000, 12:00 UT
    let jd = julian_day(2000, 1, 1, 12, 0, 0.0, Calendar::Gregorian);
    
    // Erwartete Werte (JPL Horizons)
    let sun_expected = 280.5823;  // Ekliptikale Länge
    
    let sun_pos = calculate_planet(jd, Planet::Sun, 0).unwrap();
    let sun_error = (sun_pos.longitude - sun_expected).abs();
    
    // Mit SE Dateien: Fehler < 0.001°
    // Mit Moshier: Fehler kann bis zu 0.1° sein
    assert!(
        sun_error < 0.001,
        "Sonnenposition zu ungenau: {}° (erwartet: {}°), Fehler: {}°",
        sun_pos.longitude, sun_expected, sun_error
    );
}
```

### 2. Human Design Spezifische Tests

```rust
#[test]
fn test_ra_uru_hu_chart_gates() {
    init_ephemeris(Some("./ephemeris")).unwrap();
    
    // Ra Uru Hu: 28. April 1948, 08:14 EST, Montreal
    // Bekannte Referenzwerte von mybodygraph.com
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
    
    let chart = calculate_hd_chart(birth_data).unwrap();
    
    // Typ muss Manifestor sein
    assert_eq!(chart.energy_type, "MANIFESTOR");
    
    // Sonnentor sollte 9 sein (bekannt aus Referenz)
    let sun_gate = chart.gates.iter()
        .find(|g| g.planet == "SUN")
        .map(|g| g.number);
    
    assert_eq!(sun_gate, Some(9), "Sonnentor stimmt nicht mit Referenz überein");
}
```

---

## Build-Konfiguration

### Cargo.toml Anpassungen

```toml
[package]
name = "synthesis-engine"
version = "0.1.0"
build = "build.rs"  # Wichtig für Datei-Kopieren

[build-dependencies]
tauri-build = { version = "2.0", features = [] }

[dependencies]
# ... bestehende Dependencies

[features]
default = ["custom-protocol"]
custom-protocol = ["tauri/custom-protocol"]
```

### build.rs

```rust
use std::env;
use std::path::PathBuf;

fn main() {
    // Kopiere Ephemeris-Dateien zum Build-Output
    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
    let target_dir = out_dir.join("ephemeris");
    
    std::fs::create_dir_all(&target_dir).ok();
    
    let ephe_files = ["sepl_18.se1", "semo_18.se1", "seas_18.se1"];
    
    for file in &ephe_files {
        let src = PathBuf::from("ephemeris").join(file);
        let dst = target_dir.join(file);
        
        if src.exists() {
            std::fs::copy(&src, &dst).ok();
            println!("cargo:rerun-if-changed=ephemeris/{}", file);
        }
    }
    
    tauri_build::build()
}
```

---

## Deployment Strategien

### Option 1: Dateien im Repository (empfohlen für Web)

```
project/
├── backend/
│   └── ephemeris/           # .se1 Dateien
├── app/
│   └── src-tauri/
│       └── ephemeris/       # Kopie für Desktop
```

**Vorteile:**
- Einfaches Deployment
- Keine zusätzlichen Downloads nötig

**Nachteile:**
- Repository wird größer (~1.5 MB für 1800-2400)

### Option 2: Runtime Download

```rust
async fn download_ephemeris_files() -> Result<(), Box<dyn Error>> {
    let base_url = "https://raw.githubusercontent.com/aloistr/swisseph/master/ephe/";
    let files = ["sepl_18.se1", "semo_18.se1"];
    
    for file in &files {
        let url = format!("{}{}", base_url, file);
        let response = reqwest::get(&url).await?;
        let content = response.bytes().await?;
        
        let path = format!("./ephemeris/{}", file);
        std::fs::write(&path, content)?;
    }
    
    Ok(())
}
```

**Vorteile:**
- Kleineres Repository
- Aktuelle Dateien

**Nachteile:**
- Internet-Verbindung nötig
- Lizenz-Überlegungen

### Option 3: System-Installation

```bash
# Linux
sudo mkdir -p /usr/share/sweph/ephe
sudo cp *.se1 /usr/share/sweph/ephe/

# macOS
sudo mkdir -p /usr/local/share/sweph/ephe
sudo cp *.se1 /usr/local/share/sweph/ephe/

# Windows (PowerShell Admin)
mkdir "C:\sweph\ephe"
copy *.se1 "C:\sweph\ephe\"
```

---

## Lizenz-Hinweise

Die Swiss Ephemeris hat eine **duale Lizenz**:

1. **AGPL-3.0** (Open Source)
   - Quellcode muss offen sein
   - Für nicht-kommerzielle Projekte

2. **Professional License** (kommerziell)
   - Geschlossene Software möglich
   - Lizenzgebühr an Astrodienst AG

Für dieses Projekt:
- Wenn Open Source (AGPL): Keine Gebühren
- Wenn kommerziell: Kontaktieren Sie Astrodienst AG

---

## Fehlerbehebung

### Problem: "Ephemeris file not found"

**Lösung:**
```rust
// Debug-Ausgabe hinzufügen
eprintln!("Suche Ephemeris in: {:?}", std::env::current_dir());
eprintln!("Pfad existiert: {}", std::path::Path::new(path).exists());
```

### Problem: Ungenauigkeit trotz .se1 Dateien

**Prüfen:**
1. Werden die Dateien wirklich geladen? (Version ausgeben)
2. Ist der Pfad korrekt?
3. Sind die Dateien vollständig? (Checksum prüfen)

### Problem: Segfault/Laufzeitfehler

**Ursache:** Häufig falsche CString-Behandlung

**Lösung:**
```rust
// Korrekt
let c_path = CString::new(path)?;
swe::swe_set_ephe_path(c_path.as_ptr());
```

---

## Zusammenfassung

| Schritt | Aktion | Priorität |
|---------|--------|-----------|
| 1 | .se1 Dateien herunterladen | 🔴 Kritisch |
| 2 | Pfad in Rust Code setzen | 🔴 Kritisch |
| 3 | Validierungstests schreiben | 🟡 Wichtig |
| 4 | Lizenz-Frage klären | 🟡 Wichtig |
| 5 | Deployment-Strategie wählen | 🟢 Optional |

Mit diesen Schritten erreichen Sie die **höchstmögliche Genauigkeit** für Human Design Berechnungen (±0.0001°), die der NASA JPL Daten entspricht.
