# 🃏 SynCard

Karten- und Würfelspiele für Freunde, im Browser und am Handy. Einer erstellt einen Raum und schickt den Einladungslink herum, alle anderen spielen auf ihrem eigenen Gerät mit. Man braucht keine App und kein Konto.

---

## Inhalt

- [Die Spiele](#die-spiele)
- [Fernseher-Modus](#fernseher-modus)
- [Installation](#installation)
  - [Variante A: Hosting bei Render](#variante-a-hosting-bei-render)
  - [Variante B: Auf dem eigenen PC mit start.bat](#variante-b-auf-dem-eigenen-pc-mit-startbat)
- [Projektaufbau](#projektaufbau)

---

## Die Spiele

| Spiel | Art | Spieler | Online | An einem Gerät |
|---|---|---|---|---|
| Mensch ärgere dich nicht | Brettspiel | 2–4 | ✅ | ✅ |
| Kniffel | Würfelspiel | 1–10 | ✅ | ✅ |
| Phase 10 | Kartenspiel | 2–6 | ✅ | – |
| Schwimmen (31) | Kartenspiel | 2–8 | ✅ | – |
| Zauberstich | Stichspiel mit Ansagen | 2–6 | ✅ | – |
| Sternbilder | Kooperatives Kartenspiel | 2–5 | ✅ | – |
| Eroberungsspiel | Strategiespiel | 2–6 | – | ✅ |

### Mensch ärgere dich nicht
Der Klassiker. Mit einer 6 kommst du aus dem Haus. Landest du auf einer gegnerischen Figur, fliegt sie raus. Wer zuerst alle vier Figuren im Ziel hat, gewinnt.

### Kniffel
Du würfelst bis zu dreimal pro Zug und kannst dazwischen beliebige Würfel festhalten. Danach trägst du das Ergebnis in ein freies Feld ein: Einer bis Sechser, Dreier- und Viererpasch, Full House, kleine und große Straße, Kniffel oder Chance. Wer im oberen Block 63 Punkte erreicht, bekommt 35 Bonuspunkte. Am Ende gewinnt die höchste Gesamtpunktzahl.

### Phase 10
Es gibt 108 Karten: Zahlen von 1 bis 12 in vier Farben, dazu 8 Joker und 4 Aussetzen-Karten. In jedem Zug ziehst du eine Karte (vom Stapel oder vom Ablagestapel) und legst danach eine ab. Ziel ist es, nacheinander die zehn Phasen zu erfüllen:

1. 2 Drillinge
2. Drilling + Viererfolge
3. Vierling + Viererfolge
4. Siebenerfolge
5. Achterfolge
6. Neunerfolge
7. 2 Vierlinge
8. 7 Karten einer Farbe
9. Fünfling + Zwilling
10. Fünfling + Drilling

Hast du deine Phase ausgelegt, darfst du Karten bei dir und bei anderen anlegen. Liegt in einer Folge ein Joker an der Stelle einer Zahl, die du auf der Hand hast, kannst du ihn austauschen. Wer zuerst Phase 10 schafft, gewinnt.
**Option Strafpunkte:** Alle Karten, die am Ende einer Runde noch auf der Hand sind, zählen als Minuspunkte: 1–9 zählen 5, 10–12 zählen 10, Aussetzen zählt 15 und ein Joker 25. Schaffen mehrere gleichzeitig Phase 10, gewinnt, wer die wenigsten Strafpunkte hat.

### Schwimmen (31)
Gespielt wird mit einem Skatblatt (32 Karten). Jeder hat 3 Karten auf der Hand, und 3 weitere liegen offen in der Mitte. In deinem Zug hast du vier Möglichkeiten:
- **Tauschen:** eine Karte deiner Hand gegen eine aus der Mitte.
- **Alle tauschen:** deine ganze Hand gegen die Mitte.
- **Schieben:** nichts tun. Schieben alle hintereinander, kommen drei neue Karten in die Mitte.
- **Zumachen:** Jeder andere ist noch genau einmal dran, dann wird aufgedeckt.

Es zählt die höchste Summe einer Farbe: Ass 11, Bildkarten und 10 zählen 10, die anderen Karten ihren Zahlenwert. Drei gleiche Werte zählen 30,5, drei Asse („Feuer“) zählen 33. Wer 31 oder Feuer hat, deckt sofort auf. Wer am Ende einer Runde am wenigsten hat, verliert ein Leben. Bei Feuer verlieren alle anderen ein Leben. Nach 3 Leben „schwimmst“ du, und beim nächsten Verlust bist du raus. Wer als Letzter übrig bleibt, gewinnt.
Liegen 7, 8 und 9 in der Mitte, darfst du sie gegen drei neue Karten tauschen lassen.

### Zauberstich
Ein Stichspiel mit Ansagen und 60 Karten: Zahlen von 1 bis 13 in Rot, Blau, Grün und Gelb, dazu 4 Zauberhüte und 4 Nieten. In Runde 1 bekommt jeder eine Karte, in Runde 2 zwei und so weiter. Die oberste Karte des restlichen Stapels bestimmt den Trumpf. Ist sie ein Zauberhut, wählt der Geber die Trumpffarbe.
- **Ansagen:** Vor jeder Runde sagt jeder an, wie viele Stiche er machen wird.
- **Spielen:** Du musst die angespielte Farbe bedienen, wenn du kannst. Zauberhüte und Nieten darfst du immer spielen. Den Stich gewinnt der erste Zauberhut, sonst der höchste Trumpf, sonst die höchste Karte der angespielten Farbe.
- **Punkte:** Liegst du mit deiner Ansage genau richtig, bekommst du 20 Punkte plus 10 pro Stich. Liegst du daneben, verlierst du 10 Punkte pro Stich Abweichung.

**Option „Ansagen dürfen nicht aufgehen“** (Standard): Wer als Letzter ansagt, darf keine Zahl nennen, bei der die Summe aller Ansagen genau der Zahl der Stiche entspricht. So liegt in jeder Runde mindestens einer daneben.

### Sternbilder
Ein kooperatives Spiel: Ihr gewinnt oder verliert gemeinsam. **Du siehst die Karten aller Mitspieler, nur deine eigenen nicht.** Zusammen baut ihr fünf Sternbilder auf, eins pro Farbe (Rot, Blau, Grün, Gelb, Weiß), jeweils in der Reihenfolge 1 bis 5.

In deinem Zug machst du genau eine dieser drei Sachen:
- **Hinweis geben:** Du zeigst einem Mitspieler alle seine Karten einer bestimmten Farbe oder Zahl. Das kostet einen der 8 Hinweise.
- **Abwerfen:** Du legst eine eigene Karte ab und bekommst dafür einen Hinweis zurück.
- **Anlegen:** Du spielst eine eigene Karte aus. Passt sie nicht, zieht eine Wolke auf. Bei 3 Wolken ist der Himmel verdeckt und das Spiel verloren.

Wer ein Sternbild mit der 5 vollendet, bekommt einen Hinweis zurück. Ist der Stapel leer, kommt jeder noch einmal dran. Am Ende zählen die angelegten Karten, maximal 25 Punkte.
**Option Gedächtnis-Modus:** Hinweise verschwinden wieder, sobald du das nächste Mal dran warst. Du musst sie dir also merken.

### Eroberungsspiel
Ein Strategiespiel auf einer Weltkarte mit 49 Gebieten in 8 Regionen, gespielt abwechselnd an einem Gerät. Die Gebiete werden zufällig verteilt, auf jedem steht anfangs eine Armee. Die übrigen Startarmeen setzt ihr reihum, jeweils drei.

Jeder Zug hat drei Schritte:
- **Verstärken:** Du bekommst ein Drittel deiner Gebietszahl als Armeen (mindestens 3), dazu den Bonus jeder Region, die dir ganz gehört.
- **Angreifen:** Aus einem Gebiet mit mindestens 2 Armeen greifst du ein fremdes Nachbargebiet an; gestrichelte Linien sind Seewege. Du würfelst mit bis zu 3 Würfeln, der Verteidiger mit bis zu 2. Die höchsten Würfel werden paarweise verglichen, bei Gleichstand gewinnt der Verteidiger. „Bis zum Ende“ würfelt so lange, bis das Gebiet erobert ist oder du nur noch eine Armee hast.
- **Verschieben:** Einmal Armeen zwischen zwei eigenen Gebieten verschieben, die über eigene Gebiete verbunden sind.

Wer in einem Zug mindestens ein Gebiet erobert, bekommt eine Karte. Drei gleiche oder drei verschiedene Symbole (Joker passen immer) tauschst du gegen 4, 6, 8, 10, 12, 15 und danach je 5 Armeen mehr. Ab 5 Karten musst du tauschen.

Jeder bekommt zu Beginn einen **geheimen Auftrag**, z. B. zwei bestimmte Regionen erobern, 31 Gebiete besetzen oder einen bestimmten Mitspieler ausschalten. Er wird erst nach „Die anderen schauen weg“ angezeigt. Wer seinen Auftrag zuerst erfüllt oder alle anderen ausschaltet, gewinnt. Zu zweit spielen neutrale graue Armeen mit, die nie angreifen.

Die Regionsboni, die Aufträge und einige Extra-Startarmeen für benachteiligte Sitzplätze sind so eingestellt, dass in Tausenden simulierten Partien kein Platz und kein Auftrag deutlich im Vorteil war. Die Karte entsteht aus den gemeinfreien Ländergrenzen von Natural Earth.

---

## Fernseher-Modus

Ihr sitzt zusammen im Wohnzimmer und habt einen Fernseher oder Beamer? Dann kann ein Laptop am Fernseher den gemeinsamen Tisch groß zeigen, während jeder an seinem Handy spielt und dort seine Karten sieht.

1. Den Laptop per HDMI an den Fernseher anschließen und SynCard öffnen.
2. **Online spielen** → **📺 Dieses Gerät ist der Fernseher** wählen und ein Spiel antippen.
3. Die Handys scannen den QR-Code auf dem Fernseher (oder geben den Raumcode ein).
4. Am Fernseher oder am Handy des ersten Spielers (Spielleiter) auf **Spiel starten** tippen. Mit **Vollbild** verschwinden die Browserleisten.

Der Fernseher spielt nicht mit und bekommt vom Server keine einzige Handkarte zu sehen. Bei Sternbilder zeigt er alle Hände verdeckt, nur mit den Hinweisen, die jeder über seine Karten bekommen hat. Spielauswahl, „Nochmal spielen“ und „Zurück zur Lobby“ gehen am Fernseher und beim Spielleiter.

Möglich sind alle Online-Spiele außer *Mensch ärgere dich nicht* und *Sudoku Battle*: Bei diesen beiden sieht man am Handy ohnehin schon alles.

**Wichtig:** Öffne SynCard am Laptop über die öffentliche Adresse (Render oder die Tunnel-Adresse von `start.bat`), nicht über `localhost`. Sonst steht `localhost` im QR-Code, und die Handys finden den Raum nicht.

---

## Installation

Es gibt zwei Wege, SynCard zu betreiben:

| | Render | Eigener PC (start.bat) |
|---|---|---|
| Adresse | fest, z. B. `https://brettspiele.onrender.com` | ändert sich bei jedem Start (`https://….trycloudflare.com`) |
| PC muss laufen | nein | ja, solange gespielt wird |
| Kosten | kostenlos | kostenlos |
| Nachteil | schläft nach 15 Min. ohne Besucher ein, der erste Aufruf dauert dann ca. 1 Minute | Fenster muss offen bleiben |

### Variante A: Hosting bei Render

Render ist mit dem GitHub-Konto verbunden und liest die Datei [`render.yaml`](render.yaml) im Repo. Darin steht schon alles, was Render braucht: Build-Befehl, Start-Befehl, Region Frankfurt und den kostenlosen Plan.

**Einmalig einrichten:**
1. Auf [render.com](https://render.com) mit dem GitHub-Konto anmelden.
2. **New → Blueprint** wählen und dieses Repository auswählen.
3. Render zeigt den Dienst aus `render.yaml` an. Mit **Apply** bestätigen.
4. Nach ein paar Minuten läuft die Seite unter der angezeigten `onrender.com`-Adresse.

**Danach:** Jeder Push auf `main` löst automatisch einen neuen Build aus. Den Fortschritt und die Logs findest du im Render-Dashboard unter dem Dienst.

> Der Dienst heißt in der `render.yaml` noch `brettspiele`. Daraus ergibt sich die Adresse. Für eine Adresse mit `syncard` ändert man `name:` dort, solange der Name bei Render noch frei ist.

### Variante B: Auf dem eigenen PC mit start.bat

Damit läuft der Server auf deinem Windows-PC. Über einen kostenlosen Cloudflare-Tunnel bekommt er eine öffentliche https-Adresse, die deine Freunde von überall öffnen können. Du musst dafür keine Ports freigeben und nichts am Router einstellen.

**Voraussetzungen:**
- Windows 10 oder 11 mit **winget** (ist bei aktuellen Windows-Versionen dabei)
- Internetverbindung

Alles andere (Node.js, cloudflared, die npm-Pakete) installiert das Skript beim ersten Start selbst.

**Einrichten:**
1. Das Repository herunterladen, entweder mit `git clone …` oder auf GitHub über **Code → Download ZIP** (danach entpacken).
2. Im Ordner doppelt auf **`start.bat`** klicken.
3. Beim ersten Mal fragt winget eventuell nach Administratorrechten, um Node.js und cloudflared zu installieren. Das bestätigen.
   Meldet das Skript danach *„wurde installiert, wird aber noch nicht gefunden“*: Fenster schließen und `start.bat` noch einmal starten. Windows kennt die neuen Programme erst in einem neuen Fenster.

**Was beim Start passiert** (die Schritte stehen auch im Fenster):

| Schritt | Was passiert |
|---|---|
| 1/6 | Node.js prüfen und bei Bedarf installieren |
| 2/6 | cloudflared prüfen und bei Bedarf installieren |
| 3/6 | npm-Pakete installieren (nur beim ersten Mal, dauert 1–3 Minuten) |
| 4/6 | Webseite bauen, aber nur wenn sich in `client/src` etwas geändert hat |
| 5/6 | Server auf Port 3001 starten |
| 6/6 | Tunnel starten und warten, bis die Adresse im Internet erreichbar ist |

Danach:
- Die Adresse (`https://….trycloudflare.com`) erscheint im Fenster, liegt **in der Zwischenablage** und öffnet sich automatisch im Browser.
- **Öffne selbst diese Adresse, nicht `localhost`.** Dann stimmen auch die Einladungslinks, die du an andere schickst.
- **Lass das Fenster offen**, solange gespielt wird. Mit **Enter** beendest du Server und Tunnel.

**Beenden, falls das Fenster einfach geschlossen wurde:** `stop.bat` ausführen. Das Skript beendet Server und Tunnel im Hintergrund. Die Prozess-IDs dafür stehen in `.run-pids`.

**Ohne Doppelklick:** `start.bat` ruft nur `start.ps1` auf. Direkt geht es so:
```powershell
powershell -ExecutionPolicy Bypass -File start.ps1        # starten
powershell -ExecutionPolicy Bypass -File start.ps1 -Stop  # beenden
```

**Wenn etwas nicht klappt:**

| Meldung | Lösung |
|---|---|
| *Port 3001 ist schon belegt* | `stop.bat` ausführen, oder das Programm beenden, das den Port nutzt |
| *Der DNS-Server deines Netzwerks kennt die Adresse nicht* | In den Windows-Netzwerkeinstellungen als DNS-Server `1.1.1.1` und `1.0.0.1` eintragen |
| *Der Tunnel liefert keine Adresse* | Internetverbindung und Firewall prüfen |
| *Der Server hat sich sofort beendet* | Die Fehlermeldung steht im Fenster. Das komplette Log liegt in `%TEMP%\kniffel-server.log` (und `.err`) |

Das Log des Tunnels liegt in `%TEMP%\kniffel-tunnel.log`.

### Nur lokal (ohne Tunnel)

Wer nur im eigenen WLAN spielen oder entwickeln will:
```bash
npm install
npm run build      # installiert und baut den Client nach client/dist
npm start          # Server auf http://localhost:3001
```
Andere Geräte im selben WLAN erreichen den Server über die IP-Adresse des PCs, z. B. `http://192.168.0.42:3001`.

---

## Projektaufbau

```
├── server/index.js        Node-Server (Express + Socket.IO): Räume, Spieler, Spielzüge
├── client/                React-App (Vite)
│   └── src/
│       ├── App.jsx        Startseite mit der Spielauswahl
│       ├── games/         Spiele für ein Gerät (Kniffel, Mensch ärgere dich nicht, Eroberungsspiel)
│       ├── online/        Online-Ansichten der Spiele und die Lobby (Online.jsx)
│       └── shared/        Spiellogik, die Server und Browser gemeinsam nutzen
├── render.yaml            Konfiguration für Render
├── start.bat / start.ps1  Lokal starten inkl. Cloudflare-Tunnel
└── stop.bat               Lokalen Server und Tunnel beenden
```

Der Server entscheidet über alle Spielzüge (Mischen, Regeln prüfen) und schickt jedem Spieler nur das, was er sehen darf. Die Regeln jedes Spiels stehen in `client/src/shared/<spiel>.js`.

**Neues Spiel hinzufügen:** Spiellogik in `shared/` anlegen, in `server/index.js` eintragen (`GAMES`, `MAX_PLAYERS`) und eine Ansicht in `online/` bauen. Für den Fernseher-Modus bekommt die Ansicht `me.tv` (die eigene Hand ausblenden) und die `view`-Funktion den Spielerindex `-1` (keine Hand verraten). Soll das Spiel nicht im Fernseher-Modus laufen, kommt es in `NO_TV` (Server) und bekommt `noTv` in `games/catalog.js`.
