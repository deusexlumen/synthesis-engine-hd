# Professionelle Berechnungen - Implementierungsspezifikation

> **⚠️ Historisches Dokument (Tauri-Ära).** Die beschriebenen Rust-Pfade (`app/src-tauri`) existieren nicht mehr. Professionelle Genauigkeit ist inzwischen erreicht: Das Backend nutzt `sweph` (Swiss Ephemeris) serverseitig. Dieses Dokument dient nur noch als Referenz.

## Executive Summary

Diese Dokumentation beschreibt die notwendigen Schritte, um die Synthesis Engine auf professionelle, astrologisch korrekte Berechnungen umzustellen. Der Fokus liegt auf der Integration der **Swiss Ephemeris** für präzise Planetenpositionen und der korrekten Umsetzung aller Human Design- und Numerologie-Algorithmen.

---

## 1. Aktueller Stand vs. Professioneller Anspruch

### 1.1 Human Design Berechnungen

| Aspekt | Aktuell | Professionell | Status |
|--------|---------|---------------|--------|
| Sonnenposition | Analytische Formel (±0.01°) | Swiss Ephemeris (±0.001") | ⚠️ Gut, aber verbesserbar |
| Mondposition | Vereinfachtes Modell (±0.5°) | Swiss Ephemeris (±0.001") | ❌ Ungenau |
| Planetenpositionen | Mittlere Längen (±2°) | Swiss Ephemeris (±0.001") | ❌ Ungenau |
| Mondknoten | Vereinfacht (±1°) | Swiss Ephemeris | ❌ Ungenau |
| Retrograde | Geschätzt | Exakte Berechnung | ⚠️ Teilweise |
| Zeitzonen-Handling | Basic | Historische Zeitzonen | ❌ Fehlt |

### 1.2 Numerologie Berechnungen

| Aspekt | Aktuell | Professionell | Status |
|--------|---------|---------------|--------|
| Lebensweg | ✓ Korrekt | ✓ Korrekt | ✅ OK |
| Meisterzahlen | ✓ 11, 22 | ✓ 11, 22, 33* | ⚠️ 33 optional |
| Seelenweg | ✓ Korrekt | ✓ Korrekt | ✅ OK |
| Ausdruck | ✓ Korrekt | ✓ Korrekt | ✅ OK |
| Herausforderungen | ✓ Korrekt | ✓ Korrekt | ✅ OK |
| Höhepunkte | ✓ Korrekt | ✓ Korrekt | ✅ OK |

*33 wird in manchen Systemen als Meisterzahl behandelt

---

## 2. Swiss Ephemeris Integration

### 2.1 Was ist die Swiss Ephemeris?

Die Swiss Ephemeris ist die professionelle Standard-Bibliothek für astronomische Berechnungen, entwickelt von Astrodienst. Sie basiert auf den NASA JPL Ephemeriden (DE431) und bietet:

- **Präzision**: Bis zu 0.001 Bogensekunden
- **Zeitspanne**: 3000 v.Chr. bis 3000 n.Chr.
- **Planeten**: Alle 10 Planeten + Mondknoten + Apogäum
- **House Systeme**: Placidus, Koch, Equal, etc.
- **Sternzeichen**: Tropical, Sidereal

### 2.2 Crate: `libswe-sys`

```toml
[dependencies]
libswe-sys = "0.2"
```

**Wichtig**: Die Crate ist bereits in `Cargo.toml` eingetragen, aber **nicht aktiv genutzt**!

### 2.3 Ephemeris Daten-Dateien

Die Swiss Ephemeris benötigt Daten-Dateien für verschiedene Zeitspannen:

| Datei | Zeitspanne | Größe |
|-------|------------|-------|
| `seplm18.se1` | 1800-2400 | 6 KB |
| `semom18.se1` | 1800-2400 (Mond) | 6 KB |
| `seplm06.se1` | 600-1200 | 6 KB |
| `sepl_18.se1` | 1800-2400 (grob) | 3 KB |

**Lokale Speicherung**: Die Dateien müssen in `app/src-tauri/ephemeris/` abgelegt werden und bei Build mitgebunden werden.

---

## 3. Implementierungsplan

### Phase 1: Swiss Ephemeris Wrapper (Kritisch)

#### 3.1.1 Neue Datei: `ephemeris.rs`

```rust
use libswe_sys::swe;
use std::path::PathBuf;

pub struct EphemerisCalculator {
    ephe_path: PathBuf,
}

impl EphemerisCalculator {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        // Pfad zu den Ephemeris-Dateien
        let ephe_path = PathBuf::from("./ephemeris");
        
        // Swiss Ephemeris initialisieren
        unsafe {
            let path_cstring = std::ffi::CString::new(ephe_path.to_str().unwrap())?;
            swe::swe_set_ephe_path(path_cstring.as_ptr());
        }
        
        Ok(Self { ephe_path })
    }
    
    /// Berechnet die ekliptikale Länge eines Planeten
    pub fn calculate_planet(
        &self,
        julian_day: f64,
        planet: Planet,
        use_true_node: bool,
    ) -> Result<PlanetPosition, Box<dyn std::error::Error>> {
        let planet_id = planet.to_swe_id();
        
        unsafe {
            let mut result = [0.0; 6];
            let mut error_buffer = [0 as libc::c_char; 256];
            
            let flag = swe::SE_EQUATORIAL | swe::SE_SPEED;
            
            let status = swe::swe_calc_ut(
                julian_day,
                planet_id,
                flag,
                result.as_mut_ptr(),
                error_buffer.as_mut_ptr(),
            );
            
            if status < 0 {
                let error_msg = CStr::from_ptr(error_buffer.as_ptr())
                    .to_string_lossy()
                    .to_string();
                return Err(error_msg.into());
            }
            
            Ok(PlanetPosition {
                longitude: result[0],      // Ekliptikale Länge
                latitude: result[1],       // Ekliptikale Breite
                distance: result[2],       // Entfernung (AU)
                longitude_speed: result[3], // Tägliche Bewegung
                latitude_speed: result[4],
                distance_speed: result[5],
                is_retrograde: result[3] < 0.0, // Negative Geschwindigkeit = Retrograd
            })
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub enum Planet {
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

impl Planet {
    fn to_swe_id(&self) -> i32 {
        match self {
            Planet::Sun => swe::SE_SUN,
            Planet::Moon => swe::SE_MOON,
            Planet::Mercury => swe::SE_MERCURY,
            Planet::Venus => swe::SE_VENUS,
            Planet::Mars => swe::SE_MARS,
            Planet::Jupiter => swe::SE_JUPITER,
            Planet::Saturn => swe::SE_SATURN,
            Planet::Uranus => swe::SE_URANUS,
            Planet::Neptune => swe::SE_NEPTUNE,
            Planet::Pluto => swe::SE_PLUTO,
            Planet::NorthNode => swe::SE_TRUE_NODE,
            Planet::SouthNode => swe::SE_MEAN_NODE, // Oder berechnet als Gegenpunkt
        }
    }
}

#[derive(Debug, Clone)]
pub struct PlanetPosition {
    pub longitude: f64,
    pub latitude: f64,
    pub distance: f64,
    pub longitude_speed: f64,
    pub latitude_speed: f64,
    pub distance_speed: f64,
    pub is_retrograde: bool,
}
```

#### 3.1.2 Julian Day mit Zeitzone

```rust
/// Konvertiert ein Datum mit lokaler Zeit und Zeitzone zu Julian Day UT
pub fn local_to_julian_day(
    year: i32,
    month: u32,
    day: u32,
    hour: u32,
    minute: u32,
    timezone_offset: f64, // In Stunden, z.B. +1.0 für MEZ
) -> f64 {
    // Lokale Zeit zu UT konvertieren
    let ut_hour = hour as f64 + minute as f64 / 60.0 - timezone_offset;
    
    // Swiss Ephemeris Julian Day Funktion nutzen
    unsafe {
        swe::swe_julday(
            year,
            month as i32,
            day as i32,
            ut_hour,
            swe::SE_GREG_CAL,
        )
    }
}
```

### Phase 2: Human Design mit Swiss Ephemeris

#### 3.2.1 Refactoring `human_design.rs`

Die bestehenden Berechnungsfunktionen müssen ersetzt werden:

```rust
// ALT: Vereinfachte Berechnung
fn sun_longitude(jd: f64) -> f64 { ... }

// NEU: Swiss Ephemeris
pub fn calculate_hd_chart_with_ephemeris(
    birth_data: BirthData,
    ephe: &EphemerisCalculator,
) -> Result<HumanDesignChart, Box<dyn std::error::Error>> {
    // Julian Day mit Zeitzone berechnen
    let jd = local_to_julian_day(
        birth_data.year,
        birth_data.month,
        birth_data.day,
        birth_data.hour,
        birth_data.minute,
        birth_data.timezone,
    );
    
    // Alle Planeten mit Swiss Ephemeris berechnen
    let sun = ephe.calculate_planet(jd, Planet::Sun, false)?;
    let moon = ephe.calculate_planet(jd, Planet::Moon, false)?;
    let north_node = ephe.calculate_planet(jd, Planet::NorthNode, true)?;
    let mercury = ephe.calculate_planet(jd, Planet::Mercury, false)?;
    let venus = ephe.calculate_planet(jd, Planet::Venus, false)?;
    let mars = ephe.calculate_planet(jd, Planet::Mars, false)?;
    let jupiter = ephe.calculate_planet(jd, Planet::Jupiter, false)?;
    let saturn = ephe.calculate_planet(jd, Planet::Saturn, false)?;
    let uranus = ephe.calculate_planet(jd, Planet::Uranus, false)?;
    let neptune = ephe.calculate_planet(jd, Planet::Neptune, false)?;
    let pluto = ephe.calculate_planet(jd, Planet::Pluto, false)?;
    
    // Erde ist Sonne + 180°
    let earth_longitude = (sun.longitude + 180.0) % 360.0;
    let south_node_longitude = (north_node.longitude + 180.0) % 360.0;
    
    // ... Rest der Berechnung bleibt gleich
}
```

### Phase 3: Transit-Berechnungen

#### 3.3.1 Tages-Transit mit Ephemeris

```rust
pub fn calculate_daily_transit_ephemeris(
    year: i32,
    month: u32,
    day: u32,
    ephe: &EphemerisCalculator,
) -> Result<TransitData, Box<dyn std::error::Error>> {
    // Mittag UT des Tages
    let jd = unsafe {
        swe::swe_julday(year, month as i32, day as i32, 12.0, swe::SE_GREG_CAL)
    };
    
    // Alle Planeten berechnen
    let planets = vec![
        TransitPlanet::from_position(
            "Sonne".to_string(),
            ephe.calculate_planet(jd, Planet::Sun, false)?,
        ),
        TransitPlanet::from_position(
            "Mond".to_string(),
            ephe.calculate_planet(jd, Planet::Moon, false)?,
        ),
        // ... alle anderen Planeten
    ];
    
    Ok(TransitData { ... })
}
```

### Phase 4: Zeitzonen-Handling

#### 3.4.1 Historische Zeitzonen

```rust
use chrono_tz::Tz;

pub fn resolve_timezone(
    latitude: f64,
    longitude: f64,
    timestamp: chrono::DateTime<chrono::Utc>,
) -> Result<f64, Box<dyn std::error::Error>> {
    // Option 1: IANA Zeitzonen-Datenbank
    // Option 2: GeoNames API (Falls offline nicht möglich)
    
    // Für jetzt: Vereinfachte Annäherung
    let offset_hours = (longitude / 15.0).round();
    Ok(offset_hours)
}
```

---

## 4. Build-Konfiguration

### 4.1 Ephemeris-Dateien einbinden

#### `app/src-tauri/tauri.conf.json`:

```json
{
  "bundle": {
    "resources": [
      "ephemeris/*"
    ]
  }
}
```

#### Build-Script (`build.rs`):

```rust
use std::env;
use std::path::PathBuf;

fn main() {
    // Ephemeris-Dateien kopieren
    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
    let ephe_src = PathBuf::from("ephemeris");
    let ephe_dst = out_dir.join("ephemeris");
    
    if ephe_src.exists() {
        std::fs::create_dir_all(&ephe_dst).unwrap();
        for entry in std::fs::read_dir(ephe_src).unwrap() {
            let entry = entry.unwrap();
            let src = entry.path();
            let dst = ephe_dst.join(entry.file_name());
            std::fs::copy(&src, &dst).unwrap();
        }
    }
    
    println!("cargo:rerun-if-changed=ephemeris/");
}
```

### 4.2 Cargo.toml Anpassungen

```toml
[dependencies]
# ... bestehende Abhängigkeiten

# Zeitzone-Unterstützung
chrono-tz = "0.8"

# Für libswe-sys (falls System-Library nicht verfügbar)
# libswe-sys = { version = "0.2", features = ["build-from-source"] }
```

---

## 5. Test-Strategie

### 5.1 Unit Tests für Berechnungen

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_swiss_ephemeris_sun_position() {
        let ephe = EphemerisCalculator::new().unwrap();
        
        // J2000.0: 1. Januar 2000, 12:00 UT
        let jd = 2451545.0;
        let sun = ephe.calculate_planet(jd, Planet::Sun, false).unwrap();
        
        // Erwartet: ~280.46° (Steinbock)
        assert!((sun.longitude - 280.46).abs() < 0.01,
            "Sonnenposition ist {}°, erwartet ~280.46°", sun.longitude);
    }
    
    #[test]
    fn test_gate_calculation() {
        // Gate 41 beginnt bei 0° Aquarius
        assert_eq!(longitude_to_gate(0.0), 41);
        assert_eq!(longitude_to_gate(5.0), 41);
        assert_eq!(longitude_to_gate(5.625), 19);
        
        // Gate 1 bei ~225°
        let gate_1_approx = 225.0;
        assert_eq!(longitude_to_gate(gate_1_approx), 1);
    }
    
    #[test]
    fn test_known_birth_chart() {
        // Test mit bekanntem Human Design Chart
        // Ra Uru Hu: 28. April 1948, 08:14, Montreal
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
        
        // Erwartet: Manifestor, 5/1 Profil
        assert_eq!(chart.energy_type, "MANIFESTOR");
        assert_eq!(chart.profile, "5/1");
    }
}
```

### 5.2 Integration Tests

```rust
// tests/integration_tests.rs
use synthesis_engine::*;

#[test]
fn test_full_calculation_pipeline() {
    // Erstelle temporäre Ephemeris
    let temp_dir = tempfile::tempdir().unwrap();
    // ... kopiere minimale Ephemeris-Dateien
    
    let ephe = EphemerisCalculator::with_path(temp_dir.path()).unwrap();
    
    // Teste komplette Pipeline
    let birth_data = BirthData {
        year: 1990,
        month: 6,
        day: 15,
        hour: 14,
        minute: 30,
        latitude: 52.5200,
        longitude: 13.4050,
        timezone: 2.0,
    };
    
    let chart = calculate_hd_chart_with_ephemeris(birth_data, &ephe).unwrap();
    
    // Validierungen
    assert!(!chart.gates.is_empty());
    assert!(chart.profile_line_1 >= 1 && chart.profile_line_1 <= 6);
    assert!(chart.profile_line_2 >= 1 && chart.profile_line_2 <= 6);
}
```

### 5.3 Vergleich mit Referenz-Daten

```rust
#[test]
fn test_against_jpl_horizons() {
    // Vergleiche mit NASA JPL Horizons Daten
    // https://ssd.jpl.nasa.gov/horizons/app.html/
    
    let test_cases = vec![
        // (JD, Planet, Erwartete_Länge)
        (2451545.0, Planet::Sun, 280.46646),
        (2451545.0, Planet::Moon, 218.31645),
        (2451545.0, Planet::Mercury, 250.3),
    ];
    
    let ephe = EphemerisCalculator::new().unwrap();
    
    for (jd, planet, expected) in test_cases {
        let pos = ephe.calculate_planet(jd, planet, false).unwrap();
        let diff = (pos.longitude - expected).abs();
        assert!(diff < 0.01, 
            "Abweichung für {:?} zu groß: {}° (erwartet: {}°)", 
            planet, pos.longitude, expected);
    }
}
```

---

## 6. Validierungs-Methoden

### 6.1 Externe Referenzen

| Tool | URL | Zweck |
|------|-----|-------|
| JPL Horizons | https://ssd.jpl.nasa.gov/horizons/ | Planetenpositionen |
| Astro.com | https://www.astro.com/swisseph/sweph.htm | Swiss Ephemeris Tests |
| Genetic Matrix | https://geneticmatrix.com | HD Chart Vergleich |
| MyBodyGraph | https://mybodygraph.com | HD Chart Vergleich |
| AstroSeek | https://astro-seek.com | Ephemeris Daten |

### 6.2 Manuelle Validierung

```rust
// Debug-Ausgabe für manuelle Prüfung
#[cfg(debug_assertions)]
pub fn debug_planet_positions(jd: f64, ephe: &EphemerisCalculator) {
    let planets = vec![
        ("Sonne", Planet::Sun),
        ("Mond", Planet::Moon),
        ("Merkur", Planet::Mercury),
        // ...
    ];
    
    for (name, planet) in planets {
        let pos = ephe.calculate_planet(jd, planet, false).unwrap();
        let gate = longitude_to_gate(pos.longitude);
        let (line, color, tone, base) = calculate_gate_details(pos.longitude);
        
        println!(
            "{}: {:>8.4}° | Gate {:>2} | Linie {} | Farbe {} | Ton {} | Basis {}",
            name, pos.longitude, gate, line, color, tone, base
        );
    }
}
```

---

## 7. Fallback-Strategie

Falls Swiss Ephemeris nicht verfügbar ist (z.B. fehlende Dateien):

```rust
pub enum CalculatorMode {
    SwissEphemeris,  // Volle Präzision
    Analytical,      // Aktuelle Implementierung (Fallback)
}

impl EphemerisCalculator {
    pub fn calculate_with_fallback(
        &self,
        jd: f64,
        planet: Planet,
    ) -> Result<PlanetPosition, Box<dyn std::error::Error>> {
        match self.mode {
            CalculatorMode::SwissEphemeris => {
                self.calculate_planet(jd, planet, false)
            }
            CalculatorMode::Analytical => {
                // Nutze bestehende analytische Funktionen
                Ok(analytical_planet_position(jd, planet))
            }
        }
    }
}
```

---

## 8. Zusammenfassung der To-Dos

### Priorität: Kritisch (MVP)
- [ ] Swiss Ephemeris Daten-Dateien herunterladen
- [ ] `ephemeris.rs` Modul erstellen
- [ ] `human_design.rs` auf Ephemeris umstellen
- [ ] Tests mit bekannten Geburtsdaten validieren

### Priorität: Hoch
- [ ] Transit-Berechnungen auf Ephemeris umstellen
- [ ] Zeitzonen-Handling verbessern
- [ ] Retrograde-Detektion korrigieren

### Priorität: Mittel
- [ ] Numerologie 33 als Meisterzahl (optional)
- [ ] Performance-Optimierung (Caching)
- [ ] Offline-Fallback implementieren

### Priorität: Niedrig
- [ ] House-Systeme (für erweiterte Astrologie)
- [ ] Kleinster Planetoiden (Chiron, etc.)
- [ ] Historische Ephemeriden (vor 1800)

---

## 9. Ressourcen

### Swiss Ephemeris Downloads
```bash
# Ephemeris-Dateien (1800-2400)
wget https://www.astro.com/swisseph/ephe/archive/seplm18.se1
wget https://www.astro.com/swisseph/ephe/archive/semom18.se1

# Für erweiterte Zeitspannen
wget https://www.astro.com/swisseph/ephe/archive/seas_18.se1
```

### Dokumentation
- Swiss Ephemeris Manual: https://www.astro.com/swisseph/swephprg.htm
- Rust bindings: https://docs.rs/libswe-sys/latest/libswe_sys/

---

**Autor**: AI Coding Agent  
**Version**: 1.0  
**Datum**: 2026-03-05
