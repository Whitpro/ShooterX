; Shooter X Installer Script
!include "MUI2.nsh"
!include "FileFunc.nsh"

; General
Name "Shooter X"
OutFile "dist\ShooterX-Setup-1.2.0.exe"
InstallDir "$PROGRAMFILES64\Shooter X"
InstallDirRegKey HKCU "Software\Shooter X" ""

; Request admin privileges
RequestExecutionLevel admin

; Interface Settings
!define MUI_ABORTWARNING
!define MUI_ICON "src\\textures\\icons\\icon.ico"
!define MUI_UNICON "src\\textures\\icons\\icon.ico"

; Pages
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; Uninstaller pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Language
!insertmacro MUI_LANGUAGE "English"

Section "Install"
    SetOutPath "$INSTDIR"
    
    ; Copy all files from the packaged game
    File /r "dist\shooter-x-win32-x64\*.*"
    
    ; Store installation folder
    WriteRegStr HKCU "Software\Shooter X" "" $INSTDIR
    
    ; Create uninstaller
    WriteUninstaller "$INSTDIR\Uninstall.exe"
    
    ; Create shortcuts
    CreateDirectory "$SMPROGRAMS\Shooter X"
    CreateShortcut "$SMPROGRAMS\Shooter X\Shooter X.lnk" "$INSTDIR\Shooter X.exe"
    CreateShortcut "$DESKTOP\Shooter X.lnk" "$INSTDIR\Shooter X.exe"
    
    ; Add uninstall information to Add/Remove Programs
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Shooter X" \
                     "DisplayName" "Shooter X"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Shooter X" \
                     "UninstallString" "$\"$INSTDIR\Uninstall.exe$\""
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Shooter X" \
                     "DisplayVersion" "1.2.0"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Shooter X" \
                     "Publisher" "Shooter X"
    
    ; Get installation size
    ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
    IntFmt $0 "0x%08X" $0
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Shooter X" \
                       "EstimatedSize" "$0"
SectionEnd

Section "Uninstall"
    ; Remove files and directories
    Delete "$INSTDIR\Uninstall.exe"
    RMDir /r "$INSTDIR"
    
    ; Remove shortcuts
    Delete "$SMPROGRAMS\Shooter X\Shooter X.lnk"
    RMDir "$SMPROGRAMS\Shooter X"
    Delete "$DESKTOP\Shooter X.lnk"
    
    ; Remove registry keys
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Shooter X"
    DeleteRegKey HKCU "Software\Shooter X"
SectionEnd 