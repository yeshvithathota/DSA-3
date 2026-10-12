@echo off
cd /d "%~dp0"
echo.
echo Starting IntelliCheck...
echo If port 8080 is busy, close the other server or change PORT in src\SpellChecker.java.
echo Keep this window open while using the website.
echo.
if not exist out mkdir out
javac -encoding UTF-8 -d out src\SpellChecker.java
if errorlevel 1 (
  echo.
  echo Compilation failed. Check the error above.
  pause
  exit /b 1
)
java -cp out SpellChecker
pause
