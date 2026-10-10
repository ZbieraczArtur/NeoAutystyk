# NeoAutystyk
TBA




## Cel główny

Zmodernizuj istniejący interfejs rozwiązywania testu politycznego Autystyk. Dodaj drugi tryb rozwiązywania pytań — **„Tryb kart”** — i gruntownie popraw wygląd oraz ergonomię obecnego „Trybu listy”.

Aktualnie na stronie głównej testu wybiera się który test chce się rozwiązywać (krótki, pełny, zbalansowany) a następnie pojawia się okno z 2 opcjami:\
1. Ciągła Lista\
2. 6 Zakładek tematycznych\
\
Chcemy usunąć opcje zakładki tematyczne i zastąpić je Trybem kart. 

**Najważniejsze:** pracuj na istniejącym kodzie. Najpierw rozpoznaj strukturę projektu, mechanizm wyświetlania pytań, zapisywania odpowiedzi, naliczania wyników, eksportu i importu postępu. Następnie wprowadź zmiany bez naruszania działających mechanizmów testu.

## 1. Wybór trybu rozwiązywania

Obecnie użytkownik wybiera na stronie głównej jeden z wariantów testu: krótki, pełny lub zbalansowany. Po wyborze pojawia się ekran wyboru sposobu rozwiązywania.

Zachowaj obecne warianty testu, ale zastąp wybór między listą a zakładkami tematycznymi wyborem:

- **Tryb listy** — wszystkie pytania wyświetlane kolejno na jednej stronie, jak obecnie.

- **Tryb kart** — jedno aktywne pytanie na ekranie, z możliwością przechodzenia między pytaniami.

Usuń z interfejsu dotychczasową opcję 6 zakładek tematycznych i zastąp ją trybem kart. Usuń lub przebuduj wyłącznie te elementy kodu, które dotyczą starego sposobu nawigacji tematycznej. Nie usuwaj kategorii pytań, metadanych ani zależności między tezami, jeżeli są wykorzystywane przez pozostałe funkcje.

Ekran wyboru powinien mieć dwie estetyczne karty z krótkim opisem, ikoną i informacją o sposobie pracy. Wybór trybu powinien być jednoznaczny, a powrót do poprzedniego ekranu łatwy.

## 2. Tryb kart — główny interfejs

W trybie kart wyświetlaj tylko jedno pytanie naraz. Po przejściu do następnego pytania poprzednia karta znika i zostaje zastąpiona kolejną.

Każda karta powinna zawierać:

- numer aktualnego pytania i całkowitą liczbę pytań;

- czytelną treść tezy;

- opcję rozwinięcia pełnego objaśnienia tezy, jeśli jest dostępne;

- przycisk „Pokaż później”;

- zestaw odpowiedzi;

- opcjonalne uzasadnienie odpowiedzi użytkownika;

- przycisk pauzy;

- czytelny pasek postępu;

- nawigację do poprzedniego i następnego pytania.

Zaprojektuj kartę tak, aby jej treść była wygodna do czytania na telefonie. Unikaj zbyt dużej pustej przestrzeni, przesadnych animacji i elementów zajmujących niepotrzebnie miejsce.

Na komputerze wykorzystaj szerszy układ, ale zachowaj czytelne ograniczenie szerokości tekstu. Na urządzeniach mobilnych dopasuj odstępy, rozmiary przycisków i typografię do mniejszego ekranu.

## 3. Odpowiedzi i automatyczne przechodzenie

Zachowaj obecne pięć odpowiedzi:

1. Zdecydowanie zgadzam się.

2. Częściowo zgadzam się.

3. Częściowo nie zgadzam się.

4. Zdecydowanie nie zgadzam się.

5. Pomiń pytanie.

Nie zmieniaj ich znaczenia, przypisanych wartości ani sposobu wykorzystywania w obliczeniach wyników.

Dodaj ustawienie „Automatycznie przechodź do następnego pytania”, domyślnie wyłączone.

**Gdy automatyczne przechodzenie jest wyłączone:**

- użytkownik wybiera odpowiedź;

- wybrana odpowiedź zostaje wizualnie zaznaczona;

- użytkownik naciska „Kontynuuj”, aby przejść dalej;

- może zmienić odpowiedź przed przejściem dalej.

**Gdy automatyczne przechodzenie jest włączone:**

- wybór odpowiedzi zapisuje ją i automatycznie przechodzi do kolejnego pytania;

- dotyczy to również opcji „Pomiń pytanie”;

- mechanizm nie może powodować wielokrotnego zapisania odpowiedzi ani przeskakiwania dwóch pytań przez wielokrotne wywołanie zdarzenia.

Dodaj krótką, subtelną informację o włączonym trybie automatycznym. Umożliw szybką zmianę ustawienia bez opuszczania testu.

Jeżeli użytkownik wróci do wcześniej rozwiązanej tezy, ma zobaczyć poprzednio wybraną odpowiedź. Ponowny wybór powinien ją aktualizować, a nie tworzyć duplikat.

## 4. Pauza, eksport i wznawianie testu

Dodaj wyraźny przycisk „Pauza”.

Po jego naciśnięciu:

- zatrzymaj dalsze rozwiązywanie;

- zapisz aktualny stan testu w istniejącym mechanizmie przechowywania danych, jeśli jest dostępny;

- wyświetl okno pauzy z informacją o postępie;

- wygeneruj kod eksportu z wszystkimi dotychczasowymi odpowiedziami;

- pokaż kod w polu umożliwiającym skopiowanie go jednym przyciskiem;

- udostępnij opcję powrotu do testu.

Uwzględnij również inne istniejące dane, jeśli są potrzebne do poprawnego wznowienia testu.

Zachowaj zgodność z obecnym systemem eksportu i importu. Jeśli wymagana jest migracja formatu, przygotuj ją tak, aby starsze prawidłowe kody nadal można było obsłużyć, o ile pozwala na to ich struktura.

Po wznowieniu testu użytkownik powinien znaleźć się na pytaniu, na którym skończył, z zachowanymi odpowiedziami, ustawieniami i odłożonymi pytaniami.

Nie uzależniaj możliwości wznowienia wyłącznie od pamięci przeglądarki. Eksport powinien umożliwiać odtworzenie sesji na innym urządzeniu.

## 5. Nawigacja po pytaniach

W dolnej części trybu kart umieść panel nawigacyjny, który można rozwinąć lub zwinąć.

Powinien umożliwiać:

- przejście do poprzedniego i następnego pytania;

- przejście do dowolnego numeru pytania;

- szybkie przeskoczenie o kilka pytań;

- wyszukiwanie pytania po treści, identyfikatorze lub numerze;

- podgląd statusu pytań;

- przejście do pytań odłożonych;

- powrót do pytania aktualnie rozwiązywanego.

Zaprojektuj panel tak, aby nie zajmował stale dużej części ekranu.

Statusy pytań oznaczaj czytelnie, ale nie opieraj ich wyłącznie na kolorze. Rozróżniaj przynajmniej pytania:

- bez odpowiedzi;

- z udzieloną odpowiedzią;

- pominięte;

- odłożone na później.

Dodaj też opcje odznaczania pytań, jeśli aktualnie brakuje.

Wyszukiwarka powinna działać lokalnie na dostępnych danych, bez zbędnych zapytań sieciowych. Zastosuj indeksowanie tekstu lub inne proste rozwiązanie, jeśli wielkość zbioru pytań tego wymaga. Nie przeszukuj całej bazy ponownie przy każdym niepotrzebnym renderowaniu. Przy dużej liczbie wyników rozważ ograniczenie liczby jednocześnie renderowanych elementów.

Wybór dowolnego pytania nie może zmieniać jego odpowiedzi ani resetować stanu testu.

## 6. Funkcja „Pokaż później”

Przycisk „Pokaż później” na każdej karcie.

Po jego naciśnięciu:

- bieżące pytanie zostaje oznaczone jako odłożone;

- zostaje usunięte z bieżącej kolejki i przeniesione na jej koniec;

- test przechodzi do następnego dostępnego pytania;

- odłożenie nie jest równoznaczne z odpowiedzią ani z pominięciem pytania.

Dodaj opcję „Pokaż odłożone pytania”, pozwalającą zobaczyć wszystkie odłożone tezy oraz wybrać konkretną z nich do rozwiązania.

Użytkownik musi móc wrócić do odłożonego pytania w dowolnym momencie. Po udzieleniu odpowiedzi usuń jego status odłożenia, chyba że użytkownik ponownie odłoży je na później.

Zadbaj o poprawną obsługę przypadków brzegowych: odłożenie ostatniego dostępnego pytania, odłożenie wielu pytań pod rząd, powrót do odłożonej tezy oraz zakończenie testu z pytaniami wciąż odłożonymi.

Nie duplikuj pytań i nie zmieniaj ich oryginalnych identyfikatorów. Zachowaj pierwotną kolejność pytań poza celowym przesuwaniem odłożonych pozycji.

## 7. Modernizacja trybu listy

Nie traktuj trybu listy jako pozostawionego bez zmian starego interfejsu. Zachowaj jego główną funkcję — wyświetlanie wielu pytań na jednej stronie — ale popraw czytelność, nawigację i wygodę udzielania odpowiedzi.

Wprowadź:

- wyraźniejszą hierarchię typograficzną;

- czytelniejsze karty pytań;

- spójne marginesy i odstępy;

- wyraźny numer pytania;

- lepiej widoczne przyciski odpowiedzi (oraz zmień ich barwy - aktualnie barwy są błędne np. opcja "**Częściowo nie zgadzam się"** ma kolor, który powinna mieć opcja pomiń i vice versa); 

- spójne rozwijanie objaśnień;

- łatwiejsze rozpoznawanie zapisanych odpowiedzi;

- lepsze dopasowanie do ekranów mobilnych;

- wyraźny i dynamiczny, ale nienachalny wskaźnik postępu;

- wygodną nawigację do wybranego pytania;

- poprawne działanie przycisku kończącego test.

Nie wymuszaj automatycznego przewijania strony po każdym wyborze odpowiedzi. Jeśli użytkownik odpowiada na pytania na dole strony, interfejs nie powinien nagle przenosić go w inne miejsce.

Jeśli lista zawiera dużo pytań, zadbaj o płynność działania. Nie wdrażaj wirtualizacji listy, jeśli mogłaby zepsuć nawigację, pola uzasadnień lub istniejące zależności. Najpierw sprawdź, czy jest rzeczywiście potrzebna.

## 8. Kolory odpowiedzi i informacja zwrotna

Wprowadź spójny system wizualnego zaznaczania odpowiedzi. Kolor wybranej odpowiedzi powinien być widoczny również wtedy, gdy użytkownik szybko przewija listę.

Zastosuj następującą semantykę:

- zdecydowana zgoda — wyraźniejszy zielony akcent;

- częściowa zgoda — delikatniejszy zielony akcent;

- częściowa niezgoda — delikatniejszy czerwony lub koralowy akcent;

- zdecydowana niezgoda — intensywniejszy czerwony lub koralowy akcent;

- pominięcie — odrębny, neutralny kolor, np. przygaszony fiolet lub śliwka.

Kolor może zmieniać tło, obramowanie i subtelny gradient wybranej karty. Zastosuj różne natężenie barwy dla odpowiedzi częściowych i zdecydowanych.

Nie polegaj wyłącznie na kolorze: dodaj wyraźny obrys, ikonę zaznaczenia lub inny jednoznaczny wskaźnik. Stan wybranej odpowiedzi musi być widoczny również dla osób z zaburzeniami rozpoznawania barw.

Zadbaj o odpowiedni kontrast tekstu i dostępność w trybie jasnym oraz ciemnym. Nie stosuj jaskrawych gradientów na całej powierzchni interfejsu.

## 9. Nowy kierunek wizualny

Obecny interfejs jest chłodny i korporacyjny. Zmień jego charakter na bardziej przyjazny, nowoczesny i dopracowany.

Kierunek artystyczny:

- nowoczesny interfejs redakcyjny połączony z estetyką interaktywnych quizów;

- ciepłe, przyjemne tła zamiast dominującego chłodnego granatu;

- stonowane barwy bazowe i mocniejsze akcenty przy odpowiedziach;

- delikatne gradienty, miękkie obramowania i umiarkowanie zaokrąglone narożniki;

- czytelna, nowoczesna typografia z dobrym wsparciem języka polskiego;

- wyraźna hierarchia informacji;

- animacje krótkie i subtelne, z możliwością ograniczenia ruchu;

- spójne ikony, przyciski, pola tekstowe i komunikaty;

- konsekwentny wygląd obu trybów.

Zaprojektuj paletę kolorów jako zestaw współdzielonych zmiennych lub tokenów, aby późniejsze zmiany były proste. Zachowaj lub popraw istniejący przełącznik jasnego i ciemnego motywu, jeżeli jest dostępny.

## 10. Dodatkowe usprawnienia UX

W miarę możliwości dodaj:

- ostrzeżenie przed przypadkowym opuszczeniem niezapisanego testu;

- widoczny status zapisania postępu;

- możliwość wyczyszczenia odpowiedzi pojedynczego pytania, jeśli nie narusza to obecnej logiki;

- klawiaturową nawigację między pytaniami i odpowiedziami;

- wyraźne stany focus, hover, active i disabled;

- obsługę `prefers-reduced-motion`;

- odpowiednie etykiety dostępności dla przycisków i kontrolek;

- potwierdzenie przed resetowaniem całego testu.

Nie dodawaj funkcji tylko dla efektu wizualnego. Każdy element powinien mieć jasny cel.

## 11. Zachowanie logiki testu

To warunek krytyczny.

Nie zmieniaj:

- treści tez;

- identyfikatorów pytań;

- przypisanych wag;

- kierunku punktacji;

- zależności między pytaniami;

- logiki wyboru pytań w wariantach krótkim, pełnym i zbalansowanym;

- algorytmu obliczania wyniku;

- mechanizmu wyświetlania wyników;

- istniejących formatów danych, chyba że zmiana jest konieczna i kompatybilna.

Nie traktuj kolejności wyświetlania pytań jako ich tożsamości. Używaj stabilnych identyfikatorów.

Przełączanie między trybami, cofanie się, wyszukiwanie pytań i odkładanie ich na później nie mogą powodować utraty odpowiedzi ani zmiany wyniku testu.

Nie zastępuj istniejącej logiki testu uproszczoną implementacją. Jeśli jakaś funkcja jest niejasna, najpierw prześledź jej działanie w kodzie.

## 12. Responsywność i wydajność

Przetestuj interfejs w następujących warunkach:

- telefon o szerokości około 360–390 px;

- większy telefon;

- tablet;

- komputer stacjonarny.

Zapewnij:

- brak poziomego przewijania całej strony;

- brak uciętych przycisków;

- wygodne pola dotykowe;

- poprawne zachowanie klawiatury ekranowej przy edycji uzasadnienia;

- czytelność dłuższych tez;

- stabilny pasek nawigacji, który nie zasłania treści;

- poprawne przewijanie przy otwartych panelach i oknach;

- płynne działanie przy dużej liczbie pytań.

Nie dodawaj ciężkich bibliotek, jeżeli podobny efekt można osiągnąć przy użyciu istniejących narzędzi projektu.

## 13. Kolejność prac

Pracuj etapami:

1. Zbadaj strukturę projektu, komponenty pytań, przechowywanie odpowiedzi, nawigację, eksport/import i obliczanie wyników.

2. Określ, które elementy można współdzielić między trybem listy i trybem kart.

3. Zaprojektuj wspólny model stanu sesji testowej.

4. Zaimplementuj wybór trybu oraz nowy tryb kart.

5. Dodaj pauzę, eksport, wznowienie, nawigację i odkładanie pytań.

6. Zmodernizuj tryb listy i wspólny system wizualny.

7. Przetestuj logikę odpowiedzi, wyników i przypadki brzegowe.

8. Sprawdź responsywność i usuń błędy.

9. Dodaj tryb Ustawień, gdzie użytkownik może dostosować lub doregulować niektóre elementy testu dla swojego komfortu - jakieś proste opcje

Nie kończ pracy na makiecie ani na samych zmianach CSS. Zaimplementuj rzeczywiście działające funkcje.

## 14. Kryteria akceptacji

Uznaj zadanie za ukończone dopiero wtedy, gdy:

- użytkownik może wybrać tryb listy lub kart;

- tryb kart pokazuje tylko jedno pytanie;

- działa ręczne i automatyczne przechodzenie;

- zapisane odpowiedzi pozostają zachowane podczas cofania się i przeskakiwania;

- pauza generuje kod umożliwiający wznowienie testu;

- wyszukiwarka znajduje pytania po treści i identyfikatorze;

- odłożone pytania trafiają na koniec kolejki i można do nich wrócić;

- tryb listy działa poprawnie po modernizacji;

- kolory zaznaczonych odpowiedzi różnicują kierunek i siłę stanowiska;

- warianty testu i algorytm wyników działają jak wcześniej;

- interfejs jest wygodny na telefonie i komputerze;

- nie ma błędów konsoli, zduplikowanych odpowiedzi ani utraty postępu.

Na koniec podsumuj zmiany, wskaż zmodyfikowane pliki i opisz wykonane testy. Wyraźnie zaznacz wszelkie elementy, których nie udało się w pełni zrealizować.
