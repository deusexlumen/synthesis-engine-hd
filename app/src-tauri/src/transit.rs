//! Transit-Berechnungen mit Swiss Ephemeris
//!
//! Dieses Modul berechnet tägliche Planetentransits mit professioneller Genauigkeit.
//! Es verwendet die Swiss Ephemeris Bibliothek für präzise Planetenpositionen.

use serde::{Deserialize, Serialize};
use chrono::{NaiveDate, Utc};
use crate::ephemeris::{
    self, Planet, julian_day, Calendar, calculate_planet, longitude_to_hd_gate, calculate_hd_details
};
use libswe_sys as swe;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransitData {
    pub date: String,
    pub planets: Vec<TransitPlanet>,
    pub moon_phase: String,
    pub active_gates: Vec<i32>,
    pub daily_theme: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransitPlanet {
    pub name: String,
    pub longitude: f64,
    pub gate: i32,
    pub line: i32,
    pub color: i32,
    pub tone: i32,
    pub base: i32,
    pub retrograde: bool,
    pub zodiac_sign: String,
    pub zodiac_degree: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransitComparison {
    pub date: String,
    pub transits: Vec<PlanetTransit>,
    pub activated_gates: Vec<i32>,
    pub activated_channels: Vec<(i32, i32)>,
    pub themes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanetTransit {
    pub planet: String,
    pub transit_gate: i32,
    pub natal_gate: Option<i32>,
    pub aspect: String,
    pub influence: String,
}

// Human Design Mandala Gates
const MANDALA_GATES: [i32; 64] = [
    41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3,
    27, 24, 2, 23, 8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56,
    31, 33, 7, 4, 29, 59, 40, 64, 47, 6, 46, 18, 48, 57, 32, 50,
    28, 44, 1, 43, 14, 34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60
];

/// Initialisiert die Ephemeris für Transit-Berechnungen
fn init() -> Result<(), Box<dyn std::error::Error>> {
    ephemeris::init_ephemeris(None)?;
    Ok(())
}

/// Zodiac Sign berechnen
fn longitude_to_zodiac(longitude: f64) -> (String, f64) {
    let signs = [
        "Widder", "Stier", "Zwillinge", "Krebs", "Löwe", "Jungfrau",
        "Waage", "Skorpion", "Schütze", "Steinbock", "Wassermann", "Fische"
    ];
    
    let normalized = longitude.rem_euclid(360.0);
    let sign_index = (normalized / 30.0).floor() as usize;
    let degree_in_sign = normalized % 30.0;
    
    (signs[sign_index % 12].to_string(), degree_in_sign)
}

/// Mondphase berechnen
fn calculate_moon_phase(sun_lon: f64, moon_lon: f64) -> String {
    let elongation = (moon_lon - sun_lon).rem_euclid(360.0);
    
    match elongation {
        e if e < 22.5 || e >= 337.5 => "Neumond".to_string(),
        e if e >= 22.5 && e < 67.5 => "Zunehmende Sichel".to_string(),
        e if e >= 67.5 && e < 112.5 => "Erstes Viertel".to_string(),
        e if e >= 112.5 && e < 157.5 => "Zunehmender Mond".to_string(),
        e if e >= 157.5 && e < 202.5 => "Vollmond".to_string(),
        e if e >= 202.5 && e < 247.5 => "Abnehmender Mond".to_string(),
        e if e >= 247.5 && e < 292.5 => "Letztes Viertel".to_string(),
        e if e >= 292.5 && e < 337.5 => "Abnehmende Sichel".to_string(),
        _ => "Unbekannt".to_string(),
    }
}

/// Tägliches Theme basierend auf Sonnentor
fn daily_theme(sun_gate: i32) -> String {
    let themes: std::collections::HashMap<i32, &str> = [
        (1, "Selbstausdruck & Kreativität"),
        (2, "Receptivität & Empfangen"),
        (3, "Mutation & Veränderung"),
        (4, "Formulierung & Antworten"),
        (5, "Rhythmus & Muster"),
        (6, "Intimität & Konflikt"),
        (7, "Führung & Rolle"),
        (8, "Beitrag & Einfluss"),
        (9, "Konzentration & Fokus"),
        (10, "Selbstverhalten & Identität"),
        (11, "Ideen & Inspiration"),
        (12, "Vorsicht & Standhaftigkeit"),
        (13, "Zuhören & Geheimnisse"),
        (14, "Macht & Vermögen"),
        (15, "Extreme & Rhythmen"),
        (16, "Enthusiasmus & Fähigkeiten"),
        (17, "Meinungen & Überzeugungen"),
        (18, "Korrektur & Perfektion"),
        (19, "Bedürfnisse & Wünsche"),
        (20, "Jetzt & Gegenwart"),
        (21, "Kontrolle & Durchsetzung"),
        (22, "Offenheit & Scham"),
        (23, "Vereinfachung & Assimilation"),
        (24, "Rückkehr & Wiederholung"),
        (25, "Innocenz & Liebe"),
        (26, "Täuschung & Manipulation"),
        (27, "Fürsorge & Ernährung"),
        (28, "Risiko & Tiefe"),
        (29, "Commitment & Ja-Sagen"),
        (30, "Intensität & Gefühl"),
        (31, "Einfluss & Führung"),
        (32, "Kontinuität & Erinnerung"),
        (33, "Rückzug & Privatsphäre"),
        (34, "Macht & Autorität"),
        (35, "Veränderung & Fortschritt"),
        (36, "Krise & Erfahrung"),
        (37, "Freundschaft & Gemeinschaft"),
        (38, "Kampf & Druck"),
        (39, "Provokation & Konfrontation"),
        (40, "Einsamkeit & Übertragung"),
        (41, "Phantasie & Träume"),
        (42, "Wachstum & Reifung"),
        (43, "Einsicht & Verständnis"),
        (44, "Instinkt & Überleben"),
        (45, "Sammlung & Besitz"),
        (46, "Determination & Serendipität"),
        (47, "Realisation & Abstraktion"),
        (48, "Tiefe & Kompetenz"),
        (49, "Prinzipien & Revolution"),
        (50, "Werte & Gesetze"),
        (51, "Schock & Erweckung"),
        (52, "Inaktivität & Konzentration"),
        (53, "Beginn & Start"),
        (54, "Transformation & Treiben"),
        (55, "Freiheit & Geist"),
        (56, "Wanderung & Suche"),
        (57, "Intuition & Klarheit"),
        (58, "Vitalität & Lebendigkeit"),
        (59, "Sexualität & Dispersion"),
        (60, "Einschränkung & Akzeptanz"),
        (61, "Mystery & Wissen"),
        (62, "Details & Fakten"),
        (63, "Doubt & Verdacht"),
        (64, "Verwirrung & Vor-Logik"),
    ].iter().cloned().collect();
    
    themes.get(&sun_gate).unwrap_or(&"Allgemeine Transformation").to_string()
}

/// Berechnet Transit-Daten für ein Datum mit Swiss Ephemeris
///
/// # Arguments
/// * `year` - Jahr
/// * `month` - Monat (1-12)
/// * `day` - Tag (1-31)
///
/// # Returns
/// * `TransitData` mit allen Planetenpositionen
pub fn calculate_daily_transit(year: i32, month: u32, day: u32) -> Result<TransitData, Box<dyn std::error::Error>> {
    init()?;
    
    // Mittag des Tages (12:00 UT) für Berechnung
    let jd = julian_day(year, month as i32, day as i32, 12, 0, 0.0, Calendar::Gregorian);
    let iflag = swe::SE_EQUATORIAL as i32;
    
    // Alle Planeten berechnen
    let planets_data = vec![
        (Planet::Sun, "Sonne".to_string(), false),
        (Planet::Moon, "Mond".to_string(), false),
        (Planet::Mercury, "Merkur".to_string(), true),
        (Planet::Venus, "Venus".to_string(), true),
        (Planet::Mars, "Mars".to_string(), true),
        (Planet::Jupiter, "Jupiter".to_string(), true),
        (Planet::Saturn, "Saturn".to_string(), true),
        (Planet::Uranus, "Uranus".to_string(), true),
        (Planet::Neptune, "Neptun".to_string(), true),
        (Planet::Pluto, "Pluto".to_string(), true),
        (Planet::MeanNode, "Nordknoten".to_string(), false),
    ];
    
    let mut planets = Vec::new();
    let mut sun_longitude = 0.0;
    let mut moon_longitude = 0.0;
    
    for (planet, name, check_retrograde) in planets_data {
        let pos = calculate_planet(jd, planet, iflag)?;
        let longitude = pos.longitude;
        let gate = longitude_to_hd_gate(longitude);
        let (line, color, tone, base) = calculate_hd_details(longitude);
        let (zodiac_sign, zodiac_degree) = longitude_to_zodiac(longitude);
        
        // Retrograd-Status: Negative Geschwindigkeit = Retrograd
        let retrograde = if check_retrograde {
            pos.longitude_speed < 0.0
        } else {
            false
        };
        
        // Speichere Sonne und Mond für Mondphase
        if matches!(planet, Planet::Sun) {
            sun_longitude = longitude;
        }
        if matches!(planet, Planet::Moon) {
            moon_longitude = longitude;
        }
        
        planets.push(TransitPlanet {
            name,
            longitude,
            gate,
            line,
            color,
            tone,
            base,
            retrograde,
            zodiac_sign,
            zodiac_degree,
        });
    }
    
    // Mondphase berechnen
    let moon_phase = calculate_moon_phase(sun_longitude, moon_longitude);
    
    // Aktive Gates sammeln
    let active_gates: Vec<i32> = planets.iter().map(|p| p.gate).collect();
    
    // Sonnentor für daily theme
    let sun_gate = planets.iter()
        .find(|p| p.name == "Sonne")
        .map(|p| p.gate)
        .unwrap_or(1);
    
    let daily_theme_text = daily_theme(sun_gate);
    
    Ok(TransitData {
        date: format!("{:04}-{:02}-{:02}", year, month, day),
        planets,
        moon_phase,
        active_gates,
        daily_theme: daily_theme_text,
    })
}

/// Vergleicht Transit mit Natal-Chart
///
/// # Arguments
/// * `transit_date` - (Jahr, Monat, Tag) des Transits
/// * `natal_gates` - Liste der natalen Gates
///
/// # Returns
/// * `TransitComparison` mit aktivierten Gates und Einflüssen
pub fn compare_transit_to_natal(
    transit_date: (i32, u32, u32),
    natal_gates: Vec<i32>,
) -> Result<TransitComparison, Box<dyn std::error::Error>> {
    let transit = calculate_daily_transit(transit_date.0, transit_date.1, transit_date.2)?;
    
    let mut planet_transits = Vec::new();
    let mut activated_gates = Vec::new();
    let mut themes = Vec::new();
    
    for planet in &transit.planets {
        // Prüfe ob Transit-Gate im Natal-Chart vorhanden
        if natal_gates.contains(&planet.gate) {
            activated_gates.push(planet.gate);
            
            let aspect = format!("{} transit Gate {}", planet.name, planet.gate);
            let influence = format!("{} aktiviert dein natal Gate {}", planet.name, planet.gate);
            
            planet_transits.push(PlanetTransit {
                planet: planet.name.clone(),
                transit_gate: planet.gate,
                natal_gate: Some(planet.gate),
                aspect,
                influence,
            });
            
            themes.push(format!("{}-Energie aktiviert", planet.name));
        }
    }
    
    // Entferne Duplikate
    activated_gates.sort_unstable();
    activated_gates.dedup();
    themes.sort_unstable();
    themes.dedup();
    
    Ok(TransitComparison {
        date: transit.date,
        transits: planet_transits,
        activated_gates,
        activated_channels: Vec::new(), // TODO: Kanäle prüfen
        themes,
    })
}

/// Heutige Transit-Daten
pub fn get_today_transit() -> Result<TransitData, Box<dyn std::error::Error>> {
    let today = Utc::now().naive_utc().date();
    calculate_daily_transit(today.year(), today.month(), today.day())
}

/// Transit für bestimmten Zeitraum
pub fn get_transit_range(
    start: NaiveDate,
    end: NaiveDate,
) -> Result<Vec<TransitData>, Box<dyn std::error::Error>> {
    let mut transits = Vec::new();
    let mut current = start;
    
    while current <= end {
        match calculate_daily_transit(current.year(), current.month(), current.day()) {
            Ok(transit) => transits.push(transit),
            Err(_) => {}
        }
        current = current.succ_opt().unwrap_or(current);
    }
    
    Ok(transits)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_transit_calculation() {
        let transit = calculate_daily_transit(2024, 1, 1).expect("Transit calculation failed");
        
        // Prüfe dass alle Planeten vorhanden sind
        assert_eq!(transit.planets.len(), 11);
        
        // Prüfe dass Sonne vorhanden ist
        let sun = transit.planets.iter().find(|p| p.name == "Sonne");
        assert!(sun.is_some());
        
        // Prüfe Mondphase
        assert!(!transit.moon_phase.is_empty());
        
        println!("Transit for 2024-01-01:");
        println!("  Moon Phase: {}", transit.moon_phase);
        println!("  Sun Gate: {}", sun.unwrap().gate);
        println!("  Active Gates: {:?}", transit.active_gates);
    }

    #[test]
    fn test_moon_phases() {
        // Neumond: Sonne und Mond zusammen
        assert_eq!(calculate_moon_phase(0.0, 0.0), "Neumond");
        assert_eq!(calculate_moon_phase(100.0, 100.0), "Neumond");
        
        // Vollmond: Mond 180° von Sonne entfernt
        assert_eq!(calculate_moon_phase(0.0, 180.0), "Vollmond");
        
        // Erstes Viertel: Mond 90° vor Sonne
        assert_eq!(calculate_moon_phase(0.0, 90.0), "Erstes Viertel");
        
        // Letztes Viertel: Mond 270° von Sonne (oder -90°)
        assert_eq!(calculate_moon_phase(0.0, 270.0), "Letztes Viertel");
    }

    #[test]
    fn test_zodiac_conversion() {
        let (sign, deg) = longitude_to_zodiac(0.0);
        assert_eq!(sign, "Widder");
        assert_eq!(deg, 0.0);
        
        let (sign, deg) = longitude_to_zodiac(30.0);
        assert_eq!(sign, "Stier");
        assert_eq!(deg, 0.0);
        
        let (sign, deg) = longitude_to_zodiac(300.0);
        assert_eq!(sign, "Wassermann");
        assert_eq!(deg, 0.0);
    }

    #[test]
    fn test_transit_comparison() {
        let natal_gates = vec![1, 10, 20, 34, 57];
        let comparison = compare_transit_to_natal((2024, 1, 1), natal_gates)
            .expect("Transit comparison failed");
        
        println!("Activated gates: {:?}", comparison.activated_gates);
        println!("Themes: {:?}", comparison.themes);
        
        // Mindestens einige Gates sollten übereinstimmen (wahrscheinlich)
        // Wir prüfen nur dass die Struktur korrekt ist
        assert!(!comparison.date.is_empty());
    }
}
