# Synthesis Engine

Eine transformative App, die Human Design, Gene Keys und Dan Millman Numerologie mit KI-gestützter Synthese verbindet.

## Features

### Core-Module

- **Human Design Chart** - Vollständige Berechnung mit BodyGraph-Visualisierung
- **Gene Keys** - Alle 64 Gene Keys mit Schatten, Gabe und Siddhi
- **Dan Millman Numerologie** - Lebensweg, Schicksal, Seelenverlangen und mehr
- **KI-Synthese** - Personalisierte Einblicke durch OpenAI/Anthropic/Google AI

### Zusätzliche Features

- **Planetare Transits** - Tägliche Planetenpositionen und Aktivierungen
- **Verschlüsseltes Journal** - AES-256-GCM verschlüsselte Einträge
- **PDF-Export** - Exportiere Charts und Reports als PDF
- **Einstellungen** - Umfassende App-Konfiguration

## Technologie-Stack

### Frontend
- React + TypeScript + Vite
- Tailwind CSS für Styling
- Framer Motion für Animationen
- Tauri v2 für Desktop-App

### Backend
- Rust (Tauri Commands) für lokale Berechnungen
- Node.js + Express für API
- Prisma ORM + PostgreSQL
- OpenAI/Anthropic/Google AI Integration

### Sicherheit
- AES-256-GCM Verschlüsselung für lokale Daten
- JWT-Authentifizierung
- Rate Limiting

## Installation

### Voraussetzungen
- Node.js 18+
- Rust (für Tauri)
- PostgreSQL (für Backend)

### Setup

```bash
# Frontend
npm install
npm run dev

# Backend
cd backend
npm install
npx prisma migrate dev
npm run dev

# Tauri Desktop
npm run tauri dev
```

## Verzeichnisstruktur

```
app/
├── src/
│   ├── components/     # React-Komponenten
│   ├── sections/       # Hauptsektionen
│   ├── lib/           # Utilities & Daten
│   ├── services/      # API-Services
│   └── types/         # TypeScript-Typen
├── src-tauri/         # Rust Backend
└── public/            # Statische Assets

backend/
├── src/
│   ├── routes/        # API-Routen
│   ├── services/      # Business-Logik
│   ├── middleware/    # Auth, Error Handling
│   └── lib/           # Utilities
└── prisma/            # Datenbank-Schema
```

## API-Endpunkte

### Auth
- `POST /api/auth/register` - Registrierung
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Profil abrufen

### Human Design
- `POST /api/hd/calculate` - Chart berechnen
- `GET /api/hd/profile/:id` - Profil abrufen

### Numerologie
- `POST /api/numerology/calculate` - Berechnung
- `GET /api/numerology/profile/:id` - Profil abrufen

### Transit
- `GET /api/transit/daily` - Tägliche Transits
- `GET /api/transit/today` - Heutige Transits
- `GET /api/transit/compare` - Vergleich mit Natal

### KI
- `POST /api/ai/chat` - Chat-Completion
- `POST /api/synthesis` - KI-Synthese

## Umgebungsvariablen

```env
# Backend
DATABASE_URL="postgresql://user:pass@localhost:5432/synthesis"
JWT_SECRET="your-secret"
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
GOOGLE_AI_API_KEY="..."

# Frontend
VITE_API_URL="http://localhost:3000"
```

## Lizenz

MIT
