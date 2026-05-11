# Changelog

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
