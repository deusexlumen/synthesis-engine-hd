# Swiss Ephemeris Einrichtung - Professionelle Genauigkeit

## Warum ist das wichtig?

| Methode | Genauigkeit | Auswirkung auf HD |
|---------|-------------|-------------------|
| Moshier Formeln | ±0.1° | Planet kann im falschen Gate liegen |
| **Swiss Ephemeris** | **±0.0001°** | **Präzise Gate-Zuordnung** |

Da jedes Human Design Gate 5.625° groß ist, kann eine Abweichung von 0.1° bereits zu einem falschen Gate führen!

---

## Schnellstart

### 1. Ephemeris-Dateien herunterladen

**Windows (PowerShell):**
```powershell
cd scripts
.\download-ephemeris.ps1
```

**Linux/macOS (Bash):**
```bash
cd scripts
chmod +x download-ephemeris.sh
./download-ephemeris.sh
```

Dies lädt die erforderlichen Dateien (~1.4 MB) herunter:
- `sepl_18.se1` - Planeten (1800-2400)
- `semo_18.se1` - Mond (1800-2400)  
- `seas_18.se1` - Asteroiden (1800-2400)

### 2. Backend-Abhängigkeiten installieren

```bash
cd backend
npm install
```

### 3. Umgebungsvariable setzen (optional)

```bash
# Windows
$env:SE_EPHE_PATH = "C:\\path\\to\\ephemeris"

# Linux/macOS
export SE_EPHE_PATH=/path/to/ephemeris
```

---

## Genauigkeits-Validierung

### Test mit Ra Uru Hu Chart

```bash
curl -X POST http://localhost:3000/api/hd/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "year": 1948,
    "month": 4,
    "day": 28,
    "hour": 8,
    "minute": 14,
    "latitude": 45.5017,
    "longitude": -73.5673,
    "timezone": -5
  }'
```

**Erwartetes Ergebnis:**
- `energyType`: "MANIFESTOR"
- `profile`: "5/1"
- Sonnen-Gate: 9

### Health Check

```bash
curl http://localhost:3000/api/hd/health
```

Zeigt ob Ephemeris-Dateien verwendet werden:
```json
{
  "status": "ok",
  "usingEphemerisFiles": true,
  "version": "2.10.03"
}
```

---

## Architektur-Übersicht

### Web-Version Flow

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Browser   │ ───> │   Node.js API    │ ───> │  Swiss Ephemeris│
│  (Frontend) │      │   (Backend)      │      │    (.se1 files) │
└─────────────┘      └──────────────────┘      └─────────────────┘
                           │
                           v
                    ┌──────────────┐
                    │  PostgreSQL  │
                    │   (Prisma)   │
                    └──────────────┘
```

### Dateien

```
backend/
├── src/
│   ├── routes/
│   │   └── humanDesign.ts    # /calculate Endpoint
│   └── services/
│       └── ephemeris.ts      # Swiss Ephemeris Integration
└── ephemeris/                # .se1 Dateien
    ├── sepl_18.se1
    ├── semo_18.se1
    └── seas_18.se1
```

---

## Erweiterte Konfiguration

### Andere Zeiträume

Für historische Charts (vor 1800) oder zukünftige (nach 2400):

```powershell
# 3000 BCE bis 3000 CE (~11 MB)
.\download-ephemeris.ps1 -TimeRange "3000"

# Alles (13201 BCE bis 17191 CE, ~115 MB)
.\download-ephemeris.ps1 -TimeRange "all"
```

### Manuelle Installation

1. Dateien von [GitHub](https://github.com/aloistr/swisseph/tree/master/ephe) herunterladen
2. Nach `backend/ephemeris/` kopieren
3. Server neu starten

---

## Fehlerbehebung

### Problem: "No ephemeris files found"

**Lösung:**
```bash
# Prüfe ob Dateien existieren
ls backend/ephemeris/*.se1

# Falls nicht, erneut herunterladen
cd scripts && ./download-ephemeris.sh
```

### Problem: "Cannot find module 'sweph'"

**Lösung:**
```bash
cd backend
npm install sweph
```

### Problem: Ungenauigkeit trotz .se1 Dateien

**Prüfen:**
```bash
curl http://localhost:3000/api/hd/health
```

Wenn `usingEphemerisFiles: false`, prüfe:
1. Ist `SE_EPHE_PATH` korrekt gesetzt?
2. Existieren die Dateien im angegebenen Pfad?
3. Hat Node.js Lesezugriff?

---

## Lizenz-Hinweise

Die Swiss Ephemeris verwendet eine **duale Lizenz**:

1. **AGPL-3.0** (Open Source)
   - Quellcode muss offen sein
   - Keine Gebühren

2. **Professional License** (kommerziell)
   - Geschlossene Software möglich
   - Lizenzgebühr an [Astrodienst AG](https://www.astro.com/)

Für Open-Source-Projekte: **Keine Gebühren!**

---

## Zusammenfassung

| Schritt | Befehl | Status |
|---------|--------|--------|
| 1. Dateien herunterladen | `scripts/download-ephemeris.ps1` | ✅ |
| 2. Backend installieren | `npm install` | ✅ |
| 3. Server starten | `npm run dev` | ✅ |
| 4. Validieren | `curl /api/hd/health` | ✅ |

Nach diesen Schritten hast du **NASA JPL Genauigkeit** (±0.0001°) für alle Human Design Berechnungen!
