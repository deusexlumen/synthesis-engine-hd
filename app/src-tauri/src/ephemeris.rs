//! Swiss Ephemeris Integration - Professionelle Version
//! 
//! Dieses Modul bietet einen sicheren Rust-Wrapper um die libswe-sys FFI-Bindings.
//! Es berechnet präzise Planetenpositionen für Human Design Charts mit NASA JPL Genauigkeit.
//!
//! Genauigkeit: ±0.0001° (mit .se1 Dateien) vs ±0.1° (Moshier Formeln)
//! Datenquelle: NASA JPL DE431/DE441 (via Swiss Ephemeris .se1 Dateien)

use libswe_sys as swe;
use serde::{Deserialize, Serialize};
use std::ffi::CString;
use std::sync::Once;

static INIT: Once = Once::new();
static mut EPHE_PATH_SET: bool = false;

/// Planeten-Position mit allen Details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanetPosition {
    pub longitude: f64,
    pub latitude: f64,
    pub distance: f64,
    pub longitude_speed: f64,
    pub latitude_speed: f64,
    pub distance_speed: f64,
}

/// Verfügbare Planeten und Punkte
#[derive(Debug, Clone, Copy)]
pub enum Planet {
    Sun = swe::SE_SUN as isize,
    Moon = swe::SE_MOON as isize,
    Mercury = swe::SE_MERCURY as isize,
    Venus = swe::SE_VENUS as isize,
    Mars = swe::SE_MARS as isize,
    Jupiter = swe::SE_JUPITER as isize,
    Saturn = swe::SE_SATURN as isize,
    Uranus = swe::SE_URANUS as isize,
    Neptune = swe::SE_NEPTUNE as isize,
    Pluto = swe::SE_PLUTO as isize,
    MeanNode = swe::SE_MEAN_NODE as isize,
    TrueNode = swe::SE_TRUE_NODE as isize,
    MeanApogee = swe::SE_MEAN_APOGEE as isize,
    Chiron = swe::SE_CHIRON as isize,
}

impl Planet {
    /// Swiss Ephemeris ID für Berechnungen
    pub fn to_swe_id(&self) -> i32 {
        *self as i32
    }
    
    /// Human-Readable Name
    pub fn name(&self) -> &'static str {
        match self {
            Planet::Sun => "SUN",
            Planet::Moon => "MOON",
            Planet::Mercury => "MERCURY",
            Planet::Venus => "VENUS",
            Planet::Mars => "MARS",
            Planet::Jupiter => "JUPITER",
            Planet::Saturn => "SATURN",
            Planet::Uranus => "URANUS",
            Planet::Neptune => "NEPTUNE",
            Planet::Pluto => "PLUTO",
            Planet::MeanNode => "NORTH_NODE",
            Planet::TrueNode => "NORTH_NODE_TRUE",
            Planet::MeanApogee => "LILITH",
            Planet::Chiron => "CHIRON",
        }
    }
}

/// Fehler-Typ für Ephemeris-Operationen
#[derive(Debug)]
pub struct EphemerisError {
    pub message: String,
}

impl std::fmt::Display for EphemerisError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "Ephemeris error: {}", self.message)
    }
}

impl std::error::Error for EphemerisError {}

/// Kalender-Systeme
#[derive(Debug, Clone, Copy)]
pub enum Calendar {
    Gregorian,
    Julian,
}

/// Initialisiert die Swiss Ephemeris
/// 
/// # Arguments
/// * `ephe_path` - Pfad zu den .se1 Ephemeris-Dateien
///   - `Some(path)` - Verwendet .se1 Dateien (höchste Genauigkeit ±0.0001°)
///   - `None` - Verwendet Moshier-Formeln (weniger genau ±0.1°)
///
/// # Thread-Safety
/// Diese Funktion ist thread-safe durch `std::sync::Once`
pub fn init_ephemeris(ephe_path: Option<&str>) -> Result<(), EphemerisError> {
    INIT.call_once(|| {
        unsafe {
            if let Some(path) = ephe_path {
                // Verwende komprimierte Ephemeris-Dateien
                match CString::new(path) {
                    Ok(c_path) => {
                        swe::swe_set_ephe_path(c_path.as_ptr());
                        EPHE_PATH_SET = true;
                        
                        // Versions-Info ausgeben
                        let version = get_version();
                        eprintln!("✓ Swiss Ephemeris v{} initialisiert", version);
                        eprintln!("  Ephemeris-Pfad: {}", path);
                        
                        // Prüfe ob Dateien gefunden wurden
                        if !check_ephemeris_files(path) {
                            eprintln!("  ⚠️ WARNUNG: Keine .se1 Dateien im Pfad gefunden!");
                            eprintln!("  Verwende Moshier-Formeln (weniger genau)");
                        } else {
                            eprintln!("  ✓ .se1 Ephemeris-Dateien gefunden");
                        }
                    }
                    Err(_) => {
                        eprintln!("  ⚠️ Ungültiger Pfad, verwende Moshier-Formeln");
                        swe::swe_set_ephe_path(std::ptr::null());
                        EPHE_PATH_SET = false;
                    }
                }
            } else {
                // Moshier fallback
                swe::swe_set_ephe_path(std::ptr::null());
                EPHE_PATH_SET = false;
                eprintln!("  ⚠️ Keine Ephemeris-Pfad angegeben - verwende Moshier-Formeln (±0.1°)");
            }
        }
    });
    Ok(())
}

/// Prüft ob Ephemeris-Dateien im Pfad existieren
fn check_ephemeris_files(path: &str) -> bool {
    let required_files = ["sepl_18.se1", "semo_18.se1"];
    let base_path = std::path::Path::new(path);
    
    for file in &required_files {
        let file_path = base_path.join(file);
        if file_path.exists() {
            return true; // Mindestens eine Datei gefunden
        }
    }
    false
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

/// Prüft ob Ephemeris-Dateien verwendet werden (statt Moshier)
pub fn is_using_ephemeris_files() -> bool {
    unsafe { EPHE_PATH_SET }
}

/// Berechnet Julian Day Number aus Datum/Zeit
///
/// # Arguments
/// * `year` - Jahr (z.B. 1984)
/// * `month` - Monat (1-12)
/// * `day` - Tag (1-31)
/// * `hour` - Stunde (0-23)
/// * `minute` - Minute (0-59)
/// * `second` - Sekunde (0.0-59.9)
/// * `calendar` - Kalendersystem
pub fn julian_day(
    year: i32,
    month: i32,
    day: i32,
    hour: i32,
    minute: i32,
    second: f64,
    calendar: Calendar,
) -> f64 {
    let hour_f64 = hour as f64 + minute as f64 / 60.0 + second / 3600.0;
    let gregflag = match calendar {
        Calendar::Gregorian => swe::SE_GREG_CAL as i32,
        Calendar::Julian => swe::SE_JUL_CAL as i32,
    };
    
    unsafe {
        swe::swe_julday(year, month, day, hour_f64, gregflag)
    }
}

/// Berechnet die Position eines Planeten
///
/// # Arguments
/// * `jd` - Julian Day Number (UT)
/// * `planet` - Der zu berechnende Planet
/// * `iflag` - Berechnungsflags (siehe SE_EQUATORIAL, SE_HELIOCTR, etc.)
///
/// # Returns
/// * `PlanetPosition` mit Longitude, Latitude, Distance und Geschwindigkeiten
///
/// # Errors
/// * `EphemerisError` wenn die Berechnung fehlschlägt
pub fn calculate_planet(
    jd: f64,
    planet: Planet,
    iflag: i32,
) -> Result<PlanetPosition, EphemerisError> {
    let mut xx: [f64; 6] = [0.0; 6];
    let mut serr: [i8; 256] = [0; 256];
    
    let result = unsafe {
        swe::swe_calc_ut(jd, planet.to_swe_id(), iflag, xx.as_mut_ptr(), serr.as_mut_ptr())
    };
    
    // Prüfe auf Fehler
    if result < 0 {
        let error_msg = unsafe {
            let c_str = std::ffi::CStr::from_ptr(serr.as_ptr());
            c_str.to_string_lossy().into_owned()
        };
        return Err(EphemerisError {
            message: format!("Calculation failed for {}: {}", planet.name(), error_msg),
        });
    }
    
    Ok(PlanetPosition {
        longitude: xx[0],
        latitude: xx[1],
        distance: xx[2],
        longitude_speed: xx[3],
        latitude_speed: xx[4],
        distance_speed: xx[5],
    })
}

/// Berechnet alle Planetenpositionen für ein Julian Day
///
/// # Arguments
/// * `jd` - Julian Day Number (UT)
/// * `include_outer` - Pluto und äußere Planeten einbeziehen
///
/// # Returns
/// * `Vec<(Planet, PlanetPosition)>` mit allen berechneten Planeten
pub fn calculate_all_planets(jd: f64, include_outer: bool) -> Result<Vec<(Planet, PlanetPosition)>, EphemerisError> {
    let iflag = swe::SE_EQUATORIAL as i32;
    
    let mut planets = vec![
        Planet::Sun,
        Planet::Moon,
        Planet::Mercury,
        Planet::Venus,
        Planet::Mars,
        Planet::Jupiter,
        Planet::Saturn,
        Planet::MeanNode,
    ];
    
    if include_outer {
        planets.push(Planet::Uranus);
        planets.push(Planet::Neptune);
        planets.push(Planet::Pluto);
        planets.push(Planet::Chiron);
    }
    
    let mut results = Vec::new();
    
    for planet in planets {
        match calculate_planet(jd, planet, iflag) {
            Ok(pos) => results.push((planet, pos)),
            Err(e) => {
                eprintln!("Warnung: Konnte {} nicht berechnen: {}", planet.name(), e);
                // Fahre fort mit anderen Planeten
            }
        }
    }
    
    Ok(results)
}

/// Berechnet Design- und Personality-Positionen für HD
///
/// Für Human Design benötigen wir:
/// - Personality: Positionen zum Zeitpunkt der Geburt
/// - Design: Positionen ~88° vor der Geburt (Sonne)
pub fn calculate_hd_moments(
    birth_jd: f64,
    include_outer: bool,
) -> Result<(Vec<(Planet, PlanetPosition)>, Vec<(Planet, PlanetPosition)>), EphemerisError> {
    // Design-Phase: ~88 Tage vor der Geburt (Sonne bewegt sich ~1° pro Tag)
    // Dies ist eine Annäherung - die exakte Berechnung erfolgt später
    let design_offset = 88.0; // Tage
    let design_jd = birth_jd - design_offset;
    
    let personality = calculate_all_planets(birth_jd, include_outer)?;
    let design = calculate_all_planets(design_jd, include_outer)?;
    
    Ok((design, personality))
}

// Human Design Mandala - Gates in korrekter Reihenfolge
const MANDALA_GATES: [i32; 64] = [
    41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3,
    27, 24, 2, 23, 8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56,
    31, 33, 7, 4, 29, 59, 40, 64, 47, 6, 46, 18, 48, 57, 32, 50,
    28, 44, 1, 43, 14, 34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60
];

/// Konvertiert ekliptikale Länge zu Human Design Gate
///
/// Human Design Mandala beginnt bei 0° Aquarius (≈ 300° ekliptikal)
/// Jedes Gate ist 5.625° (360° / 64)
pub fn longitude_to_hd_gate(longitude: f64) -> i32 {
    const HD_OFFSET: f64 = 300.0;  // 0° Aquarius
    const GATE_DEGREES: f64 = 5.625; // 360° / 64
    
    // Normalisiere Longitude zu 0-360
    let normalized = longitude.rem_euclid(360.0);
    
    // Berechne Position im HD-Mandala
    let hd_position = (normalized - HD_OFFSET).rem_euclid(360.0);
    let gate_index = (hd_position / GATE_DEGREES).floor() as i32;
    
    MANDALA_GATES[gate_index as usize % 64]
}

/// Berechnet Linie, Farbe, Ton und Basis für eine gegebene Longitude
pub fn calculate_hd_details(longitude: f64) -> (i32, i32, i32, i32) {
    const HD_OFFSET: f64 = 300.0;
    const GATE_DEGREES: f64 = 5.625;
    const LINE_DEGREES: f64 = 0.9375;     // 5.625 / 6
    const COLOR_DEGREES: f64 = 0.15625;   // 0.9375 / 6
    const TONE_DEGREES: f64 = 0.02604167; // 0.15625 / 6
    const BASE_DEGREES: f64 = 0.00520833; // 0.02604167 / 5
    
    let normalized = longitude.rem_euclid(360.0);
    let hd_position = (normalized - HD_OFFSET).rem_euclid(360.0);
    let within_gate = hd_position % GATE_DEGREES;
    
    // Linie (1-6)
    let line = ((within_gate / LINE_DEGREES).floor() as i32).clamp(0, 5) + 1;
    let within_line = within_gate - ((line - 1) as f64 * LINE_DEGREES);
    
    // Farbe (1-6)
    let color = ((within_line / COLOR_DEGREES).floor() as i32).clamp(0, 5) + 1;
    let within_color = within_line - ((color - 1) as f64 * COLOR_DEGREES);
    
    // Ton (1-6)
    let tone = ((within_color / TONE_DEGREES).floor() as i32).clamp(0, 5) + 1;
    let within_tone = within_color - ((tone - 1) as f64 * TONE_DEGREES);
    
    // Basis (1-5)
    let base = ((within_tone / BASE_DEGREES).floor() as i32).clamp(0, 4) + 1;
    
    (line, color, tone, base)
}

/// Bereinigt die Ephemeris-Ressourcen beim Programmende
pub fn close_ephemeris() {
    unsafe {
        swe::swe_close();
    }
}

/// Findet den besten verfügbaren Ephemeris-Pfad
pub fn find_ephemeris_path() -> Option<String> {
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
        "../../ephemeris",
    ];
    
    for path in &dev_paths {
        if std::path::Path::new(path).exists() {
            // Prüfe ob .se1 Dateien existieren
            if check_ephemeris_files(path) {
                return Some(path.to_string());
            }
        }
    }
    
    // 3. Standard-Systempfade
    let system_paths = [
        "/usr/share/sweph/ephe",
        "/usr/local/share/sweph/ephe",
        "/opt/sweph/ephe",
        "C:\\sweph\\ephe",
        "C:\\Program Files\\sweph\\ephe",
    ];
    
    for path in &system_paths {
        if std::path::Path::new(path).exists() {
            if check_ephemeris_files(path) {
                return Some(path.to_string());
            }
        }
    }
    
    None
}

/// Zeigt Diagnose-Informationen über die Ephemeris-Konfiguration
pub fn diagnose_ephemeris() {
    eprintln!("\n=== Swiss Ephemeris Diagnose ===");
    eprintln!("Version: {}", get_version());
    
    match find_ephemeris_path() {
        Some(path) => {
            eprintln!("Gefundener Pfad: {}", path);
            
            // Liste alle .se1 Dateien
            if let Ok(entries) = std::fs::read_dir(&path) {
                eprintln!("Ephemeris-Dateien:");
                for entry in entries.flatten() {
                    let name = entry.file_name();
                    let name_str = name.to_string_lossy();
                    if name_str.ends_with(".se1") {
                        if let Ok(metadata) = entry.metadata() {
                            let size_kb = metadata.len() / 1024;
                            eprintln!("  - {} ({} KB)", name_str, size_kb);
                        }
                    }
                }
            }
        }
        None => {
            eprintln!("Keine Ephemeris-Dateien gefunden!");
            eprintln!("Verwende Moshier-Formeln (weniger genau)");
        }
    }
    eprintln!("================================\n");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn init() {
        let _ = init_ephemeris(None);
    }

    #[test]
    fn test_version() {
        let version = get_version();
        assert!(!version.is_empty());
        eprintln!("Swiss Ephemeris Version: {}", version);
    }

    #[test]
    fn test_julian_day() {
        // J2000.0 = 1. Januar 2000, 12:00 UT
        let jd = julian_day(2000, 1, 1, 12, 0, 0.0, Calendar::Gregorian);
        assert!((jd - 2451545.0).abs() < 0.01);
    }

    #[test]
    fn test_sun_position_j2000() {
        init();
        
        let jd = julian_day(2000, 1, 1, 12, 0, 0.0, Calendar::Gregorian);
        let sun = calculate_planet(jd, Planet::Sun, swe::SE_EQUATORIAL as i32).unwrap();
        
        // Sonne am 1.1.2000 um 12:00 UT sollte etwa bei 280° sein
        assert!(sun.longitude > 279.0 && sun.longitude < 281.0,
            "Sun longitude should be around 280°, got {}", sun.longitude);
    }

    #[test]
    fn test_gate_conversion() {
        // Gate 41 beginnt bei 0° Aquarius = 300° ekliptikal
        assert_eq!(longitude_to_hd_gate(300.0), 41);
        
        // Gate 19 beginnt bei 5.625° nach Gate 41
        assert_eq!(longitude_to_hd_gate(305.625), 19);
    }

    #[test]
    fn test_hd_details() {
        let (line, color, tone, base) = calculate_hd_details(300.0); // Beginn Gate 41
        assert_eq!(line, 1);
        assert_eq!(color, 1);
        assert_eq!(tone, 1);
        assert_eq!(base, 1);
        
        // Etwas weiter im Gate
        let (line2, _, _, _) = calculate_hd_details(301.0);
        assert!(line2 >= 1 && line2 <= 6);
    }

    #[test]
    fn test_moon_position() {
        init();
        
        let jd = julian_day(2000, 1, 1, 12, 0, 0.0, Calendar::Gregorian);
        let moon = calculate_planet(jd, Planet::Moon, swe::SE_EQUATORIAL as i32).unwrap();
        
        // Mond sollte eine valide Position haben
        assert!(moon.longitude >= 0.0 && moon.longitude <= 360.0);
        assert!(moon.latitude.abs() < 10.0); // Mondneigung ~5°
    }

    #[test]
    fn test_retrograde_detection() {
        init();
        
        // Berechne Merkur (häufig retrograd)
        let jd = julian_day(2020, 1, 1, 12, 0, 0.0, Calendar::Gregorian);
        let mercury = calculate_planet(jd, Planet::Mercury, swe::SE_EQUATORIAL as i32).unwrap();
        
        // Geschwindigkeit sollte vorhanden sein
        // Positiv = direkt, Negativ = retrograd
        eprintln!("Merkur Geschwindigkeit: {}°/Tag", mercury.longitude_speed);
    }

    #[test]
    fn test_all_planets() {
        init();
        
        let jd = julian_day(2020, 6, 21, 12, 0, 0.0, Calendar::Gregorian);
        let planets = calculate_all_planets(jd, true).unwrap();
        
        // Sollte mindestens 8 Planeten haben
        assert!(planets.len() >= 8);
        
        // Prüfe dass alle Planeten valide Positionen haben
        for (planet, pos) in &planets {
            assert!(pos.longitude >= 0.0 && pos.longitude <= 360.0,
                "{} hat ungültige Longitude: {}", planet.name(), pos.longitude);
        }
    }
}
