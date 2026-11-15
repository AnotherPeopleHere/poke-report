# Poke Report

Sito per un gruppo di amici che giocano al Pokémon TCG nel formato **Standard 2026-27**.
Si usa dal browser o dal telefono, anche aggiunto alla schermata Home come un'app.

| Sezione | Cosa fa |
| --- | --- |
| Home | Widget da aggiungere, togliere e riordinare |
| Deck builder | Card pool Standard (regulation mark H, I, J), controllo di legalità, probabilità di apertura, import/export per Pokémon TCG Live |
| Meta | Quote degli archetipi e top 8 dei Regional recenti, da limitlesstcg.com |
| Consigli | Mazzi in forma, pick esotiche e mazzi adatti al proprio stile di gioco, calcolati sulle partite dei tornei online di play.limitlesstcg.com (Dragapult escluso di default) |
| Notizie | Novità sul gioco, con link alle fonti |
| Tornei | Registro personale: round Bo1/Bo3, primo o secondo, game per game; statistiche e matchup |
| Gruppo | Classifica e meta locale degli amici con lo stesso codice gruppo |
| Metafy | Coach in top 8 nei Regional e link personali |

## Come funziona

- **Sito statico** servito da GitHub Pages: `index.html`, `assets/`, `data/`.
- **Account e dati personali** su [Supabase](https://supabase.com): accesso con link via email, tabelle `profiles`, `decks`, `tournaments` protette da row-level security (`supabase/schema.sql`). Chi non accede usa il sito con i dati salvati nel proprio browser.
- **Aggiornamento automatico dei dati** ogni mattina con GitHub Actions (`.github/workflows/update-data.yml`):
  - `scripts/build_cards.py` — card pool legale da [PokemonTCG/pokemon-tcg-data](https://github.com/PokemonTCG/pokemon-tcg-data)
  - `scripts/build_names.py` — nomi delle carte in italiano, francese, spagnolo, tedesco e portoghese da [tcgdex/cards-database](https://github.com/tcgdex/cards-database), per importare liste esportate da TCG Live in altre lingue
  - `scripts/update_meta.py` — meta report e Regional recenti da limitlesstcg.com
  - `scripts/fetch_online.py` + `scripts/analyze.py` — tornei online delle ultime 3 settimane e calcolo dei consigli
- **Notizie**: aggiornate ogni giorno da un'attività programmata di Claude che modifica `data/news.json`.

## Configurazione (una volta sola)

1. **Database** — in Supabase apri *SQL Editor → New query*, incolla il contenuto di `supabase/schema.sql` e premi *Run*.
2. **Accesso via email** — in Supabase, *Authentication → URL Configuration*:
   - *Site URL*: `https://anotherpeoplehere.github.io/poke-report/`
   - *Redirect URLs*: aggiungi `https://anotherpeoplehere.github.io/poke-report/**`
3. **GitHub Pages** — nel repository, *Settings → Pages*: *Source* = *Deploy from a branch*, *Branch* = `main`, cartella `/ (root)`.
4. **Primo aggiornamento dei dati** — *Actions → Aggiorna dati → Run workflow* (poi parte da solo ogni giorno).

Il link per entrare via email usa il servizio di posta integrato di Supabase, che invia un numero limitato di email all'ora: per un gruppo di amici basta. Per volumi maggiori si può collegare un proprio SMTP in *Authentication → Emails*.

## Cambio di formato (rotazione)

Alla rotazione annuale modifica i regulation mark legali: variabile `LEGAL_MARKS` in `scripts/build_cards.py` (o come variabile d'ambiente nel workflow), e il testo "regulation mark H, I, J" in `index.html`.

## Sviluppo in locale

```bash
python3 -m http.server 8000
```

Poi apri http://localhost:8000.

## Fonti e note

Dati di gioco © The Pokémon Company, Nintendo, Game Freak, Creatures. Questo sito non è affiliato né approvato da loro.
Dati dei tornei da Limitless TCG; testi delle carte da PokemonTCG/pokemon-tcg-data. Le illustrazioni delle carte sono generate dal sito e non sono quelle ufficiali.
`assets/vendor/supabase-2.118.0.js` è la libreria @supabase/supabase-js (licenza MIT, vedi `assets/vendor/supabase-LICENSE.txt`).
