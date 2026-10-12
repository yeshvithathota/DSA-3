# IntelliCheck — Full Java Spell Checker Website

## Features
- Customer registration and sign-in
- Admin sign-in and admin dashboard
- Password hashing with PBKDF2-HMAC-SHA256 and per-user salts
- HttpOnly session cookie (session lasts up to 8 hours while server is running)
- Java backend and Levenshtein Edit Distance algorithm
- Ranked correction suggestions with edit distance
- Apply one suggestion or apply the top suggestion for all detected issues
- Per-account check history
- Admin overview with registered accounts, usage count, dictionary size and recent checks
- Persistent local account and activity data in the `data` folder
- Responsive interface for desktop and mobile
- No Node.js or `node_modules` required

## Requirements
Install a **JDK** (Java Development Kit). Java 17+ is recommended. This project was tested for compatibility with modern Java and uses Java's built-in HTTP server.

## Run on Windows (VS Code)
1. Extract this ZIP to a folder.
2. Open the extracted `IntelliCheck_Full_Project` folder in VS Code.
3. Double-click `Run-IntelliCheck.bat`, or use the VS Code terminal:
   ```powershell
   javac -encoding UTF-8 -d out src\SpellChecker.java
   java -cp out SpellChecker
   ```
4. Open **http://localhost:8080** in Edge/Chrome.
5. Keep the terminal open while using the website.

## Admin demo login
- Email: `admin@intellicheck.com`
- Password: `Admin@12345`

The app creates this admin account automatically on first run. Customer accounts are created using **Create account** on the login screen. Admin can view accounts and usage, but cannot view customer passwords.

## Where data is stored
- `data/users.tsv` — account profile, salt and password hash (not plaintext passwords)
- `data/history.tsv` — spell-check activity summaries
- `dictionary.txt` — local word list

These files are created automatically. Back up the `data` folder if you need to preserve local accounts and history. The session map is in memory, so users sign in again after the Java server restarts.

## Important deployment note
This is a functional **local demonstration project**. It uses local file storage, an in-memory session store, a demo admin password, and a built-in Java HTTP server. Before putting it on the public internet, replace the demo admin password, use HTTPS, add stronger rate limiting/CSRF protections, use a production database, and deploy behind a production-grade server. “Live data” here means data that updates live from accounts and checks created in this running app; it does not connect to an external cloud service.
