#!/bin/bash
# Swiss Ephemeris Downloader
# Downloads .se1 ephemeris files for professional accuracy (±0.0001°)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# Default values
TARGET_PATH="../app/src-tauri/ephemeris"
TIME_RANGE="1800-2400"
BASE_URL="https://raw.githubusercontent.com/aloistr/swisseph/master/ephe"
VERIFY_CHECKSUMS=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--target)
            TARGET_PATH="$2"
            shift 2
            ;;
        -r|--range)
            TIME_RANGE="$2"
            shift 2
            ;;
        -v|--verify)
            VERIFY_CHECKSUMS=true
            shift
            ;;
        -h|--help)
            echo "Swiss Ephemeris Downloader"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -t, --target PATH    Target directory (default: ../app/src-tauri/ephemeris)"
            echo "  -r, --range RANGE    Time range: 1800-2400, 3000, or all (default: 1800-2400)"
            echo "  -v, --verify         Verify SHA-256 checksums after download"
            echo "  -h, --help           Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                                    # Download standard files"
            echo "  $0 -r 3000                           # Download extended range"
            echo "  $0 -t /usr/share/sweph/ephe          # Download to system path"
            echo "  $0 -v                                # Download and verify checksums"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use -h for help"
            exit 1
            ;;
    esac
done

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}Swiss Ephemeris Downloader${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "Target: ${YELLOW}$TARGET_PATH${NC}"
echo -e "Range:  ${YELLOW}$TIME_RANGE${NC}"
echo ""

# Create directory
mkdir -p "$TARGET_PATH"

# Define files based on range
declare -a FILES
declare -a DESCRIPTIONS
declare -a SIZES

case $TIME_RANGE in
    1800-2400)
        FILES=("sepl_18.se1" "semo_18.se1" "seas_18.se1")
        DESCRIPTIONS=("Planets (1800-2400 CE)" "Moon (1800-2400 CE)" "Asteroids (1800-2400 CE)")
        SIZES=("~400 KB" "~800 KB" "~200 KB")
        ;;
    3000)
        FILES=("seplm18.se1" "semom18.se1" "seasm18.se1")
        DESCRIPTIONS=("Planets (3000 BCE - 3000 CE)" "Moon (3000 BCE - 3000 CE)" "Asteroids (3000 BCE - 3000 CE)")
        SIZES=("~3 MB" "~6 MB" "~2 MB")
        ;;
    all)
        FILES=("sepl_18.se1" "semo_18.se1" "seplm18.se1" "semom18.se1" "seplm54.se1" "sefstars.txt")
        DESCRIPTIONS=("Planets (1800-2400)" "Moon (1800-2400)" "Planets (3000 BCE-3000 CE)" "Moon (3000 BCE-3000 CE)" "Planets (13201 BCE-17191 CE)" "Fixed stars")
        SIZES=("~400 KB" "~800 KB" "~3 MB" "~6 MB" "~36 MB" "~300 KB")
        ;;
    *)
        echo -e "${RED}Invalid time range: $TIME_RANGE${NC}"
        echo "Valid options: 1800-2400, 3000, all"
        exit 1
        ;;
esac

SUCCESS_COUNT=0
FAIL_COUNT=0

# Download files
for i in "${!FILES[@]}"; do
    FILE="${FILES[$i]}"
    DESC="${DESCRIPTIONS[$i]}"
    SIZE="${SIZES[$i]}"
    URL="$BASE_URL/$FILE"
    OUTPUT="$TARGET_PATH/$FILE"
    
    echo -n "Downloading: $FILE"
    echo -e " ${GRAY}($DESC, $SIZE)${NC}"
    
    if curl -fsSL "$URL" -o "$OUTPUT" 2>/dev/null; then
        FILE_SIZE=$(du -h "$OUTPUT" | cut -f1)
        echo -e "  ${GREEN}✓ Success ($FILE_SIZE)${NC}"
        ((SUCCESS_COUNT++))
    else
        echo -e "  ${RED}✗ Failed${NC}"
        ((FAIL_COUNT++))
        continue
    fi
    
    # Verify checksum if requested and checksum file exists
    if [ "$VERIFY_CHECKSUMS" = true ]; then
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        CHECKSUM_FILE="$SCRIPT_DIR/ephemeris-checksums.sha256"
        if [ -f "$CHECKSUM_FILE" ]; then
            EXPECTED=$(grep "${FILE}$" "$CHECKSUM_FILE" | awk '{print $1}')
            if [ -n "$EXPECTED" ]; then
                ACTUAL=$(sha256sum "$OUTPUT" | awk '{print $1}')
                if [ "$EXPECTED" = "$ACTUAL" ]; then
                    echo -e "  ${GREEN}  ✓ Checksum verified${NC}"
                else
                    echo -e "  ${RED}  ✗ Checksum mismatch! File may be corrupted.${NC}"
                    echo -e "  ${GRAY}    Expected: $EXPECTED${NC}"
                    echo -e "  ${GRAY}    Actual:   $ACTUAL${NC}"
                    ((FAIL_COUNT++))
                fi
            else
                echo -e "  ${YELLOW}  ⚠ No checksum found for $FILE${NC}"
                echo -e "  ${GRAY}    Add it to: $CHECKSUM_FILE${NC}"
            fi
        else
            echo -e "  ${YELLOW}  ⚠ Checksum file not found: $CHECKSUM_FILE${NC}"
        fi
    fi
done

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}Download Summary${NC}"
echo -e "${CYAN}========================================${NC}"
echo -e "Successful: ${GREEN}$SUCCESS_COUNT${NC}"
if [ $FAIL_COUNT -gt 0 ]; then
    echo -e "Failed:     ${RED}$FAIL_COUNT${NC}"
else
    echo -e "Failed:     ${GREEN}$FAIL_COUNT${NC}"
fi
echo ""

if [ $SUCCESS_COUNT -gt 0 ]; then
    echo -e "${YELLOW}Ephemeris files installed to:${NC}"
    echo "  $(cd "$TARGET_PATH" && pwd)"
    echo ""
    echo -e "${GREEN}You can now use professional accuracy (±0.0001°) in your calculations!${NC}"
    echo ""
    echo -e "${GRAY}To verify, run: cargo test in the src-tauri directory${NC}"
fi

if [ $FAIL_COUNT -gt 0 ]; then
    echo -e "${YELLOW}Some downloads failed. You can:${NC}"
    echo -e "  ${GRAY}1. Check your internet connection${NC}"
    echo -e "  ${GRAY}2. Try downloading manually from:${NC}"
    echo -e "     ${CYAN}https://github.com/aloistr/swisseph/tree/master/ephe${NC}"
    echo -e "  ${GRAY}3. The code will fall back to Moshier formulas (±0.1° accuracy)${NC}"
    exit 1
fi

exit 0
