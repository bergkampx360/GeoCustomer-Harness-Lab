# Superpowers és BMAD összehasonlítása

## Setup és tanulási görbe

A pontos beüzemelési időt nem mértem, ezért utólag nem tudok hiteles óraszámot megadni.

A **Superpowers** beüzemelése egyszerűbb és gyorsabban átlátható volt. Egy központi implementációs tervből dolgozott, ezért könnyű volt követni, hogy hol tart a fejlesztés és mi a következő lépés.

A **BMAD** indulása összetettebb volt. A kódolás előtt külön specifikáció, architektúra, epicek, storyk és státuszdokumentumok készültek. A tanulási görbéje meredekebb volt, viszont később jobban visszakövethetővé tette a döntéseket és az egyes feladatok állapotát.

## Steering

Mindkét rendszert kellett manuálisan terelni, de eltérő mértékben.

A **Superpowers** esetében főként a mérföldkövek sorrendjét, a scope megtartását és a commit/push lépéseket kellett jóváhagynom. A folyamat alapvetően lineáris maradt.

A **BMAD** több irányítást igényelt. Storynként külön implementációs és review-fázisok voltak, a findingokat pedig manuálisan kellett értékelni: javítandó hiba, elhalasztható edge case vagy hamis pozitív. Pontos iterációszámot nem naplóztam, de a BMAD több review- és korrekciós kört igényelt. Továbbá a BMAD esetében nagyon lassan tudtam haladni, rengeteg időt elvett az, hogy a session sokszor lejárt, mert túl gyorsan fogyasztotta a krediteket. Itt muszáj voltam játszani a modellel, kontextus ürítésével, hogy minél tovább tartson a session. 

## Tervezési fázis

Mindkét harness készített értelmes tervet a kódolás előtt.

A **Superpowers** egy konszolidált, mérföldkő-alapú implementációs tervet készített. A megvalósítás nagyrészt követte ezt a sorrendet, az eltéréseket ugyanabban a dokumentumban rögzítette.

A **BMAD** részletesebb tervezést végzett: külön specifikáció, architektúra, storyk és acceptance criteria készültek. A végrehajtás szigorúbban követte az előzetes tervet, de ez több adminisztrációval járt.

## Kód minősége

A végleges állapotban mindkét branch működő, tesztelt megoldást tartalmazott. A próbálkozások pontos számát nem mértem, ezért azt nem tudom biztosan megmondani, hogy minden funkció elsőre működött-e.

Mindkét rendszer magától írt teszteket, és mindkét ágon 19 automatizált teszteset készült.

A **Superpowers** főként tiszta unit teszteket készített a normalizálásra, koordinátafeloldásra, Haversine-számításra és rendezésre. A seed JSON szerkezetét runtime ellenőrzéssel is validálta.

A **BMAD** unit tesztek mellett valódi HTTP-szintű route-teszteket is készített `app.inject()` használatával. Ez jobban ellenőrizte a tényleges Fastify route-okat és státuszkódokat.

Az edge case-eket mindkét megoldás kezelte:

- ismeretlen település esetén nem állt le a seed;
- a koordináták `null` értéket kaptak;
- a null-koordinátás rekordok a lista végére kerültek;
- a rendezés a nyers, nem kerekített távolság alapján történt;
- azonos távolságnál név szerinti tie-break működött;
- az ismételt seed nem hozott létre duplikált rekordokat.

## Kontroll
Mindkét esetben azt éreztem, hogy a tervezés során kellett odafigyelni, hogy a terv megfelelő minőségben készüljön el és akkor a Claude Code sokkal pontosabb eredményt hozott. Szerencsére mindkét plugin esetében az út kitaposott volt az adott metodologiára nézve.

A **Superpowers** esetében ritkábban kellett kézzel átvennem az irányítást. Főként a következő lépés, a scope és a commitok jóváhagyása maradt nálam a tervezésen kívül.

A **BMAD** több aktív kontrollt igényelt. Manuálisan kellett:

- review-findingokat felülvizsgálni;
- egyes javaslatokat elutasítani vagy deferred státuszba helyezni;
- ennél a folyamtnál vettem észre, hogy sokszor több subagent futott, így nagyobb figyelmet követelt az, hogy ezek az agentek mit is csinálnak;
- több fázist új sessionben folytatni, hogy a kontextus csökkentésével kevesebb kreditet használjon.

Összességében a BMAD több ellenőrzési pontot adott(ezzel több iterációt is), de ezek nem csökkentették az emberi kontroll szükségességét.

## Összegzés

Kisebb vagy közepes, jól specifikált projekthez a **Superpowerst** választanám. Egyszerűbb a setupja, kisebb a dokumentációs overheadje, könnyebb követni, és kevesebb manuális workflow-kezelést igényelt.

Hosszabb távú, összetettebb vagy több fejlesztőt érintő projekthez inkább a **BMAD megközelítését** választanám, mert erősebb a követhetősége, részletesebb a review-folyamat és a dokumentáció és picit a SCRUM módszertant juttatta eszembe. 

A saját tapasztalatom alapján:

> A Superpowers hatékonyabb és arányosabb volt ennél a kisebb backendfeladatnál. A BMAD több időt, dokumentációt és manuális kontrollt igényelt, de hosszabb távon jobb döntéskövetést és strukturáltabb fejlesztési folyamatot biztosíthat.

Forráskód:

[Superpowers branch](https://github.com/bergkampx360/GeoCustomer-Harness-Lab/tree/harness/superpowers)

[BMAD branch](https://github.com/bergkampx360/GeoCustomer-Harness-Lab/tree/harness/bmad)