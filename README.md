# FLYDES Platform

Aplikacja webowa do konfiguracji oraz zamawiania personalizowanych części samochodowych (lotki / spoilery, druk 3D), zrealizowana w ramach pracy inżynierskiej.

**Stos technologiczny:** Next.js (App Router) + TypeScript + PostgreSQL + Prisma + Auth.js (NextAuth v5).

---

## Wymagania

- **Node.js** 20+
- **npm**
- **Docker Desktop** (lokalny PostgreSQL przez `docker compose`)

---

## Uruchomienie lokalne

```bash
# 1. Zależności
npm install

# 2. Zmienne środowiskowe
cp .env.example .env
# Windows (PowerShell): Copy-Item .env.example .env
# opcjonalnie ustaw własny AUTH_SECRET (np. openssl rand -base64 32)

# 3. Baza PostgreSQL
docker compose up -d

# 4. Migracje i dane przykładowe
npx prisma migrate dev
npm run db:seed

# 5. Serwer developerski
npm run dev
```

Aplikacja uruchamia się pod adresem [http://localhost:3000](http://localhost:3000).

Weryfikacja buildu produkcyjnego: `npm run build` → `npm start`.

### Reset bazy danych

```bash
npm run db:reset
```

Czyści bazę danych, wykonuje migracje od zera i zasila przykładowy katalog.

---

## Konta testowe

| Rola  | E-mail               | Hasło       |
|-------|----------------------|-------------|
| ADMIN | `admin@flydes.local` | `Admin123!` |
| USER  | `user@flydes.local`  | `User123!`  |

Domyślne hasła seeda można nadpisać zmiennymi środowiskowymi `SEED_ADMIN_PASSWORD` oraz `SEED_USER_PASSWORD`.

---

## Funkcjonalności

- **Konfigurator katalogowy:** wybór pojazdu krok po kroku (`marka → model → generacja → część`) z interaktywnym podglądem 3D (`@google/model-viewer`).
- **Koszyk i zamówienia katalogowe:** koszyk w `localStorage`, składanie zamówienia po zalogowaniu z serwerową weryfikacją aktywności części (`archivedAt: null`) oraz aktualności cen z bazy danych.
- **Wycena indywidualna (Custom):** kalkulator orientacyjnej ceny druku 3D, opcjonalny upload geometrii (`STL`, `OBJ`, `3MF`) z walidacją zawartości, zapisem poza `public/` (`uploads/custom/`) i autoryzowanym pobieraniem przez `/api/uploads/custom/[filename]`.
- **Panel administratora:** zarządzanie katalogiem części (dodawanie, edycja, miękka archiwizacja, bezpieczne usuwanie), zmiana statusów zamówień oraz akceptacja/odrzucanie wycen custom z korektą ceny i notatką.
- **Założenia i zakres MVP:** aplikacja korzysta z przykładowego katalogu (marki reprezentowane są przez inicjały i kolor UI bez znaków towarowych OEM, a grafiki w `/public/parts/` mają charakter poglądowy), nie zawiera integracji z zewnętrzną bramką płatności ani pełnego panelu CRUD dla hierarchii Brand / Model / Generation.

### Atrybucja modeli 3D (CC-BY-4.0)

Przykładowe modele 3D w `/public/models/` pochodzą ze Sketchfab i są udostępniane na licencji [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/):

- `car_spoiler.glb` - *Car Spoiler*, autor: [Prasad_bhushi](https://sketchfab.com/Prasad_bhushi), źródło: [Sketchfab](https://sketchfab.com/3d-models/car-spoiler-98576be85f3f4867b16a31b20104da30), licencja: CC-BY-4.0
- `drag_spoiler.glb` - *drag spoiler*, autor: [ベータBETAベータ](https://sketchfab.com/max_ar99), źródło: [Sketchfab](https://sketchfab.com/3d-models/drag-spoiler-d7a8d7d46c74435ea556c33afcecd9da), licencja: CC-BY-4.0
- `universal_spoiler_1.glb` - *Universal Spoiler 1*, autor: [the_86_guy](https://sketchfab.com/the_86_guy), źródło: [Sketchfab](https://sketchfab.com/3d-models/universal-spoiler-1-5e118ed64b6b4cdb9b5a2931c06a0bc4), licencja: CC-BY-4.0

---

## Ścieżki aplikacji

| Ścieżka | Opis |
|---------|------|
| `/` | Strona startowa |
| `/konfigurator` | Konfigurator katalogowy |
| `/wycena` | Wycena indywidualna |
| `/koszyk` | Koszyk i złożenie zamówienia |
| `/zamowienie/[id]` | Szczegóły i potwierdzenie zamówienia |
| `/zamowienia` | Lista zamówień zalogowanego użytkownika |
| `/login`, `/register` | Logowanie i rejestracja (`Credentials`) |
| `/admin` | Panel administratora (`ADMIN`) |

**Role:** `USER` / `ADMIN` · **Statusy zamówień:** `NEW` → `IN_PROGRESS` → `COMPLETED` / `REJECTED`

---

## Skrypty

| Skrypt | Opis |
|--------|------|
| `npm run dev` | serwer developerski |
| `npm run build` | generowanie klienta Prisma + build produkcyjny |
| `npm start` | uruchomienie buildu produkcyjnego |
| `npm run lint` | kontrola ESLint |
| `npm test` | testy jednostkowe (`node:test` + `tsx`) |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:migrate:deploy` | `prisma migrate deploy` |
| `npm run db:seed` | zasilenie bazy danymi przykładowymi |
| `npm run db:reset` | reset migracji i ponowny seed |

---

## Wdrożenie (Vercel + Neon)

1. Utwórz projekt PostgreSQL w [Neon](https://neon.tech) i skopiuj connection string (`DATABASE_URL`).
2. Wykonaj migracje i seed na docelowej bazie:
   ```bash
   export DATABASE_URL="postgresql://..."
   export SEED_ADMIN_PASSWORD="silne-haslo-admina"
   npx prisma migrate deploy
   npm run db:seed
   ```
3. Zaimportuj repozytorium na [Vercel](https://vercel.com) i skonfiguruj zmienne środowiskowe:
   - `DATABASE_URL`
   - `AUTH_SECRET` (np. `openssl rand -base64 32`)
   - `AUTH_URL` (docelowy adres aplikacji, np. `https://twoja-aplikacja.vercel.app`)

> **Uwaga dotycząca środowiska serverless:** zapis przesłanych plików 3D korzysta lokalnie z katalogu `uploads/custom/`. W środowiskach z systemem plików tylko do odczytu (np. Vercel) upload załącznika zwraca komunikat o niedostępności zapisu, natomiast wycena bez pliku działa normalnie (pełny upload w chmurze wymaga podpięcia zewnętrznego object storage, np. Vercel Blob lub S3).

---

## Licencja

Kod źródłowy projektu jest udostępniany na licencji [MIT](LICENSE). Przykładowe modele 3D w `/public/models/` podlegają licencji CC-BY-4.0 (atrybucja powyżej).
