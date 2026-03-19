use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonData {
    pub birth_date: String, // Format: "DD.MM.YYYY"
    pub full_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MillmanProfile {
    // Life Path (Hauptlebensweg)
    pub life_path_string: String, // e.g., "35/8"
    pub root_1: i32,              // 3
    pub root_2: i32,              // 5
    pub base_sum: i32,            // 35
    pub destiny_number: i32,      // 8
    
    // Flags for special cases
    pub has_master_number: bool,
    pub has_zero_enhancer: bool,
    
    // Secondary paths
    pub soul_urge_string: Option<String>,   // Vowels
    pub expression_string: Option<String>,  // Consonants
    
    // Challenges and pinnacles
    pub challenges: Vec<Challenge>,
    pub pinnacles: Vec<Pinnacle>,
    
    // Personal year
    pub personal_year: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Challenge {
    pub age_range: String,
    pub challenge_number: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pinnacle {
    pub age_range: String,
    pub pinnacle_number: i32,
}

#[derive(Debug)]
pub struct NumerologyError {
    pub message: String,
}

impl std::fmt::Display for NumerologyError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for NumerologyError {}

// Master numbers in Dan Millman system
const MASTER_NUMBERS: [i32; 2] = [11, 22];

// Check if a number is a master number
fn is_master_number(n: i32) -> bool {
    MASTER_NUMBERS.contains(&n)
}

// Reduce a number to single digit, preserving master numbers
fn reduce_number(n: i32) -> i32 {
    if is_master_number(n) {
        return n;
    }
    
    let mut result = n;
    while result > 9 && !is_master_number(result) {
        result = result.to_string()
            .chars()
            .filter_map(|c| c.to_digit(10))
            .map(|d| d as i32)
            .sum();
    }
    result
}

// Calculate full reduction showing all steps
fn calculate_full_reduction(n: i32) -> (i32, Vec<i32>) {
    let mut steps = vec![n];
    let mut current = n;
    
    while current > 9 && !is_master_number(current) {
        current = current.to_string()
            .chars()
            .filter_map(|c| c.to_digit(10))
            .map(|d| d as i32)
            .sum();
        steps.push(current);
    }
    
    (current, steps)
}

// Parse birth date string
fn parse_birth_date(date_str: &str) -> Result<(i32, i32, i32), Box<dyn std::error::Error>> {
    let parts: Vec<&str> = date_str.split('.').collect();
    if parts.len() != 3 {
        return Err("Invalid date format. Use DD.MM.YYYY".into());
    }
    
    let day = parts[0].parse::<i32>()?;
    let month = parts[1].parse::<i32>()?;
    let year = parts[2].parse::<i32>()?;
    
    Ok((day, month, year))
}

// Calculate life path from birth date
fn calculate_life_path(day: i32, month: i32, year: i32) -> (String, i32, i32, i32, i32, bool, bool) {
    // Reduce each component
    let (reduced_day, day_steps) = calculate_full_reduction(day);
    let (reduced_month, month_steps) = calculate_full_reduction(month);
    let (reduced_year, year_steps) = calculate_full_reduction(year);
    
    // Calculate base sum
    let base_sum = reduced_day + reduced_month + reduced_year;
    
    // Check for zero enhancer (if any component had a 0 in original)
    let has_zero_enhancer = day.to_string().contains('0') || 
                           month.to_string().contains('0') || 
                           year.to_string().contains('0');
    
    // Check for master numbers in the path
    let has_master_number = is_master_number(base_sum) ||
                           day_steps.iter().any(|&n| is_master_number(n)) ||
                           month_steps.iter().any(|&n| is_master_number(n)) ||
                           year_steps.iter().any(|&n| is_master_number(n));
    
    // Calculate destiny number (final reduction)
    let destiny_number = reduce_number(base_sum);
    
    // Determine root numbers (the two digits before final reduction)
    let root_1 = (base_sum / 10) as i32;
    let root_2 = (base_sum % 10) as i32;
    
    // Format life path string
    let life_path_string = if base_sum == destiny_number {
        format!("{}", destiny_number)
    } else {
        format!("{}/{}", base_sum, destiny_number)
    };
    
    (life_path_string, root_1, root_2, base_sum, destiny_number, has_master_number, has_zero_enhancer)
}

// Pythagorean numerology chart for letters
fn letter_to_number(c: char) -> Option<i32> {
    match c.to_ascii_uppercase() {
        'A' | 'J' | 'S' => Some(1),
        'B' | 'K' | 'T' => Some(2),
        'C' | 'L' | 'U' => Some(3),
        'D' | 'M' | 'V' => Some(4),
        'E' | 'N' | 'W' => Some(5),
        'F' | 'O' | 'X' => Some(6),
        'G' | 'P' | 'Y' => Some(7),
        'H' | 'Q' | 'Z' => Some(8),
        'I' | 'R' => Some(9),
        _ => None,
    }
}

// Check if a character is a vowel
fn is_vowel(c: char) -> bool {
    matches!(c.to_ascii_uppercase(), 'A' | 'E' | 'I' | 'O' | 'U')
}

// Calculate soul urge (vowels only)
fn calculate_soul_urge(name: &str) -> Option<String> {
    let vowel_sum: i32 = name
        .chars()
        .filter(|&c| is_vowel(c))
        .filter_map(letter_to_number)
        .sum();
    
    if vowel_sum == 0 {
        return None;
    }
    
    let reduced = reduce_number(vowel_sum);
    Some(if vowel_sum == reduced {
        format!("{}", reduced)
    } else {
        format!("{}/{}", vowel_sum, reduced)
    })
}

// Calculate expression (consonants only)
fn calculate_expression(name: &str) -> Option<String> {
    let consonant_sum: i32 = name
        .chars()
        .filter(|&c| !is_vowel(c) && c.is_alphabetic())
        .filter_map(letter_to_number)
        .sum();
    
    if consonant_sum == 0 {
        return None;
    }
    
    let reduced = reduce_number(consonant_sum);
    Some(if consonant_sum == reduced {
        format!("{}", reduced)
    } else {
        format!("{}/{}", consonant_sum, reduced)
    })
}

// Calculate challenges
fn calculate_challenges(day: i32, month: i32, year: i32) -> Vec<Challenge> {
    let reduced_day = reduce_number(day);
    let reduced_month = reduce_number(month);
    let reduced_year = reduce_number(year);
    
    let challenge_1 = (reduced_month - reduced_day).abs();
    let challenge_2 = (reduced_year - reduced_day).abs();
    let challenge_3 = (challenge_1 - challenge_2).abs();
    let challenge_4 = (reduced_month - reduced_year).abs();
    
    vec![
        Challenge {
            age_range: "0-30".to_string(),
            challenge_number: challenge_1,
        },
        Challenge {
            age_range: "30-38".to_string(),
            challenge_number: challenge_2,
        },
        Challenge {
            age_range: "38-46".to_string(),
            challenge_number: challenge_3,
        },
        Challenge {
            age_range: "46+".to_string(),
            challenge_number: challenge_4,
        },
    ]
}

// Calculate pinnacles
fn calculate_pinnacles(day: i32, month: i32, year: i32) -> Vec<Pinnacle> {
    let reduced_day = reduce_number(day);
    let reduced_month = reduce_number(month);
    let reduced_year = reduce_number(year);
    
    let pinnacle_1 = reduced_month + reduced_day;
    let pinnacle_2 = reduced_year + reduced_day;
    let pinnacle_3 = pinnacle_1 + pinnacle_2;
    let pinnacle_4 = reduced_month + reduced_year;
    
    vec![
        Pinnacle {
            age_range: "0-30".to_string(),
            pinnacle_number: reduce_number(pinnacle_1),
        },
        Pinnacle {
            age_range: "30-38".to_string(),
            pinnacle_number: reduce_number(pinnacle_2),
        },
        Pinnacle {
            age_range: "38-46".to_string(),
            pinnacle_number: reduce_number(pinnacle_3),
        },
        Pinnacle {
            age_range: "46+".to_string(),
            pinnacle_number: reduce_number(pinnacle_4),
        },
    ]
}

// Calculate personal year
fn calculate_personal_year(month: i32, day: i32, current_year: i32) -> i32 {
    let sum = reduce_number(month) + reduce_number(day) + reduce_number(current_year);
    reduce_number(sum)
}

pub fn calculate_millman_profile(person_data: PersonData) -> Result<MillmanProfile, Box<dyn std::error::Error>> {
    // Parse birth date
    let (day, month, year) = parse_birth_date(&person_data.birth_date)?;
    
    // Calculate life path
    let (life_path_string, root_1, root_2, base_sum, destiny_number, has_master_number, has_zero_enhancer) = 
        calculate_life_path(day, month, year);
    
    // Calculate secondary paths
    let soul_urge_string = calculate_soul_urge(&person_data.full_name);
    let expression_string = calculate_expression(&person_data.full_name);
    
    // Calculate challenges and pinnacles
    let challenges = calculate_challenges(day, month, year);
    let pinnacles = calculate_pinnacles(day, month, year);
    
    // Calculate personal year (using current year)
    let current_year = chrono::Local::now().year();
    let personal_year = calculate_personal_year(month, day, current_year);
    
    Ok(MillmanProfile {
        life_path_string,
        root_1,
        root_2,
        base_sum,
        destiny_number,
        has_master_number,
        has_zero_enhancer,
        soul_urge_string,
        expression_string,
        challenges,
        pinnacles,
        personal_year,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_reduce_number() {
        assert_eq!(reduce_number(35), 8);
        assert_eq!(reduce_number(11), 11); // Master number preserved
        assert_eq!(reduce_number(22), 22); // Master number preserved
        assert_eq!(reduce_number(123), 6); // 1+2+3 = 6
    }

    #[test]
    fn test_calculate_life_path() {
        // Test: 15.03.1990
        let (life_path, root_1, root_2, base, destiny, master, zero) = 
            calculate_life_path(15, 3, 1990);
        
        assert_eq!(life_path, "35/8");
        assert_eq!(root_1, 3);
        assert_eq!(root_2, 5);
        assert_eq!(base, 35);
        assert_eq!(destiny, 8);
        assert!(!master);
        assert!(zero); // 1990 contains 0
    }

    #[test]
    fn test_letter_to_number() {
        assert_eq!(letter_to_number('A'), Some(1));
        assert_eq!(letter_to_number('J'), Some(1));
        assert_eq!(letter_to_number('Z'), Some(8));
        assert_eq!(letter_to_number('1'), None);
    }
}
