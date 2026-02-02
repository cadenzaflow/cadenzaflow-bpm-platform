@echo off

SET BASEDIR=%~dp0
SET EXECUTABLE=%BASEDIR%internal\run.bat

REM stop CadenzaFlow Run
call "%EXECUTABLE%" stop