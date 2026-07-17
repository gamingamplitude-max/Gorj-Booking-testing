# GORJ BOOKING — v2 „Relief” (redesign 3D)

Platformă premium de turism montan pentru județul Gorj — acum un adevărat site de booking,
redesenat în același stil negru-auriu de lux, cu efecte 3D reale în toată pagina.

## Ce e nou în v2

### Booking real
- **Bară de căutare în hero** — destinație, check-in/out, persoane; filtrează cazările și precompletează formularul de rezervare
- **Grilă de carduri de cazare** cu preț/noapte, rating, facilități, buton „Rezervă" pe fiecare card
- **Filtre pe zonă** (Târgu Jiu, Rânca, Transalpina, Tismana, Baia de Fier), **filtru pe tip** și **sortare** (preț, rating)
- **Panou de detalii** cu galerie, distanțe, Google Maps embed și rezervare directă
- **Rezumat de preț live** — preț × nopți + ghid local (+€30), recalculat instant
- **Secțiune recenzii** (carusel 3D coverflow) și **FAQ** (accordion)
- **Bară sticky „Rezervă acum"** care apare la scroll și dispare când formularul e vizibil
- **Autentificare în modal** — apare doar când e nevoie (la trimiterea rezervării), nu mai ocupă pagina

### 3D peste tot
- **Teren 3D în timp real (Three.js)** — creste muntoase wireframe aurii peste imaginea hero, cu parallax la mouse și retragere la scroll + particule „praf de aur"
- **Motor universal de tilt 3D** — toate cardurile (destinații, cazări, galerie, statistici, formular) se înclină în perspectivă după cursor, cu straturi pop-out (`translateZ`) și reflexie de lumină mobilă
- **Carduri flip 3D** în banda de experiențe (rotire 180° pe hover/focus)
- **Coverflow 3D** pentru recenzii — cardurile laterale rotite în adâncime
- **Intrări de secțiune cu rotationX** — cardurile „se ridică" din pagină la scroll
- Efectul de ripple auriu la click în hero este păstrat din v1

### Calitate & performanță
- **Fonturi variabile self-hosted** (Cormorant Garamond, Josefin Sans, Playfair Display — WOFF2, fără CDN extern)
- **GSAP + ScrollTrigger + Three.js self-hosted** în `files/vendor/`
- Imagini optimizate (≈3× mai mici), denumiri de fișiere curate, fără spații
- `prefers-reduced-motion` respectat (dezactivează terenul 3D, tilt, autoplay)
- Fallback pe touch: conținutul cardurilor vizibil fără hover, tilt dezactivat
- Focus vizibil pentru tastatură; navigare din tastatură în carusel (săgeți) și Esc pentru modale

## Structura proiectului

```
app/
├── server.js          # Express + SQLite: register/login (JWT+bcrypt), rezervări
├── package.json
├── data/              # baza de date SQLite (creată la prima pornire)
└── files/
    ├── index.html
    ├── style.css
    ├── script.js
    ├── fonts/         # WOFF2 variabile self-hosted
    ├── vendor/        # gsap, ScrollTrigger, TextPlugin, three — min.js
    └── images/        # imagini optimizate (+ thumbs/)
```

## Rulare

```bash
cd app
npm install
npm start          # http://localhost:3000
```

Site-ul funcționează și **fără backend** (deschis direct `files/index.html`):
conturile și rezervările cad automat pe `localStorage`, cu aceeași logică de preț.
Cu backend pornit, rezervările se salvează și în SQLite prin API.

## API (același contract ca v1, extins)

- `POST /api/register` — nume, email, parolă (min. 6 caractere)
- `POST /api/login` — răspunde cu JWT (7 zile)
- `GET /api/profile` — profilul utilizatorului autentificat
- `GET /api/bookings` — rezervările utilizatorului
- `POST /api/bookings` — acum acceptă și `roomType`, `guideIncluded`, `guideFee`, `totalPrice`
  (migrare automată a schemei pentru baze de date v1 existente)

---
Created by **Teodor Becheanu** & **Popescu Alexandru**
