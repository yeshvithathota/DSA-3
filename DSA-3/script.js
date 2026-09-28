/* =====================================================
   INTELLICHECK - INTELLIGENT SPELL CHECKER
   Levenshtein Edit Distance
   ===================================================== */


/* ================= DICTIONARY ================= */

const dictionary = [

    // Common words
    "a", "about", "above", "after", "again", "all", "also",
    "am", "an", "and", "another", "any", "are", "around",
    "as", "at", "back", "be", "because", "been", "before",
    "being", "between", "both", "but", "by", "can", "come",
    "could", "day", "did", "different", "do", "does", "done",
    "down", "each", "even", "every", "find", "first", "for",
    "from", "get", "give", "go", "good", "great", "had",
    "has", "have", "he", "her", "here", "him", "his", "how",
    "I", "if", "in", "into", "is", "it", "its", "just", "know",
    "large", "last", "learn", "like", "little", "long",
    "look", "made", "make", "many", "may", "me", "more",
    "most", "much", "my", "new", "no", "not", "now", "of",
    "off", "on", "one", "only", "or", "other", "our", "out",
    "over", "people", "place", "put", "right", "said", "same",
    "see", "she", "should", "show", "small", "so", "some",
    "something", "still", "such", "take", "than", "that",
    "the", "their", "them", "then", "there", "these", "they",
    "thing", "think", "this", "those", "through", "time",
    "to", "too", "two", "under", "up", "us", "use", "very",
    "want", "was", "way", "we", "well", "were", "what",
    "when", "where", "which", "while", "who", "will", "with",
    "word", "work", "would", "write", "you", "your",

    // Academic / technical words
    "algorithm", "application", "artificial", "computer",
    "correction", "data", "database", "dictionary",
    "distance", "dynamic", "editing", "efficient",
    "error", "intelligent", "language", "levenshtein",
    "minimum", "natural", "processing", "project",
    "program", "search", "similarity", "spell",
    "spelling", "string", "suggestion", "system",
    "technology", "text", "user", "website",

    // Frequently misspelled target words
    "receive", "message", "friend", "tomorrow", "beautiful",
    "necessary", "different", "because", "separate",
    "definitely", "successful", "environment", "development",
    "experience", "important", "information", "available",
    "beginning", "business", "college", "computer",
    "knowledge", "language", "library", "project",
    "student", "teacher", "university", "programming",
    "software", "engineering", "science", "application"
];


/* Remove duplicate dictionary words */

const uniqueDictionary = [...new Set(
    dictionary.map(word => word.toLowerCase())
)];


/* ================= DOM ELEMENTS ================= */

const textInput = document.getElementById("textInput");
const checkBtn = document.getElementById("checkBtn");
const clearBtn = document.getElementById("clearBtn");
const results = document.getElementById("results");

const wordCount = document.getElementById("wordCount");
const errorCount = document.getElementById("errorCount");

const correctAllBtn = document.getElementById("correctAllBtn");


/* ================= WORD COUNT ================= */

textInput.addEventListener("input", updateWordCount);

function updateWordCount() {

    const text = textInput.value.trim();

    if (text === "") {
        wordCount.textContent = "0 words";
        return;
    }

    const words = text.match(/[A-Za-z]+/g) || [];

    wordCount.textContent =
        words.length + (words.length === 1 ? " word" : " words");
}


/* ================= LEVENSHTEIN DISTANCE ================= */

/*
    Calculates the minimum number of:

    1. Insertions
    2. Deletions
    3. Substitutions

    required to transform word1 into word2.
*/

function levenshteinDistance(word1, word2) {

    const m = word1.length;
    const n = word2.length;

    let matrix = [];

    for (let i = 0; i <= m; i++) {
        matrix[i] = [];

        for (let j = 0; j <= n; j++) {

            if (i === 0) {
                matrix[i][j] = j;
            }

            else if (j === 0) {
                matrix[i][j] = i;
            }

            else {

                const cost =
                    word1[i - 1] === word2[j - 1] ? 0 : 1;

                matrix[i][j] = Math.min(

                    matrix[i - 1][j] + 1,

                    matrix[i][j - 1] + 1,

                    matrix[i - 1][j - 1] + cost
                );
            }
        }
    }

    return matrix[m][n];
}


/* ================= FIND SUGGESTIONS ================= */

function getSuggestions(word) {

    const lowerWord = word.toLowerCase();

    let candidates = [];

    for (const dictionaryWord of uniqueDictionary) {

        /*
            Avoid extremely different length words.
        */

        if (
            Math.abs(dictionaryWord.length - lowerWord.length) > 4
        ) {
            continue;
        }

        const distance =
            levenshteinDistance(lowerWord, dictionaryWord);

        candidates.push({
            word: dictionaryWord,
            distance: distance
        });
    }


    candidates.sort((a, b) => {

        if (a.distance !== b.distance) {
            return a.distance - b.distance;
        }

        return a.word.length - b.word.length;
    });


    return candidates
        .filter(item => item.distance <= Math.max(3, Math.floor(lowerWord.length / 2)))
        .slice(0, 5);
}


/* ================= CHECK SPELLING ================= */

let detectedErrors = [];


checkBtn.addEventListener("click", checkSpelling);


function checkSpelling() {

    const text = textInput.value.trim();

    if (text === "") {

        results.innerHTML = `
            <div class="empty-result">
                <div class="empty-icon">!</div>
                <h3>Enter some text</h3>
                <p>Please type something before checking.</p>
            </div>
        `;

        errorCount.textContent = "0 errors";

        return;
    }


    const words = text.match(/[A-Za-z]+/g) || [];

    detectedErrors = [];

    /*
        Check every unique word.
    */

    const checkedWords = new Set();

    for (const word of words) {

        const lowerWord = word.toLowerCase();

        if (checkedWords.has(lowerWord)) {
            continue;
        }

        checkedWords.add(lowerWord);

        /*
            If word is not present in dictionary,
            consider it a possible spelling error.
        */

        if (!uniqueDictionary.includes(lowerWord)) {

            const suggestions = getSuggestions(lowerWord);

            if (suggestions.length > 0) {

                detectedErrors.push({
                    word: word,
                    suggestions: suggestions
                });

            }
        }
    }


    displayResults();
}


/* ================= DISPLAY RESULTS ================= */

function displayResults() {

    if (detectedErrors.length === 0) {

        results.innerHTML = `
            <div class="empty-result">
                <div class="empty-icon">✓</div>
                <h3>No spelling errors!</h3>
                <p>Your text looks good.</p>
            </div>
        `;

        errorCount.textContent = "0 errors";

        correctAllBtn.style.display = "none";

        return;
    }


    errorCount.textContent =
        detectedErrors.length +
        (detectedErrors.length === 1 ? " error" : " errors");


    results.innerHTML = "";


    detectedErrors.forEach((error, index) => {

        const card = document.createElement("div");

        card.className = "error-card";


        const top = document.createElement("div");

        top.className = "error-top";


        const wrongWord = document.createElement("span");

        wrongWord.className = "wrong-word";

        wrongWord.textContent = error.word;


        const distance = document.createElement("span");

        distance.className = "distance";

        distance.textContent =
            "Distance: " + error.suggestions[0].distance;


        top.appendChild(wrongWord);

        top.appendChild(distance);


        const title = document.createElement("div");

        title.className = "suggestion-title";

        title.textContent = "Suggestions";


        const suggestionsDiv = document.createElement("div");

        suggestionsDiv.className = "suggestions";


        error.suggestions.forEach(suggestion => {

            const button =
                document.createElement("button");

            button.className = "suggestion";

            button.textContent = suggestion.word;


            button.addEventListener("click", () => {

                replaceWord(
                    error.word,
                    suggestion.word
                );

            });


            suggestionsDiv.appendChild(button);
        });


        card.appendChild(top);

        card.appendChild(title);

        card.appendChild(suggestionsDiv);

        results.appendChild(card);

    });


    correctAllBtn.style.display = "block";
}


/* ================= REPLACE SINGLE WORD ================= */

function replaceWord(oldWord, newWord) {

    const regex =
        new RegExp("\\b" + escapeRegex(oldWord) + "\\b", "gi");


    textInput.value =
        textInput.value.replace(regex, newWord);


    updateWordCount();

    checkSpelling();
}


/* ================= CORRECT ALL ================= */

correctAllBtn.addEventListener(
    "click",
    correctAll
);


function correctAll() {

    let text = textInput.value;


    detectedErrors.forEach(error => {

        if (error.suggestions.length === 0) {
            return;
        }


        const replacement =
            error.suggestions[0].word;


        const regex =
            new RegExp(
                "\\b" + escapeRegex(error.word) + "\\b",
                "gi"
            );


        text =
            text.replace(regex, replacement);

    });


    textInput.value = text;

    updateWordCount();

    checkSpelling();
}


/* ================= ESCAPE REGEX ================= */

function escapeRegex(string) {

    return string.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );
}


/* ================= CLEAR ================= */

clearBtn.addEventListener("click", () => {

    textInput.value = "";

    results.innerHTML = `
        <div class="empty-result">
            <div class="empty-icon">✓</div>
            <h3>Ready to check</h3>
            <p>
                Your spelling results will appear here.
            </p>
        </div>
    `;

    wordCount.textContent = "0 words";

    errorCount.textContent = "0 errors";

    correctAllBtn.style.display = "none";

    detectedErrors = [];

});