# Changelog

## [1.1.1] - 2026-10-19

### Changed
- Verze zvýšena z 1.1.0 na 1.1.1
- Tlačítka `SSOA (dev)` a `SSOA (prod)` se nyní zobrazují zcela nezávisle na sobě – každé podle existence vlastní složky (`sSOA-Manifest` / `sSOA-Manifest-2`) a jejího `.mose` souboru v archivu
- Sekce „Jaguar umí“ na úvodní obrazovce doplněna o logo JAguaR (vpravo od seznamu, vertikálně převrácené)

## [1.1.0] - 2026-10-16

### Added
- **SSOA manifesty (dev/prod)** – podpora pro čtení a úpravu SSOA autentizačních tokenů (`.mose`) uložených v JAR
  - Tlačítka `SSOA (dev)` a `SSOA (prod)` se zobrazí, pokud archiv obsahuje odpovídající manifest, včetně jeho časového razítka
  - Modální editor tokenu: vlevo plaintextové pole pro token, vpravo automaticky dekódovaný header a payload (JSON náhled)
  - Validace tokenu v reálném čase (`Token je syntakticky validní.` / chybové hlášky při neplatném formátu)
  - Uložení změněného tokenu zpět do archivu tlačítkem `Uložit změny`
- **SSOA dekóder** – samostatný nástroj pro dekódování libovolného JWT/SSOA tokenu nezávisle na načteném manifestu
  - Dostupný tlačítkem `SSOA dekóder` na úvodní obrazovce
  - Zobrazí dekódovaný header a payload, bez možnosti uložení
- **Porovnávač manifestů** – nový nástroj pro porovnání manifestů ze dvou JAR/ZIP souborů vedle sebe
  - Dostupný tlačítkem `Porovnávač` na úvodní obrazovce
  - Samostatné načtení `Aplikace 1` a `Aplikace 2`, zobrazení SSOA časových razítek (zeleně při shodě, červeně při rozdílu)
  - Řádkový diff s barevným zvýrazněním přidaných, odebraných a změněných řádků
  - Souhrnné hlášení `Manifesty jsou shodné.` nebo `Manifesty se liší (odlišných řádků: N).`
- **Změna čísla verze** – hromadná změna verze napříč celým archivem
  - Tlačítko `Změnit číslo verze` načte aktuální verzi z manifestu (`version` / `Version` / `appVersion`) a nahradí ji zadanou hodnotou ve všech textových souborech uvnitř JAR/ZIP/složky
  - Třífázový průběh (zadání → probíhá změna → výsledek) s výpisem všech upravených souborů
  - Ošetření chybových stavů (verze nenalezena, žádný soubor neobsahoval hledaný řetězec)
- **Přepínač boolean příznaků** – automatické vyhledání všech boolean hodnot v manifestu (včetně vnořených polí a polí v poli) a jejich přepínání jedním klikem bez ruční úpravy JSON
- **Drag & drop kamkoliv do okna** – JAR, ZIP soubor nebo složku lze nyní přetáhnout kamkoliv do okna aplikace na úvodní obrazovce, nejen do dvou vyhrazených boxů
- **Vizuální efekty („trails“)** – barevné animované pruhy jako zpětná vazba při načtení, synchronizaci a uložení/exportu
- **Klávesová zkratka `Ctrl+T`** – rychlé přepnutí tmavého/světlého motivu z menu Zobrazení
- **Návod k použití** – nová sekce v README popisující krok za krokem práci s aplikací včetně SSOA manifestů, dekóderu, porovnávače a změny verze

### Changed
- Verze zvýšena z 1.0.2 na 1.1.0

### Fixed
- Zobrazení posledních platných boolean příznaků, pokud se JSON stane dočasně nevalidním (příznaky nezmizí, pouze se zašednou)


## [1.0.2] - 2026-05-11

### Added
- **Monaco Editor Integration** – Nahrazeno textové pole pokročilým JSON editorem s syntaxem a barvením
  - Zdarma dostupné klávesové zkratky (skládání kódu, zvýraznění hranatých závorek, atd.)
  - Přizpůsobené tmavé a světlé motivy sladěné s aplikací
- **Editor Expansion Mode** – Tlačítko pro roztažení editoru na celou obrazovku (ESC pro zavření)
- **Klávesové zkratky**
  - `Ctrl+S` / `Cmd+S` – Rychlé uložení manifestu
  - `Esc` – Zavření rozšířeného editoru
- **Theme Persistence** – Vybrané téma se nyní ukládá a obnovuje při dalším spuštění (electron-store)
- **Reset Button** – Tlačítko v sekci "Stav" pro rychlý návrat aplikace do výchozího stavu
- **UI Vylepšení**
  - Ikony emoji vedle cest souborů a manifestů (📁 pro složku, 📄 pro manifest, ZIP/JAR badge)
  - Zlepšen text inicializace na úvodní obrazovce
  - Vylepšená čitelnost informací o souborech (lepší rozestup, váha textu)
- **Homepage Content** – Nový blok "Jaguar umí:" se seznamem možností aplikace

### Changed
- Verze zvýšena z 1.0.1 na 1.0.2
- Původní textarea editor nahrazen Monaco Editorem
- Status text změněn z "Očekáván JAR, ZIP nebo složka." na "Nahrajte JAR, ZIP nebo složku."
- Menu item "Restart" přejmenován na "Reload"
- Vylepšená vizuální separace stavů (uložení, export, chyby)
- Větší mezera nad blokem "Stav" na úvodní obrazovce

### Fixed
- Stabilizace boolean flagů – pokud je JSON nevalidní, zobrazí se poslední platné flagy (nedostupné)
- Lepší prevence akcí během zpracování (save, export)

### Dependencies
- Přidáno `@monaco-editor/react` ^4.7.0
- Přidáno `monaco-editor` ^0.55.1
- Potvrzeno `electron-store` ^8.1.0
